"""
Body vitamin physiology for the Crew Health module.

Water-soluble vitamins (C, B1): body pool P (mg), first-order balance stepped once per Sol:

    P[t+1] = min(P_max, P[t] * (1 - k) + a * I[t])

    k  : turnover per Sol (population value * individual scale)
    a  : absorbed fraction of intake
    I  : intake actually eaten that Sol (mg)

With constant intake the continuous solution is
    P(t) = P_eq + (P_0 - P_eq) * exp(-k t),   P_eq = a * I / k
which gives an analytic "Sols until the pool crosses the risk threshold".

Vitamin D status: serum 25-hydroxyvitamin D (nmol/L). There is no UV synthesis in a shielded
spacecraft, so status declines exponentially at a rate set by intake (food + supplement):

    D[t+1] = D[t] * exp(-r(I) * days_per_Sol)
    r(I)   = r_ISS * max(0, I_req - I) / (I_req - I_ISS)

r_ISS is calibrated to the measured ISS decline (63 -> 48 nmol/L over 128-195 d missions with a
10 ug/d supplement taken 5.7 times/week); I_req is NASA's 25 ug/d requirement. The linear form
between those two anchors is an assumption (see literature_params.json).

Every constant is read from app/data/literature_params.json (app.ml.params) with its source and
status. Values are for demonstration and carry no clinical meaning.
"""

import math
from typing import Dict, Any

import numpy as np

from app.core.constants import SOL_IN_EARTH_DAYS
from app.ml.params import param

# ---------------------------------------------------------------------------
# Water-soluble vitamin pools (values + sources in literature_params.json)
# ---------------------------------------------------------------------------
def _pool_nutrient(key: str, label: str, catalog_field: str) -> Dict[str, Any]:
    return {
        "label": label,
        "catalog_field": catalog_field,
        "absorption": param(f"{key}.absorption"),
        "turnover_per_day": param(f"{key}.turnover_per_day"),
        "pool_max_mg": param(f"{key}.pool_max_mg"),
        "risk_threshold_mg": param(f"{key}.risk_threshold_mg"),
        "requirement_mg_day": param(f"{key}.requirement_mg_day"),
    }


NUTRIENTS: Dict[str, Dict[str, Any]] = {
    "vitamin_c": _pool_nutrient("vitamin_c", "Vitamin C", "vitamin_c_mg"),
    "thiamine_b1": _pool_nutrient("thiamine_b1", "Thiamine B1", "thiamine_b1_mg"),
}

# ---------------------------------------------------------------------------
# Vitamin D status (serum 25-hydroxyvitamin D)
# ---------------------------------------------------------------------------
_supp_per_week = param("vitamin_d.supplement_doses_per_week")
VITAMIN_D: Dict[str, Any] = {
    "label": "Vitamin D (25-OH-D)",
    "status_col": "vitamin_d_25ohd_nmol_l",
    "intake_col": "vitamin_d_intake_ug",
    "status_unit": "nmol/L",
    "intake_unit": "ug/day",
    "preflight": param("vitamin_d.preflight_25ohd_nmol_l"),               # {"mean", "sd"}
    "supplement_ug_day": param("vitamin_d.supplement_ug_day"),
    "doses_per_week": _supp_per_week,                                      # {"mean", "sd"}
    "food_intake_ug_day": param("vitamin_d.food_intake_ug_day"),
    "decline_rate_per_day_iss": param("vitamin_d.decline_rate_per_day_iss"),
    "requirement_ug_day": param("vitamin_d.requirement_ug_day"),
    "risk_threshold_nmol_l": param("vitamin_d.risk_threshold_nmol_l"),
    "optimal_nmol_l": param("vitamin_d.optimal_nmol_l"),
    "iu_per_ug": param("vitamin_d.iu_per_ug"),
}
# Mean ISS intake behind the calibrated decline: food + supplement * (doses per week / 7)
VITAMIN_D["iss_intake_ug_day"] = (VITAMIN_D["food_intake_ug_day"]
                                  + VITAMIN_D["supplement_ug_day"] * _supp_per_week["mean"] / 7.0)

# Observable vital signs simulated for each astronaut
VITALS = ["hr_rest", "sleep_h", "body_mass_kg", "fatigue_score"]

# Lab biomarkers that are z-scored and reported, but not used as |z| WATCH drivers or
# IsolationForest features: 25-OH-D is expected to decline monotonically in flight (no UV), so a
# z vs the first 21 Sols saturates early; its status is driven by the forecast vs NASA's band.
BIOMARKERS = [VITAMIN_D["status_col"]]

# Measurement-noise floor for personal-baseline standard deviations (model design, not physiology)
VITAL_SD_FLOOR: Dict[str, float] = {"hr_rest": 2.0, "sleep_h": 0.3, "body_mass_kg": 0.5, "fatigue_score": 0.7}

# Bounds on an estimated personal turnover rate (per Sol)
_K_MIN, _K_MAX = 1e-4, 0.5
_MIN_UNCAPPED_POINTS = 10


