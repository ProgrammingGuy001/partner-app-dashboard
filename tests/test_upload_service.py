import os
import unittest
from io import BytesIO

from fastapi import HTTPException
from starlette.datastructures import UploadFile

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-minimum-length-12345")
os.environ.setdefault("SERVICE_SECRET_KEY", "test-service-secret-key-with-minimum-length-12345")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("AWS_REGION", "ap-south-1")
os.environ.setdefault("AWS_S3_BUCKET", "test-bucket")
os.environ.setdefault("RML_SMS_USERNAME", "test")
os.environ.setdefault("RML_SMS_PASSWORD", "test")
os.environ.setdefault("RML_SMS_SENDER_ID", "test")
os.environ.setdefault("RML_SMS_ENTITY_ID", "test")
os.environ.setdefault("RML_SMS_TEMPLATE_ID", "test")
os.environ.setdefault("ATTESTR_API_KEY", "test")
os.environ.setdefault("ModulaCare_URL", "https://example.com")

from app.services.upload_service import read_validated_upload


class UploadServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_reads_valid_upload(self):
        upload = UploadFile(filename="document.pdf", file=BytesIO(b"hello world"))

        result = await read_validated_upload(
            upload,
            allowed_extensions={".pdf"},
            max_size_mb=1,
            chunk_size=4,
        )

        self.assertEqual(result.filename, "document.pdf")
        self.assertEqual(result.content, b"hello world")
        self.assertEqual(result.size_bytes, 11)

    async def test_rejects_invalid_extension(self):
        upload = UploadFile(filename="document.exe", file=BytesIO(b"hello"))

        with self.assertRaises(HTTPException) as context:
            await read_validated_upload(upload, allowed_extensions={".pdf"})

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Invalid file type", context.exception.detail)

    async def test_rejects_oversized_upload(self):
        upload = UploadFile(filename="document.pdf", file=BytesIO(b"x" * 10))

        with self.assertRaises(HTTPException) as context:
            await read_validated_upload(
                upload,
                allowed_extensions={".pdf"},
                max_size_mb=0,
                chunk_size=2,
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("File too large", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
