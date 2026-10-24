"""Local-disk file storage for school-uploaded assets (logos today; the
same save_image() is reusable for other image uploads later). Files land
under backend/uploads/, served back out via the /uploads static mount in
main.py. Swap this for an S3/R2-backed implementation behind the same
signature if a school's assets ever need to survive this machine dying."""

from pathlib import Path

from fastapi import HTTPException, UploadFile, status

UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"

ALLOWED_IMAGE_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
MAX_IMAGE_BYTES = 2 * 1024 * 1024  # 2MB — plenty for a logo, small enough to not need a CDN

ALLOWED_DOCUMENT_TYPES = {"application/pdf": "pdf"}
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024  # 10MB — comfortable for a scanned/typed exam paper

# A teacher attaching an exam paper or homework sheet just as often has a
# phone photo of it as a scanned PDF — accept either under one limit.
ALLOWED_DOCUMENT_OR_IMAGE_TYPES = {**ALLOWED_DOCUMENT_TYPES, **ALLOWED_IMAGE_TYPES}


def save_image(upload: UploadFile, *, subdir: str, base_name: str) -> str:
    """Validates and saves an image upload, returning its path relative to
    the uploads root (e.g. "schools/3/logo.png") — the caller builds the
    full public URL from settings.backend_url."""
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only PNG, JPEG, or WEBP images are allowed"
        )

    contents = upload.file.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image must be 2MB or smaller")

    extension = ALLOWED_IMAGE_TYPES[upload.content_type]
    directory = UPLOAD_ROOT / subdir
    directory.mkdir(parents=True, exist_ok=True)

    # Overwrite any previous file with this base name regardless of its old
    # extension, so a school switching from .png to .jpg doesn't leave a
    # stale logo.png lying around that nothing points to anymore.
    for existing in directory.glob(f"{base_name}.*"):
        existing.unlink()

    relative_path = f"{subdir}/{base_name}.{extension}"
    (directory / f"{base_name}.{extension}").write_bytes(contents)
    return relative_path


def save_document(upload: UploadFile, *, subdir: str, base_name: str) -> str:
    """Same pattern as save_image but for PDFs — e.g. an exam paper a
    teacher uploads instead of entering questions one by one."""
    if upload.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only PDF files are allowed")

    contents = upload.file.read(MAX_DOCUMENT_BYTES + 1)
    if len(contents) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be 10MB or smaller")

    extension = ALLOWED_DOCUMENT_TYPES[upload.content_type]
    directory = UPLOAD_ROOT / subdir
    directory.mkdir(parents=True, exist_ok=True)

    for existing in directory.glob(f"{base_name}.*"):
        existing.unlink()

    relative_path = f"{subdir}/{base_name}.{extension}"
    (directory / f"{base_name}.{extension}").write_bytes(contents)
    return relative_path


def save_document_or_image(upload: UploadFile, *, subdir: str, base_name: str) -> str:
    """Same pattern as save_document, but also accepts a phone photo of a
    paper (PNG/JPEG/WEBP) as an alternative to a scanned PDF."""
    if upload.content_type not in ALLOWED_DOCUMENT_OR_IMAGE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a PDF, PNG, JPEG, or WEBP file is allowed")

    contents = upload.file.read(MAX_DOCUMENT_BYTES + 1)
    if len(contents) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be 10MB or smaller")

    extension = ALLOWED_DOCUMENT_OR_IMAGE_TYPES[upload.content_type]
    directory = UPLOAD_ROOT / subdir
    directory.mkdir(parents=True, exist_ok=True)

    for existing in directory.glob(f"{base_name}.*"):
        existing.unlink()

    relative_path = f"{subdir}/{base_name}.{extension}"
    (directory / f"{base_name}.{extension}").write_bytes(contents)
    return relative_path
