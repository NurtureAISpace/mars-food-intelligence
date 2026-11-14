"""GET /api/v1/real-data/i4: REAL Inspiration4 data (NASA OSDR OSD-569 CBC + OSD-575 CMP).

Results must be computed from the CSV files, never hardcoded: values are cross-checked against the raw CSVs
read independently here, and toy CSVs with a planted shift must change the reported finding.
"""

import csv
import math
import statistics

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ml import i4_baseline as i4
from app.services.real_data_service import build_payload

client = TestClient(app)


@pytest.fixture(scope="module")
def payload():
    r = client.get("/api/v1/real-data/i4")
    assert r.status_code == 200
    return r.json()


def _raw_rows(panel):
    with open(i4.PANEL_FILES[panel], encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _raw_value(panel, subject, analyte, timepoint):
    tcol = "TEST_DATE" if panel == "CBC" else "timepoint"
    for row in _raw_rows(panel):
        if row["SUBJECT_ID"] == subject and row["ANALYTE"] == analyte and row[tcol] == timepoint:
            return float(row["VALUE"])
    raise KeyError((panel, subject, analyte, timepoint))


def _series(payload, astronaut, analyte):
    return next(s for s in payload["series"] if s["astronaut"] == astronaut and s["analyte"] == analyte)


def test_endpoint_shape(payload):
    assert {"source", "crew", "timepoints", "analytes", "series", "summary", "limitations"} <= payload.keys()
    assert set(payload["source"]["osd_ids"]) == {"OSD-569", "OSD-575"}
    assert payload["source"]["license"] == "NASA OSDR open data"
    assert all(u["url"].startswith("https://osdr.nasa.gov/") for u in payload["source"]["urls"])
    assert [c["id"] for c in payload["crew"]] == ["C001", "C002", "C003", "C004"]
    assert [t["id"] for t in payload["timepoints"]] == i4.PRE_FLIGHT + i4.POST_FLIGHT
    a = next(x for x in payload["analytes"] if x["name"] == "MCV")
    assert a["unit"] == "fL" and a["reference_range"] == {"low": 80.0, "high": 100.0}
    assert payload["default_analyte"] == "MCV"
    assert {"shared_finding", "noise_control", "flags_per_timepoint"} <= payload["summary"].keys()
    assert {lim["key"] for lim in payload["limitations"]} >= {"small_crew", "few_baseline_points", "short_mission"}


def test_series_values_and_baseline_come_from_csv(payload):
    s = _series(payload, "C001", "MCV")
    by_tp = {p["timepoint"]: p for p in s["points"]}
    for tp in i4.PRE_FLIGHT + i4.POST_FLIGHT:
        assert by_tp[tp]["value"] == pytest.approx(_raw_value("CBC", "C001", "MCV", tp))
    pre = [_raw_value("CBC", "C001", "MCV", tp) for tp in i4.PRE_FLIGHT]
    assert s["baseline"]["mean"] == pytest.approx(statistics.mean(pre), abs=1e-3)
    # z for a post-flight point = (value - mean) / sd_used, flagged iff |z| > 2; no z on baseline points
    sd = s["baseline"]["sd"]
    r1 = by_tp["R+1"]
    assert r1["z"] == pytest.approx((r1["value"] - statistics.mean(pre)) / sd, abs=0.01)
    assert r1["flagged"] == (abs(r1["z"]) > i4.FLAG_Z)
    assert all(by_tp[tp]["z"] is None for tp in i4.PRE_FLIGHT)
    # a CMP analyte too (the CMP file uses a different timepoint column name)
    na = _series(payload, "C002", "SODIUM")
    assert {p["timepoint"]: p["value"] for p in na["points"]}["R+1"] == _raw_value("CMP", "C002", "SODIUM", "R+1")


def test_summary_is_consistent_with_series(payload):
    s = payload["summary"]
    r1_points = [p for ser in payload["series"] for p in ser["points"] if p["timepoint"] == "R+1"]
    assert s["noise_control"]["flight_flagged"] == sum(p["flagged"] for p in r1_points)
    assert s["noise_control"]["flight_tests"] == sum(p["z"] is not None for p in r1_points)

    sf = s["shared_finding"]
    assert sf is not None and sf["n_crew_flagged"] == sf["n_crew"] == len(payload["crew"])
    for row in sf["per_astronaut"]:
        p = next(p for p in _series(payload, row["astronaut"], sf["analyte"])["points"] if p["timepoint"] == "R+1")
        assert p["flagged"] and math.copysign(1, p["z"]) == (-1 if sf["direction"] == "down" else 1)
        assert row["value"] == p["value"]
    nc = s["noise_control"]
    assert nc["control_pct"] == pytest.approx(100 * nc["control_flagged"] / nc["control_tests"], abs=0.1)


# --- toy data: the finding must follow the data ------------------------------------------------------------
CREW = [("C001", "M"), ("C002", "F"), ("C003", "F"), ("C004", "M")]
PRE = {"L-92": 0.0, "L-44": 1.0, "L-3": -1.0}
POST = ["R+1", "R+45", "R+82", "R+194"]


def _write_toy(path, glucose_r1_shift, sodium_r1_shift):
    """Two analytes, 4 crew, flat baselines; R+1 shifted by the given amounts, later points back to normal."""
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ANALYTE", "VALUE", "RANGE_MIN", "RANGE_MAX", "UNITS", "TEST_TYPE", "SUBJECT_ID", "SEX", "TEST_DATE"])
        for subj, sex in CREW:
            for analyte, base, lo, hi, unit, shift in (("GLUCOSE", 90.0, 65, 99, "mg/dL", glucose_r1_shift),
                                                       ("SODIUM", 140.0, 135, 146, "mmol/L", sodium_r1_shift)):
                for tp, d in PRE.items():
                    w.writerow([analyte, base + d, lo, hi, unit, "TOY", subj, sex, tp])
                for tp in POST:
                    w.writerow([analyte, base + (shift if tp == "R+1" else 0.0), lo, hi, unit, "TOY", subj, sex, tp])


def test_shared_finding_follows_planted_shift(tmp_path):
    p = tmp_path / "toy.csv"
    _write_toy(p, glucose_r1_shift=+15.0, sodium_r1_shift=0.0)
    sf = build_payload({"CBC": p})["summary"]["shared_finding"]
    assert sf["analyte"] == "GLUCOSE" and sf["direction"] == "up" and sf["n_crew_flagged"] == 4

    _write_toy(p, glucose_r1_shift=0.0, sodium_r1_shift=-8.0)
    sf = build_payload({"CBC": p})["summary"]["shared_finding"]
    assert sf["analyte"] == "SODIUM" and sf["direction"] == "down"


def test_no_shared_finding_when_nothing_shifts(tmp_path):
    p = tmp_path / "toy.csv"
    _write_toy(p, glucose_r1_shift=0.0, sodium_r1_shift=0.0)
    out = build_payload({"CBC": p})
    assert out["summary"]["shared_finding"] is None
    assert out["summary"]["noise_control"]["flight_flagged"] == 0
    assert out["default_analyte"] == "GLUCOSE"  # MCV absent -> first available analyte


def test_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        build_payload({"CBC": tmp_path / "nope.csv"})
