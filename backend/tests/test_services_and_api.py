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


def test_literature_endpoint_comparison():
    """Catalog kinetics are compared with published endpoints read from literature_params.json."""
    service = PredictionService()
    val = service.compare_with_literature_endpoints()
    # 6 packaged items x (thiamine, vitamin C)
    assert val["total_benchmark_series"] == 12
    assert val["aggregate_r2_score"] is None  # single published endpoints: no R^2
    assert {r["id"] for r in val["references"]} == {"GOULETTE_2020", "COOPER_2017"}
    assert "synthetic" in val["data_provenance"]
    by_key = {(s["food_id"], s["nutrient"]): s for s in val["series"]}
    # Published endpoints come from the literature file: meat thiamine 3% after 720 d at 20 C
    salmon_b1 = by_key[("TH-001", "thiamine_b1")]["datapoints"][-1]
    assert salmon_b1["days"] == 720.0
    assert salmon_b1["measured_retention"] == 3.0
    # Verdict reflects the actual agreement, it is not hard-coded
    n_agree = sum(s["agrees_with_literature"] for s in val["series"])
    assert val["series_agreeing_with_literature"] == n_agree
    expected = "AGREES_WITH_LITERATURE" if n_agree == 12 else "DOES_NOT_MATCH_LITERATURE"
    assert val["validation_verdict"] == expected


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


def test_data_provenance_is_labeled():
    """Synthetic data is labeled in the API; unsupported compliance claims and the Ganja API are gone."""
    dash = client.get("/api/v1/dashboard/telemetry?sol=450&crew_size=4").json()
    assert "synthetic" in dash["data_provenance"]
    assert "nasa_std_3001_status" not in dash

    catalog = client.get("/api/v1/datalab/catalog").json()
    assert catalog["data_provenance"] == "synthetic"
    assert "standards_reference" not in catalog

    audit = client.get("/api/v1/datalab/audit").json()
    assert audit["data_provenance"] == "synthetic"
    assert not any("verified against USDA" in note for note in audit["audit_notes"])

    crops = client.get("/api/v1/dashboard/crop-status").json()
    assert crops["data_provenance"] == "synthetic"

    sim = client.post("/api/v1/simulator/run", json={"mission_duration_sols": 200}).json()
    assert "synthetic" in sim["data_provenance"]

    diet = client.post("/api/v1/optimization/solve-diet", json={"crew_size": 4}).json()
    assert "synthetic" in diet["data_provenance"]

    assert client.get("/api/v1/ganja/cultivars").status_code == 404
    assert not any("ganja" in e for e in client.get("/").json()["endpoints"])
