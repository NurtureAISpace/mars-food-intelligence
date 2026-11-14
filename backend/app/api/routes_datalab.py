from fastapi import APIRouter
from app.pipeline.ingest import load_raw_catalog, load_catalog_meta, process_and_audit_catalog
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
        "data_provenance": load_catalog_meta()["data_provenance"],
        "dataset_meta": load_catalog_meta(),
        "items": catalog
    }


@router.get("/audit")
def get_dataset_audit():
    """
    Returns schema validation and physical-bounds audit report for the (synthetic) catalog.
    """
    _, report = process_and_audit_catalog()
    return {**report.model_dump(), "data_provenance": load_catalog_meta()["data_provenance"]}


@router.get("/validation-benchmarks")
def get_model_validation_benchmarks():
    """
    Compares the catalog's synthetic Arrhenius kinetics with published spaceflight-food
    retention endpoints (Goulette et al. 2020 thiamine; Cooper et al. 2017 vitamin C).
    """
    return prediction_service.compare_with_literature_endpoints()
