from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from app.services.simulator_service import MissionSimulatorService

router = APIRouter(prefix="/simulator", tags=["Mission Simulator"])
service = MissionSimulatorService()


class SimulationRunRequest(BaseModel):
    mission_duration_sols: int = Field(600, ge=100, le=1200)
    crew_size: int = Field(4, ge=2, le=10)
    storage_regime: str = Field("CHILLED", description="CHILLED (4C) or AMBIENT (21C)")
    cooling_failure_sol: Optional[int] = Field(None, description="Sol when cooling loop fails (e.g. 150 or 450)")
    failure_duration_sols: int = Field(45, ge=5, le=200)
    failure_peak_temp_c: float = Field(29.5, ge=10.0, le=45.0)
    crop_failure_sol: Optional[int] = Field(None, description="Sol when crop pathogen outbreak occurs")
    crop_area_m2: float = Field(18.0, ge=0.0, le=100.0)
    ration_strategy: str = Field("NOMINAL_FULL", description="NOMINAL_FULL, CONSERVATION_15_PCT, SURVIVAL")


@router.post("/run")
def execute_mission_simulation(req: SimulationRunRequest):
    """
    Executes a high-fidelity dynamic Sol-by-Sol Mars mission life-support
    and food security simulation under user-configured environmental stresses.
    """
    return service.run_mission_simulation(
        mission_duration_sols=req.mission_duration_sols,
        crew_size=req.crew_size,
        storage_regime=req.storage_regime,
        cooling_failure_sol=req.cooling_failure_sol,
        failure_duration_sols=req.failure_duration_sols,
        failure_peak_temp_c=req.failure_peak_temp_c,
        crop_failure_sol=req.crop_failure_sol,
        crop_area_m2=req.crop_area_m2,
        ration_strategy=req.ration_strategy
    )
