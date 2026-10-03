import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.user import User
from app.models.group import Group
from app.core.security import hash_password

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    # Re-create database tables clean for testing
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    # Seed 2 students and 1 teacher
    student1 = User(
        email="student1@nexavault.edu",
        hashed_password=hash_password("password123"),
        full_name="Alex Chen",
        role="student",
        is_active=True
    )
    student2 = User(
        email="student2@nexavault.edu",
        hashed_password=hash_password("password123"),
        full_name="Maya Lin",
        role="student",
        is_active=True
    )
    teacher = User(
        email="teacher@nexavault.edu",
        hashed_password=hash_password("password123"),
        full_name="Dr. Sarah Jenkins",
        role="teacher",
        is_active=True
    )
    db.add_all([student1, student2, teacher])
    db.commit()
    db.close()
    yield

def get_token(email: str, password: str = "password123") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]

def test_full_group_lifecycle():
    token_s1 = get_token("student1@nexavault.edu")
    headers_s1 = {"Authorization": f"Bearer {token_s1}"}

    token_s2 = get_token("student2@nexavault.edu")
    headers_s2 = {"Authorization": f"Bearer {token_s2}"}

    token_t = get_token("teacher@nexavault.edu")
    headers_t = {"Authorization": f"Bearer {token_t}"}

    # 1. Teacher attempts to create group -> 403 Forbidden
    res = client.post(
        "/api/v1/groups/",
        json={"name": "Teacher Group", "code": "TEACH-1"},
        headers=headers_t
    )
    assert res.status_code == 403

    # 2. Student 1 creates Group with custom code "ALPHA-101" -> 201 Created
    res = client.post(
        "/api/v1/groups/",
        json={
            "name": "Alpha Engine Vault",
            "code": "ALPHA-101",
            "workspace_code": "CS204-DSA",
            "project_title": "Storage Engine Core"
        },
        headers=headers_s1
    )
    assert res.status_code == 201, res.text
    group1 = res.json()
    assert group1["name"] == "Alpha Engine Vault"
    assert group1["code"] == "ALPHA-101"
    assert group1["is_leader"] is True
    assert len(group1["members"]) == 1
    assert group1["members"][0]["email"] == "student1@nexavault.edu"
    group1_id = group1["id"]

    # 3. Student 1 attempts to create duplicate group code -> 400 Bad Request
    res = client.post(
        "/api/v1/groups/",
        json={"name": "Duplicate Code Group", "code": "ALPHA-101"},
        headers=headers_s1
    )
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]

    # 4. Student 2 attempts to view Group 1 details before joining -> 403 Forbidden
    res = client.get(f"/api/v1/groups/{group1_id}", headers=headers_s2)
    assert res.status_code == 403

    # 5. Student 2 joins Group 1 using invalid code -> 404 Not Found
    res = client.post(
        "/api/v1/groups/join",
        json={"code": "WRONG-CODE"},
        headers=headers_s2
    )
    assert res.status_code == 404

    # 6. Student 2 joins Group 1 using valid code "ALPHA-101" -> 200 OK
    res = client.post(
        "/api/v1/groups/join",
        json={"code": "ALPHA-101"},
        headers=headers_s2
    )
    assert res.status_code == 200, res.text
    joined_group = res.json()
    assert len(joined_group["members"]) == 2
    member_emails = [m["email"] for m in joined_group["members"]]
    assert "student1@nexavault.edu" in member_emails
    assert "student2@nexavault.edu" in member_emails

    # 7. Student 2 attempts to join Group 1 again -> 400 Bad Request (duplicate membership)
    res = client.post(
        "/api/v1/groups/join",
        json={"code": "ALPHA-101"},
        headers=headers_s2
    )
    assert res.status_code == 400
    assert "already a member" in res.json()["detail"]

    # 8. Student 2 views Group 1 details -> 200 OK
    res = client.get(f"/api/v1/groups/{group1_id}", headers=headers_s2)
    assert res.status_code == 200
    assert res.json()["id"] == group1_id

    # 9. Student 2 attempts to delete Group 1 -> 403 Forbidden (only Leader can delete)
    res = client.delete(f"/api/v1/groups/{group1_id}", headers=headers_s2)
    assert res.status_code == 403

    # 10. Student 1 (Leader) attempts to leave Group 1 -> 400 Bad Request (Leader cannot leave)
    res = client.post(f"/api/v1/groups/{group1_id}/leave", headers=headers_s1)
    assert res.status_code == 400
    assert "Leader, you cannot leave" in res.json()["detail"]

    # 11. Student 2 leaves Group 1 -> 200 OK
    res = client.post(f"/api/v1/groups/{group1_id}/leave", headers=headers_s2)
    assert res.status_code == 200

    # Verify Student 2 is no longer in members list
    res = client.get(f"/api/v1/groups/{group1_id}", headers=headers_s1)
    assert len(res.json()["members"]) == 1

    # 12. Student 1 (Leader) deletes Group 1 -> 200 OK
    res = client.delete(f"/api/v1/groups/{group1_id}", headers=headers_s1)
    assert res.status_code == 200

    # 13. Fetching deleted group -> 404 Not Found
    res = client.get(f"/api/v1/groups/{group1_id}", headers=headers_s1)
    assert res.status_code == 404

    print("\n✅ ALL GROUP BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_group_lifecycle()
