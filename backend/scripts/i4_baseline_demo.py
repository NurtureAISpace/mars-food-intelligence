"""
Inspiration4 feasibility spike: personal-baseline z-scores on REAL astronaut blood data.

Data: NASA OSDR, Inspiration4 (3-day orbital mission, 4 crew), clinical panels
    OSD-569 / LSDS-7  Complete Blood Count (CBC)
    OSD-575 / LSDS-8  Comprehensive Metabolic Panel (CMP)
Files and provenance: backend/data/real/i4/README.md

Method (same idea as app/ml/anomaly.py, adapted to very few samples):
    baseline  = each astronaut's own pre-flight values (L-92, L-44, L-3) per analyte
    sd_used   = max(personal sample SD, floor); floor = SD_FLOOR_FRACTION_OF_RANGE x
                width of the lab reference range (or a fraction of the mean if no range)
    z         = (post-flight value - baseline mean) / sd_used, flagged if |z| > FLAG_Z

Shared logic: app/ml/i4_baseline.py (also served by GET /api/v1/real-data/i4). Run from the backend directory:
    python scripts/i4_baseline_demo.py                 # full table + summary
    python scripts/i4_baseline_demo.py --flagged-only  # only |z| > 2 rows in the table
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Shared logic lives in the app so the API (/api/v1/real-data/i4) and this script compute the same numbers.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ml.i4_baseline import (  # noqa: E402,F401  (re-exported for tests/test_i4_baseline.py)
    DATA_DIR, PANEL_FILES, PRE_FLIGHT, POST_FLIGHT, FLAG_Z, SD_FLOOR_FRACTION_OF_RANGE,
    SD_FLOOR_FRACTION_OF_MEAN, SENSITIVITY_FLOOR_FRACTION, MIN_BASELINE_POINTS, SMALL_N, EXCLUDED_ANALYTES,
    CONTROL_BASELINE, CONTROL_TIMEPOINT, baseline_stats, zscore, reference_status, load_panel, analyze,
    recovery_label, crew_consistent_shifts,
)


def describe_panel(df, panel, path):
    print(f"\n--- {panel}: {path.name}")
    print(f"shape: {df.shape}  (long format: one row per analyte x subject x timepoint)")
    print(f"columns: {list(df.columns[:9])}  (timepoint column normalised to TIMEPOINT)")
    sex = df.groupby("SUBJECT_ID")["SEX"].first().to_dict()
    print(f"crew IDs: {', '.join(f'{s} ({sex[s]})' for s in sorted(sex))}")
    tps = [t for t in PRE_FLIGHT + POST_FLIGHT if t in set(df.TIMEPOINT)]
    other = sorted(set(df.TIMEPOINT) - set(tps))
    print(f"timepoints: {tps}" + (f"  UNEXPECTED: {other}" if other else ""))
    renamed = int((df.ANALYTE != df.ANALYTE_RAW).sum())
    if renamed:
        who = df.loc[df.ANALYTE != df.ANALYTE_RAW, ["SUBJECT_ID", "TIMEPOINT"]].drop_duplicates().values.tolist()
        print(f"note: {renamed} rows had a '(FEMALE)' analyte suffix, merged into the base analyte {who}")
    units = df.groupby("ANALYTE")["UNITS"].first()
    print(f"analytes ({len(units)}):")
    for a, u in units.items():
        print(f"    {a:<28} {u}")
    missing = df[df.VALUE.isna()].groupby("ANALYTE").size()
    if len(missing):
        print(f"empty VALUE cells: {missing.to_dict()}")


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
    out["tp_order"] = out.timepoint.map({t: i for i, t in enumerate(PRE_FLIGHT + POST_FLIGHT)})
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


def print_table(res, flagged_only):
    t = res[res.flag] if flagged_only else res
    show = t.assign(
        flagged=np.where(t.flag, "YES", ""),
        ref_range=[f"{lo:g}-{hi:g}" if np.isfinite(hi) else f">={lo:g}" for lo, hi in zip(t.ref_lo, t.ref_hi)],
    )[["astronaut", "analyte", "unit", "timepoint", "value", "base_mean", "base_sd", "sd_src", "n_base",
       "z", "flagged", "ref_range", "ref"]]
    with pd.option_context("display.max_rows", None, "display.width", 200):
        print(show.to_string(index=False, float_format=lambda x: f"{x:.2f}"))


def print_summary(res, res_sens, res_ctrl, top_k=5):
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)

    counts = res.groupby("timepoint").agg(tests=("z", lambda s: int(s.notna().sum())), flagged=("flag", "sum"),
                                          outside_ref=("ref", lambda s: int(s.isin(["LOW", "HIGH"]).sum())))
    counts = counts.reindex([t for t in POST_FLIGHT if t in counts.index])
    both = res[res.flag & res.ref.isin(["LOW", "HIGH"])].groupby("timepoint").size()
    counts["flagged_and_outside_ref"] = both.reindex(counts.index).fillna(0).astype(int)
    print(f"\nFlags (|z| > {FLAG_Z:g}) per post-flight timepoint, whole crew:")
    print(counts.to_string())

    sens = res_sens.groupby("timepoint")["flag"].sum().reindex(counts.index)
    print(f"\nSensitivity: with SD floor = {SENSITIVITY_FLOOR_FRACTION:.2f} x ref-range width "
          f"(instead of {SD_FLOOR_FRACTION_OF_RANGE:.2f}), flags per timepoint: {sens.to_dict()}")

    n_ctrl, f_ctrl = int(res_ctrl.z.notna().sum()), int(res_ctrl.flag.sum())
    n_r1, f_r1 = int(counts.loc["R+1", "tests"]), int(counts.loc["R+1", "flagged"])
    print(f"\nNoise control (no flight involved): L-3 scored vs a baseline of L-92 + L-44 only (n=2, same floor): "
          f"{f_ctrl}/{n_ctrl} flagged ({100 * f_ctrl / max(n_ctrl, 1):.0f}%) vs R+1 {f_r1}/{n_r1} "
          f"({100 * f_r1 / max(n_r1, 1):.0f}%). If these are similar, single-analyte flags are mostly noise at this n.")

    print(f"\nTop {top_k} shifted analytes at R+1 per astronaut (z trajectory R+1 -> R+45 -> R+82 -> R+194):")
    wide = res.pivot_table(index=["astronaut", "analyte"], columns="timepoint", values="z")
    wide = wide.reindex(columns=[t for t in POST_FLIGHT if t in wide.columns])
    for subj in sorted(res.astronaut.unique()):
        r1 = res[(res.astronaut == subj) & (res.timepoint == "R+1") & res.z.notna()]
        r1 = r1.reindex(r1.z.abs().sort_values(ascending=False).index).head(top_k)
        print(f"\n  {subj}:")
        for _, r in r1.iterrows():
            traj = wide.loc[(subj, r.analyte)]
            traj_txt = " -> ".join(f"{z:+.1f}" if np.isfinite(z) else "NA" for z in traj.values)
            label = recovery_label(r.z, list(traj.items())[1:])
            print(f"    {r.analyte:<26} R+1 {r.value:g} {r.unit} vs baseline {r.base_mean:.3g} "
                  f"(z {r.z:+.1f}{', ' + r.ref + ' ref' if r.ref in ('LOW', 'HIGH') else ''}) | z: {traj_txt} | {label}")

    print(f"\nAnalytes flagged at R+1 in >= 2 of 4 astronauts in the same direction (crew-consistent shifts):")
    consistent = crew_consistent_shifts(res, "R+1", min_crew=2)
    if consistent:
        for analyte, name, who, zs in consistent:
            print(f"    {analyte:<26} {name:<4} {who} z={[round(z, 1) for z in zs]}")
    else:
        print("    none")

def main(argv):
    flagged_only = "--flagged-only" in argv
    print("=" * 100)
    print("Inspiration4 personal-baseline demo  |  REAL astronaut data, NASA OSDR (OSD-569 CBC, OSD-575 CMP)")
    print("=" * 100)

    panels = {}
    for panel, path in PANEL_FILES.items():
        if not path.exists():
            sys.exit(f"missing data file: {path}  (see backend/data/real/i4/README.md)")
        panels[panel] = load_panel(path, panel)
        describe_panel(panels[panel], panel, path)
    df = pd.concat(panels.values(), ignore_index=True)

    print("\nMETHOD NOTES")
    print(f"  * Baseline = each astronaut's own pre-flight draws {PRE_FLIGHT}; post-flight {POST_FLIGHT} scored vs it.")
    print(f"  * WARNING (small n): at most {len(PRE_FLIGHT)} baseline points per astronaut x analyte. A sample SD from "
          f"n <= {SMALL_N} is very unstable, so sd_used = max(sample SD, floor), floor = "
          f"{SD_FLOOR_FRACTION_OF_RANGE:.2f} x lab reference-range width (a heuristic, not a validated biological-"
          f"variation estimate). z-scores here are a screening signal, not a statistical test.")
    print("  * IsolationForest is NOT used: with 3 baseline samples per astronaut it cannot learn a distribution "
          "(the app's IsolationForest trains on dozens of Sols per astronaut).")
    print(f"  * Excluded: {sorted(EXCLUDED_ANALYTES)} (duplicate calculation of the non-race eGFR from the same creatinine).")
    print("  * Reference ranges are the per-row lab ranges from the file; for C003 some ranges differ pre- vs post-flight.")

    res, skipped = analyze(df)
    res_sens, _ = analyze(df, floor_fraction=SENSITIVITY_FLOOR_FRACTION)
    res_ctrl, _ = analyze(df, baseline_tps=CONTROL_BASELINE, score_tps=[CONTROL_TIMEPOINT])
    if skipped:
        by_analyte = {}
        for s, a, n in skipped:
            by_analyte.setdefault(a, []).append(f"{s}(n={n})")
        print(f"\nSkipped (fewer than {MIN_BASELINE_POINTS} numeric baseline values): "
              + "; ".join(f"{a}: {', '.join(sorted(v))}" for a, v in sorted(by_analyte.items())))
    n_floor = int((res.drop_duplicates(['astronaut', 'analyte']).sd_src == "floor").sum())
    n_series = res[["astronaut", "analyte"]].drop_duplicates().shape[0]
    print(f"Baselines: {n_series} astronaut x analyte series; SD floor was used for {n_floor} of them.")

    print(f"\nRESULTS TABLE ({'flagged rows only' if flagged_only else 'all post-flight rows'}; "
          f"flagged = |z| > {FLAG_Z:g}; ref = value vs the lab reference range on that row)")
    print_table(res, flagged_only)
    print_summary(res, res_sens, res_ctrl)


if __name__ == "__main__":
    main(sys.argv[1:])
