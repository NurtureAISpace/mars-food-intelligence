from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from app.services.optimization_service import OptimizationService

router = APIRouter(prefix="/optimization", tags=["Optimization Engine"])
service = OptimizationService()


class DietOptimizationRequest(BaseModel):
    crew_size: int = Field(4, ge=1, le=12)
    mission_sol: int = Field(450, ge=0, le=1200)
    storage_temperature_c: float = Field(4.0)
    objective_mode: str = Field(
        "BALANCED_HEALTH",
        description="BALANCED_HEALTH, MINIMIZE_MASS, MINIMIZE_ENERGY, MAXIMIZE_MICRONUTRIENTS"
    )
    max_biomass_available_g: float = Field(1200.0, ge=0.0)
    max_rehydration_water_l: float = Field(8.0, ge=1.0)


@router.post("/solve-diet")
def solve_optimal_diet(req: DietOptimizationRequest):
    """
    Runs linear programming optimization via SciPy to determine the mathematically
    optimal daily crew ration plan meeting the daily nutrient targets (vitamin C/B1 from
    NASA JSC 2005; other targets assumed). Food values come from the synthetic catalog.
    """
    return service.optimize_daily_crew_diet(
        crew_size=req.crew_size,
        mission_sol=req.mission_sol,
        storage_temperature_c=req.storage_temperature_c,
        objective_mode=req.objective_mode,
        max_biomass_available_g=req.max_biomass_available_g,
        max_rehydration_water_l=req.max_rehydration_water_l
    )
