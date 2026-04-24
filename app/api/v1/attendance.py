from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_fully_verified_user
from app.database import get_db
from app.model.attendance import DailyAttendance
from app.model.ip import ip
from app.schemas.attendance import DailyAttendanceResponse
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
from app.utils.attendance_policy import ensure_attendance_window_open

router = APIRouter(prefix="/dashboard/attendance", tags=["Dashboard Attendance"])


@router.post("", response_model=dict)
async def record_independent_attendance(
    phone: str | None = Form(None),
    latitude: float = Form(...),
    longitude: float = Form(...),
    manual_location: str | None = Form(None),
    photo: UploadFile = File(...),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Record IP attendance without tying it to a specific job."""
    ensure_attendance_window_open()

    attendance_phone = (current_user.phone_number or phone or "").strip()
    if not attendance_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated user phone number is required for attendance.",
        )

    upload = await read_validated_upload(photo)
    photo_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )

    record = DailyAttendance(
        job_id=None,
        phone=attendance_phone,
        latitude=latitude,
        longitude=longitude,
        manual_location=manual_location.strip() if manual_location else None,
        photo_url=photo_url,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "message": "Attendance recorded successfully",
        "attendance": DailyAttendanceResponse.model_validate(record),
    }


@router.get("", response_model=dict)
def get_independent_attendance(
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Return independent attendance records for the authenticated IP user."""
    phone = (current_user.phone_number or "").strip()
    if not phone:
        return {
            "message": "Attendance records fetched",
            "records": [],
        }

    records = (
        db.query(DailyAttendance)
        .filter(DailyAttendance.job_id.is_(None))
        .filter(DailyAttendance.phone == phone)
        .order_by(DailyAttendance.recorded_at.desc())
        .all()
    )
    return {
        "message": "Attendance records fetched",
        "records": [DailyAttendanceResponse.model_validate(r) for r in records],
    }
