import json

import pytest
from fastapi.testclient import TestClient

from app.api import routes_health
from app.main import app
from app.services.checkin_service import (CheckinIn, CheckinService, CheckinStore, classify, load_ranges,
                                          streak)

client = TestClient(app)

GREEN = dict(astronaut_id="TEST-01", sol=10, heart_rate_bpm=64, systolic_mmHg=112, diastolic_mmHg=72,
             blood_glucose_mg_dl=88, body_temp_c=36.7, sleep_hours=7.5, mood_1_5=4)
EXPECTED_INDICATORS = {"heart_rate", "blood_pressure", "blood_glucose", "body_temperature", "sleep", "mood"}


@pytest.fixture
def svc(tmp_path):
    return CheckinService(store=CheckinStore(tmp_path / "checkins.json"))


@pytest.fixture
def api_svc(tmp_path, monkeypatch):
    """Route the API to a temporary store (keeps backend/data/runtime clean), with the real crew service."""
    s = CheckinService(store=CheckinStore(tmp_path / "api_checkins.json"), crew_service=routes_health.service)
    monkeypatch.setattr(routes_health, "checkin_service", s)
    return s


def _eval(svc, prior=(), **overrides):
    return svc.evaluate(CheckinIn(**{**GREEN, **overrides}), list(prior))


def _ind(result, key):
    return next(i for i in result["indicators"] if i["key"] == key)


# --- validation --------------------------------------------------------------
@pytest.mark.parametrize("override", [
    {"heart_rate_bpm": 300}, {"heart_rate_bpm": 5}, {"systolic_mmHg": 400}, {"diastolic_mmHg": 10},
    {"blood_glucose_mg_dl": 5}, {"body_temp_c": 50}, {"body_temp_c": 25}, {"sleep_hours": 25},
    {"sleep_hours": -1}, {"mood_1_5": 0}, {"mood_1_5": 6}, {"sol": -1}, {"astronaut_id": ""},
    {"astronaut_id": "bad id!"}, {"notes": "x" * 501}, {"systolic_mmHg": 80, "diastolic_mmHg": 85},
])
def test_physically_impossible_values_rejected(api_svc, override):
    r = client.post("/api/v1/health/checkin", json={**GREEN, **override})
    assert r.status_code == 422


def test_missing_field_rejected(api_svc):
    body = {k: v for k, v in GREEN.items() if k != "blood_glucose_mg_dl"}
    assert client.post("/api/v1/health/checkin", json=body).status_code == 422


# --- colour rules ------------------------------------------------------------
@pytest.mark.parametrize("field,value,color", [
    ("heart_rate_bpm", 39, "red"), ("heart_rate_bpm", 40, "amber"), ("heart_rate_bpm", 49.9, "amber"),
    ("heart_rate_bpm", 50, "green"), ("heart_rate_bpm", 100, "green"), ("heart_rate_bpm", 101, "amber"),
    ("heart_rate_bpm", 120, "amber"), ("heart_rate_bpm", 121, "red"),
    ("systolic_mmHg", 79, "red"), ("systolic_mmHg", 90, "amber"), ("systolic_mmHg", 91, "green"),
    ("systolic_mmHg", 119, "green"), ("systolic_mmHg", 120, "amber"), ("systolic_mmHg", 139, "amber"),
    ("systolic_mmHg", 140, "red"),
    ("diastolic_mmHg", 60, "amber"), ("diastolic_mmHg", 61, "green"), ("diastolic_mmHg", 79, "green"),
    ("diastolic_mmHg", 80, "amber"), ("diastolic_mmHg", 90, "red"),
    ("blood_glucose_mg_dl", 53, "red"), ("blood_glucose_mg_dl", 54, "amber"), ("blood_glucose_mg_dl", 69, "amber"),
    ("blood_glucose_mg_dl", 70, "green"), ("blood_glucose_mg_dl", 99, "green"), ("blood_glucose_mg_dl", 100, "amber"),
    ("blood_glucose_mg_dl", 125, "amber"), ("blood_glucose_mg_dl", 126, "red"),
    ("body_temp_c", 34.9, "red"), ("body_temp_c", 35.0, "amber"), ("body_temp_c", 36.0, "green"),
    ("body_temp_c", 37.5, "green"), ("body_temp_c", 37.6, "amber"), ("body_temp_c", 38.0, "red"),
    ("sleep_hours", 5.9, "red"), ("sleep_hours", 6, "amber"), ("sleep_hours", 7, "green"), ("sleep_hours", 9, "green"),
    ("sleep_hours", 9.5, "amber"), ("sleep_hours", 10, "amber"), ("sleep_hours", 10.5, "red"),
    ("mood_1_5", 1, "red"), ("mood_1_5", 2, "amber"), ("mood_1_5", 3, "green"), ("mood_1_5", 5, "green"),
])
def test_threshold_colours(field, value, color):
    ind = next(i for i in load_ranges()["indicators"].values() if field in i["fields"])
    assert classify(value, ind["thresholds"][field])[0] == color


