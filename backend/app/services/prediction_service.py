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
from app.pipeline.ingest import load_raw_catalog
from app.ml.params import param, sources

# Agreement band for the thiamine comparison (percentage points); a modelling choice.
THIAMINE_TOLERANCE_PP = 10.0


class PredictionService:
    def __init__(self):
        self.catalog = {item["id"]: item for item in load_raw_catalog()}

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

    def compare_with_literature_endpoints(self) -> Dict[str, Any]:
        """
        Compares the catalog's (synthetic) Arrhenius kinetics with published spaceflight-food
        retention endpoints. The endpoints are read from app/data/literature_params.json:

        - thiamine: Goulette et al. 2020, model-predicted retention after 720 days at 20 C for
          three NASA thermostabilized food classes (grain 55%, legume 42%, meat 3%);
        - vitamin C: Cooper et al. 2017, 32-83% loss after 3 years at 21 C (fruit products).

        Each packaged menu item is mapped to a food class (kinetics.food_class_map, assumed).
        Every published value is a single endpoint, so R^2 is not computed. A thiamine series
        agrees when the prediction is within THIAMINE_TOLERANCE_PP percentage points of the
        published value; a vitamin C series agrees when it falls inside the published range.
        """
        b1_ref = param("kinetics.thiamine_b1.reference")
        vc_ref = param("kinetics.vitamin_c.reference")
        class_map = param("kinetics.food_class_map")
        srcs = sources()

        vc_lo_pct = round((1.0 - vc_ref["loss_fraction_range"][1]) * 100.0, 1)
        vc_hi_pct = round((1.0 - vc_ref["loss_fraction_range"][0]) * 100.0, 1)
        vc_mid_pct = round((vc_lo_pct + vc_hi_pct) / 2.0, 2)

        series = []
        residuals = []
        for food_id, food_class in class_map.items():
            if food_id not in self.catalog:
                continue
            food = self.catalog[food_id]
            comparisons = [
                ("thiamine_b1", b1_ref["temp_c"], b1_ref["days"], round(b1_ref["retention"][food_class] * 100.0, 2),
                 None, "GOULETTE_2020", f"Goulette 2020, {food_class} class"),
                ("vitamin_c", vc_ref["temp_c"], vc_ref["days"], vc_mid_pct,
                 [vc_lo_pct, vc_hi_pct], "COOPER_2017", "Cooper 2017, fruit products (range midpoint)"),
            ]
            for nutrient, temp_c, days, published, published_range, source_id, basis in comparisons:
                k = arrhenius_rate_constant(food["arrhenius_A"], food["activation_energy_Ea_kJ_mol"], temp_c)
                predicted = round(first_order_retention(100.0, k, days), 2)
                residual = round(predicted - published, 2)
                residuals.append(residual)
                if published_range is None:
                    agrees = abs(residual) <= THIAMINE_TOLERANCE_PP
                else:
                    agrees = published_range[0] <= predicted <= published_range[1]
                series.append({
                    "food_id": food_id,
                    "food_name": food["name"],
                    "nutrient": nutrient,
                    "temperature_c": temp_c,
                    "sample_points": 1,
                    "rmse": abs(residual),
                    "r2_score": None,
                    "published_basis": basis,
                    "published_range_pct": published_range,
                    "source_id": source_id,
                    "agrees_with_literature": agrees,
                    "datapoints": [
                        {"sol": 0, "days": 0, "measured_retention": 100.0, "predicted_retention": 100.0, "residual": 0.0},
                        {"sol": round(days / SOL_IN_EARTH_DAYS), "days": days, "measured_retention": published,
                         "predicted_retention": predicted, "residual": residual},
                    ],
                })

        rmse = float(np.sqrt(np.mean(np.square(residuals)))) if residuals else 0.0
        n_agree = sum(1 for s_ in series if s_["agrees_with_literature"])
        return {
            "model_architecture": "First-order Arrhenius kinetics with synthetic per-item catalog constants",
            "comparison_type": "published single-endpoint retention values (not measurements of these menu items)",
            "total_benchmark_series": len(series),
            "series_agreeing_with_literature": n_agree,
            "aggregate_rmse": round(rmse, 3),
            "aggregate_r2_score": None,
            "validation_verdict": "AGREES_WITH_LITERATURE" if series and n_agree == len(series) else "DOES_NOT_MATCH_LITERATURE",
            "thiamine_tolerance_pp": THIAMINE_TOLERANCE_PP,
            "references": [
                {"id": sid, "citation": srcs[sid]["citation"], "doi_or_url": srcs[sid]["doi_or_url"]}
                for sid in ("GOULETTE_2020", "COOPER_2017")
            ],
            "data_provenance": ("catalog kinetics (A, Ea) are synthetic; published endpoints from literature_params.json; "
                                "food-class mapping is assumed; vitamin C endpoint is for fruit products only"),
            "series": series,
        }
