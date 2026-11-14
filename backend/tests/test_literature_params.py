import math
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ml.crew_data import CrewScenario, generate_crew, retention_after, load_catalog, FOOD_CLASS
from app.ml.literature_check import run_checks, summary
from app.ml.params import REQUIRED_FIELDS, VALID_STATUS, load_params_file, param, sources
from app.ml.physiology import NUTRIENTS, VITAMIN_D, vitamin_d_decline_rate_per_day, vitamin_d_step

client = TestClient(app)
BACKEND = Path(__file__).resolve().parents[1]


# ---------------------------------------------------------------------------
# Parameter file
# ---------------------------------------------------------------------------
def test_params_file_loads_and_every_entry_has_source_and_status():
    data = load_params_file()
    srcs = sources()
    names = [e["name"] for e in data["parameters"]]
    assert len(names) == len(set(names)), "duplicate parameter names"
    for e in data["parameters"]:
        for f in REQUIRED_FIELDS:
            assert f in e, f"{e.get('name')} missing '{f}'"
        assert e["status"] in VALID_STATUS, e["name"]
        assert e["source"] in srcs, f"{e['name']} cites unknown source {e['source']}"
        assert e["note"], e["name"]
        if e["status"] == "literature":
            assert e["where_in_source"], f"{e['name']} is 'literature' but has no location in source"
            assert srcs[e["source"]]["doi_or_url"], e["name"]
        if e["status"] == "assumed":
            assert e["source"] == "MODEL_ASSUMPTION", e["name"]
    for sid, s in srcs.items():
        assert s["citation"] and s["access"], sid


def test_derived_values_match_their_formulas():
    assert param("vitamin_c.turnover_per_day") == pytest.approx(
        max(param("vitamin_c.catabolic_turnover_mg_day")) / param("vitamin_c.pool_max_mg"), rel=1e-4)
    assert param("thiamine_b1.turnover_per_day") == pytest.approx(
        math.log(2) / np.mean(param("thiamine_b1.half_life_days")), rel=1e-4)
    ref = param("kinetics.thiamine_b1.reference")
    for cls, k in param("kinetics.thiamine_b1.k_ref_per_day").items():
        assert k == pytest.approx(-math.log(ref["retention"][cls]) / ref["days"], rel=1e-4), cls
    vc = param("kinetics.vitamin_c.reference")
    assert param("kinetics.vitamin_c.k_ref_per_day") == pytest.approx(
        -math.log(1 - np.mean(vc["loss_fraction_range"])) / vc["days"], rel=1e-4)
    pre, post = param("vitamin_d.preflight_25ohd_nmol_l")["mean"], param("vitamin_d.postflight_25ohd_nmol_l")["mean"]
    assert param("vitamin_d.decline_rate_per_day_iss") == pytest.approx(
        math.log(pre / post) / np.mean(param("vitamin_d.iss_mission_days")), rel=1e-4)


def test_model_uses_parameter_file_values():
    assert NUTRIENTS["vitamin_c"]["pool_max_mg"] == param("vitamin_c.pool_max_mg")
    assert NUTRIENTS["thiamine_b1"]["turnover_per_day"] == param("thiamine_b1.turnover_per_day")
    assert VITAMIN_D["risk_threshold_nmol_l"] == param("vitamin_d.risk_threshold_nmol_l")
    # storage kinetics reproduce the literature endpoints at the reference temperature
    catalog = load_catalog()
    ref = param("kinetics.thiamine_b1.reference")
    for item, cls in FOOD_CLASS.items():
        assert retention_after("thiamine_b1", item, catalog, ref["temp_c"], ref["days"]) == pytest.approx(
            ref["retention"][cls], rel=1e-3)


# ---------------------------------------------------------------------------
# Vitamin D
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def crew_no_failure():
    return generate_crew(CrewScenario(failure_enabled=False))


def test_vitamin_d_declines_without_uv(crew_no_failure):
    col = VITAMIN_D["status_col"]
    for astronaut, g in crew_no_failure.crew_df.groupby("astronaut"):
        series = g.sort_values("sol")[col].to_numpy()
        assert np.all(np.diff(series) < 0), f"{astronaut}: 25-OH-D must decline every Sol without UV"
        assert series[-1] < series[0]