def test_blood_pressure_takes_worst_of_systolic_and_diastolic(svc):
    assert _ind(_eval(svc, systolic_mmHg=118, diastolic_mmHg=92), "blood_pressure")["status_color"] == "red"
    assert _ind(_eval(svc, systolic_mmHg=132, diastolic_mmHg=70), "blood_pressure")["status_color"] == "amber"
    assert _ind(_eval(svc), "blood_pressure")["display_value"] == "112/72 mmHg"


# --- overall status and escalation -------------------------------------------
def test_all_green_is_nominal(svc):
    r = _eval(svc)
    assert {i["key"] for i in r["indicators"]} == EXPECTED_INDICATORS
    assert r["overall"]["status"] == "NOMINAL" and not r["overall"]["contact_flight_surgeon"]
    assert all(not i["guidance"]["escalate_to_flight_surgeon"]["required"] for i in r["indicators"])


def test_amber_is_watch_without_escalation(svc):
    r = _eval(svc, sleep_hours=6.5)
    assert r["overall"]["status"] == "WATCH" and not r["overall"]["contact_flight_surgeon"]
    sleep = _ind(r, "sleep")
    assert sleep["status_color"] == "amber" and sleep["band"] == "amber_low"
    assert not sleep["guidance"]["escalate_to_flight_surgeon"]["required"]


@pytest.mark.parametrize("override,key", [
    ({"body_temp_c": 38.4}, "body_temperature"), ({"blood_glucose_mg_dl": 50}, "blood_glucose"),
    ({"systolic_mmHg": 150, "diastolic_mmHg": 95}, "blood_pressure"), ({"mood_1_5": 1}, "mood"),
    ({"heart_rate_bpm": 130}, "heart_rate"), ({"sleep_hours": 4}, "sleep"),
])
def test_any_red_is_act_and_escalates(svc, override, key):
    r = _eval(svc, **override)
    assert r["overall"]["status"] == "ACT" and r["overall"]["contact_flight_surgeon"]
    esc = _ind(r, key)["guidance"]["escalate_to_flight_surgeon"]
    assert esc["required"] and len(esc["reason"]) > 10


def test_every_indicator_has_plain_english_guidance(svc):
    for i in _eval(svc, body_temp_c=38.5)["indicators"]:
        g = i["guidance"]
        for k in ("how_to_measure", "why_it_matters_in_space", "what_to_do"):
            assert isinstance(g[k], str) and len(g[k]) > 10, (i["key"], k)
        assert g["hazard"] in {"radiation", "isolation and confinement", "gravity", "closed environment", "distance"}
        assert i["meaning"]


# --- personal baseline -------------------------------------------------------
def _priors(n, **vals):
    return [{**GREEN, **vals, "sol": s} for s in range(n)]


def test_baseline_needs_five_prior_entries(svc):
    r4 = _eval(svc, prior=_priors(4), sol=10)
    assert all(i["personal_baseline"]["status"] == "building" for i in r4["indicators"])
    assert "4/5" in _ind(r4, "heart_rate")["personal_baseline"]["message"]
    r5 = _eval(svc, prior=_priors(5), sol=10)
    assert all(i["personal_baseline"]["status"] == "ready" for i in r5["indicators"])


def test_baseline_only_uses_earlier_sols(svc):
    later = [{**GREEN, "sol": s} for s in range(20, 30)]
    r = _eval(svc, prior=later, sol=10)
    assert _ind(r, "heart_rate")["personal_baseline"]["status"] == "building"


