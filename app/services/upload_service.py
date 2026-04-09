from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from fastapi import HTTPException, UploadFile, status

from app.config import settings


@dataclass(slots=True)
class ValidatedUpload:
    filename: str
    content_type: str | None
    content: bytes
    size_bytes: int


def _normalize_extensions(allowed_extensions: Iterable[str] | None) -> set[str]:
    return {extension.lower() for extension in (allowed_extensions or settings.allowed_extensions_list)}


def validate_upload_extension(
    filename: str | None,
    *,
    allowed_extensions: Iterable[str] | None = None,
) -> str:
    normalized_extensions = _normalize_extensions(allowed_extensions)
    file_ext = Path(filename or "").suffix.lower()
    if file_ext not in normalized_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(sorted(normalized_extensions))}",
        )
    return file_ext


async def read_validated_upload(
    file: UploadFile,
    *,
    allowed_extensions: Iterable[str] | None = None,
    allowed_content_types: Iterable[str] | None = None,
    max_size_mb: int | None = None,
    chunk_size: int | None = None,
) -> ValidatedUpload:
    filename = file.filename or ""
    validate_upload_extension(filename, allowed_extensions=allowed_extensions)

    if allowed_content_types and file.content_type not in set(allowed_content_types):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type.",
        )

    resolved_max_size_mb = settings.MAX_UPLOAD_SIZE_MB if max_size_mb is None else max_size_mb
    max_size_bytes = resolved_max_size_mb * 1024 * 1024
    read_chunk_size = chunk_size if chunk_size is not None else settings.UPLOAD_READ_CHUNK_SIZE
    buffer = bytearray()

    while chunk := await file.read(read_chunk_size):
        buffer.extend(chunk)
        if len(buffer) > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size: {resolved_max_size_mb}MB",
            )

    return ValidatedUpload(
        filename=filename,
        content_type=file.content_type,
        content=bytes(buffer),
        size_bytes=len(buffer),
    )
