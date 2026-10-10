import io
import os
import pytest
from datetime import datetime, timezone, timedelta
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceNotice
from app.services.storage_service import (
    get_storage_dir,
    delete_notice_images,
    cleanup_expired_notices_storage,
)

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def auth_headers(email: str) -> dict:
    token = create_access_token(subject=email)
    return {"Authorization": f"Bearer {token}"}

def create_sample_image(width=600, height=400, color="teal", format="PNG") -> bytes:
    """Generates an in-memory test image."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()

@pytest.fixture
def setup_workspace(db_session: Session):
    ts = datetime.now().strftime("%Y%m%d%H%M%S%f")
    
    # 1. Workspace owner (staff)
    owner_email = f"owner_{ts}@nexavault.edu"
    owner = User(email=owner_email, hashed_password=hash_password("pass"), full_name="Owner Staff", role="staff")
    db_session.add(owner)

    # 2. Unauthorized staff
    other_staff_email = f"other_{ts}@nexavault.edu"
    other_staff = User(email=other_staff_email, hashed_password=hash_password("pass"), full_name="Other Staff", role="staff")
    db_session.add(other_staff)

    # 3. Student
    student_email = f"student_{ts}@nexavault.edu"
    student = User(email=student_email, hashed_password=hash_password("pass"), full_name="Student", role="student")
    db_session.add(student)

    # Workspace
    ws_id = f"WS-NOTICE-{ts}"
    ws = Workspace(id=ws_id, name="Notice Test WS", term="Fall 2026", owner=owner, is_open=True)
    db_session.add(ws)

    # Add owner to workspace_staff
    ws_staff = WorkspaceStaff(workspace_id=ws_id, user=owner, role="owner")
    db_session.add(ws_staff)

    db_session.commit()

    return {
        "ws_id": ws_id,
        "owner_email": owner_email,
        "other_staff_email": other_staff_email,
        "student_email": student_email,
    }

def test_notice_creation_without_image(setup_workspace):
    ws_id = setup_workspace["ws_id"]
    headers = auth_headers(setup_workspace["owner_email"])

    response = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=headers,
        data={
            "title": "Text Notice",
            "body": "Notice content with no image.",
            "is_pinned": "false",
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Text Notice"
    assert data["body"] == "Notice content with no image."
    assert data["image_url"] is None
    assert data["thumbnail_url"] is None
    assert data["is_pinned"] is False
    assert "expires_at" in data

    # Verify 24h expiration
    created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
    expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
    diff_hours = (expires_at - created_at).total_seconds() / 3600
    assert abs(diff_hours - 24.0) < 0.1

def test_notice_creation_with_multipart_image(setup_workspace):
    ws_id = setup_workspace["ws_id"]
    headers = auth_headers(setup_workspace["owner_email"])

    image_bytes = create_sample_image(width=1600, height=1200, color="cyan")
    files = {
        "image": ("test_banner.png", image_bytes, "image/png"),
    }
    data = {
        "title": "Notice With Image",
        "body": "Checking direct image upload.",
        "is_pinned": "true",
    }

    response = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=headers,
        data=data,
        files=files,
    )
    assert response.status_code == 201
    res_data = response.json()
    assert res_data["title"] == "Notice With Image"
    assert res_data["is_pinned"] is True
    assert res_data["image_url"] is not None
    assert res_data["thumbnail_url"] is not None
    assert res_data["image_key"] is not None
    assert res_data["image_key"].endswith(".webp")

    # Verify image is stored on disk
    storage_dir = get_storage_dir()
    image_path = os.path.join(storage_dir, res_data["image_key"])
    assert os.path.exists(image_path)

    # Verify image can be fetched via endpoint
    img_resp = client.get(res_data["image_url"])
    assert img_resp.status_code == 200
    assert "image/webp" in img_resp.headers.get("content-type", "")
    assert "public" in img_resp.headers.get("cache-control", "")

    # Cleanup created files
    delete_notice_images(res_data["image_key"])

def test_image_validation_rejections(setup_workspace):
    ws_id = setup_workspace["ws_id"]
    headers = auth_headers(setup_workspace["owner_email"])

    # 1. Invalid file extension (.txt)
    response = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=headers,
        data={"title": "Invalid Type", "body": "Bad file type test."},
        files={"image": ("script.txt", b"plain text content", "text/plain")},
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]

    # 2. File size exceeds 5MB
    fake_large_bytes = b"0" * (6 * 1024 * 1024)
    response = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=headers,
        data={"title": "Too Large", "body": "Oversized file test."},
        files={"image": ("giant.png", fake_large_bytes, "image/png")},
    )
    assert response.status_code == 400
    assert "maximum limit" in response.json()["detail"]

def test_notice_listing_active_and_expired(setup_workspace, db_session: Session):
    ws_id = setup_workspace["ws_id"]
    headers = auth_headers(setup_workspace["owner_email"])

    now_utc = datetime.now(timezone.utc)

    # 1. Insert an active notice
    active_notice = WorkspaceNotice(
        workspace_id=ws_id,
        author_id=1,
        title="Active Notice",
        body="This is still active.",
        is_pinned=False,
        is_archived=False,
        created_at=now_utc - timedelta(hours=2),
        expires_at=now_utc + timedelta(hours=22),
    )
    db_session.add(active_notice)

    # 2. Insert an expired notice (expired 1 hour ago)
    expired_notice = WorkspaceNotice(
        workspace_id=ws_id,
        author_id=1,
        title="Expired Notice",
        body="This has expired.",
        is_pinned=True,  # Even if pinned, must be excluded!
        is_archived=False,
        created_at=now_utc - timedelta(hours=25),
        expires_at=now_utc - timedelta(hours=1),
    )
    db_session.add(expired_notice)
    db_session.commit()

    # Query notice list
    resp = client.get(f"/api/v1/workspaces/{ws_id}/notices", headers=headers)
    assert resp.status_code == 200
    notices = resp.json()
    titles = [n["title"] for n in notices]

    assert "Active Notice" in titles
    assert "Expired Notice" not in titles

def test_pinning_and_expiration(setup_workspace, db_session: Session):
    ws_id = setup_workspace["ws_id"]
    headers = auth_headers(setup_workspace["owner_email"])

    now_utc = datetime.now(timezone.utc)

    # Create active notice and pin it
    active = WorkspaceNotice(
        workspace_id=ws_id,
        author_id=1,
        title="Will Pin",
        body="Content",
        is_pinned=False,
        created_at=now_utc,
        expires_at=now_utc + timedelta(hours=24),
    )
    db_session.add(active)

    # Create expired notice
    expired = WorkspaceNotice(
        workspace_id=ws_id,
        author_id=1,
        title="Already Expired",
        body="Content",
        is_pinned=False,
        created_at=now_utc - timedelta(hours=30),
        expires_at=now_utc - timedelta(hours=6),
    )
    db_session.add(expired)
    db_session.commit()

    # Pin active notice -> succeeds
    pin_resp = client.post(f"/api/v1/workspaces/{ws_id}/notices/{active.id}/pin", headers=headers)
    assert pin_resp.status_code == 200
    assert pin_resp.json()["is_pinned"] is True

    # Attempt to pin expired notice -> blocked with 400
    pin_exp_resp = client.post(f"/api/v1/workspaces/{ws_id}/notices/{expired.id}/pin", headers=headers)
    assert pin_exp_resp.status_code == 400
    assert "Cannot pin an expired notice" in pin_exp_resp.json()["detail"]

def test_notice_deletion_and_image_cleanup(setup_workspace):
    ws_id = setup_workspace["ws_id"]
    headers = auth_headers(setup_workspace["owner_email"])

    # Create notice with image
    image_bytes = create_sample_image()
    post_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=headers,
        data={"title": "Delete Me", "body": "To be removed."},
        files={"image": ("todelete.png", image_bytes, "image/png")},
    )
    assert post_resp.status_code == 201
    notice_data = post_resp.json()
    notice_id = notice_data["id"]
    image_key = notice_data["image_key"]

    storage_dir = get_storage_dir()
    image_path = os.path.join(storage_dir, image_key)
    assert os.path.exists(image_path)

    # Delete the notice
    del_resp = client.delete(f"/api/v1/workspaces/{ws_id}/notices/{notice_id}", headers=headers)
    assert del_resp.status_code == 200

    # Verify notice is deleted
    get_resp = client.get(f"/api/v1/workspaces/{ws_id}/notices", headers=headers)
    notices = get_resp.json()
    assert all(n["id"] != notice_id for n in notices)

    # Verify image was deleted from disk
    assert not os.path.exists(image_path)

def test_expired_notice_storage_cleanup(setup_workspace, db_session: Session):
    ws_id = setup_workspace["ws_id"]
    headers = auth_headers(setup_workspace["owner_email"])

    # Create notice with image
    image_bytes = create_sample_image()
    post_resp = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=headers,
        data={"title": "Will Expire Cleanup", "body": "Testing automated storage purge."},
        files={"image": ("purge.png", image_bytes, "image/png")},
    )
    assert post_resp.status_code == 201
    notice_data = post_resp.json()
    notice_id = notice_data["id"]
    image_key = notice_data["image_key"]

    image_path = os.path.join(get_storage_dir(), image_key)
    assert os.path.exists(image_path)

    # Manually expire the notice in the DB
    notice = db_session.query(WorkspaceNotice).filter(WorkspaceNotice.id == notice_id).first()
    notice.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.commit()

    # Trigger expired notices cleanup
    cleaned_count = cleanup_expired_notices_storage(db_session)
    assert cleaned_count >= 1

    # Verify image was removed from disk
    assert not os.path.exists(image_path)

def test_workspace_authorization_rules(setup_workspace):
    ws_id = setup_workspace["ws_id"]
    other_headers = auth_headers(setup_workspace["other_staff_email"])
    student_headers = auth_headers(setup_workspace["student_email"])

    # Unauthorized staff cannot create notice
    resp1 = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=other_headers,
        data={"title": "Hacker Staff", "body": "Should fail."},
    )
    assert resp1.status_code in (403, 404)

    # Student cannot create notice
    resp2 = client.post(
        f"/api/v1/workspaces/{ws_id}/notices",
        headers=student_headers,
        data={"title": "Student Notice", "body": "Should fail."},
    )
    assert resp2.status_code in (401, 403, 404)