def test_baseline_flag_in_green_range_gives_watch(svc):
    # resting HR always 55 -> 85 bpm is still green (50-100) but far from this astronaut's normal
    r = _eval(svc, prior=_priors(8, heart_rate_bpm=55), heart_rate_bpm=85)
    hr = _ind(r, "heart_rate")
    assert hr["status_color"] == "green"
    assert hr["personal_baseline"]["flag"] and "higher than your usual" in hr["personal_baseline"]["message"]
    assert r["overall"]["status"] == "WATCH"


def test_no_flag_within_personal_noise(svc):
    prior = [{**GREEN, "sol": s, "heart_rate_bpm": 60 + (s % 3)} for s in range(8)]
    r = _eval(svc, prior=prior, heart_rate_bpm=62)
    assert not _ind(r, "heart_rate")["personal_baseline"]["flag"]
    assert r["overall"]["status"] == "NOMINAL"


# --- sources -----------------------------------------------------------------
def test_every_threshold_has_a_source_and_status():
    ranges = load_ranges()
    sources = ranges["sources"]
    assert set(ranges["indicators"]) == EXPECTED_INDICATORS
    for key, ind in ranges["indicators"].items():
        assert set(ind["thresholds"]) == set(ind["fields"])
        for field, ths in ind["thresholds"].items():
            assert ths, (key, field)
            for t in ths:
                assert t["source"] in sources, (key, field, t)
                assert t["status"] in ("literature", "assumed")
                if t["source"] == "MODEL_ASSUMPTION":
                    assert t["status"] == "assumed", (key, field, t)
                else:
                    assert t["status"] == "literature" and t.get("where_in_source"), (key, field, t)
    for sid, s in sources.items():
        assert s["citation"] and s["access"]
        if sid != "MODEL_ASSUMPTION":
            assert s["doi_or_url"] and "http" in s["doi_or_url"], sid


def test_guidance_covers_every_reachable_band():
    for key, ind in load_ranges()["indicators"].items():
        g = ind["guidance"]
        bands = {"green"} | {f"{t['color']}_{'low' if t['direction'] == 'below' else 'high'}"
                             for ths in ind["thresholds"].values() for t in ths}
        for b in bands:
            assert b in g["meaning"] and b in g["what_to_do"], (key, b)
            if b.startswith("red"):
                assert b in g["escalate_reason"], (key, b)


# --- persistence, streak, API --------------------------------------------------
def test_store_persists_and_replaces_same_sol(tmp_path):
    path = tmp_path / "c.json"
    store = CheckinStore(path)
    store.upsert({**GREEN, "sol": 1})
    store.upsert({**GREEN, "sol": 1, "heart_rate_bpm": 70})
    store.upsert({**GREEN, "sol": 2})
    reloaded = CheckinStore(path).for_astronaut("TEST-01")
    assert [e["sol"] for e in reloaded] == [1, 2] and reloaded[0]["heart_rate_bpm"] == 70
    assert json.loads(path.read_text(encoding="utf-8"))["checkins"]


def test_corrupt_store_starts_empty(tmp_path):
    path = tmp_path / "c.json"
    path.write_text("{not json", encoding="utf-8")
    assert CheckinStore(path).for_astronaut("TEST-01") == []


def test_streak():
    assert streak([])["current_sols"] == 0
    assert streak([1, 2, 3])["current_sols"] == 3
    assert streak([1, 2, 5, 6])["current_sols"] == 2
    assert streak([3, 3, 4])["total_checkins"] == 2


def test_api_checkin_roundtrip(api_svc):
    for s in range(1, 7):
        r = client.post("/api/v1/health/checkin", json={**GREEN, "sol": s})
        assert r.status_code == 200
    d = r.json()
    assert d["disclaimer"] == "Decision-support prototype, not a medical device."
    assert d["streak"]["current_sols"] == 6
    assert _ind(d, "heart_rate")["personal_baseline"]["status"] == "ready"
    assert d["nutrition_link"] is None                       # not a simulated crew member
    h = client.get("/api/v1/health/checkins", params={"astronaut_id": "TEST-01"}).json()
    assert h["count"] == 6 and h["checkins"][-1]["overall_status"] == "NOMINAL"
    assert set(h["checkins"][-1]["colors"]) == EXPECTED_INDICATORS