def test_vitamin_d_rate_calibrated_and_intake_dependent():
    vd = VITAMIN_D
    # ISS intake reproduces the measured decline rate
    assert vitamin_d_decline_rate_per_day(vd["iss_intake_ug_day"]) == pytest.approx(vd["decline_rate_per_day_iss"])
    # meeting NASA's requirement stops the decline; less intake declines faster
    assert vitamin_d_decline_rate_per_day(vd["requirement_ug_day"]) == 0.0
    assert vitamin_d_step(60.0, vd["requirement_ug_day"]) == pytest.approx(60.0)
    assert vitamin_d_decline_rate_per_day(0.0) > vitamin_d_decline_rate_per_day(10.0) > 0


def test_vitamin_d_independent_of_cooling_failure(crew_no_failure):
    col = VITAMIN_D["status_col"]
    with_failure = generate_crew(CrewScenario()).crew_df
    assert np.allclose(with_failure[col].to_numpy(), crew_no_failure.crew_df[col].to_numpy())


def test_vitamin_d_stream_does_not_change_other_draws(crew_no_failure):
    # vitamin D uses its own RNG stream: the original crew profile draws are unchanged by its addition
    p = crew_no_failure.profiles["CDR-01"]
    rng = np.random.default_rng(42)
    expected = [rng.normal(62, 5), rng.normal(6.7, 0.4), rng.normal(74, 8)]
    assert [p["hr_rest"], p["sleep_h"], p["body_mass_kg"]] == pytest.approx(expected)


# ---------------------------------------------------------------------------
# Literature check
# ---------------------------------------------------------------------------
def test_literature_check_runs():
    checks = run_checks()
    s = summary(checks)
    assert s["graded"] > 0 and s["passed"] + s["failed"] == s["graded"]
    for c in checks:
        assert c["source"] in sources(), c["check"]
        if c["kind"] == "calibration identity":
            assert c["passed"], f"calibration identity failed (implementation bug): {c['check']}"


def test_literature_check_script_prints_table():
    out = subprocess.run([sys.executable, "scripts/literature_check.py"], cwd=BACKEND, capture_output=True,
                         text=True, timeout=300)
    assert out.returncode == 0, out.stderr
    assert "LITERATURE RANGE CHECK" in out.stdout and "PASS" in out.stdout
    assert "PARAMETERS" in out.stdout


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def test_endpoint_parameters():
    r = client.get("/api/v1/health/parameters")
    assert r.status_code == 200
    body = r.json()
    for key in ("data_provenance", "parameter_sources", "parameters", "literature_check", "status_definitions"):
        assert key in body
    assert all(p["status"] in VALID_STATUS for p in body["parameters"])
    assert body["literature_check"]["summary"]["graded"] > 0


def test_endpoint_crew_has_vitamin_d_and_parameter_sources():
    body = client.get("/api/v1/health/crew", params={"sol": 300, "failure_enabled": "false"}).json()
    prov = body["parameter_sources"]
    assert prov["status_counts"]["literature"] > 0 and prov["sources"]
    assert "vitamin_d_meta" in body and body["vitamin_d_meta"]["uv_synthesis"] is False
    for member in body["crew"]:
        vd = member["vitamin_d"]
        assert vd["status_nmol_l"] < vd["preflight_nmol_l"]
        assert vd["pct_change_vs_preflight"] < 0
        assert VITAMIN_D["status_col"] in member["biomarker_z_scores"]


def test_vitamin_d_alert_has_explanation_and_supplement_recommendation():
    body = client.get("/api/v1/health/alerts", params={"failure_enabled": "false"}).json()
    vd_alerts = [a for a in body["alerts"] if a["nutrient"] == "vitamin_d"]
    assert vd_alerts, "expected vitamin D alerts in the 450-Sol no-UV mission"
    for a in vd_alerts:
        assert a["status_unit"] == "nmol/L" and a["risk_threshold"] == VITAMIN_D["risk_threshold_nmol_l"]
        assert "no UV" in a["message"]
        rec = a["recommendation"]
        assert rec is not None and rec["dose_ug_per_day"] > 0 and "supplement" in rec["food_name"]
        assert "servings/Sol" in a["action"]
