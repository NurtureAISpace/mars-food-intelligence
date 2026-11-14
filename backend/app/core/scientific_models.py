"""
Scientific degradation kinetics, thermodynamics, and biophysical models
for Space Food Intelligence on Mars.

Standard first-order / zero-order kinetics and the Arrhenius equation. The per-item constants
(A, Ea) used with these functions come from the synthetic food catalog; see docs/DATA_SOURCES.md.
"""

import math
from typing import List, Tuple, Dict, Any
from app.core.constants import R_GAS, KELVIN_ZERO_CELSIUS, SOL_IN_EARTH_DAYS


def celsius_to_kelvin(temp_celsius: float) -> float:
    """Converts temperature from Celsius to Kelvin."""
    return temp_celsius + KELVIN_ZERO_CELSIUS


def arrhenius_rate_constant(A: float, Ea_kJ_mol: float, temp_celsius: float) -> float:
    """
    Computes reaction rate constant k (day^-1) using Arrhenius equation:
    k = A * exp(-Ea / (R * T))
    
    Args:
        A: Pre-exponential frequency factor (day^-1)
        Ea_kJ_mol: Activation energy in kJ/mol
        temp_celsius: Storage temperature in Celsius
    
    Returns:
        Rate constant k (day^-1)
    """
    T_kelvin = celsius_to_kelvin(temp_celsius)
    if T_kelvin <= 0:
        raise ValueError("Temperature must be greater than absolute zero (-273.15 C)")
    
    Ea_joules = Ea_kJ_mol * 1000.0
    k = A * math.exp(-Ea_joules / (R_GAS * T_kelvin))
    return max(0.0, k)


def q10_temperature_factor(temp_celsius: float, ref_temp_celsius: float = 20.0, Q10: float = 2.2) -> float:
    """
    Computes Q10 acceleration factor relative to reference temperature:
    Factor = Q10 ** ((T - T_ref) / 10)
    """
    delta_t = temp_celsius - ref_temp_celsius
    return Q10 ** (delta_t / 10.0)


def first_order_retention(c0: float, k: float, time_days: float) -> float:
    """
    First-order degradation kinetics:
    C(t) = C0 * exp(-k * t)
    Used for heat-sensitive vitamins (Thiamine B1, Ascorbic acid C, Folic acid).
    """
    if time_days <= 0 or k <= 0:
        return c0
    return c0 * math.exp(-k * time_days)


def zero_order_retention(c0: float, k: float, time_days: float) -> float:
    """
    Zero-order degradation kinetics:
    C(t) = max(0, C0 - k * t)
    Used for enzymatic lipid oxidation and non-enzymatic browning in low-moisture space rations.
    """
    if time_days <= 0 or k <= 0:
        return c0
    return max(0.0, c0 - (k * time_days))


def half_life_days(k: float, order: int = 1, c0: float = 100.0) -> float:
    """Computes time (in Earth days) for 50% degradation."""
    if k <= 1e-12:
        return float("inf")
    if order == 1:
        return math.log(2.0) / k
    elif order == 0:
        return c0 / (2.0 * k)
    raise ValueError("Supported kinetic orders: 0 or 1")


def simulate_dynamic_temperature_degradation(
    initial_concentration: float,
    A: float,
    Ea_kJ_mol: float,
    sol_temperature_profile: List[Tuple[int, float]],
    order: int = 1
) -> List[Dict[str, Any]]:
    """
    Simulates nutrient degradation across a variable temperature profile across Sols.
    
    Args:
        initial_concentration: Starting concentration (mg, g, or %)
        A: Arrhenius frequency factor
        Ea_kJ_mol: Activation energy
        sol_temperature_profile: List of (Sol, Temperature_Celsius)
        order: Kinetic reaction order (1 or 0)
    
    Returns:
        List of dicts with Sol, Temp, k, Concentration, and RetentionPct.
    """
    results = []
    current_conc = initial_concentration
    prev_sol = 0

    for sol, temp_c in sol_temperature_profile:
        delta_sol = sol - prev_sol
        if delta_sol > 0:
            delta_earth_days = delta_sol * SOL_IN_EARTH_DAYS
            k = arrhenius_rate_constant(A, Ea_kJ_mol, temp_c)
            
            if order == 1:
                current_conc = first_order_retention(current_conc, k, delta_earth_days)
            else:
                current_conc = zero_order_retention(current_conc, k, delta_earth_days)
        else:
            k = arrhenius_rate_constant(A, Ea_kJ_mol, temp_c)
            
        retention_pct = (current_conc / initial_concentration) * 100.0 if initial_concentration > 0 else 0.0
        results.append({
            "sol": sol,
            "temperature_celsius": round(temp_c, 2),
            "rate_constant_k": float(f"{k:.6e}"),
            "concentration": round(current_conc, 4),
            "retention_percentage": round(retention_pct, 2)
        })
        prev_sol = sol

    return results


def calculate_composite_space_food_index(
    calories_pct: float,
    thiamine_pct: float,
    vitamin_c_pct: float,
    sensory_score_10: float,
    microbial_viability_pct: float
) -> float:
    """
    Calculates weighted Composite Food Viability Index (0 to 100)
    Weights are a modelling assumption of this project (no cited source):
    - Caloric stability: 30%
    - Thiamine (neurological protection): 25%
    - Vitamin C (oxidative/immune countermeasure): 20%
    - Sensory acceptance (anorexia in space countermeasure): 15%
    - Microbial safety: 10%
    """
    sensory_pct = (sensory_score_10 / 10.0) * 100.0
    composite = (
        0.30 * min(calories_pct, 100.0) +
        0.25 * min(thiamine_pct, 100.0) +
        0.20 * min(vitamin_c_pct, 100.0) +
        0.15 * min(sensory_pct, 100.0) +
        0.10 * min(microbial_viability_pct, 100.0)
    )
    return round(max(0.0, min(100.0, composite)), 2)
