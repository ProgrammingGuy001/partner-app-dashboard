import requests
from fastapi import APIRouter, HTTPException, Request
from app.config import Settings
from app.utils.helpers import get_internal_headers

modulacare_url = Settings.ModulaCare_URL

router = APIRouter(prefix="/internal", tags=["internal"])


@router.get("/tickets")
def get_tickets(request: Request):
    headers = get_internal_headers(request)

    if not headers:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        response = requests.get(
            f"{modulacare_url}/api/v1/admin/tickets",
            headers=headers,
            timeout=5,
        )

        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch tickets: {str(e)}"
        )