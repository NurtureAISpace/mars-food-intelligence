"""
REAL NASA data (Inspiration4, NASA OSDR OSD-569 CBC + OSD-575 CMP) -> JSON for the "Real NASA Data" view.

Every number in the payload is computed from the CSV files in backend/data/real/i4/ with the shared
logic in app/ml/i4_baseline.py (the same code behind scripts/i4_baseline_demo.py). Nothing about the
results is hardcoded: the shared finding, noise control and limitation counts all come from the data.
"""

import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.ml import i4_baseline as i4

SOURCE = {
    "name": "Inspiration4 clinical blood panels (NASA Open Science Data Repository)",
    "mission": "Inspiration4 (SpaceX, September 2021): 4 civilian crew, about 3 days in orbit",
    "osd_ids": ["OSD-569", "OSD-575"],
    "panels": {"CBC": "OSD-569 · Complete Blood Count", "CMP": "OSD-575 · Comprehensive Metabolic Panel"},
    "urls": [
        {"label": "OSD-569 (CBC) study page", "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569"},
        {"label": "OSD-575 (CMP) study page", "url": "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575"},
    ],
    "license": "NASA OSDR open data",
    "citation": "Please cite NASA OSDR studies OSD-569 and OSD-575 and the Inspiration4 / SOMA publications.",
    "mission_days": 3,
}

TIMEPOINT_LABELS = {
    "L-92": "92 days before launch", "L-44": "44 days before launch", "L-3": "3 days before launch",
    "R+1": "1 day after return", "R+45": "45 days after return", "R+82": "82 days after return",
    "R+194": "194 days after return",
}

# Short plain-English names for non-experts (display only; the raw lab name is always returned too).
PLAIN_NAMES = {
    "WHITE BLOOD CELL COUNT": "White blood cells", "RED BLOOD CELL COUNT": "Red blood cells",
    "HEMOGLOBIN": "Hemoglobin (carries oxygen)", "HEMATOCRIT": "Hematocrit (% of blood that is red cells)",
    "MCV": "MCV (average red blood cell size)", "MCH": "MCH (hemoglobin per red cell)",
    "MCHC": "MCHC (hemoglobin concentration in red cells)", "RDW": "RDW (variation in red cell size)",
    "PLATELET COUNT": "Platelets", "MPV": "MPV (average platelet size)",
    "NEUTROPHILS": "Neutrophils (%)", "LYMPHOCYTES": "Lymphocytes (%)", "MONOCYTES": "Monocytes (%)",
    "EOSINOPHILS": "Eosinophils (%)", "BASOPHILS": "Basophils (%)",
    "ABSOLUTE NEUTROPHILS": "Neutrophils (count)", "ABSOLUTE LYMPHOCYTES": "Lymphocytes (count)",
    "ABSOLUTE MONOCYTES": "Monocytes (count)", "ABSOLUTE EOSINOPHILS": "Eosinophils (count)",
    "ABSOLUTE BASOPHILS": "Basophils (count)",
    "GLUCOSE": "Blood sugar (glucose)", "SODIUM": "Sodium", "POTASSIUM": "Potassium", "CHLORIDE": "Chloride",
    "CARBON DIOXIDE": "Bicarbonate (CO2)", "CALCIUM": "Calcium", "UREA NITROGEN (BUN)": "Urea nitrogen (BUN, kidney)",
    "CREATININE": "Creatinine (kidney)", "eGFR NON-AFR. AMERICAN": "eGFR (kidney filtering rate)",
    "BUN/CREATININE RATIO": "BUN / creatinine ratio", "PROTEIN; TOTAL": "Total protein", "ALBUMIN": "Albumin",
    "GLOBULIN": "Globulin", "ALBUMIN/GLOBULIN RATIO": "Albumin / globulin ratio",
    "BILIRUBIN; TOTAL": "Bilirubin (liver)", "ALKALINE PHOSPHATASE": "Alkaline phosphatase (liver/bone)",
    "ALT": "ALT (liver enzyme)", "AST": "AST (liver enzyme)",
}

DEFAULT_ANALYTE = "MCV"


