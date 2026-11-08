import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.prediction_service import PredictionService
from app.services.optimization_service import OptimizationService
from app.services.simulator_service import MissionSimulatorService
from app.pipeline.ingest import process_and_audit_catalog

client = TestClient(app)


def test_data_pipeline_audit():
    items, report = process_and_audit_catalog()
    assert len(items) >= 8
    assert report.missing_fields_count == 0
    assert report.data_quality_score_pct == 100.0
    assert report.scientific_bounds_passed is True


def test_prediction_service_shelf_life():
    service = PredictionService()
    result = service.predict_food_shelf_life("TH-001", storage_temperature_c=4.0, max_sols=500)
    assert result["food_id"] == "TH-001"
    assert result["half_life_sols"] > 300
    assert len(result["retention_curve"]) > 10


def test_prediction_model_validation_benchmark_accuracy():
    service = PredictionService()
    val = service.validate_against_experimental_benchmarks()
    # High statistical accuracy benchmark check: R^2 > 0.95
    assert val["aggregate_r2_score"] >= 0.90
    assert val["aggregate_rmse"] < 6.0
    assert val["validation_verdict"] == "VERIFIED_ACCURATE"


def test_optimization_service_scipy_diet():
    service = OptimizationService()
    result = service.optimize_daily_crew_diet(crew_size=4, objective_mode="BALANCED_HEALTH")
    assert result["success"] is True
    # Ensure all NASA minimums satisfied
    metrics = result["optimal_daily_metrics"]
    assert metrics["total_calories_kcal"] >= 4 * 2500
    assert metrics["total_protein_g"] >= 4 * 65
    assert metrics["total_vitamin_c_mg"] >= 4 * 75
    assert len(result["allocated_food_plan"]) > 0


def test_mission_simulator_baseline_vs_failure():
    service = MissionSimulatorService()
    # Nominal run
    baseline = service.run_mission_simulation(mission_duration_sols=450, crew_size=4, storage_regime="CHILLED")
    assert baseline["summary_metrics"]["mission_survived"] is True

    # Cooling failure run at Sol 150
    failure = service.run_mission_simulation(
        mission_duration_sols=450,
        crew_size=4,
        storage_regime="CHILLED",
        cooling_failure_sol=150,
        failure_duration_sols=50,
        failure_peak_temp_c=32.0
    )
    # Failure run should have lower minimum food security index
    assert failure["summary_metrics"]["minimum_food_security_index"] < baseline["summary_metrics"]["minimum_food_security_index"]
    assert len(failure["critical_advisories"]) > 0


def test_api_endpoints():
    # Root
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "OPERATIONAL"

    # Dashboard
    res = client.get("/api/v1/dashboard/telemetry?sol=450&crew_size=4")
    assert res.status_code == 200
    assert "food_security_index_pct" in res.json()

    # DataLab
    res = client.get("/api/v1/datalab/catalog")
    assert res.status_code == 200
    assert res.json()["count"] > 0

    # Prediction API
    res = client.post("/api/v1/prediction/shelf-life", json={
        "food_id": "TH-001",
        "storage_temperature_c": 4.0,
        "critical_nutrient": "thiamine_b1",
        "degradation_threshold_pct": 50.0,
        "max_sols": 600
    })
    assert res.status_code == 200
    assert res.json()["drop_dead_sol"] > 0

    # Optimization API
    res = client.post("/api/v1/optimization/solve-diet", json={
        "crew_size": 4,
        "mission_sol": 450,
        "storage_temperature_c": 4.0,
        "objective_mode": "BALANCED_HEALTH",
        "max_biomass_available_g": 1200.0,
        "max_rehydration_water_l": 8.0
    })
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Simulator API
    res = client.post("/api/v1/simulator/run", json={
        "mission_duration_sols": 450,
        "crew_size": 4,
        "storage_regime": "CHILLED",
        "cooling_failure_sol": 200,
        "failure_duration_sols": 30,
        "failure_peak_temp_c": 30.0,
        "crop_area_m2": 18.0,
        "ration_strategy": "NOMINAL_FULL"
    })
    assert res.status_code == 200
    assert "telemetry_timeline" in res.json()
