import numpy as np
from typing import Dict, Any, List, Optional
from app.core.scientific_models import (
    arrhenius_rate_constant,
    first_order_retention,
    zero_order_retention,
    half_life_days,
    simulate_dynamic_temperature_degradation
)
from app.core.constants import SOL_IN_EARTH_DAYS
from app.pipeline.ingest import load_raw_catalog, load_raw_benchmarks


class PredictionService:
    def __init__(self):
        self.catalog = {item["id"]: item for item in load_raw_catalog()}
        self.benchmarks = load_raw_benchmarks()

    def predict_food_shelf_life(
        self,
        food_id: str,
        storage_temperature_c: float,
        critical_nutrient: str = "thiamine_b1",
        degradation_threshold_pct: float = 50.0,
        max_sols: int = 1200
    ) -> Dict[str, Any]:
        """
        Projects nutrient and sensory shelf-life for a specific food item
        under constant or controlled temperature conditions.
        """
        if food_id not in self.catalog:
            raise ValueError(f"Food ID '{food_id}' not found in catalog")
        
        food = self.catalog[food_id]
        A = food["arrhenius_A"]
        Ea = food["activation_energy_Ea_kJ_mol"]
        order = food.get("kinetic_order", 1)

        k = arrhenius_rate_constant(A, Ea, storage_temperature_c)
        half_life_e_days = half_life_days(k, order=order)
        half_life_sols = half_life_e_days / SOL_IN_EARTH_DAYS

        # Trajectory generation
        sols_timeline = list(range(0, max_sols + 1, 25))
        curve = []
        c0 = 100.0 # Normalized initial percentage
        drop_dead_sol: Optional[int] = None

        for sol in sols_timeline:
            earth_days = sol * SOL_IN_EARTH_DAYS
            if order == 1:
                ret = first_order_retention(c0, k, earth_days)
            else:
                ret = zero_order_retention(c0, k, earth_days)
            
            ret = round(max(0.0, ret), 2)
            if drop_dead_sol is None and ret < degradation_threshold_pct:
                drop_dead_sol = sol
            
            curve.append({"sol": sol, "retention_pct": ret})

        return {
            "food_id": food_id,
            "food_name": food["name"],
            "storage_temperature_c": storage_temperature_c,
            "rate_constant_k_per_day": float(f"{k:.6e}"),
            "half_life_sols": round(half_life_sols, 1),
            "critical_threshold_pct": degradation_threshold_pct,
            "drop_dead_sol": drop_dead_sol if drop_dead_sol is not None else max_sols,
            "status": "COMPROMISED" if drop_dead_sol and drop_dead_sol <= 450 else "STABLE",
            "retention_curve": curve
        }

    def simulate_temperature_excursion(
        self,
        food_id: str,
        excursion_sol: int = 150,
        excursion_duration_sols: int = 30,
        baseline_temp_c: float = 4.0,
        excursion_temp_c: float = 28.0,
        total_sols: int = 600
    ) -> Dict[str, Any]:
        """
        Simulates cooling system failure (e.g. Sol 150 power failure heating storage to 28C)
        and compares with uninterrupted 4C nominal baseline.
        """
        if food_id not in self.catalog:
            raise ValueError(f"Food ID '{food_id}' not found")
        
        food = self.catalog[food_id]
        A = food["arrhenius_A"]
        Ea = food["activation_energy_Ea_kJ_mol"]
        order = food.get("kinetic_order", 1)

        # Baseline (No failure)
        k_nominal = arrhenius_rate_constant(A, Ea, baseline_temp_c)
        k_excursion = arrhenius_rate_constant(A, Ea, excursion_temp_c)

        timeline = []
        curr_nominal = 100.0
        curr_excursion = 100.0

        for sol in range(0, total_sols + 1, 10):
            days_step = 10 * SOL_IN_EARTH_DAYS
            # Nominal progression
            curr_nominal = first_order_retention(curr_nominal, k_nominal, days_step) if order == 1 else zero_order_retention(curr_nominal, k_nominal, days_step)
            
            # Excursion progression
            if excursion_sol <= sol < (excursion_sol + excursion_duration_sols):
                curr_temp = excursion_temp_c
                k_active = k_excursion
            else:
                curr_temp = baseline_temp_c
                k_active = k_nominal
            
            curr_excursion = first_order_retention(curr_excursion, k_active, days_step) if order == 1 else zero_order_retention(curr_excursion, k_active, days_step)
            
            timeline.append({
                "sol": sol,
                "current_temp_c": curr_temp,
                "nominal_retention_pct": round(curr_nominal, 2),
                "excursion_retention_pct": round(curr_excursion, 2),
                "delta_degradation_pct": round(curr_nominal - curr_excursion, 2)
            })

        loss_due_to_failure = round(timeline[-1]["nominal_retention_pct"] - timeline[-1]["excursion_retention_pct"], 2)

        return {
            "food_id": food_id,
            "food_name": food["name"],
            "failure_sol": excursion_sol,
            "excursion_duration_sols": excursion_duration_sols,
            "baseline_temp_c": baseline_temp_c,
            "excursion_temp_c": excursion_temp_c,
            "final_retention_nominal_pct": timeline[-1]["nominal_retention_pct"],
            "final_retention_excursion_pct": timeline[-1]["excursion_retention_pct"],
            "accelerated_loss_due_to_failure_pct": loss_due_to_failure,
            "timeline": timeline
        }

    def validate_against_experimental_benchmarks(self) -> Dict[str, Any]:
        """
        Validates the mathematical Arrhenius degradation engine against
        empirical NASA JSC Food Lab datasets. Computes RMSE and R^2.
        """
        benchmarks = self.benchmarks.get("benchmarks", [])
        validation_results = []
        all_actual = []
        all_predicted = []

        for b in benchmarks:
            food_id = b["food_id"]
            if food_id not in self.catalog:
                continue
            food = self.catalog[food_id]
            A = food["arrhenius_A"]
            Ea = food["activation_energy_Ea_kJ_mol"]
            order = food.get("kinetic_order", 1)
            temp_c = b["temperature_c"]
            k = arrhenius_rate_constant(A, Ea, temp_c)

            series_predicted = []
            series_actual = []

            for dp in b["datapoints"]:
                sol = dp["sol"]
                actual_val = dp["measured_retention_pct"]
                days = sol * SOL_IN_EARTH_DAYS
                pred_val = first_order_retention(100.0, k, days) if order == 1 else zero_order_retention(100.0, k, days)
                
                series_actual.append(actual_val)
                series_predicted.append(pred_val)
                all_actual.append(actual_val)
                all_predicted.append(pred_val)

            series_actual_arr = np.array(series_actual)
            series_pred_arr = np.array(series_predicted)
            rmse = np.sqrt(np.mean((series_actual_arr - series_pred_arr) ** 2))
            ss_tot = np.sum((series_actual_arr - np.mean(series_actual_arr)) ** 2)
            ss_res = np.sum((series_actual_arr - series_pred_arr) ** 2)
            r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 1.0

            validation_results.append({
                "food_id": food_id,
                "food_name": food["name"],
                "nutrient": b["nutrient"],
                "temperature_c": temp_c,
                "sample_points": len(b["datapoints"]),
                "rmse": round(float(rmse), 3),
                "r2_score": round(float(r2), 4),
                "datapoints": [
                    {
                        "sol": dp["sol"],
                        "measured_retention": dp["measured_retention_pct"],
                        "predicted_retention": round(pred, 2),
                        "residual": round(pred - dp["measured_retention_pct"], 2)
                    }
                    for dp, pred in zip(b["datapoints"], series_predicted)
                ]
            })

        overall_act = np.array(all_actual)
        overall_pred = np.array(all_predicted)
        overall_rmse = float(np.sqrt(np.mean((overall_act - overall_pred) ** 2)))
        overall_ss_tot = float(np.sum((overall_act - np.mean(overall_act)) ** 2))
        overall_ss_res = float(np.sum((overall_act - overall_pred) ** 2))
        overall_r2 = float(1.0 - (overall_ss_res / overall_ss_tot)) if overall_ss_tot > 0 else 1.0

        return {
            "model_architecture": "First-Order Arrhenius Kinetic Non-linear Degradation",
            "total_benchmark_series": len(validation_results),
            "aggregate_rmse": round(overall_rmse, 3),
            "aggregate_r2_score": round(overall_r2, 4),
            "validation_verdict": "VERIFIED_ACCURATE" if overall_r2 > 0.90 else "CALIBRATION_REQUIRED",
            "series": validation_results
        }
