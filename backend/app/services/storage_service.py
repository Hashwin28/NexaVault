import os
import io
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any
from PIL import Image, ImageOps
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

NOTICES_SUBDIR = "notices"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_DIMENSION = 1200
THUMB_DIMENSION = 400

def get_storage_dir() -> str:
    """Returns absolute path to notices storage directory, ensuring it exists."""
    target_dir = os.path.join(settings.UPLOAD_DIR, NOTICES_SUBDIR)
    os.makedirs(target_dir, exist_ok=True)
    return target_dir

def validate_image_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> Image.Image:
    """
    Validates file size, file extension, MIME type, and Pillow decodability.
    Raises HTTPException 400 on validation failure.
    """
    # 1. Size check
    if len(file_bytes) > settings.MAX_IMAGE_SIZE_BYTES:
        max_mb = settings.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image size exceeds the maximum limit of {max_mb:.0f}MB."
        )

    # 2. Extension check
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed formats: JPG, JPEG, PNG, WebP."
        )

    # 3. MIME check
    if content_type and content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid MIME type '{content_type}'. Must be image/jpeg, image/png, or image/webp."
        )

    # 4. Binary magic bytes and Pillow decode validation
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()  # Verifies file integrity
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is corrupted or not a valid image."
        )

    # Re-open image because verify() closes it
    img = Image.open(io.BytesIO(file_bytes))
    return img

def process_and_store_image(
    file_bytes: bytes,
    original_filename: str,
    content_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Validates, compresses, resizes, and stores the image + thumbnail.
    Returns dictionary with image_key, image_url, thumbnail_url, and metadata.
    """
    img = validate_image_file(file_bytes, original_filename, content_type)

    # Auto-orient based on EXIF if present
    img = ImageOps.exif_transpose(img)

    # Prepare storage directory
    storage_dir = get_storage_dir()
    unique_id = uuid.uuid4().hex
    full_key = f"{unique_id}.webp"
    thumb_key = f"{unique_id}_thumb.webp"

    full_path = os.path.join(storage_dir, full_key)
    thumb_path = os.path.join(storage_dir, thumb_key)

    # Convert mode to RGB or RGBA (if transparency present)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    target_mode = "RGBA" if has_alpha else "RGB"
    if img.mode != target_mode:
        img = img.convert(target_mode)

    # 1. Main image: resize if exceeds MAX_DIMENSION (1200px)
    main_img = img.copy()
    if main_img.width > MAX_DIMENSION or main_img.height > MAX_DIMENSION:
        main_img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

    main_img.save(full_path, "WEBP", quality=82, method=6)
    full_size = os.path.getsize(full_path)

    # 2. Thumbnail: resize to fit THUMB_DIMENSION (400px)
    thumb_img = img.copy()
    thumb_img.thumbnail((THUMB_DIMENSION, THUMB_DIMENSION), Image.Resampling.LANCZOS)
    thumb_img.save(thumb_path, "WEBP", quality=75, method=6)

    # Relative URLs served by the FastAPI router / static mount
    image_url = f"/api/v1/workspaces/notices/images/{full_key}"
    thumbnail_url = f"/api/v1/workspaces/notices/images/{thumb_key}"

    return {
        "image_key": full_key,
        "image_url": image_url,
        "thumbnail_url": thumbnail_url,
        "metadata": {
            "original_name": original_filename,
            "width": main_img.width,
            "height": main_img.height,
            "size_bytes": full_size,
            "format": "webp"
        }
    }

def delete_notice_images(image_key: Optional[str]) -> bool:
    """
    Deletes the main image and its associated thumbnail from disk.
    Safe against non-existent files.
    """
    if not image_key:
        return False

    # Prevent path traversal
    safe_filename = os.path.basename(image_key)
    storage_dir = get_storage_dir()
    full_path = os.path.join(storage_dir, safe_filename)

    # Find thumbnail name by inserting _thumb before extension
    base, ext = os.path.splitext(safe_filename)
    thumb_path = os.path.join(storage_dir, f"{base}_thumb{ext}")

    deleted = False
    for p in (full_path, thumb_path):
        try:
            if os.path.exists(p):
                os.remove(p)
                deleted = True
        except Exception:
            pass

    return deleted

def cleanup_expired_notices_storage(db) -> int:
    """
    Finds notices that have reached expires_at or are archived,
    and removes their associated image files from disk.
    Also clears their image_key/image_url in the database to prevent orphaned records.
    """
    from app.models.workspace import WorkspaceNotice
    now_utc = datetime.now(timezone.utc)

    expired_notices = (
        db.query(WorkspaceNotice)
        .filter(
            WorkspaceNotice.image_key.isnot(None),
            (WorkspaceNotice.expires_at <= now_utc) | (WorkspaceNotice.is_archived == True)
        )
        .all()
    )

    count = 0
    for notice in expired_notices:
        if notice.image_key:
            delete_notice_images(notice.image_key)
            notice.image_key = None
            notice.image_url = None
            notice.thumbnail_url = None
            count += 1

    if count > 0:
        db.commit()

    return count
