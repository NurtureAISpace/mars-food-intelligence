"""
Body vitamin pool physiology for the Crew Health module.

Each astronaut's body pool P (mg) of a water-soluble vitamin follows a first-order
balance, stepped once per Sol:

    P[t+1] = min(P_max, P[t] * (1 - k) + a * I[t])

    k  : turnover per Sol (population value * individual scale)
    a  : absorbed fraction of intake
    I  : intake actually eaten that Sol (mg)

With constant intake the continuous solution is
    P(t) = P_eq + (P_0 - P_eq) * exp(-k t),   P_eq = a * I / k
which gives an analytic "Sols until the pool crosses the risk threshold".

NOTE: the constants below are approximate literature values, verify before use.
They are intended for demonstration only and carry no clinical meaning.
"""

from typing import Dict, Any

import numpy as np

from app.core.constants import SOL_IN_EARTH_DAYS

# ---------------------------------------------------------------------------
# Approximate literature values, verify before use
# ---------------------------------------------------------------------------
NUTRIENTS: Dict[str, Dict[str, Any]] = {
    "vitamin_c": {
        "label": "Vitamin C",
        "catalog_field": "vitamin_c_mg",
        "absorption": 0.70,          # fraction of intake absorbed
        "turnover_per_day": 0.040,   # first-order body turnover (per Earth day)
        "pool_max_mg": 1500.0,
        "risk_threshold_mg": 400.0,  # early-warning level, above clinical deficiency
    },
    "thiamine_b1": {
        "label": "Thiamine B1",
        "catalog_field": "thiamine_b1_mg",
        "absorption": 0.60,
        "turnover_per_day": 0.030,
        "pool_max_mg": 30.0,
        "risk_threshold_mg": 10.0,   # early-warning level, above clinical deficiency
    },
}

# Observable vital signs simulated for each astronaut
VITALS = ["hr_rest", "sleep_h", "body_mass_kg", "fatigue_score"]

# Measurement-noise floor for personal-baseline standard deviations
VITAL_SD_FLOOR: Dict[str, float] = {"hr_rest": 2.0, "sleep_h": 0.3, "body_mass_kg": 0.5, "fatigue_score": 0.7}

# Target pool level (fraction of capacity) used to size corrective intake
TARGET_POOL_FRACTION = 0.8

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


def daily_need_mg(cfg: Dict[str, Any], target_fraction: float = TARGET_POOL_FRACTION) -> float:
    """Daily intake that holds the pool at target_fraction of capacity (population turnover)."""
    return cfg["turnover_per_day"] * cfg["pool_max_mg"] * target_fraction / cfg["absorption"]
