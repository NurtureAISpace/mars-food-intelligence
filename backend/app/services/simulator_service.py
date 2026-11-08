import math
from typing import Dict, Any, List, Optional
from app.core.constants import NASA_STD_3001_REQUIREMENTS, SOL_IN_EARTH_DAYS
from app.core.scientific_models import (
    arrhenius_rate_constant,
    first_order_retention,
    calculate_composite_space_food_index
)
from app.pipeline.ingest import load_raw_catalog, load_crop_models


class MissionSimulatorService:
    def __init__(self):
        self.catalog = load_raw_catalog()
        self.crops = load_crop_models()

    def run_mission_simulation(
        self,
        mission_duration_sols: int = 600,
        crew_size: int = 4,
        storage_regime: str = "CHILLED", # CHILLED (4C) or AMBIENT (21C)
        cooling_failure_sol: Optional[int] = None,
        failure_duration_sols: int = 45,
        failure_peak_temp_c: float = 29.5,
        crop_failure_sol: Optional[int] = None,
        crop_area_m2: float = 18.0,
        ration_strategy: str = "NOMINAL_FULL" # NOMINAL_FULL, CONSERVATION_15_PCT, SURVIVAL
    ) -> Dict[str, Any]:
        """
        Executes Sol-by-Sol dynamic Mars habitat simulation modeling nutrition degradation,
        bio-regenerative harvest cycles, subsystem thermal failures, and crew health indicators.
        """
        # Baseline storage temp
        nominal_temp_c = 4.0 if storage_regime == "CHILLED" else 21.0
        
        # Initial inventory: 1.6 kg food package per crew member per Sol + 20% margin
        initial_food_mass_kg = crew_size * 1.6 * mission_duration_sols * 1.2
        remaining_food_mass_kg = initial_food_mass_kg

        # Daily consumption based on strategy
        daily_cal_target = NASA_STD_3001_REQUIREMENTS["calories_kcal"]["nominal"]
        if ration_strategy == "CONSERVATION_15_PCT":
            daily_cal_target *= 0.85
        elif ration_strategy == "SURVIVAL":
            daily_cal_target *= 0.70

        daily_mass_burn_kg = (crew_size * daily_cal_target / 2800.0) * 1.5

        # Representative Arrhenius kinetic constants for space rations
        # Weighted avg: Ea ~ 51 kJ/mol, A ~ 20000 day^-1 for Thiamine
        # Ea ~ 58 kJ/mol for Vitamin C
        thiamine_A = 21000.0
        thiamine_Ea = 51.5
        vit_c_A = 35000.0
        vit_c_Ea = 55.0

        current_thiamine_pct = 100.0
        current_vit_c_pct = 100.0
        current_sensory_score = 9.0

        time_series = []
        alerts = []
        total_biomass_harvested_kg = 0.0
        total_energy_kwh = 0.0
        critical_failure_sol: Optional[int] = None

        step = 10  # simulate every 10 Sols
        for sol in range(0, mission_duration_sols + 1, step):
            delta_sols = step if sol > 0 else 0
            delta_days = delta_sols * SOL_IN_EARTH_DAYS

            # Determine ambient temperature at this Sol
            is_cooling_down = False
            if cooling_failure_sol is not None:
                if cooling_failure_sol <= sol < (cooling_failure_sol + failure_duration_sols):
                    is_cooling_down = True
                    current_temp_c = failure_peak_temp_c
                else:
                    current_temp_c = nominal_temp_c
            else:
                current_temp_c = nominal_temp_c

            # Arrhenius degradation step
            if delta_days > 0:
                k_b1 = arrhenius_rate_constant(thiamine_A, thiamine_Ea, current_temp_c)
                k_vitc = arrhenius_rate_constant(vit_c_A, vit_c_Ea, current_temp_c)
                current_thiamine_pct = first_order_retention(current_thiamine_pct, k_b1, delta_days)
                current_vit_c_pct = first_order_retention(current_vit_c_pct, k_vitc, delta_days)
                
                # Sensory decay accelerates with higher temperatures
                sensory_decay_rate = 0.0008 * (1.8 ** ((current_temp_c - 4.0) / 10.0))
                current_sensory_score = max(2.0, current_sensory_score - (sensory_decay_rate * delta_days * 10.0))

                # Food mass inventory deduction
                remaining_food_mass_kg = max(0.0, remaining_food_mass_kg - (daily_mass_burn_kg * delta_sols))

            # Bio-regenerative Crop Yield Calculation
            is_crop_impaired = (crop_failure_sol is not None) and (sol >= crop_failure_sol)
            crop_yield_factor = 0.25 if is_crop_impaired else 1.0

            # Daily fresh biomass from greenhouse
            # Average 280 g/m2/day across crops
            daily_fresh_biomass_g = crop_area_m2 * 280.0 * crop_yield_factor
            fresh_harvest_step_kg = (daily_fresh_biomass_g * delta_sols) / 1000.0
            total_biomass_harvested_kg += fresh_harvest_step_kg

            # Power consumption (chilling food storage + greenhouse lighting)
            chilling_power_w = remaining_food_mass_kg * (0.45 if current_temp_c <= 6.0 else 0.08)
            greenhouse_power_w = crop_area_m2 * 120.0
            daily_kwh = ((chilling_power_w + greenhouse_power_w) * 24.0) / 1000.0
            total_energy_kwh += daily_kwh * (delta_sols if delta_sols > 0 else 1)

            # Compute Food Security Index
            caloric_security_pct = (remaining_food_mass_kg / initial_food_mass_kg) * 100.0 if initial_food_mass_kg > 0 else 0.0
            security_index = calculate_composite_space_food_index(
                calories_pct=caloric_security_pct,
                thiamine_pct=current_thiamine_pct,
                vitamin_c_pct=current_vit_c_pct,
                sensory_score_10=current_sensory_score,
                microbial_viability_pct=95.0 if not is_cooling_down else 72.0
            )

            # Sol Alarms
            sol_alerts = []
            if is_cooling_down:
                sol_alerts.append(f"SOL-{sol} WARNING: Cooling Loop Malfunction (+{current_temp_c:.1f}C)")
            if current_thiamine_pct < 50.0:
                sol_alerts.append(f"SOL-{sol} CRITICAL: Thiamine dropped to {current_thiamine_pct:.1f}% (Beriberi Risk)")
                if critical_failure_sol is None:
                    critical_failure_sol = sol
            if current_vit_c_pct < 45.0:
                sol_alerts.append(f"SOL-{sol} ALERT: Vitamin C degradation below 45% (Scurvy Risk)")
            if is_crop_impaired and sol == crop_failure_sol:
                sol_alerts.append(f"SOL-{sol} HAZARD: Greenhouse Aeroponic Pathogen / Blight Outbreak (-75% yield)")
            if remaining_food_mass_kg < (initial_food_mass_kg * 0.15):
                sol_alerts.append(f"SOL-{sol} EMERGENCY: Rations below 15% reserve threshold")

            alerts.extend(sol_alerts)

            time_series.append({
                "sol": sol,
                "storage_temp_c": round(current_temp_c, 1),
                "remaining_mass_kg": round(remaining_food_mass_kg, 1),
                "daily_fresh_biomass_g": round(daily_fresh_biomass_g, 1),
                "thiamine_retention_pct": round(current_thiamine_pct, 1),
                "vitamin_c_retention_pct": round(current_vit_c_pct, 1),
                "sensory_score": round(current_sensory_score, 2),
                "food_security_index": security_index,
                "power_draw_kw": round((chilling_power_w + greenhouse_power_w) / 1000.0, 2),
                "active_alarm_count": len(sol_alerts)
            })

        min_security_index = min(pt["food_security_index"] for pt in time_series)

        return {
            "mission_parameters": {
                "duration_sols": mission_duration_sols,
                "crew_size": crew_size,
                "storage_regime": storage_regime,
                "ration_strategy": ration_strategy,
                "crop_area_m2": crop_area_m2,
                "cooling_failure_sol": cooling_failure_sol,
                "crop_failure_sol": crop_failure_sol
            },
            "summary_metrics": {
                "mission_survived": critical_failure_sol is None or critical_failure_sol >= mission_duration_sols,
                "first_critical_sol": critical_failure_sol,
                "minimum_food_security_index": min_security_index,
                "final_food_security_index": time_series[-1]["food_security_index"],
                "total_biomass_harvested_kg": round(total_biomass_harvested_kg, 1),
                "total_cumulative_energy_kwh": round(total_energy_kwh, 1),
                "total_alerts_count": len(alerts)
            },
            "critical_advisories": alerts,
            "telemetry_timeline": time_series
        }
