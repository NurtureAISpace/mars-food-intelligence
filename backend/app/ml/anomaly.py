"""
Personal-baseline anomaly detection and explainable early-warning alerts.

For every astronaut:
  1. Personal baseline = mean / SD of each signal over the first `baseline_sols` Sols
     (SD floored at a measurement-noise level so a quiet baseline does not inflate z).
  2. z-scores, smoothed with a rolling mean. Vitals use a trend-following reference level: the mean
     of a `baseline_sols` window that ends VITALS_REFERENCE_LAG_SOLS before the current Sol (the fixed
     personal baseline before that window exists), divided by the personal-baseline SD. Slow, sustained
     drifts are covered by the mechanistic nutrient forecast (step 4); the vitals channel flags changes
     faster than the lag, so an expected slow decline is not re-alarmed indefinitely.
  3. IsolationForest trained on that astronaut's baseline window only -> anomaly score
     (supporting evidence, not part of the status rules).
  4. Causal per-Sol forecast: personal turnover k estimated from history up to that Sol,
     analytic Sols-to-risk under the recent intake trend, worst nutrient. Vitamin D status
     (25-OH-D) uses its personal log-linear decline rate vs NASA's 25 nmol/L band edge.
  5. Status rules:
        ACT     if Sols-to-risk <= ACT_SOLS_TO_RISK
        WATCH   if Sols-to-risk <= WATCH_SOLS_TO_RISK or |z| of any vital >= WATCH_Z
        NOMINAL otherwise   (CALIBRATING before baseline + trend window is available)
     Status driver = largest contributor relative to its rule threshold:
        nutrient forecast: WATCH_SOLS_TO_RISK / Sols-to-risk;  vital: |z| / WATCH_Z  (ACT is always forecast).
  6. Alerts at the first WATCH / first ACT, explaining what changed, by how much vs
     baseline, since which Sol, and food + servings to close the intake gap.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.ml.crew_data import CrewData, FRESH_PREFIX, load_catalog
from app.ml.physiology import (
    BIOMARKERS,
    NUTRIENTS,
    VITALS,
    VITAL_SD_FLOOR,
    VITAMIN_D,
    daily_need_mg,
    equilibrium_pool,
    personal_turnover,
    sols_to_risk,
    vitamin_d_personal_rate,
    vitamin_d_sols_to_risk,
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
VITALS_REFERENCE_LAG_SOLS = 28     # trend-following vitals reference window ends this many Sols back
DRIVER_FORECAST = "nutrient_forecast"
DRIVER_VITAL = "vital_zscore"

INTAKE_COLS = [f"{n}_intake_mg" for n in NUTRIENTS]
MODEL_FEATURES = VITALS + INTAKE_COLS
ZSCORE_COLS = VITALS + INTAKE_COLS + BIOMARKERS
VITD = "vitamin_d"
ALL_NUTRIENTS = list(NUTRIENTS) + [VITD]
VITD_SUPPLEMENT_UG = VITAMIN_D["supplement_ug_day"]   # one ISS supplement tablet = one "serving"
STATUS_RANK = {"CALIBRATING": -1, "NOMINAL": 0, "WATCH": 1, "ACT": 2}

SIGNAL_LABELS = {
    "hr_rest": "Resting heart rate",
    "sleep_h": "Sleep duration",
    "body_mass_kg": "Body mass",
    "fatigue_score": "Fatigue score",
    **{f"{n}_intake_mg": f"{cfg['label']} intake" for n, cfg in NUTRIENTS.items()},
    **{f"{n}_pool_mg": f"{cfg['label']} body pool" for n, cfg in NUTRIENTS.items()},
    VITAMIN_D["status_col"]: "Serum 25-hydroxyvitamin D",
    VITAMIN_D["intake_col"]: "Vitamin D intake (food + supplement)",
}
NUTRIENT_LABELS = {**{n: cfg["label"] for n, cfg in NUTRIENTS.items()}, VITD: VITAMIN_D["label"]}
VITAL_UNITS = {"hr_rest": "bpm", "sleep_h": "h", "body_mass_kg": "kg", "fatigue_score": "score"}


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
    cols = ZSCORE_COLS
    mu = base[cols].mean()
    floors = pd.Series({**VITAL_SD_FLOOR, **{c: INTAKE_SD_FLOOR_FRACTION * mu[c] for c in INTAKE_COLS + BIOMARKERS}})
    sd = np.maximum(base[cols].std(), floors[cols])
    return PersonalBaseline(mean=mu, sd=sd)


def vitals_reference(g: pd.DataFrame, baseline: PersonalBaseline, baseline_sols: int,
                     lag_sols: int = VITALS_REFERENCE_LAG_SOLS) -> pd.DataFrame:
    """
    Causal trend-following reference level per vital: mean over Sols [i - lag - W + 1, i - lag]
    (W = baseline_sols); the fixed personal-baseline mean before that window exists.
    """
    ref = g[VITALS].rolling(baseline_sols, min_periods=baseline_sols).mean().shift(lag_sols)
    return ref.fillna(baseline.mean[VITALS])


def baseline_zscores(g: pd.DataFrame, baseline: PersonalBaseline, smoothing_sols: int,
                     reference: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """z vs the fixed personal baseline; vitals vs `reference` (trend-following level) when given."""
    cols = list(baseline.mean.index)
    z = (g[cols] - baseline.mean) / baseline.sd
    if reference is not None:
        z[VITALS] = (g[VITALS] - reference[VITALS]) / baseline.sd[VITALS]
    return z.rolling(smoothing_sols, min_periods=smoothing_sols).mean()


def status_driver(status: str, worst_nutrient: str, worst_sols_to_risk: float, vital: str,
                  vital_abs_z: float) -> Tuple[str, str]:
    """
    Largest contributor to the status, each signal relative to its own rule threshold:
    forecast WATCH_SOLS_TO_RISK / Sols-to-risk vs vital |z| / WATCH_Z. ACT can only come from the forecast.
    """
    forecast_ratio = np.inf if worst_sols_to_risk <= 0 else WATCH_SOLS_TO_RISK / worst_sols_to_risk
    vital_ratio = vital_abs_z / WATCH_Z
    if status == "ACT" or forecast_ratio >= vital_ratio:
        return DRIVER_FORECAST, worst_nutrient
    return DRIVER_VITAL, vital


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
        source = "packaged (greenhouse offline; content at current storage retention)"
        ret = data.retention[nutrient]
        candidates = {i: catalog[i][f] * float(ret[i].iloc[sol]) for i in ret.columns}
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


def recommend_vitamin_d(gap_ug: float) -> Dict[str, Any]:
    """Vitamin D gap is closed with supplement tablets: the food system has very little vitamin D."""
    servings = gap_ug / VITD_SUPPLEMENT_UG
    return {
        "food_id": None,
        "food_name": f"vitamin D3 supplement ({VITD_SUPPLEMENT_UG:.0f} ug = {VITD_SUPPLEMENT_UG * VITAMIN_D['iu_per_ug']:.0f} IU tablet)",
        "source": "supplement (space food system is low in vitamin D; no UV synthesis in flight)",
        "nutrient_per_serving_mg": VITD_SUPPLEMENT_UG / 1000.0,
        "dose_ug_per_day": round(gap_ug, 2),
        "dose_iu_per_day": round(gap_ug * VITAMIN_D["iu_per_ug"], 0),
        "servings_per_sol": round(servings, 2),
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
    if row["driver_kind"] == DRIVER_VITAL:
        return _explain_vital(res, data, sol)
    nutrient = row["driver_signal"]
    if nutrient == VITD:
        return _explain_vitamin_d(res, data, sol)
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
        "driver_kind": DRIVER_FORECAST,
        "driver_signal": nutrient,
        "nutrient": nutrient,
        "pool_mg": _num(pool_now, 1),
        "risk_threshold_mg": cfg["risk_threshold_mg"],
        "status_value": _num(pool_now, 1),
        "status_unit": "mg",
        "risk_threshold": cfg["risk_threshold_mg"],
        "sols_to_risk": _num(s2r, 0),
        "projected_risk_sol": int(round(sol + s2r)) if np.isfinite(s2r) else None,
        "top_vital_driver": driver,
        "driver_z": _num(row["driver_z"]),
        "anomaly_score": _num(row["anomaly_score"], 3),
        "since_sol": since_sol,
        "since_signal": since_signal,
        "changes": changes,
        "intake_gap_mg_per_sol": _num(gap_mg),
        "intake_gap": _num(gap_mg),
        "intake_gap_unit": "mg/Sol",
        "recommendation": recommendation,
        "action": action,
        "message": message,
    }


def _explain_vitamin_d(res: AstronautResult, data: CrewData, sol: int) -> Dict[str, Any]:
    """Assessment when vitamin D status is the worst-forecast nutrient (uses data up to `sol` only)."""
    vd = VITAMIN_D
    fr = res.frame
    row = fr.iloc[sol]
    col, intake_col = vd["status_col"], vd["intake_col"]
    driver = row["top_driver"]
    level = float(row[col])
    base = res.pool_baseline[VITD]
    preflight = float(fr[col].iloc[0])
    intake = float(row[intake_col])
    s2r = float(row["sols_to_risk"])
    rate = float(row[f"{VITD}_k_per_sol"])

    def pct(cur: float, ref: float) -> Optional[float]:
        return _num(100.0 * (cur - ref) / ref, 1) if ref else None

    recent = fr.iloc[sol - data.scenario.trend_window_sols + 1: sol + 1]
    intake_base = float(fr[intake_col].iloc[: data.scenario.baseline_sols].mean())
    changes = [
        {"signal": intake_col, "label": SIGNAL_LABELS[intake_col], "baseline": _num(intake_base),
         "current": _num(intake), "pct_change_vs_baseline": pct(intake, intake_base), "z": None},
        {"signal": col, "label": SIGNAL_LABELS[col], "baseline": _num(base), "current": _num(level),
         "pct_change_vs_baseline": pct(level, base), "z": _num(row[f"z_{col}"])},
        {"signal": driver, "label": SIGNAL_LABELS[driver], "baseline": _num(float(res.baseline.mean[driver])),
         "current": _num(float(recent[driver].mean())),
         "pct_change_vs_baseline": pct(float(recent[driver].mean()), float(res.baseline.mean[driver])),
         "z": _num(row["driver_z"])},
    ]
    since_sol = _run_start((fr[f"z_{col}"] <= ONSET_INTAKE_Z).to_numpy(), sol)
    since_signal = col if since_sol is not None else None
    if since_sol is None:
        since_sol = sol

    gap_ug = max(0.0, vd["requirement_ug_day"] - intake)
    recommendation = recommend_vitamin_d(gap_ug) if gap_ug > 0 else None
    if recommendation is None:
        action = "monitor"
    else:
        action = (f"add {recommendation['servings_per_sol']:.1f} servings/Sol of {recommendation['food_name']} "
                  f"(+{gap_ug:.1f} ug/day to reach NASA's {vd['requirement_ug_day']:.0f} ug/day requirement)")
    forecast_txt = (f"forecast to fall below {vd['risk_threshold_nmol_l']:.0f} nmol/L in {s2r:.0f} Sols (Sol {sol + s2r:.0f})"
                    if np.isfinite(s2r) else "no threshold crossing forecast at current intake")
    message = (
        f"{vd['label']} {level:.1f} nmol/L ({pct(level, preflight):+.0f}% vs pre-flight {preflight:.0f} nmol/L; "
        f"no UV synthesis in flight), declining {100 * rate:.2f}%/Sol, {forecast_txt}. "
        f"Vitamin D intake {intake:.1f} ug/day vs {vd['requirement_ug_day']:.0f} ug/day required. "
        f"Top vital driver: {SIGNAL_LABELS[driver]} (z {row['driver_z']:+.1f}). Action: {action}."
    )
    return {
        "astronaut_id": res.astronaut,
        "sol": int(sol),
        "status": row["status"],
        "driver_kind": DRIVER_FORECAST,
        "driver_signal": VITD,
        "nutrient": VITD,
        "pool_mg": None,
        "risk_threshold_mg": None,
        "status_value": _num(level, 1),
        "status_unit": vd["status_unit"],
        "risk_threshold": vd["risk_threshold_nmol_l"],
        "sols_to_risk": _num(s2r, 0),
        "projected_risk_sol": int(round(sol + s2r)) if np.isfinite(s2r) else None,
        "top_vital_driver": driver,
        "driver_z": _num(row["driver_z"]),
        "anomaly_score": _num(row["anomaly_score"], 3),
        "since_sol": since_sol,
        "since_signal": since_signal,
        "changes": changes,
        "intake_gap_mg_per_sol": _num(gap_ug / 1000.0, 4),
        "intake_gap": _num(gap_ug),
        "intake_gap_unit": "ug/day",
        "recommendation": recommendation,
        "action": action,
        "message": message,
    }


def _explain_vital(res: AstronautResult, data: CrewData, sol: int) -> Dict[str, Any]:
    """Assessment when a vital-sign change (not a nutrient forecast) is the largest contributor to WATCH."""
    fr = res.frame
    row = fr.iloc[sol]
    v = row["driver_signal"]
    z = float(row[f"z_{v}"])
    recent = fr.iloc[sol - data.scenario.smoothing_sols + 1: sol + 1]
    current, ref = float(recent[v].mean()), float(row[f"ref_{v}"])
    since_sol = _run_start((fr[f"z_{v}"].abs() >= WATCH_Z).to_numpy(), sol)
    nearest, s2r = row["worst_nutrient"], float(row["sols_to_risk"])

    def pct(cur: float, b: float) -> Optional[float]:
        return _num(100.0 * (cur - b) / b, 1) if b else None

    context = []
    for n in ALL_NUTRIENTS:
        col = VITAMIN_D["status_col"] if n == VITD else f"{n}_pool_mg"
        context.append({"nutrient": n, "sols_to_risk": _num(row[f"{n}_sols_to_risk"], 0),
                        "status_value": _num(row[col]),
                        "pct_change_vs_baseline": pct(float(row[col]), res.pool_baseline[n])})
    changes = [{"signal": v, "label": SIGNAL_LABELS[v], "baseline": _num(ref), "current": _num(current),
                "pct_change_vs_baseline": pct(current, ref), "z": _num(z)}]
    nearest_txt = (f"nearest forecast: {NUTRIENT_LABELS[nearest]} in {s2r:.0f} Sols" if np.isfinite(s2r)
                   else "no nutrient forecast to cross its threshold")
    moved = min(context, key=lambda c: c["pct_change_vs_baseline"] if c["pct_change_vs_baseline"] is not None else 0.0)
    if moved["pct_change_vs_baseline"] is not None and moved["pct_change_vs_baseline"] < 0:
        nearest_txt += (f"; largest nutrient change: {NUTRIENT_LABELS[moved['nutrient']]} "
                        f"{moved['pct_change_vs_baseline']:+.0f}% vs baseline, above its threshold")
    action = f"re-measure {SIGNAL_LABELS[v].lower()} and review crew log; no diet change indicated by the nutrient model"
    message = (
        f"{SIGNAL_LABELS[v]} {current:.1f} {VITAL_UNITS[v]} vs personal reference {ref:.1f} "
        f"({pct(current, ref):+.0f}%, z {z:+.1f}) since Sol {since_sol}: largest contributor to {row['status']}. "
        f"Not explained by a nutrient forecast within {WATCH_SOLS_TO_RISK} Sols ({nearest_txt}). Action: {action}."
    )
    return {
        "astronaut_id": res.astronaut,
        "sol": int(sol),
        "status": row["status"],
        "driver_kind": DRIVER_VITAL,
        "driver_signal": v,
        "nutrient": None,
        "pool_mg": None,
        "risk_threshold_mg": None,
        "status_value": _num(current),
        "status_unit": VITAL_UNITS[v],
        "risk_threshold": None,
        "sols_to_risk": _num(s2r, 0),
        "projected_risk_sol": int(round(sol + s2r)) if np.isfinite(s2r) else None,
        "top_vital_driver": v,
        "driver_z": _num(z),
        "anomaly_score": _num(row["anomaly_score"], 3),
        "since_sol": since_sol,
        "since_signal": v,
        "changes": changes,
        "nutrient_context": context,
        "intake_gap_mg_per_sol": None,
        "intake_gap": None,
        "intake_gap_unit": None,
        "recommendation": None,
        "action": action,
        "message": message,
    }


def analyze_astronaut(g: pd.DataFrame, data: CrewData) -> AstronautResult:
    sc = data.scenario
    g = g.sort_values("sol").reset_index(drop=True).copy()
    astronaut = str(g["astronaut"].iloc[0])
    n_sols = len(g)

    baseline = personal_baseline(g, sc.baseline_sols)
    reference = vitals_reference(g, baseline, sc.baseline_sols)
    z = baseline_zscores(g, baseline, sc.smoothing_sols, reference)
    for c in z.columns:
        g[f"z_{c}"] = z[c].values
    for v in VITALS:
        g[f"ref_{v}"] = reference[v].values

    iso = fit_baseline_isolation_forest(g, sc.baseline_sols, sc.seed)
    g["anomaly_score"] = -iso.score_samples(g[MODEL_FEATURES])
    g["iso_outlier"] = iso.predict(g[MODEL_FEATURES]) == -1

    pools = {n: g[f"{n}_pool_mg"].to_numpy() for n in NUTRIENTS}
    intakes = {n: g[f"{n}_intake_mg"].to_numpy() for n in NUTRIENTS}
    vit_d = g[VITAMIN_D["status_col"]].to_numpy()
    zv = z[VITALS].to_numpy()

    per_n = {n: {"k": np.full(n_sols, np.nan), "eq": np.full(n_sols, np.nan), "s2r": np.full(n_sols, np.nan)}
             for n in ALL_NUTRIENTS}
    status = np.array(["CALIBRATING"] * n_sols, dtype=object)
    worst_n = np.array([None] * n_sols, dtype=object)
    worst_s2r = np.full(n_sols, np.nan)
    driver = np.array([None] * n_sols, dtype=object)
    driver_z = np.full(n_sols, np.nan)
    driver_kind = np.array([None] * n_sols, dtype=object)
    driver_signal = np.array([None] * n_sols, dtype=object)

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
        # Vitamin D: personal log-linear decline (no UV), forecast vs NASA band edge
        r_d = vitamin_d_personal_rate(vit_d[: i + 1])
        s_d = vitamin_d_sols_to_risk(float(vit_d[i]), r_d, VITAMIN_D["risk_threshold_nmol_l"])
        per_n[VITD]["k"][i], per_n[VITD]["s2r"][i] = r_d, s_d
        if s_d < best_s:
            best_n, best_s = VITD, s_d
        if best_n is None:
            # no nutrient on course to the threshold: report the one with the lowest relative pool
            best_n = min(NUTRIENTS, key=lambda n: pools[n][i] / NUTRIENTS[n]["pool_max_mg"])
        worst_n[i], worst_s2r[i] = best_n, best_s
        status[i] = classify_status(best_s, abs(zv[i, d]))
        driver_kind[i], driver_signal[i] = status_driver(status[i], best_n, best_s, VITALS[d], abs(zv[i, d]))

    for n in ALL_NUTRIENTS:
        g[f"{n}_k_per_sol"] = per_n[n]["k"]
        g[f"{n}_pool_eq_mg"] = per_n[n]["eq"]
        g[f"{n}_sols_to_risk"] = per_n[n]["s2r"]
    g["worst_nutrient"] = worst_n
    g["sols_to_risk"] = worst_s2r
    g["top_driver"] = driver
    g["driver_z"] = driver_z
    g["driver_kind"] = driver_kind
    g["driver_signal"] = driver_signal
    g["status"] = status

    res = AstronautResult(
        astronaut=astronaut,
        baseline=baseline,
        pool_baseline={**{n: float(g.loc[g.sol < sc.baseline_sols, f"{n}_pool_mg"].mean()) for n in NUTRIENTS},
                       VITD: float(g.loc[g.sol < sc.baseline_sols, VITAMIN_D["status_col"]].mean())},
        frame=g,
    )
    for n, cfg in NUTRIENTS.items():
        below = np.flatnonzero(pools[n] <= cfg["risk_threshold_mg"])
        res.threshold_crossing_sol[n] = int(below[0]) if below.size else None
    below = np.flatnonzero(vit_d <= VITAMIN_D["risk_threshold_nmol_l"])
    res.threshold_crossing_sol[VITD] = int(below[0]) if below.size else None

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
