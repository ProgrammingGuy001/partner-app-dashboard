import boto3, uuid, os
from dotenv import load_dotenv
load_dotenv()

AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")
AWS_REGION = os.getenv("AWS_REGION")

s3_client = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=AWS_REGION
)

def upload_file_to_s3(file_content, filename, content_type):
    unique_filename = f"{uuid.uuid4()}_{filename}"

    s3_client.put_object(
        Bucket=AWS_S3_BUCKET,
        Key=unique_filename,
        Body=file_content,
        ContentType=content_type,
        
    )

    file_url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{unique_filename}"
    return file_url
