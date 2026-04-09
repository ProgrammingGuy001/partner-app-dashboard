from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy.orm import Session

from app.api.deps import get_verified_user
from app.database import get_db
from app.model.ip import ip
from app.schemas.ip import BankVerification, PANVerification, UserDetailResponse
from app.schemas.job import JobResponse
from app.crud.job import get_jobs_for_ip
from app.services.bank_service import BankService
from app.services.pan_service import PANService
from app.services.upload_service import read_validated_upload
from app.utils.rate_limiter import limiter

router = APIRouter(prefix="/verification", tags=["Verification"])


@router.post("/pan", response_model=UserDetailResponse)
@limiter.limit("5/hour")
def verify_pan(
    request: Request,
    pan_data: PANVerification,
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """Verify PAN card details"""

    # Check if already verified
    if current_user.is_pan_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PAN already verified for this user"
        )

    # Verify PAN using external API
    result = PANService.verify_pan(pan_data.pan)

    if not result["verified"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "PAN verification failed")
        )

    # Update user record
    current_user.is_pan_verified = True
    current_user.pan_number = result["pan_number"]
    current_user.pan_name = result.get("name")

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/bank", response_model=UserDetailResponse)
@limiter.limit("5/hour")
def verify_bank(
    request: Request,
    bank_data: BankVerification,
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """Verify bank account details"""

    # Check if already verified
    if current_user.is_bank_details_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bank account already verified for this user"
        )

    # Verify bank account using external API
    result = BankService.verify_bank_account(
        bank_data.account_number,
        bank_data.ifsc,
        bank_data.fetch_ifsc
    )

    if not result["verified"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Bank account verification failed")
        )

    # Update user record
    current_user.is_bank_details_verified = True
    current_user.account_number = result["account_number"]
    current_user.ifsc_code = result["ifsc_code"]
    current_user.account_holder_name = result.get("account_holder_name")

    db.commit()
    db.refresh(current_user)

    return current_user


@router.get("/status", response_model=UserDetailResponse)
def get_verification_status(
    current_user: ip = Depends(get_verified_user),
):
    """Get current verification status of the user"""

    return current_user


@router.post("/verify_document", response_model=UserDetailResponse)
@limiter.limit("5/hour")
async def upload_id_document(
    request: Request,
    file: UploadFile = File(...),
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Upload ID document for verification (requires admin approval)"""
    await read_validated_upload(
        file,
        allowed_extensions={".jpg", ".jpeg", ".png", ".pdf"},
        allowed_content_types={"image/jpeg", "image/jpg", "image/png", "application/pdf"},
        max_size_mb=5,
    )

    # TODO: Upload file to S3 or local storage
    # TODO: Save document reference to database
    # Note: is_id_verified remains False until admin manually verifies
    
    db.commit()
    db.refresh(current_user)
    
    return current_user





@router.get("/panel-access")
def check_panel_access(
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Check if user has completed all verifications"""

    all_verified = (
        current_user.is_verified and
        current_user.is_pan_verified and
        current_user.is_bank_details_verified and
        current_user.is_id_verified
    )

    # ✅ If verified, fetch jobs assigned to this user only
    if all_verified:
        jobs = get_jobs_for_ip(db, current_user.id)

        # Convert SQLAlchemy objects to dict using JobResponse for safety and completeness
        job_data = [JobResponse.model_validate(job).model_dump() for job in jobs]

        return {
            "has_full_access": True,
            "message": "All verifications complete",
            "jobs": job_data
        }

    # ❌ If not verified, return verification status
    return {
        "has_full_access": False,
        "verification_status": {
            "phone_verified": current_user.is_verified,
            "pan_verified": current_user.is_pan_verified,
            "bank_verified": current_user.is_bank_details_verified,
            "id_verified": current_user.is_id_verified
        },
        "message": "Please complete pending verifications"
    }