def population_turnover_per_sol(cfg: Dict[str, Any], scale: float = 1.0) -> float:
    """Population first-order turnover converted to per-Sol, optionally scaled per individual."""
    return cfg["turnover_per_day"] * scale * SOL_IN_EARTH_DAYS


def steady_state_pool(cfg: Dict[str, Any], intake_mg: float, k_per_sol: float) -> float:
    """Pool level reached under constant intake: P_eq = a * I / k, capped at capacity."""
    return min(cfg["pool_max_mg"], cfg["absorption"] * intake_mg / k_per_sol)


def pool_step(pool_mg: float, intake_mg: float, k_per_sol: float, cfg: Dict[str, Any]) -> float:
    """One Sol of the first-order pool balance: P' = min(P_max, P * (1 - k) + a * I)."""
    return min(cfg["pool_max_mg"], pool_mg * (1 - k_per_sol) + cfg["absorption"] * intake_mg)


def personal_turnover(pool: np.ndarray, intake: np.ndarray, cfg: Dict[str, Any]) -> float:
    """
    Estimates an astronaut's own first-order turnover rate k (per Sol) by least squares on
    dP = absorption * intake - k * P, using only Sols where the pool is below capacity.
    Falls back to the population value when there is not enough uncapped history.
    """
    pool = np.asarray(pool, dtype=float)
    intake = np.asarray(intake, dtype=float)
    if pool.size < 2:
        return population_turnover_per_sol(cfg)
    d_pool = np.diff(pool)
    p_next, absorbed = pool[1:], cfg["absorption"] * intake[1:]
    p_prev = pool[:-1]
    uncapped = p_next < cfg["pool_max_mg"] * 0.999
    if uncapped.sum() < _MIN_UNCAPPED_POINTS:
        return population_turnover_per_sol(cfg)
    x, y = p_prev[uncapped], absorbed[uncapped] - d_pool[uncapped]
    return float(np.clip(np.dot(x, y) / np.dot(x, x), _K_MIN, _K_MAX))


def equilibrium_pool(cfg: Dict[str, Any], mean_intake_mg: float, k_per_sol: float) -> float:
    """Uncapped equilibrium used by the forecast: P_eq = a * I / k."""
    return cfg["absorption"] * mean_intake_mg / k_per_sol


def sols_to_risk(pool_now: float, pool_eq: float, k_per_sol: float, threshold_mg: float) -> float:
    """
    Analytic Sols until P(t) = P_eq + (P_0 - P_eq) exp(-k t) reaches the threshold.
    Returns 0 if already at/below the threshold, inf if the trajectory never reaches it.
    """
    if pool_now <= threshold_mg:
        return 0.0
    if pool_eq >= threshold_mg:
        return float("inf")
    return float(np.log((pool_now - pool_eq) / (threshold_mg - pool_eq)) / k_per_sol)


def forecast_pool(pool_now: float, pool_eq: float, k_per_sol: float, horizon_sols: np.ndarray) -> np.ndarray:
    """P(t) for t in horizon_sols under constant recent intake."""
    return pool_eq + (pool_now - pool_eq) * np.exp(-k_per_sol * np.asarray(horizon_sols, dtype=float))


def daily_need_mg(cfg: Dict[str, Any]) -> float:
    """Daily intake requirement (NASA exploration requirement, see literature_params.json)."""
    return cfg["requirement_mg_day"]


# ---------------------------------------------------------------------------
# Vitamin D
# ---------------------------------------------------------------------------
def vitamin_d_decline_rate_per_day(intake_ug_day: float, cfg: Dict[str, Any] = VITAMIN_D) -> float:
    """r(I) = r_ISS * max(0, I_req - I) / (I_req - I_ISS); 0 once intake meets the requirement."""
    shortfall = max(0.0, cfg["requirement_ug_day"] - intake_ug_day)
    return cfg["decline_rate_per_day_iss"] * shortfall / (cfg["requirement_ug_day"] - cfg["iss_intake_ug_day"])


def vitamin_d_step(level_nmol_l: float, intake_ug_day: float, cfg: Dict[str, Any] = VITAMIN_D) -> float:
    """One Sol of no-UV exponential decline of serum 25-OH-D."""
    return level_nmol_l * math.exp(-vitamin_d_decline_rate_per_day(intake_ug_day, cfg) * SOL_IN_EARTH_DAYS)


def vitamin_d_personal_rate(levels: np.ndarray) -> float:
    """Personal decline rate per Sol from the log-linear slope of the history (>= 0)."""
    y = np.log(np.asarray(levels, dtype=float))
    if y.size < 2:
        return 0.0
    t = np.arange(y.size, dtype=float)
    slope = np.polyfit(t, y, 1)[0]
    return float(max(0.0, -slope))


def vitamin_d_sols_to_risk(level_now: float, rate_per_sol: float, threshold: float) -> float:
    """Sols until D(t) = D_0 exp(-r t) reaches the threshold (0 if at/below, inf if not declining)."""
    if level_now <= threshold:
        return 0.0
    if rate_per_sol <= 0:
        return float("inf")
    return float(math.log(level_now / threshold) / rate_per_sol)