def test_api_crew_member_gets_synthetic_baseline_and_nutrition_link(api_svc):
    r = client.post("/api/v1/health/checkin", json={**GREEN, "astronaut_id": "MS-03", "sol": 250})
    d = r.json()
    assert _ind(d, "heart_rate")["personal_baseline"]["status"] == "ready"      # synthetic Sols 0-20
    assert _ind(d, "blood_glucose")["personal_baseline"]["status"] == "building"
    link = d["nutrition_link"]
    assert link["active"] and link["nutrient"] == "thiamine_b1" and "Eat" in link["message"]


def test_api_guide(api_svc):
    g = client.get("/api/v1/health/checkin/guide").json()
    assert {i["key"] for i in g["indicators"]} == EXPECTED_INDICATORS
    assert all(i["how_to_measure"] and i["sources"] for i in g["indicators"])
    assert g["baseline"]["min_prior_entries"] == 5


# --- offline clients: client_id idempotency + measured_at ------------------------
CID = "3f2b8c1e-6a4d-4e2f-9b1a-0c7d5e8f9a10"


def test_api_same_client_id_is_deduplicated(api_svc):
    body = {**GREEN, "sol": 3, "client_id": CID, "measured_at": "2026-11-14T06:30:00Z"}
    r1 = client.post("/api/v1/health/checkin", json=body)
    assert r1.status_code == 200 and r1.json()["duplicate"] is False
    # retry (e.g. the response was lost) - even with a changed body, the stored record wins
    r2 = client.post("/api/v1/health/checkin", json={**body, "heart_rate_bpm": 130})
    assert r2.status_code == 200
    d1, d2 = r1.json(), r2.json()
    assert d2["duplicate"] is True and d2["record"] == d1["record"]
    assert d2["recorded_at"] == d1["recorded_at"] and d2["client_id"] == CID
    assert _ind(d2, "heart_rate")["value"] == GREEN["heart_rate_bpm"]
    h = client.get("/api/v1/health/checkins", params={"astronaut_id": "TEST-01"}).json()
    assert h["count"] == 1 and h["checkins"][0]["client_id"] == CID
    assert h["checkins"][0]["heart_rate_bpm"] == GREEN["heart_rate_bpm"]


def test_api_old_payload_without_client_id_still_works(api_svc):
    r = client.post("/api/v1/health/checkin", json={**GREEN, "sol": 4})
    assert r.status_code == 200
    d = r.json()
    assert d["duplicate"] is False and d["client_id"] is None and d["measured_at"] is None
    assert d["overall"]["status"] == "NOMINAL" == d["record"]["overall_status"]
    # resubmitting without client_id keeps the old behaviour: same Sol replaces, no dedupe needed
    assert client.post("/api/v1/health/checkin", json={**GREEN, "sol": 4, "heart_rate_bpm": 70}).status_code == 200
    h = client.get("/api/v1/health/checkins", params={"astronaut_id": "TEST-01"}).json()
    assert h["count"] == 1 and h["checkins"][0]["heart_rate_bpm"] == 70
    assert "client_id" not in h["checkins"][0] and "measured_at" not in h["checkins"][0]


def test_api_measured_at_is_stored_in_utc(api_svc):
    r = client.post("/api/v1/health/checkin",
                    json={**GREEN, "sol": 5, "client_id": CID, "measured_at": "2026-11-14T09:30:00+03:00"})
    assert r.json()["record"]["measured_at"] == "2026-11-14T06:30:00+00:00"
    naive = client.post("/api/v1/health/checkin",
                        json={**GREEN, "sol": 6, "client_id": CID + "-b", "measured_at": "2026-11-14T06:30:00"})
    assert naive.json()["measured_at"] == "2026-11-14T06:30:00+00:00"


def test_api_client_id_of_another_astronaut_conflicts(api_svc):
    assert client.post("/api/v1/health/checkin", json={**GREEN, "client_id": CID}).status_code == 200
    r = client.post("/api/v1/health/checkin", json={**GREEN, "astronaut_id": "TEST-02", "client_id": CID})
    assert r.status_code == 409
    assert client.get("/api/v1/health/checkins", params={"astronaut_id": "TEST-02"}).json()["count"] == 0


@pytest.mark.parametrize("bad", ["short", "bad id with spaces", "x" * 65, "-leading-dash-123"])
def test_api_invalid_client_id_rejected(api_svc, bad):
    assert client.post("/api/v1/health/checkin", json={**GREEN, "client_id": bad}).status_code == 422


