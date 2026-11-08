from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.services.prediction_service import PredictionService

router = APIRouter(prefix="/prediction", tags=["Prediction Engine"])
service = PredictionService()


class ShelfLifeRequest(BaseModel):
    food_id: str = Field("TH-001", description="Food ID, e.g. TH-001, FD-001, BIO-003")
    storage_temperature_c: float = Field(4.0, description="Temperature in Celsius")
    critical_nutrient: str = Field("thiamine_b1", description="Nutrient to monitor")
    degradation_threshold_pct: float = Field(50.0, ge=10.0, le=90.0)
    max_sols: int = Field(800, ge=100, le=2000)


class ExcursionRequest(BaseModel):
    food_id: str = Field("TH-001")
    excursion_sol: int = Field(150, ge=1, le=1000)
    excursion_duration_sols: int = Field(45, ge=1, le=300)
    baseline_temp_c: float = Field(4.0)
    excursion_temp_c: float = Field(28.0)
    total_sols: int = Field(600, ge=100, le=1200)


@router.post("/shelf-life")
def calculate_shelf_life(req: ShelfLifeRequest):
    try:
        return service.predict_food_shelf_life(
            food_id=req.food_id,
            storage_temperature_c=req.storage_temperature_c,
            critical_nutrient=req.critical_nutrient,
            degradation_threshold_pct=req.degradation_threshold_pct,
            max_sols=req.max_sols
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/cooling-failure-impact")
def calculate_failure_impact(req: ExcursionRequest):
    try:
        return service.simulate_temperature_excursion(
            food_id=req.food_id,
            excursion_sol=req.excursion_sol,
            excursion_duration_sols=req.excursion_duration_sols,
            baseline_temp_c=req.baseline_temp_c,
            excursion_temp_c=req.excursion_temp_c,
            total_sols=req.total_sols
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/thermal-sensitivity")
def get_thermal_sensitivity_matrix(food_id: str = "TH-001"):
    """
    Computes comparative shelf-life curves across standard storage regimes:
    Deep Freeze (-20C), Chilled (4C), Ambient (21C), and Cabin Overheat (32C).
    """
    regimes = [
        {"name": "Deep Freeze (-20°C)", "temp": -20.0},
        {"name": "Chilled Nominal (4°C)", "temp": 4.0},
        {"name": "Ambient Storage (21°C)", "temp": 21.0},
        {"name": "Cabin Overheat (32°C)", "temp": 32.0}
    ]
    results = []
    for r in regimes:
        pred = service.predict_food_shelf_life(food_id, r["temp"], max_sols=600)
        results.append({
            "regime": r["name"],
            "temperature_c": r["temp"],
            "half_life_sols": pred["half_life_sols"],
            "rate_constant_k": pred["rate_constant_k_per_day"],
            "drop_dead_sol": pred["drop_dead_sol"]
        })
    return {
        "food_id": food_id,
        "comparative_regimes": results
    }