def _num(x: Any, nd: int = 3) -> Optional[float]:
    """JSON-safe float: NaN/inf/None -> None, rounded."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    return round(f, nd) if math.isfinite(f) else None


def _pct(a: int, b: int) -> Optional[float]:
    return round(100.0 * a / b, 1) if b else None


def _mode_range(rows: pd.DataFrame) -> Dict[str, Optional[float]]:
    """Most common (RANGE_MIN, RANGE_MAX) pair; ranges vary between rows for a few C003 analytes."""
    pairs = rows[["RANGE_MIN", "RANGE_MAX"]].apply(lambda r: (_num(r.RANGE_MIN), _num(r.RANGE_MAX)), axis=1)
    if pairs.empty:
        return {"low": None, "high": None}
    lo, hi = pairs.value_counts().index[0]
    return {"low": lo, "high": hi}


def _timepoints() -> List[Dict[str, Any]]:
    out = []
    for tp in i4.ALL_TIMEPOINTS:
        sign = -1 if tp.startswith("L") else 1
        out.append({"id": tp, "phase": "pre" if sign < 0 else "post", "day": sign * int(tp[2:]),
                    "label": TIMEPOINT_LABELS.get(tp, tp), "is_baseline": tp in i4.PRE_FLIGHT})
    return out


def _series(df: pd.DataFrame, res: pd.DataFrame) -> List[Dict[str, Any]]:
    base_info = res.drop_duplicates(["astronaut", "analyte"]).set_index(["astronaut", "analyte"])
    scored = res.set_index(["astronaut", "analyte", "timepoint"])
    out = []
    for (subj, analyte), b in base_info.iterrows():
        raw = df[(df.SUBJECT_ID == subj) & (df.ANALYTE == analyte)]
        points = []
        for tp in i4.ALL_TIMEPOINTS:
            r = raw[raw.TIMEPOINT == tp]
            if r.empty:
                continue
            r = r.iloc[0]
            key = (subj, analyte, tp)
            z = scored.loc[key, "z"] if key in scored.index else float("nan")
            points.append({
                "timepoint": tp,
                "value": _num(r.VALUE),
                "ref_low": _num(r.RANGE_MIN), "ref_high": _num(r.RANGE_MAX),
                "ref_status": i4.reference_status(r.VALUE, r.RANGE_MIN, r.RANGE_MAX),
                "z": _num(z, 2),
                "flagged": bool(key in scored.index and scored.loc[key, "flag"]),
            })
        out.append({
            "astronaut": subj, "analyte": analyte, "unit": b.unit, "panel": b.panel,
            "baseline": {
                "timepoints": list(i4.PRE_FLIGHT), "n": int(b.n_base),
                "mean": _num(b.base_mean, 4), "sd": _num(b.base_sd, 4), "sd_source": b.sd_src,
                "band_low": _num(b.base_mean - i4.FLAG_Z * b.base_sd, 4),
                "band_high": _num(b.base_mean + i4.FLAG_Z * b.base_sd, 4),
            },
            "points": points,
        })
    return out


def _shared_finding(df: pd.DataFrame, res: pd.DataFrame, res_sens: pd.DataFrame, crew: List[str],
                    timepoint: str = "R+1") -> Optional[Dict[str, Any]]:
    """The strongest analyte flagged in the same direction in EVERY crew member at `timepoint`."""
    shared = i4.crew_consistent_shifts(res, timepoint, min_crew=len(crew))
    if not shared:
        return None
    analyte, direction, who, zs = max(shared, key=lambda s: float(np.mean(np.abs(s[3]))))
    rows = res[(res.analyte == analyte) & (res.timepoint == timepoint)].sort_values("astronaut")
    sens = res_sens[(res_sens.analyte == analyte) & (res_sens.timepoint == timepoint)]
    sign = -1 if direction == "down" else 1
    per = []
    for _, r in rows.iterrows():
        pre = df[(df.SUBJECT_ID == r.astronaut) & (df.ANALYTE == analyte) & df.TIMEPOINT.isin(i4.PRE_FLIGHT)].VALUE
        pre = pre[np.isfinite(pre)]
        beyond = bool(len(pre) and (r.value < pre.min() if sign < 0 else r.value > pre.max()))
        per.append({
            "astronaut": r.astronaut, "value": _num(r.value), "baseline_mean": _num(r.base_mean),
            "z": _num(r.z, 2), "flagged": bool(r.flag),
            "pct_change": _num(100.0 * (r.value - r.base_mean) / r.base_mean, 1) if r.base_mean else None,
            "beyond_all_preflight_values": beyond, "ref_status": r.ref,
        })
    n_beyond = sum(p["beyond_all_preflight_values"] for p in per)
    n_in_ref = sum(p["ref_status"] == "in" for p in per)
    word = "lower" if sign < 0 else "higher"
    label = PLAIN_NAMES.get(analyte, analyte)
    mean_pct = float(np.mean([p["pct_change"] for p in per if p["pct_change"] is not None]))
    return {
        "analyte": analyte, "label": label, "unit": rows.unit.iloc[0], "timepoint": timepoint,
        "direction": direction, "n_crew_flagged": len(who), "n_crew": len(crew),
        "mean_pct_change": _num(mean_pct, 1),
        "n_beyond_all_preflight_values": n_beyond,
        "n_inside_reference_range": n_in_ref,
        "per_astronaut": per,
        "sensitivity": {
            "sd_floor_fraction_of_range": i4.SENSITIVITY_FLOOR_FRACTION,
            "n_crew_flagged": int(sens.flag.sum()),
            "plain_text": (
                f"With a stricter rule (minimum spread {i4.SENSITIVITY_FLOOR_FRACTION:.0%} of the lab range instead of "
                f"{i4.SD_FLOOR_FRACTION_OF_RANGE:.0%}), {int(sens.flag.sum())} of {len(crew)} would be flagged. "
                f"So the flag count depends on that choice; the direction ({word} than every pre-flight test in "
                f"{n_beyond} of {len(crew)}) does not."
            ),
        },
        "other_all_crew_analytes": [s[0] for s in shared if s[0] != analyte],
        "plain_text": (
            f"One day after landing, {label} was {word} than usual in {len(who)} of {len(crew)} crew members "
            f"(on average {abs(mean_pct):.1f}% {word} than their own pre-flight average). "
            f"In {n_beyond} of {len(crew)} it was {word} than every one of their own pre-flight tests. "
            f"{n_in_ref} of {len(crew)} values were still inside the normal lab range, so a standard "
            f"one-size-fits-all check would not have noticed it; comparing each person with their own normal does."
        ),
    }


def _noise_control(df: pd.DataFrame, res: pd.DataFrame, crew: List[str]) -> Dict[str, Any]:
    ctrl, _ = i4.analyze(df, baseline_tps=i4.CONTROL_BASELINE, score_tps=[i4.CONTROL_TIMEPOINT])
    c_flag, c_tests = i4.flag_rate(ctrl, i4.CONTROL_TIMEPOINT)
    f_flag, f_tests = i4.flag_rate(res, "R+1")
    c_pct, f_pct = _pct(c_flag, c_tests), _pct(f_flag, f_tests)
    n_analytes = int(res.analyte.nunique())
    p = c_flag / c_tests if c_tests else 0.0
    expected = n_analytes * p ** len(crew)
    similar = c_pct is not None and f_pct is not None and c_pct >= 0.75 * f_pct
    return {
        "control_timepoint": i4.CONTROL_TIMEPOINT, "control_baseline": list(i4.CONTROL_BASELINE),
        "control_flagged": c_flag, "control_tests": c_tests, "control_pct": c_pct,
        "flight_timepoint": "R+1", "flight_flagged": f_flag, "flight_tests": f_tests, "flight_pct": f_pct,
        "single_flags_mostly_noise": bool(similar),
        "n_analytes": n_analytes,
        "expected_all_crew_by_chance": _num(expected, 2),
        "chance_note": (f"Rough estimate: if every flag were noise at the pre-flight rate ({c_pct}%) and analytes were "
                        f"independent, about {expected:.2f} of {n_analytes} analytes would be flagged in all "
                        f"{len(crew)} people by chance."),
        "plain_text": (
            f"Sanity check without any spaceflight: we scored the last pre-flight test ({i4.CONTROL_TIMEPOINT}) against "
            f"the two earlier ones ({i4.CONTROL_BASELINE[0]}, {i4.CONTROL_BASELINE[1]}). {c_pct}% of tests were flagged there, vs {f_pct}% one day after landing. "
            + ("So a single flag on its own is mostly normal day-to-day noise. The signal worth trusting is the same "
               "change showing up in every crew member."
               if similar else
               "Flags were clearly more common after flight than before it.")
        ),
    }


def _limitations(res: pd.DataFrame, crew: List[str], noise: Dict[str, Any]) -> List[Dict[str, str]]:
    per_series = res.drop_duplicates(["astronaut", "analyte"])
    n_floor, n_series = int((per_series.sd_src == "floor").sum()), len(per_series)
    return [
        {"key": "small_crew", "title": f"Only {len(crew)} people",
         "text": f"With n={len(crew)}, nothing here is statistically proven. It shows the method working on real data, "
                 f"not a medical conclusion."},
        {"key": "few_baseline_points", "title": f"Only {len(i4.PRE_FLIGHT)} 'normal' tests per person",
         "text": f"Each person's normal comes from {len(i4.PRE_FLIGHT)} pre-flight blood tests. That is too few to know "
                 f"their natural spread well, so we use a minimum spread (5% of the lab range width); "
                 f"it was needed for {n_floor} of {n_series} person-analyte series."},
        {"key": "short_mission", "title": f"A {SOURCE['mission_days']}-day mission, not a Mars trip",
         "text": f"Inspiration4 lasted about {SOURCE['mission_days']} days. A Mars mission takes years, "
                 f"so these data cannot tell us what happens on long flights."},
        {"key": "noise", "title": "Single flags are often noise",
         "text": f"{noise['control_pct']}% of tests were flagged even before flight, vs {noise['flight_pct']}% after. "
                 f"Only changes seen in the whole crew are worth attention."},
        {"key": "not_medical", "title": "Not medical advice",
         "text": "A flag means 'different from this person's usual', not 'sick'. Day R+1 is also affected by "
                 "re-entry, travel and fluid shifts, not only by time in orbit."},
    ]


def build_payload(panel_files: Optional[Dict[str, Path]] = None) -> Dict[str, Any]:
    df = i4.load_all(panel_files)
    res, skipped = i4.analyze(df)
    res_sens, _ = i4.analyze(df, floor_fraction=i4.SENSITIVITY_FLOOR_FRACTION)

    sex = df.groupby("SUBJECT_ID")["SEX"].first().to_dict()
    crew = sorted(res.astronaut.unique())

    analytes = []
    for analyte, g in res.groupby("analyte", sort=False):
        raw = df[df.ANALYTE == analyte]
        analytes.append({
            "name": analyte, "label": PLAIN_NAMES.get(analyte, analyte), "unit": g.unit.iloc[0],
            "panel": g.panel.iloc[0], "reference_range": _mode_range(raw),
        })
    analytes.sort(key=lambda a: (a["panel"], a["name"].lower()))

    flags = []
    for tp in i4.POST_FLIGHT:
        f, n = i4.flag_rate(res, tp)
        flags.append({"timepoint": tp, "flagged": f, "tests": n, "pct": _pct(f, n)})

    noise = _noise_control(df, res, crew)
    names = [a["name"] for a in analytes]
    return {
        "source": SOURCE,
        "crew": [{"id": c, "sex": sex.get(c)} for c in crew],
        "timepoints": _timepoints(),
        "baseline_timepoints": list(i4.PRE_FLIGHT),
        "post_flight_timepoints": list(i4.POST_FLIGHT),
        "analytes": analytes,
        "default_analyte": DEFAULT_ANALYTE if DEFAULT_ANALYTE in names else (names[0] if names else None),
        "series": _series(df, res),
        "method": {
            "flag_z": i4.FLAG_Z,
            "sd_floor_fraction_of_range": i4.SD_FLOOR_FRACTION_OF_RANGE,
            "excluded_analytes": sorted(i4.EXCLUDED_ANALYTES),
            "skipped_series": [{"astronaut": s, "analyte": a, "n_baseline": n} for s, a, n in skipped],
            "plain_text": (f"Each person's normal = the average of their {len(i4.PRE_FLIGHT)} pre-flight tests. "
                           f"A later value is flagged when it is more than {i4.FLAG_Z:g} 'typical spreads' away "
                           f"from that normal (|z| > {i4.FLAG_Z:g})."),
        },
        "summary": {
            "flag_z": i4.FLAG_Z,
            "flags_per_timepoint": flags,
            "shared_finding": _shared_finding(df, res, res_sens, crew),
            "crew_consistent_shifts": [
                {"analyte": a, "label": PLAIN_NAMES.get(a, a), "direction": d, "astronauts": w,
                 "z": [_num(z, 2) for z in zs]}
                for a, d, w, zs in i4.crew_consistent_shifts(res, "R+1", min_crew=2)
            ],
            "noise_control": noise,
        },
        "limitations": _limitations(res, crew, noise),
    }


@lru_cache(maxsize=1)
def get_i4_payload() -> Dict[str, Any]:
    """Cached payload for the bundled data files (they never change at runtime)."""
    return build_payload()
