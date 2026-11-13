import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ml import DATA_PROVENANCE
from app.ml.anomaly import analyze_crew, explain
from app.ml.crew_data import CrewScenario, generate_crew
from app.ml.physiology import NUTRIENTS, VITALS, sols_to_risk, personal_turnover
from app.services.crew_health_service import CrewHealthService

client = TestClient(app)
service = CrewHealthService()


@pytest.fixture(scope="module")
def default_analysis():
    return service.get_analysis(CrewScenario())


@pytest.fixture(scope="module")
def no_failure_analysis():
    return service.get_analysis(CrewScenario(failure_enabled=False))


def test_no_act_without_cooling_failure(no_failure_analysis):
    statuses = set(no_failure_analysis.timeline["status"])
    assert "ACT" not in statuses
    assert all(a["status"] != "ACT" for a in no_failure_analysis.alerts)
    for res in no_failure_analysis.astronauts.values():
        assert all(v is None for v in res.threshold_crossing_sol.values())


def test_no_watch_or_act_without_cooling_failure(no_failure_analysis):
    statuses = set(no_failure_analysis.timeline["status"])
    assert statuses <= {"CALIBRATING", "NOMINAL"}, statuses
    assert no_failure_analysis.alerts == []
    for res in no_failure_analysis.astronauts.values():
        assert res.first_status == {}


def test_act_raised_before_pool_crosses_threshold(default_analysis):
    crossed = 0
    for res in default_analysis.astronauts.values():
        crossings = [s for s in res.threshold_crossing_sol.values() if s is not None]
        if not crossings:
            continue
        crossed += 1
        assert "ACT" in res.first_status, f"{res.astronaut} crossed a threshold without an ACT alert"
        assert res.first_status["ACT"] < min(crossings)
    # default scenario (Sol-150 cooling failure) must drive at least one astronaut below threshold
    assert crossed >= 1


def test_baseline_window_zscores_are_near_zero(default_analysis):
    sc = default_analysis.data.scenario
    tl = default_analysis.timeline
    base = tl[tl.sol < sc.baseline_sols]
    for v in VITALS:
        z = base[f"z_{v}"].dropna()
        assert abs(z.mean()) < 0.5, v
        assert z.abs().max() < 2.0, v


def test_determinism_with_fixed_seed():
    a = generate_crew(CrewScenario(seed=7)).crew_df
    b = generate_crew(CrewScenario(seed=7)).crew_df
    c = generate_crew(CrewScenario(seed=8)).crew_df
    assert a.equals(b)
    assert not np.allclose(a["hr_rest"], c["hr_rest"])
    ra, rb = analyze_crew(generate_crew(CrewScenario(seed=7))), analyze_crew(generate_crew(CrewScenario(seed=7)))
    assert list(ra.timeline["status"]) == list(rb.timeline["status"])
    assert np.allclose(ra.timeline["anomaly_score"], rb.timeline["anomaly_score"])


def test_servings_positive_when_deficit(default_analysis):
    act_alerts = [a for a in default_analysis.alerts if a["status"] == "ACT"]
    assert act_alerts
    for a in act_alerts:
        assert a["intake_gap_mg_per_sol"] > 0
        assert a["recommendation"]["servings_per_sol"] > 0
        assert a["since_sol"] is not None and a["since_sol"] <= a["sol"]
        assert "servings/Sol" in a["action"]


def test_disabled_failure_normalizes_cache_key():
    a = service.build_scenario(failure_enabled=False, cooling_failure_sol=10, failure_peak_temp_c=40.0)
    b = service.build_scenario(failure_enabled=False)
    assert a == b and hash(a) == hash(b)


def test_forecast_and_turnover_math():
    cfg = NUTRIENTS["vitamin_c"]
    assert sols_to_risk(300.0, 100.0, 0.04, 400.0) == 0.0
    assert sols_to_risk(900.0, 500.0, 0.04, 400.0) == float("inf")
    s = sols_to_risk(900.0, 100.0, 0.04, 400.0)
    assert 100.0 + 800.0 * np.exp(-0.04 * s) == pytest.approx(400.0)
    # recover a known k from a synthetic uncapped trajectory
    k_true, intake = 0.05, np.full(60, 50.0)  # P_eq = 700 mg, below capacity
    pool = [1000.0]
    for i in range(1, 60):
        pool.append(pool[-1] * (1 - k_true) + cfg["absorption"] * intake[i])
    assert personal_turnover(np.array(pool), intake, cfg) == pytest.approx(k_true, rel=1e-6)


def test_endpoint_crew_snapshot():
    r = client.get("/api/v1/health/crew", params={"sol": 200})
    assert r.status_code == 200
    body = r.json()
    for key in ("data_provenance", "scenario", "events", "sol", "crew_status", "status_counts", "crew", "active_alerts"):
        assert key in body
    assert body["data_provenance"] == DATA_PROVENANCE
    assert body["sol"] == 200 and len(body["crew"]) == 4
    member = body["crew"][0]
    for key in ("astronaut_id", "status", "sols_to_risk", "top_driver", "vitals", "z_scores", "nutrients", "assessment"):
        assert key in member
    assert all(a["sol"] <= 200 for a in body["active_alerts"])


def test_endpoint_timeline_and_alerts():
    r = client.get("/api/v1/health/astronaut/MS-03/timeline")
    assert r.status_code == 200
    body = r.json()
    for key in ("data_provenance", "astronaut_id", "baseline", "timeline", "alerts", "threshold_crossing_sol", "events"):
        assert key in body
    assert len(body["timeline"]) == 450
    assert body["data_provenance"] == DATA_PROVENANCE

    assert client.get("/api/v1/health/astronaut/XX-99/timeline").status_code == 404

    r = client.get("/api/v1/health/alerts", params={"failure_enabled": "false"})
    assert r.status_code == 200
    body = r.json()
    for key in ("data_provenance", "scenario", "count", "alerts"):
        assert key in body
    assert body["scenario"]["failure_enabled"] is False
    assert all(a["status"] != "ACT" for a in body["alerts"])


def test_snapshot_assessment_is_causal(default_analysis):
    res = default_analysis.astronauts["MS-03"]
    act_sol = res.first_status["ACT"]
    e = explain(res, default_analysis.data, act_sol)
    assert e["status"] == "ACT"
    assert e["projected_risk_sol"] > act_sol
    assert explain(res, default_analysis.data, 5) is None  # still calibrating
