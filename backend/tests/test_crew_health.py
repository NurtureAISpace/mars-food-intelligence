from dataclasses import replace

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ml import DATA_PROVENANCE
from app.ml.anomaly import (ACT_SOLS_TO_RISK, DRIVER_FORECAST, DRIVER_VITAL, WATCH_SOLS_TO_RISK, WATCH_Z,
                            analyze_astronaut, analyze_crew, explain)
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


NO_FAILURE_ALERTS_XFAIL = (
    "Known model finding (feature/literature-params-vitd): vitamin D declines without UV in every scenario "
    "(NASA's documented in-flight concern). Without a cooling failure the vitamin D forecast raises WATCH/ACT and "
    "MS-04 crosses 25 nmol/L at Sol 393 (supplement 3.7 ug/day vs 25 ug/day required). These are forecast-driven "
    "true positives, not cooling-related; vitamin C / B1 / vitals alerts without the failure are covered by "
    "test_no_cooling_nutrient_or_vital_alerts_without_failure. Not tuned away; see handoff report."
)
COOLING_NUTRIENTS = ("vitamin_c", "thiamine_b1")


@pytest.mark.xfail(strict=True, reason=NO_FAILURE_ALERTS_XFAIL)
def test_no_act_without_cooling_failure(no_failure_analysis):
    statuses = set(no_failure_analysis.timeline["status"])
    assert "ACT" not in statuses
    assert all(a["status"] != "ACT" for a in no_failure_analysis.alerts)
    for res in no_failure_analysis.astronauts.values():
        assert all(v is None for v in res.threshold_crossing_sol.values())


@pytest.mark.xfail(strict=True, reason=NO_FAILURE_ALERTS_XFAIL)
def test_no_watch_or_act_without_cooling_failure(no_failure_analysis):
    statuses = set(no_failure_analysis.timeline["status"])
    assert statuses <= {"CALIBRATING", "NOMINAL"}, statuses
    assert no_failure_analysis.alerts == []
    for res in no_failure_analysis.astronauts.values():
        assert res.first_status == {}


def test_no_cooling_nutrient_or_vital_alerts_without_failure(no_failure_analysis):
    """Without the event, no vitamin C / B1 alert, no crossing, and no vital-driven WATCH (slow drifts excluded)."""
    tl = no_failure_analysis.timeline
    flagged = tl[tl.status.isin(["WATCH", "ACT"])]
    assert set(flagged["driver_kind"]) <= {DRIVER_FORECAST}
    assert not set(flagged["driver_signal"]) & set(COOLING_NUTRIENTS)
    for res in no_failure_analysis.astronauts.values():
        assert all(res.threshold_crossing_sol[n] is None for n in COOLING_NUTRIENTS)


def test_act_raised_before_any_threshold_crossing(default_analysis):
    for res in default_analysis.astronauts.values():
        crossings = [s for s in res.threshold_crossing_sol.values() if s is not None]
        if crossings:
            assert "ACT" in res.first_status, f"{res.astronaut} crossed a threshold without an ACT alert"
            assert res.first_status["ACT"] < min(crossings)


@pytest.mark.xfail(strict=True, reason=(
    "Model finding after the steady-state calibration: the default Sol-150 cooling failure brings thiamine to "
    "10.04 mg (MS-03) and 10.10 mg (PLT-02) vs the 10 mg ASSUMED threshold, but no vitamin C / B1 pool crosses. "
    "ACT is still raised on the B1 forecast. Scenario not re-tuned to force a crossing; see handoff report."))
def test_cooling_failure_drives_a_cooling_nutrient_below_threshold(default_analysis):
    assert any(res.threshold_crossing_sol[n] is not None
               for res in default_analysis.astronauts.values() for n in COOLING_NUTRIENTS)


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
    for key in ("astronaut_id", "status", "sols_to_risk", "top_driver", "vitals", "z_scores", "nutrients", "assessment",
                "driver_kind", "driver_signal"):
        assert key in member
    for a in body["active_alerts"]:
        assert a["driver_kind"] in (DRIVER_FORECAST, DRIVER_VITAL) and a["driver_signal"]
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
    # "no ACT without cooling failure" is tracked by the strict-xfail test_no_act_without_cooling_failure
    assert all(a["status"] in ("WATCH", "ACT") for a in body["alerts"])