def test_store_upsert_dedupes_client_id(tmp_path):
    store = CheckinStore(tmp_path / "c.json")
    first, dup = store.upsert({**GREEN, "sol": 1, "client_id": CID})
    assert dup is False
    again, dup = store.upsert({**GREEN, "sol": 2, "client_id": CID})
    assert dup is True and again["sol"] == 1
    assert [e["sol"] for e in store.for_astronaut("TEST-01")] == [1]


# --- pseudonym: anonymized code made on the Astronaut App (the name never leaves the device) ----
PSEUDO = "CREW-3FA2C1"


def test_api_pseudonym_accepted_and_returned(api_svc):
    """Seat ids of the Inspiration4 subjects (C001-C004) are valid crew ids; the code is stored and listed."""
    r = client.post("/api/v1/health/checkin",
                    json={**GREEN, "astronaut_id": "C001", "sol": 7, "client_id": CID, "pseudonym": PSEUDO})
    assert r.status_code == 200
    d = r.json()
    assert d["pseudonym"] == PSEUDO and d["record"]["pseudonym"] == PSEUDO
    h = client.get("/api/v1/health/checkins", params={"astronaut_id": "C001"}).json()
    assert h["pseudonym"] == PSEUDO and h["checkins"][0]["pseudonym"] == PSEUDO
    # a retry of the same client_id returns the stored code too
    assert client.post("/api/v1/health/checkin", json={**GREEN, "astronaut_id": "C001", "sol": 7,
                                                      "client_id": CID, "pseudonym": PSEUDO}).json()["pseudonym"] == PSEUDO


@pytest.mark.parametrize("bad", ["Ada Lovelace", "crew-3fa2c1", "CREW-3FA2C", "CREW-3FA2C1X", "CREW-GGGGGG",
                                 "3FA2C1", ""])
def test_api_invalid_pseudonym_rejected(api_svc, bad):
    r = client.post("/api/v1/health/checkin", json={**GREEN, "astronaut_id": "C002", "pseudonym": bad})
    assert r.status_code == 422
    assert client.get("/api/v1/health/checkins", params={"astronaut_id": "C002"}).json()["count"] == 0


def test_api_old_payload_without_pseudonym_still_works(api_svc):
    r = client.post("/api/v1/health/checkin", json={**GREEN, "sol": 8})
    assert r.status_code == 200 and r.json()["pseudonym"] is None
    h = client.get("/api/v1/health/checkins", params={"astronaut_id": "TEST-01"}).json()
    assert h["pseudonym"] is None and "pseudonym" not in h["checkins"][0]


# ---------------------------------------------------------------------------
# Hosted backend: CORS for the GitHub Pages site, demo seed on an empty store
# ---------------------------------------------------------------------------
def test_cors_allows_github_pages_only():
    pre = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}
    ok = client.options("/api/v1/health/checkin", headers={"Origin": "https://nurtureaispace.github.io", **pre})
    assert ok.status_code == 200
    assert ok.headers["access-control-allow-origin"] == "https://nurtureaispace.github.io"
    assert "access-control-allow-credentials" not in ok.headers
    get = client.get("/api/v1/health/checkin/guide", headers={"Origin": "https://nurtureaispace.github.io"})
    assert get.headers["access-control-allow-origin"] == "https://nurtureaispace.github.io"
    bad = client.get("/api/v1/health/checkin/guide", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in bad.headers


def test_demo_seed_only_when_store_empty(tmp_path):
    from app.services.demo_seed import seed_if_empty

    s = CheckinService(store=CheckinStore(tmp_path / "seed.json"), crew_service=routes_health.service)
    assert seed_if_empty(s) == 3
    by_seat = {a: s.history(a) for a in ("C001", "C002", "C003", "C004")}
    assert [by_seat[a]["count"] for a in ("C001", "C002", "C003", "C004")] == [1, 1, 1, 0]
    assert all(by_seat[a]["checkins"][0]["notes"] == "demo seed" for a in ("C001", "C002", "C003"))
    assert by_seat["C003"]["checkins"][0]["colors"]["sleep"] == "amber"
    assert seed_if_empty(s) == 0                                       # not empty any more: nothing added
    assert seed_if_empty(CheckinService(store=CheckinStore(tmp_path / "seed.json"))) == 0  # reloaded from the file
