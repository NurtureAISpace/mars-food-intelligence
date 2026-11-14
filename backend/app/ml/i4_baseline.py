"""
Personal-baseline z-scores on REAL astronaut blood data (NASA OSDR, Inspiration4).

Data: Inspiration4 (SpaceX, Sept 2021, ~3 days in orbit, 4 civilian crew), clinical panels
    OSD-569 / LSDS-7  Complete Blood Count (CBC)
    OSD-575 / LSDS-8  Comprehensive Metabolic Panel (CMP)
Files and provenance: backend/data/real/i4/README.md

Method (same idea as app/ml/anomaly.py, adapted to very few samples):
    baseline  = each astronaut's own pre-flight values (L-92, L-44, L-3) per analyte
    sd_used   = max(personal sample SD, floor); floor = SD_FLOOR_FRACTION_OF_RANGE x
                width of the lab reference range (or a fraction of the mean if no range)
    z         = (post-flight value - baseline mean) / sd_used, flagged if |z| > FLAG_Z

Shared by scripts/i4_baseline_demo.py (CLI report) and app/services/real_data_service.py (API).
"""

from pathlib import Path
from typing import Dict, Optional

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "real" / "i4"
PANEL_FILES: Dict[str, Path] = {
    "CBC": DATA_DIR / "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv",
    "CMP": DATA_DIR / "LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv",
}
PRE_FLIGHT = ["L-92", "L-44", "L-3"]
POST_FLIGHT = ["R+1", "R+45", "R+82", "R+194"]
ALL_TIMEPOINTS = PRE_FLIGHT + POST_FLIGHT

FLAG_Z = 2.0
SD_FLOOR_FRACTION_OF_RANGE = 0.05   # heuristic, NOT validated: ~0.2 population SD if range = mean +/- 2 SD
SD_FLOOR_FRACTION_OF_MEAN = 0.02    # used only when the file gives no usable reference range
SENSITIVITY_FLOOR_FRACTION = 0.10   # re-run with a stricter floor to show how sensitive the flags are
MIN_BASELINE_POINTS = 2             # below this, no z-score (one pre-flight value is not a baseline)
SMALL_N = 3                         # n <= SMALL_N baseline points -> explicit small-n warning
# Derived duplicate of eGFR NON-AFR. AMERICAN (same creatinine, race coefficient); excluded to avoid double counting.
EXCLUDED_ANALYTES = {"eGFR AFRICAN AMERICAN"}

# Noise control: score the last pre-flight draw against the two earlier ones (no flight in between).
CONTROL_BASELINE = ["L-92", "L-44"]
CONTROL_TIMEPOINT = "L-3"


def baseline_stats(values, ref_width=None, floor_fraction=SD_FLOOR_FRACTION_OF_RANGE):
    """
    Personal baseline from a handful of pre-flight values.

    Returns (mean, sd_used, sd_source, n). sd_source is "personal" when the sample SD is
    used and "floor" when the floor is larger (or the sample SD is undefined, n < 2).
    """
    v = np.asarray([x for x in values if x is not None and np.isfinite(x)], dtype=float)
    n = int(v.size)
    if n == 0:
        return float("nan"), float("nan"), "none", 0
    mean = float(v.mean())
    sd_personal = float(v.std(ddof=1)) if n >= 2 else float("nan")
    if ref_width is not None and np.isfinite(ref_width) and ref_width > 0:
        floor = floor_fraction * float(ref_width)
    else:
        floor = SD_FLOOR_FRACTION_OF_MEAN * abs(mean)
    if np.isfinite(sd_personal) and sd_personal >= floor:
        return mean, sd_personal, "personal", n
    return mean, float(floor), "floor", n


def zscore(value, mean, sd):
    """z of one value vs a baseline; NaN when undefined (missing value or non-positive SD)."""
    if not (np.isfinite(value) and np.isfinite(mean) and np.isfinite(sd)) or sd <= 0:
        return float("nan")
    return (float(value) - float(mean)) / float(sd)


def reference_status(value, lo, hi):
    if not np.isfinite(value):
        return "n/a"
    if np.isfinite(lo) and value < lo:
        return "LOW"
    if np.isfinite(hi) and value > hi:
        return "HIGH"
    if not np.isfinite(lo) and not np.isfinite(hi):
        return "n/a"
    return "in"


