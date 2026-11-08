"""
API router for Ganja Agro-Biotechnological BLSS Subsystem.
Integrates ADAU Ganja cultivars, phytotron yields, and regolith remediation models.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from app.services.ganja_agri_service import GanjaAgriService

router = APIRouter(prefix="/ganja", tags=["Ganja Agro-BLSS"])


class ChamberSimulationRequest(BaseModel):
    crew_size: int = Field(default=4, ge=1, le=12)
    sol_duration: int = Field(default=450, ge=10, le=1200)
    chamber_allocation: Optional[Dict[str, float]] = Field(
        default=None,
        description="Cultivar ID to area in m2 mapping (e.g. {'GHM-01': 8.0, 'GC-26': 10.0})"
    )


@router.get("/cultivars")
def get_cultivars():
    """Retrieve all Ganja ADAU cultivars and their biochemical parameters."""
    return {
        "institution": "Azerbaijan State Agricultural University (ADAU), Ganja",
        "regional_lead": "Ganja Agro-Biotech Space Nutrition Laboratory",
        "count": len(GanjaAgriService.get_all_cultivars()),
        "cultivars": GanjaAgriService.get_all_cultivars(),
    }


@router.post("/simulate-blss")
def simulate_blss(req: ChamberSimulationRequest):
    """
    Run closed-loop bioregenerative life support simulation for Ganja crops
    over mission duration.
    """
    try:
        results = GanjaAgriService.simulate_chamber_suite(
            crew_size=req.crew_size,
            sol_duration=req.sol_duration,
            chamber_allocation=req.chamber_allocation,
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
