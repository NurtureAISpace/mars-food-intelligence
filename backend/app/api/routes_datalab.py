from fastapi import APIRouter
from app.pipeline.ingest import load_raw_catalog, process_and_audit_catalog
from app.services.prediction_service import PredictionService

router = APIRouter(prefix="/datalab", tags=["Data Laboratory"])
prediction_service = PredictionService()


@router.get("/catalog")
def get_food_catalog():
    """
    Returns full space food nutritional and kinetic catalog with physical units.
    """
    catalog = load_raw_catalog()
    return {
        "count": len(catalog),
        "standards_reference": "NASA-STD-3001 & USDA FoodData Spaceflight Inventory",
        "items": catalog
    }


@router.get("/audit")
def get_dataset_audit():
    """
    Returns data cleaning, schema validation, and scientific bounds audit report.
    """
    _, report = process_and_audit_catalog()
    return report.model_dump()


@router.get("/validation-benchmarks")
def get_model_validation_benchmarks():
    """
    Returns experimental NASA JSC spaceflight food degradation data
    and compares it with model predictions (computes RMSE and R^2).
    """
    return prediction_service.validate_against_experimental_benchmarks()