def _with_body_mass_change(data, astronaut, start_sol, delta_fn):
    crew = data.crew_df.copy()
    m = (crew.sol >= start_sol) & ((crew.astronaut == astronaut) if astronaut else True)
    crew.loc[m, "body_mass_kg"] += delta_fn(crew.loc[m, "sol"] - start_sol)
    return replace(data, crew_df=crew)


def test_alert_names_vital_driver_not_nearest_forecast():
    """Acute vital change while every nutrient forecast is far away: the alert names the vital, not vitamin D."""
    base = generate_crew(CrewScenario(failure_enabled=False))
    data = _with_body_mass_change(base, "MS-03", 100, lambda t: -2.0)
    g = data.crew_df[data.crew_df.astronaut == "MS-03"]
    res = analyze_astronaut(g, data)
    watch = res.first_status["WATCH"]
    assert 100 <= watch <= 110
    alert = next(a for a in res.alerts if a["sol"] == watch)
    assert alert["driver_kind"] == DRIVER_VITAL and alert["driver_signal"] == "body_mass_kg"
    assert alert["nutrient"] is None and alert["recommendation"] is None
    assert alert["sols_to_risk"] > WATCH_SOLS_TO_RISK          # nearest forecast (vitamin D) did not drive it
    assert alert["message"].startswith("Body mass")
    assert {c["nutrient"] for c in alert["nutrient_context"]} == {"vitamin_c", "thiamine_b1", "vitamin_d"}


def test_alert_driver_is_largest_contributor(default_analysis, no_failure_analysis):
    for analysis in (default_analysis, no_failure_analysis):
        for res in analysis.astronauts.values():
            fr = res.frame
            for a in res.alerts:
                row = fr.iloc[a["sol"]]
                forecast_ratio = np.inf if row["sols_to_risk"] <= 0 else WATCH_SOLS_TO_RISK / row["sols_to_risk"]
                vital_ratio = abs(row["driver_z"]) / WATCH_Z
                assert a["driver_kind"] == row["driver_kind"] and a["driver_signal"] == row["driver_signal"]
                if a["driver_kind"] == DRIVER_FORECAST:
                    assert a["status"] == "ACT" or forecast_ratio >= vital_ratio
                    assert a["nutrient"] == a["driver_signal"] == row["worst_nutrient"]
                    if a["status"] == "ACT":
                        assert row["sols_to_risk"] <= ACT_SOLS_TO_RISK
                else:
                    assert a["status"] == "WATCH" and vital_ratio > forecast_ratio
                    assert a["driver_signal"] == row["top_driver"] and abs(a["driver_z"]) >= WATCH_Z


def test_slow_expected_vital_drift_does_not_raise_watch():
    """A slow, sustained drift (-0.01 kg/Sol) is not a WATCH by itself; with a fixed baseline it reached |z| >= 2."""
    base = generate_crew(CrewScenario(failure_enabled=False))
    data = _with_body_mass_change(base, None, 40, lambda t: -0.01 * t)
    res = analyze_crew(data)
    tl = res.timeline
    assert not ((tl.status == "WATCH") & (tl.driver_kind == DRIVER_VITAL)).any()
    # the drift is real and large vs the fixed personal baseline (so this is not a vacuous pass)
    for r in res.astronauts.values():
        assert (r.frame["body_mass_kg"].iloc[-30:].mean() - r.baseline.mean["body_mass_kg"]) / r.baseline.sd["body_mass_kg"] < -4


def test_snapshot_assessment_is_causal(default_analysis):
    res = default_analysis.astronauts["MS-03"]
    act_sol = res.first_status["ACT"]
    e = explain(res, default_analysis.data, act_sol)
    assert e["status"] == "ACT"
    assert e["projected_risk_sol"] > act_sol
    assert explain(res, default_analysis.data, 5) is None  # still calibrating
