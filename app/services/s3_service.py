from functools import lru_cache
from pathlib import Path
import boto3
import uuid

from app.config import settings


@lru_cache(maxsize=1)
def get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def upload_file_to_s3(file_content: bytes, filename: str, content_type: str | None) -> str:
    safe_filename = Path(filename).name if filename else "upload.bin"
    unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"

    get_s3_client().put_object(
        Bucket=settings.AWS_S3_BUCKET,
        Key=unique_filename,
        Body=file_content,
        ContentType=content_type or "application/octet-stream",
    )

    file_url = (
        f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{unique_filename}"
    )
    return file_url
