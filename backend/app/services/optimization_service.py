import numpy as np
from scipy.optimize import linprog
from typing import Dict, Any, List, Optional
from app.core.constants import DAILY_NUTRIENT_TARGETS, COOLING_POWER_WATTS_PER_KG
from app.pipeline.ingest import load_raw_catalog


class OptimizationService:
    def __init__(self):
        self.raw_catalog = load_raw_catalog()

    def optimize_daily_crew_diet(
        self,
        crew_size: int = 4,
        mission_sol: int = 1,
        storage_temperature_c: float = 4.0,
        objective_mode: str = "BALANCED_HEALTH",
        max_biomass_available_g: float = 1200.0,
        max_rehydration_water_l: float = 8.0
    ) -> Dict[str, Any]:
        """
        Solves constrained linear programming optimization for daily astronaut diet
        meeting daily nutrient targets (vitamin C/B1 from NASA JSC 2005; other targets assumed) while balancing payload mass,
        chilling energy consumption, and bio-regenerative crop freshness.
        """
        foods = self.raw_catalog
        n_items = len(foods)

        # Daily crew nutrient targets (see app/core/constants.py for provenance)
        target_cals = DAILY_NUTRIENT_TARGETS["calories_kcal"]["nominal"] * crew_size
        target_protein = DAILY_NUTRIENT_TARGETS["protein_g"]["nominal"] * crew_size
        target_vit_c = DAILY_NUTRIENT_TARGETS["vitamin_c_mg"]["nominal"] * crew_size
        target_b1 = DAILY_NUTRIENT_TARGETS["thiamine_b1_mg"]["nominal"] * crew_size
        target_potassium = DAILY_NUTRIENT_TARGETS["potassium_mg"]["min"] * crew_size

        # Coefficients for objective function
        # c @ x to minimize
        c = np.zeros(n_items)

        for i, food in enumerate(foods):
            mass_kg = (food["serving_size_g"] + food["packaging_mass_g"]) / 1000.0
            is_chilled = food.get("storage_temp_recommended_c", 21.0) <= 5.0
            power_watt = mass_kg * (COOLING_POWER_WATTS_PER_KG["CHILLED"] if is_chilled else COOLING_POWER_WATTS_PER_KG["AMBIENT_NOMINAL"])
            sensory_freshness = food["sensory_initial_score"]

            if objective_mode == "MINIMIZE_MASS":
                c[i] = mass_kg
            elif objective_mode == "MINIMIZE_ENERGY":
                c[i] = power_watt + (food["water_to_rehydrate_ml"] * 0.001)
            elif objective_mode == "MAXIMIZE_MICRONUTRIENTS":
                # Minimizing negative nutrient density
                c[i] = -1.0 * (food["vitamin_c_mg"] * 0.1 + food["thiamine_b1_mg"] * 10.0 + sensory_freshness)
            else: # BALANCED_HEALTH
                c[i] = (mass_kg * 2.0) + (power_watt * 0.5) - (sensory_freshness * 0.15)

        # Inequality constraints: A_ub @ x <= b_ub
        # Since requirements are >= targets, we negate them: -sum(nutrients * x) <= -target
        A_ub = []
        b_ub = []

        # 1. Calories >= target_cals -> -Calories <= -target_cals
        A_ub.append([-food["calories_kcal"] for food in foods])
        b_ub.append(-target_cals)

        # 2. Protein >= target_protein
        A_ub.append([-food["protein_g"] for food in foods])
        b_ub.append(-target_protein)

        # 3. Vitamin C >= target_vit_c
        A_ub.append([-food["vitamin_c_mg"] for food in foods])
        b_ub.append(-target_vit_c)

        # 4. Thiamine B1 >= target_b1
        A_ub.append([-food["thiamine_b1_mg"] for food in foods])
        b_ub.append(-target_b1)

        # 5. Potassium >= target_potassium
        A_ub.append([-food["potassium_mg"] for food in foods])
        b_ub.append(-target_potassium)

        # 6. Water limit for rehydration: sum(water_ml * x) <= max_water_l * 1000
        A_ub.append([food["water_to_rehydrate_ml"] for food in foods])
        b_ub.append(max_rehydration_water_l * 1000.0)

        # 7. Bio-regenerative fresh biomass cap: sum(fresh_crop_g * x) <= max_biomass_available_g
        fresh_mass_row = [
            food["serving_size_g"] if food["category"] == "Bio-regenerative" else 0.0
            for food in foods
        ]
        A_ub.append(fresh_mass_row)
        b_ub.append(max_biomass_available_g)

        # Bounds per item: 0 <= x_i <= max_servings
        # Astronaut variety constraint: no crew member eats > 4 servings of a single dish per day
        bounds = [(0.0, float(crew_size * 3.5)) for _ in range(n_items)]

        # Run linear program using HiGHS solver
        res = linprog(
            c=c,
            A_ub=A_ub,
            b_ub=b_ub,
            bounds=bounds,
            method="highs"
        )

        if not res.success:
            return {
                "success": False,
                "message": f"Optimization failed to find feasible diet: {res.message}",
                "crew_size": crew_size,
                "objective_mode": objective_mode
            }

        servings = res.x
        allocated_items = []
        total_cals = 0.0
        total_prot = 0.0
        total_vit_c = 0.0
        total_b1 = 0.0
        total_potassium = 0.0
        total_mass_kg = 0.0
        total_rehydrate_water_l = 0.0
        total_cooling_power_w = 0.0

        for i, count in enumerate(servings):
            if count > 0.05:
                f = foods[i]
                serv_mass_kg = ((f["serving_size_g"] + f["packaging_mass_g"]) * count) / 1000.0
                is_chilled = f.get("storage_temp_recommended_c", 21.0) <= 5.0
                power_w = serv_mass_kg * (COOLING_POWER_WATTS_PER_KG["CHILLED"] if is_chilled else COOLING_POWER_WATTS_PER_KG["AMBIENT_NOMINAL"])

                total_cals += f["calories_kcal"] * count
                total_prot += f["protein_g"] * count
                total_vit_c += f["vitamin_c_mg"] * count
                total_b1 += f["thiamine_b1_mg"] * count
                total_potassium += f["potassium_mg"] * count
                total_mass_kg += serv_mass_kg
                total_rehydrate_water_l += (f["water_to_rehydrate_ml"] * count) / 1000.0
                total_cooling_power_w += power_w

                allocated_items.append({
                    "id": f["id"],
                    "name": f["name"],
                    "category": f["category"],
                    "daily_servings": round(float(count), 2),
                    "total_mass_g": round(f["serving_size_g"] * count, 1),
                    "calories_provided": round(f["calories_kcal"] * count, 1)
                })

        return {
            "success": True,
            "objective_mode": objective_mode,
            "crew_size": crew_size,
            "mission_sol": mission_sol,
            "optimal_daily_metrics": {
                "total_calories_kcal": round(total_cals, 1),
                "calories_per_crew_kcal": round(total_cals / crew_size, 1),
                "total_protein_g": round(total_prot, 1),
                "total_vitamin_c_mg": round(total_vit_c, 1),
                "total_thiamine_b1_mg": round(total_b1, 2),
                "total_potassium_mg": round(total_potassium, 1),
                "total_daily_mass_kg": round(total_mass_kg, 2),
                "rehydration_water_required_liters": round(total_rehydrate_water_l, 2),
                "cooling_power_draw_watts": round(total_cooling_power_w, 2)
            },
            "nasa_std_3001_compliance": {
                "calories_compliance_pct": round((total_cals / target_cals) * 100.0, 1),
                "protein_compliance_pct": round((total_prot / target_protein) * 100.0, 1),
                "vitamin_c_compliance_pct": round((total_vit_c / target_vit_c) * 100.0, 1),
                "thiamine_b1_compliance_pct": round((total_b1 / target_b1) * 100.0, 1)
            },
            "allocated_food_plan": allocated_items,
            "data_provenance": ("food values from the synthetic catalog; targets: vitamin C and thiamine from NASA JSC 2005, "
                                "others assumed; the key 'nasa_std_3001_compliance' is kept for UI compatibility and means "
                                "coverage of these daily targets, not a NASA-STD-3001 compliance check")
        }
