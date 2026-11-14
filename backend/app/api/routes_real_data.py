from fastapi import APIRouter, HTTPException

from app.services.real_data_service import get_i4_payload

router = APIRouter(prefix="/real-data", tags=["Real NASA Data"])


@router.get("/i4")
def get_inspiration4_real_data():
    """REAL astronaut blood panels (NASA OSDR OSD-569 CBC + OSD-575 CMP, Inspiration4) scored against
    each crew member's own pre-flight baseline. All results are computed from the bundled CSV files."""
    try:
        return get_i4_payload()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