def load_panel(path, panel):
    df = pd.read_csv(path, encoding="utf-8-sig")
    tcol = "TEST_DATE" if "TEST_DATE" in df.columns else "timepoint"
    df = df.rename(columns={tcol: "TIMEPOINT"})
    df["ANALYTE_RAW"] = df["ANALYTE"]
    # C003 at R+1 is reported under "... (FEMALE)" names; same measurement, keep the series continuous
    df["ANALYTE"] = df["ANALYTE"].str.replace(r"\s*\(FEMALE\)$", "", regex=True)
    for c in ("VALUE", "RANGE_MIN", "RANGE_MAX"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["PANEL"] = panel
    return df


def load_all(panel_files: Optional[Dict[str, Path]] = None) -> pd.DataFrame:
    """All panels in one long DataFrame. Raises FileNotFoundError if a file is missing."""
    files = panel_files or PANEL_FILES
    frames = []
    for panel, path in files.items():
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"missing data file: {path} (see backend/data/real/i4/README.md)")
        frames.append(load_panel(path, panel))
    return pd.concat(frames, ignore_index=True)


def analyze(df, floor_fraction=SD_FLOOR_FRACTION_OF_RANGE, baseline_tps=PRE_FLIGHT, score_tps=POST_FLIGHT):
    rows, skipped = [], []
    for (subj, analyte), g in df.groupby(["SUBJECT_ID", "ANALYTE"]):
        if analyte in EXCLUDED_ANALYTES:
            continue
        base = g[g.TIMEPOINT.isin(baseline_tps)]
        width = float((base.RANGE_MAX - base.RANGE_MIN).median())
        mean, sd, src, n = baseline_stats(base.VALUE.tolist(), width, floor_fraction)
        if n < MIN_BASELINE_POINTS:
            skipped.append((subj, analyte, n))
            continue
        for tp in score_tps:
            r = g[g.TIMEPOINT == tp]
            if r.empty:
                continue
            r = r.iloc[0]
            z = zscore(r.VALUE, mean, sd)
            rows.append({
                "astronaut": subj, "panel": r.PANEL, "analyte": analyte, "unit": r.UNITS,
                "timepoint": tp, "value": r.VALUE, "base_mean": mean, "base_sd": sd,
                "sd_src": src, "n_base": n, "z": z,
                "flag": bool(np.isfinite(z) and abs(z) > FLAG_Z),
                "ref_lo": r.RANGE_MIN, "ref_hi": r.RANGE_MAX,
                "ref": reference_status(r.VALUE, r.RANGE_MIN, r.RANGE_MAX),
            })
    out = pd.DataFrame(rows)
    out["tp_order"] = out.timepoint.map({t: i for i, t in enumerate(ALL_TIMEPOINTS)})
    out = out.sort_values(["astronaut", "panel", "analyte", "tp_order"]).reset_index(drop=True)
    return out, skipped


def recovery_label(z_r1, later):
    """later: list of (timepoint, z) after R+1, in time order."""
    if not (np.isfinite(z_r1) and abs(z_r1) > FLAG_Z):
        return "not flagged at R+1"
    later = [(tp, z) for tp, z in later if np.isfinite(z)]
    if not later:
        return "no follow-up value"
    back = next((i for i, (_, z) in enumerate(later) if abs(z) <= FLAG_Z), None)
    if back is None:
        return "NOT recovered: |z| > 2 at every follow-up"
    if any(abs(z) > FLAG_Z for _, z in later[back + 1:]):
        return f"back within |z|<=2 at {later[back][0]}, but re-flagged later (unstable)"
    return f"back within |z|<=2 from {later[back][0]} on"


def crew_consistent_shifts(res, timepoint="R+1", min_crew=2):
    """Analytes flagged at `timepoint` in >= min_crew astronauts in the same direction.

    Returns a list of (analyte, direction "up"/"down", [astronauts], [z values]), most crew first.
    """
    r = res[(res.timepoint == timepoint) & res.flag]
    out = []
    for analyte, g in r.groupby("analyte"):
        for sign, name in ((1, "up"), (-1, "down")):
            gg = g[np.sign(g.z) == sign].sort_values("astronaut")
            if len(gg) >= min_crew:
                out.append((analyte, name, gg.astronaut.tolist(), gg.z.tolist()))
    return sorted(out, key=lambda x: (-len(x[2]), x[0]))


def flag_rate(res, timepoint):
    """(flagged, tests) at one timepoint; tests = rows with a finite z."""
    t = res[res.timepoint == timepoint]
    return int(t.flag.sum()), int(t.z.notna().sum())
