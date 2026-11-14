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


@pytest.fixture(scope="module")
def severe_analysis():
    return service.get_analysis(service.preset_scenario("severe_cooling_failure"))


def test_cooling_failure_drives_a_cooling_nutrient_below_threshold(severe_analysis):
    """Severe preset (60 Sols, 30 °C peak): mildest searched failure where a C/B1 pool really crosses.
    The default (mild) Sol-150 failure brings B1 to ~10.04 mg vs the 10 mg threshold without crossing."""
    assert any(res.threshold_crossing_sol[n] is not None
               for res in severe_analysis.astronauts.values() for n in COOLING_NUTRIENTS)


def test_severe_preset_act_precedes_crossing(severe_analysis):
    for res in severe_analysis.astronauts.values():
        crossings = [res.threshold_crossing_sol[n] for n in COOLING_NUTRIENTS if res.threshold_crossing_sol[n] is not None]
        if crossings:
            assert res.first_status["ACT"] < min(crossings)


def test_scenario_presets_endpoint_and_param():
    r = client.get("/api/v1/health/scenarios")
    assert r.status_code == 200
    body = r.json()
    ids = [p["id"] for p in body["scenarios"]]
    assert ids == ["nominal", "mild_cooling_failure", "severe_cooling_failure"]
    for p in body["scenarios"]:
        assert p["scenario_type"] == "hypothetical stress test" and p["description"] and p["label"]
    assert service.preset_scenario("mild_cooling_failure") == CrewScenario()
    assert service.preset_scenario("nominal") == CrewScenario(failure_enabled=False).normalized()

    r = client.get("/api/v1/health/alerts", params={"scenario": "nominal"})
    assert r.status_code == 200
    assert r.json()["scenario"]["failure_enabled"] is False
    assert r.json()["scenario_preset"]["id"] == "nominal"
    r = client.get("/api/v1/health/crew", params={"scenario": "severe_cooling_failure", "sol": 200})
    assert r.status_code == 200
    assert r.json()["scenario"]["failure_duration_sols"] == 60
    assert r.json()["scenario_preset"]["scenario_type"] == "hypothetical stress test"
    assert client.get("/api/v1/health/astronaut/MS-03/timeline",
                      params={"scenario": "mild_cooling_failure"}).json()["scenario_preset"]["id"] == "mild_cooling_failure"
    assert client.get("/api/v1/health/crew", params={"scenario": "bogus"}).status_code == 422


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


# ---------------------------------------------------------------------------
# Destinations / forecast horizon (mission length only; the model is unchanged)
# ---------------------------------------------------------------------------
def test_destinations_listed_with_source_and_status():
    body = client.get("/api/v1/health/scenarios").json()
    dests = {d["id"]: d for d in body["destinations"]}
    assert set(dests) == {"earth_orbit", "moon", "mars"}
    assert body["default_destination"] == "mars"
    # Mars = the full simulated mission (default horizon, unchanged behaviour)
    assert dests["mars"]["horizon_sols"] == CrewScenario().mission_sols
    for d in dests.values():
        assert d["status"] in ("literature", "derived", "assumed")
        assert 1 <= d["horizon_sols"] <= CrewScenario().mission_sols
        if d["status"] == "assumed":
            assert d["source"] == "MODEL_ASSUMPTION"
    assert dests["earth_orbit"]["horizon_sols"] < dests["mars"]["horizon_sols"]
    assert dests["moon"]["horizon_sols"] < dests["earth_orbit"]["horizon_sols"]


def test_horizon_default_is_unchanged_behaviour():
    base = client.get("/api/v1/health/crew", params={"scenario": "severe_cooling_failure"}).json()
    full = client.get("/api/v1/health/crew", params={"scenario": "severe_cooling_failure",
                                                     "horizon_sols": CrewScenario().mission_sols}).json()
    assert base["sol"] == full["sol"] == CrewScenario().mission_sols - 1
    assert base["crew"] == full["crew"] and base["horizon"] == full["horizon"]
    a = client.get("/api/v1/health/alerts", params={"scenario": "severe_cooling_failure"}).json()
    assert a["sol"] == CrewScenario().mission_sols - 1


def test_horizon_caps_sol_and_does_not_change_model():
    short = client.get("/api/v1/health/crew", params={"scenario": "severe_cooling_failure", "horizon_sols": 190}).json()
    assert short["sol"] == 189 and short["horizon"]["last"]["sol"] == 189
    # same Sol without a horizon -> identical crew values (only the reporting window changes)
    same = client.get("/api/v1/health/crew", params={"scenario": "severe_cooling_failure", "sol": 189}).json()
    assert short["crew"] == same["crew"]
    capped = client.get("/api/v1/health/crew", params={"scenario": "nominal", "horizon_sols": 29, "sol": 300}).json()
    assert capped["sol"] == 28
    alerts = client.get("/api/v1/health/alerts", params={"scenario": "severe_cooling_failure", "horizon_sols": 190}).json()
    assert all(x["sol"] <= 189 for x in alerts["alerts"])
    assert client.get("/api/v1/health/crew", params={"horizon_sols": 0}).status_code == 422
    assert client.get("/api/v1/health/crew",
                      params={"horizon_sols": CrewScenario().mission_sols + 1}).status_code == 422


def test_horizon_summary_warning_and_whole_mission():
    mars = client.get("/api/v1/health/crew", params={"scenario": "severe_cooling_failure"}).json()["horizon"]
    fw = mars["first_warning"]
    assert fw is not None and not mars["vitamins_last_whole_mission"]
    assert fw["problem"]["sol"] > fw["warning"]["sol"]
    assert fw["lead_sols"] == fw["problem"]["sol"] - fw["warning"]["sol"]
    assert fw["problem"]["sol"] <= mars["last"]["sol"]
    # causal: the warning was raised by the assessed Sol
    assert fw["warning"]["sol"] <= mars["assessed"]["sol"]
    # per-astronaut vitamin rows cover C, B1 and D
    for p in mars["per_astronaut"]:
        assert set(p["vitamins"]) == {"vitamin_c", "thiamine_b1", "vitamin_d"}
    # a short mission ends before any forecast problem
    moon = client.get("/api/v1/health/crew", params={"scenario": "severe_cooling_failure", "horizon_sols": 29}).json()
    assert moon["horizon"]["first_warning"] is None
    assert moon["horizon"]["vitamins_last_whole_mission"] is True
    assert moon["horizon"]["cooling_failure"]["in_mission"] is False
    # day numbers use 1 Sol = 1.02749 days
    assert mars["horizon_days"] == round(mars["horizon_sols"] * 1.02749125)
