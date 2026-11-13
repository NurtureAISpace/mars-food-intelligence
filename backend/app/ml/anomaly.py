"""
Personal-baseline anomaly detection and explainable early-warning alerts.

For every astronaut:
  1. Personal baseline = mean / SD of each signal over the first `baseline_sols` Sols
     (SD floored at a measurement-noise level so a quiet baseline does not inflate z).
  2. z-scores vs that baseline, smoothed with a rolling mean.
  3. IsolationForest trained on that astronaut's baseline window only -> anomaly score
     (supporting evidence, not part of the status rules).
  4. Causal per-Sol forecast: personal turnover k estimated from history up to that Sol,
     analytic Sols-to-risk under the recent intake trend, worst nutrient.
  5. Status rules:
        ACT     if Sols-to-risk <= ACT_SOLS_TO_RISK
        WATCH   if Sols-to-risk <= WATCH_SOLS_TO_RISK or |z| of any vital >= WATCH_Z
        NOMINAL otherwise   (CALIBRATING before baseline + trend window is available)
  6. Alerts at the first WATCH / first ACT, explaining what changed, by how much vs
     baseline, since which Sol, and food + servings to close the intake gap.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.ml.crew_data import CrewData, FRESH_PREFIX, load_catalog
from app.ml.physiology import (
    NUTRIENTS,
    VITALS,
    VITAL_SD_FLOOR,
    daily_need_mg,
    equilibrium_pool,
    personal_turnover,
    sols_to_risk,
)

WATCH_Z = 2.0                      # |z| of any vital vs personal baseline
WATCH_SOLS_TO_RISK = 120
ACT_SOLS_TO_RISK = 45
ONSET_INTAKE_Z = -2.0              # smoothed intake z marking the start of a deviation
INTAKE_SD_FLOOR_FRACTION = 0.05    # SD floor for intake = 5% of baseline mean
GAP_WINDOW_SOLS = 3                # recent intake window used to size the intake gap
MAX_PRACTICAL_SERVINGS = 3.0       # above this, the recommendation is flagged as not feasible
ISO_N_ESTIMATORS = 200
ISO_CONTAMINATION = 0.02

INTAKE_COLS = [f"{n}_intake_mg" for n in NUTRIENTS]
MODEL_FEATURES = VITALS + INTAKE_COLS
STATUS_RANK = {"CALIBRATING": -1, "NOMINAL": 0, "WATCH": 1, "ACT": 2}

SIGNAL_LABELS = {
    "hr_rest": "Resting heart rate",
    "sleep_h": "Sleep duration",
    "body_mass_kg": "Body mass",
    "fatigue_score": "Fatigue score",
    **{f"{n}_intake_mg": f"{cfg['label']} intake" for n, cfg in NUTRIENTS.items()},
    **{f"{n}_pool_mg": f"{cfg['label']} body pool" for n, cfg in NUTRIENTS.items()},
}


@dataclass
class PersonalBaseline:
    mean: pd.Series
    sd: pd.Series


@dataclass
class AstronautResult:
    astronaut: str
    baseline: PersonalBaseline
    pool_baseline: Dict[str, float]
    frame: pd.DataFrame                              # this astronaut's timeline, indexed 0..N-1 by Sol
    first_status: Dict[str, int] = field(default_factory=dict)
    alerts: List[Dict[str, Any]] = field(default_factory=list)
    threshold_crossing_sol: Dict[str, Optional[int]] = field(default_factory=dict)


@dataclass
class CrewAnalysis:
    data: CrewData
    timeline: pd.DataFrame
    astronauts: Dict[str, AstronautResult]
    alerts: List[Dict[str, Any]]


def personal_baseline(g: pd.DataFrame, baseline_sols: int) -> PersonalBaseline:
    base = g[g.sol < baseline_sols]
    cols = VITALS + INTAKE_COLS
    mu = base[cols].mean()
    floors = pd.Series({**VITAL_SD_FLOOR, **{c: INTAKE_SD_FLOOR_FRACTION * mu[c] for c in INTAKE_COLS}})
    sd = np.maximum(base[cols].std(), floors[cols])
    return PersonalBaseline(mean=mu, sd=sd)


def baseline_zscores(g: pd.DataFrame, baseline: PersonalBaseline, smoothing_sols: int) -> pd.DataFrame:
    cols = list(baseline.mean.index)
    z = (g[cols] - baseline.mean) / baseline.sd
    return z.rolling(smoothing_sols, min_periods=smoothing_sols).mean()


def fit_baseline_isolation_forest(g: pd.DataFrame, baseline_sols: int, seed: int) -> IsolationForest:
    iso = IsolationForest(n_estimators=ISO_N_ESTIMATORS, contamination=ISO_CONTAMINATION, random_state=seed)
    iso.fit(g.loc[g.sol < baseline_sols, MODEL_FEATURES])
    return iso


def classify_status(worst_sols_to_risk: float, driver_abs_z: float) -> str:
    if worst_sols_to_risk <= ACT_SOLS_TO_RISK:
        return "ACT"
    if worst_sols_to_risk <= WATCH_SOLS_TO_RISK or driver_abs_z >= WATCH_Z:
        return "WATCH"
    return "NOMINAL"


def recommend_food(nutrient: str, gap_mg: float, sol: int, data: CrewData) -> Dict[str, Any]:
    """
    Best single food to close the intake gap with what is available at this Sol:
    fresh greenhouse crops when the greenhouse is running, otherwise packaged items
    at their current Arrhenius retention.
    """
    cfg = NUTRIENTS[nutrient]
    f = cfg["catalog_field"]
    catalog = load_catalog()
    if not data.greenhouse_down[sol]:
        source = "fresh greenhouse crop"
        candidates = {i: item[f] for i, item in catalog.items() if i.startswith(FRESH_PREFIX)}
    else:
        source = "packaged (greenhouse offline; content at current Arrhenius retention)"
        candidates = {i: catalog[i][f] * float(data.retention[i].iloc[sol]) for i in data.retention.columns}
    food_id = max(candidates, key=candidates.get)
    content = candidates[food_id]
    servings = gap_mg / content if content > 0 else float("inf")
    return {
        "food_id": food_id,
        "food_name": catalog[food_id]["name"],
        "source": source,
        "nutrient_per_serving_mg": round(content, 3),
        "servings_per_sol": round(servings, 2) if np.isfinite(servings) else None,
        "feasible": bool(servings <= MAX_PRACTICAL_SERVINGS),
    }


def _run_start(flags: np.ndarray, upto: int) -> Optional[int]:
    """Start index of the most recent run of True values ending at or before `upto`."""
    idx = np.flatnonzero(flags[: upto + 1])
    if idx.size == 0:
        return None
    end = idx[-1]
    start = end
    while start > 0 and flags[start - 1]:
        start -= 1
    return int(start)


def _num(x: float, nd: int = 2) -> Optional[float]:
    return round(float(x), nd) if x is not None and np.isfinite(x) else None


def explain(res: AstronautResult, data: CrewData, sol: int) -> Optional[Dict[str, Any]]:
    """Explainable assessment of one astronaut at one Sol (uses only data up to that Sol)."""
    sc = data.scenario
    row = res.frame.iloc[sol]
    status = row["status"]
    if status == "CALIBRATING":
        return None
    nutrient = row["worst_nutrient"]
    cfg = NUTRIENTS[nutrient]
    fr = res.frame
    intake_col, pool_col = f"{nutrient}_intake_mg", f"{nutrient}_pool_mg"
    driver = row["top_driver"]

    recent = fr.iloc[sol - sc.trend_window_sols + 1: sol + 1]
    intake_recent = float(recent[intake_col].mean())
    intake_base = float(res.baseline.mean[intake_col])
    pool_now = float(row[pool_col])
    pool_base = res.pool_baseline[nutrient]
    driver_recent = float(recent[driver].mean())
    driver_base = float(res.baseline.mean[driver])

    def pct(cur: float, base: float) -> Optional[float]:
        return _num(100.0 * (cur - base) / base, 1) if base else None

    changes = [
        {"signal": intake_col, "label": SIGNAL_LABELS[intake_col], "baseline": _num(intake_base),
         "current": _num(intake_recent), "pct_change_vs_baseline": pct(intake_recent, intake_base),
         "z": _num(row[f"z_{intake_col}"])},
        {"signal": pool_col, "label": SIGNAL_LABELS[pool_col], "baseline": _num(pool_base),
         "current": _num(pool_now), "pct_change_vs_baseline": pct(pool_now, pool_base), "z": None},
        {"signal": driver, "label": SIGNAL_LABELS[driver], "baseline": _num(driver_base),
         "current": _num(driver_recent), "pct_change_vs_baseline": pct(driver_recent, driver_base),
         "z": _num(row["driver_z"])},
    ]

    intake_flags = (fr[f"z_{intake_col}"] <= ONSET_INTAKE_Z).to_numpy()
    since_sol = _run_start(intake_flags, sol)
    since_signal = intake_col
    if since_sol is None:
        since_sol = _run_start((fr[f"z_{driver}"].abs() >= WATCH_Z).to_numpy(), sol)
        since_signal = driver
    if since_sol is None:
        since_sol, since_signal = sol, None

    gap_window = fr.iloc[max(0, sol - GAP_WINDOW_SOLS + 1): sol + 1][intake_col]
    gap_mg = max(0.0, daily_need_mg(cfg) - float(gap_window.mean()))
    recommendation = recommend_food(nutrient, gap_mg, sol, data) if gap_mg > 0 else None

    s2r = float(row["sols_to_risk"])
    if recommendation is None:
        action = "monitor"
    else:
        action = f"add {recommendation['servings_per_sol']:.1f} servings/Sol of {recommendation['food_name']}"
        if not recommendation["feasible"]:
            action += f" (exceeds {MAX_PRACTICAL_SERVINGS:.0f} servings/Sol: consider a supplement or greenhouse restart)"

    forecast_txt = (f"forecast to cross {cfg['risk_threshold_mg']:.0f} mg in {s2r:.0f} Sols (Sol {sol + s2r:.0f})"
                    if np.isfinite(s2r) else "no threshold crossing forecast at current intake")
    message = (
        f"{cfg['label']} pool {pool_now:.1f} mg ({changes[1]['pct_change_vs_baseline']:+.0f}% vs personal baseline), "
        f"{forecast_txt}. {cfg['label']} intake {changes[0]['pct_change_vs_baseline']:+.0f}% vs baseline"
        f"{f' since Sol {since_sol}' if since_signal == intake_col else ''}. "
        f"Top vital driver: {SIGNAL_LABELS[driver]} (z {row['driver_z']:+.1f}). Action: {action}."
    )

    return {
        "astronaut_id": res.astronaut,
        "sol": int(sol),
        "status": status,
        "nutrient": nutrient,
        "pool_mg": _num(pool_now, 1),
        "risk_threshold_mg": cfg["risk_threshold_mg"],
        "sols_to_risk": _num(s2r, 0),
        "projected_risk_sol": int(round(sol + s2r)) if np.isfinite(s2r) else None,
        "top_vital_driver": driver,
        "driver_z": _num(row["driver_z"]),
        "anomaly_score": _num(row["anomaly_score"], 3),
        "since_sol": since_sol,
        "since_signal": since_signal,
        "changes": changes,
        "intake_gap_mg_per_sol": _num(gap_mg),
        "recommendation": recommendation,
        "action": action,
        "message": message,
    }


def analyze_astronaut(g: pd.DataFrame, data: CrewData) -> AstronautResult:
    sc = data.scenario
    g = g.sort_values("sol").reset_index(drop=True).copy()
    astronaut = str(g["astronaut"].iloc[0])
    n_sols = len(g)

    baseline = personal_baseline(g, sc.baseline_sols)
    z = baseline_zscores(g, baseline, sc.smoothing_sols)
    for c in z.columns:
        g[f"z_{c}"] = z[c].values

    iso = fit_baseline_isolation_forest(g, sc.baseline_sols, sc.seed)
    g["anomaly_score"] = -iso.score_samples(g[MODEL_FEATURES])
    g["iso_outlier"] = iso.predict(g[MODEL_FEATURES]) == -1

    pools = {n: g[f"{n}_pool_mg"].to_numpy() for n in NUTRIENTS}
    intakes = {n: g[f"{n}_intake_mg"].to_numpy() for n in NUTRIENTS}
    zv = z[VITALS].to_numpy()

    per_n = {n: {"k": np.full(n_sols, np.nan), "eq": np.full(n_sols, np.nan), "s2r": np.full(n_sols, np.nan)}
             for n in NUTRIENTS}
    status = np.array(["CALIBRATING"] * n_sols, dtype=object)
    worst_n = np.array([None] * n_sols, dtype=object)
    worst_s2r = np.full(n_sols, np.nan)
    driver = np.array([None] * n_sols, dtype=object)
    driver_z = np.full(n_sols, np.nan)

    for i in range(sc.calibration_sols, n_sols):
        w0 = i - sc.trend_window_sols + 1
        d = int(np.nanargmax(np.abs(zv[i])))
        driver[i], driver_z[i] = VITALS[d], zv[i, d]

        # Forecast with the same first-order pool model, assuming recent intake continues
        best_n, best_s = None, np.inf
        for n, cfg in NUTRIENTS.items():
            k = personal_turnover(pools[n][: i + 1], intakes[n][: i + 1], cfg)
            eq = equilibrium_pool(cfg, float(intakes[n][w0: i + 1].mean()), k)
            s = sols_to_risk(float(pools[n][i]), eq, k, cfg["risk_threshold_mg"])
            per_n[n]["k"][i], per_n[n]["eq"][i], per_n[n]["s2r"][i] = k, eq, s
            if s < best_s:
                best_n, best_s = n, s
        if best_n is None:
            # no nutrient on course to the threshold: report the one with the lowest relative pool
            best_n = min(NUTRIENTS, key=lambda n: pools[n][i] / NUTRIENTS[n]["pool_max_mg"])
        worst_n[i], worst_s2r[i] = best_n, best_s
        status[i] = classify_status(best_s, abs(zv[i, d]))

    for n in NUTRIENTS:
        g[f"{n}_k_per_sol"] = per_n[n]["k"]
        g[f"{n}_pool_eq_mg"] = per_n[n]["eq"]
        g[f"{n}_sols_to_risk"] = per_n[n]["s2r"]
    g["worst_nutrient"] = worst_n
    g["sols_to_risk"] = worst_s2r
    g["top_driver"] = driver
    g["driver_z"] = driver_z
    g["status"] = status

    res = AstronautResult(
        astronaut=astronaut,
        baseline=baseline,
        pool_baseline={n: float(g.loc[g.sol < sc.baseline_sols, f"{n}_pool_mg"].mean()) for n in NUTRIENTS},
        frame=g,
    )
    for n, cfg in NUTRIENTS.items():
        below = np.flatnonzero(pools[n] <= cfg["risk_threshold_mg"])
        res.threshold_crossing_sol[n] = int(below[0]) if below.size else None

    for i in range(sc.calibration_sols, n_sols):
        s = status[i]
        if s in ("WATCH", "ACT") and s not in res.first_status:
            res.first_status[s] = i
            res.alerts.append(explain(res, data, i))
    return res


def analyze_crew(data: CrewData) -> CrewAnalysis:
    results = {astronaut: analyze_astronaut(g, data) for astronaut, g in data.crew_df.groupby("astronaut")}
    timeline = pd.concat([r.frame for r in results.values()], ignore_index=True)
    alerts = sorted((a for r in results.values() for a in r.alerts), key=lambda a: (a["sol"], a["astronaut_id"]))
    return CrewAnalysis(data=data, timeline=timeline, astronauts=results, alerts=alerts)
