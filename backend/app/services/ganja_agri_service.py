"""
Ganja Agricultural Biotechnology Service.
Processes ADAU experimental field & phytotron data, MGS-1 regolith simulant trials,
and provides API integration for Mars Food Intelligence.
"""

from typing import Dict, List, Any
import numpy as np
from app.models.ganja_blss import GANJA_CULTIVARS, GanjaBLSSEngine, GanjaCultivar


class GanjaAgriService:
    """Service layer for Ganja ADAU Agricultural datasets and BLSS simulation."""

    @staticmethod
    def get_all_cultivars() -> List[Dict[str, Any]]:
        """Return list of all Ganja cultivars and their agronomic profiles."""
        return [
            {
                "id": c.id,
                "name": c.name,
                "scientific_name": c.scientific_name,
                "origin": c.origin,
                "growth_cycle_days": c.growth_cycle_days,
                "daily_edible_biomass_g_m2": c.daily_edible_biomass_g_m2,
                "harvest_index": c.harvest_index,
                "energy_kcal_100g": c.energy_kcal_100g,
                "protein_g_100g": c.protein_g_100g,
                "vitamin_c_mg_100g": c.vitamin_c_mg_100g,
                "thiamine_mg_100g": c.thiamine_mg_100g,
                "potassium_mg_100g": c.potassium_mg_100g,
                "iron_mg_100g": c.iron_mg_100g,
                "o2_production_g_m2_day": c.o2_production_g_m2_day,
                "co2_absorption_g_m2_day": c.co2_absorption_g_m2_day,
                "water_transpiration_l_m2_day": c.water_transpiration_l_m2_day,
                "regolith_salinity_tolerance_ds_m": c.regolith_salinity_tolerance_ds_m,
                "perchlorate_remediation_pct": c.perchlorate_remediation_pct,
            }
            for c in GANJA_CULTIVARS.values()
        ]

    @staticmethod
    def simulate_chamber_suite(
        crew_size: int = 4,
        sol_duration: int = 450,
        chamber_allocation: Dict[str, float] = None,
    ) -> Dict[str, Any]:
        """
        Simulate a multi-cultivar Ganja BLSS hydroponic suite for a crew over specified mission duration.
        chamber_allocation: mapping of cultivar_id -> area in square meters.
        """
        if chamber_allocation is None:
            # Default recommended chamber sizing (total 24 m2 greenhouse module)
            chamber_allocation = {
                "GHM-01": 8.0,   # Microgreens for Vitamin C & antioxidant delivery
                "GC-26": 10.0,   # Chickpeas for protein and caloric density
                "GA-04": 4.0,    # Halotolerant biochar / O2 generation
                "GP-FERM": 2.0,  # Probiotic fermenter
            }

        total_area = sum(chamber_allocation.values())
        daily_biomass_kg = 0.0
        daily_o2_g = 0.0
        daily_co2_g = 0.0
        daily_water_l = 0.0
        daily_vit_c_mg = 0.0
        daily_thiamine_mg = 0.0
        daily_protein_g = 0.0
        daily_kcal = 0.0

        cultivar_summaries = []

        for cid, area in chamber_allocation.items():
            if cid in GANJA_CULTIVARS and area > 0:
                res = GanjaBLSSEngine.calculate_bioregenerative_yield(
                    cultivar_id=cid,
                    growth_area_m2=area,
                    sols=sol_duration,
                )
                daily_biomass_kg += res["daily_edible_kg"]
                daily_o2_g += res["daily_o2_generated_g"]
                daily_co2_g += res["daily_co2_absorbed_g"]
                daily_water_l += res["daily_water_recycled_l"]
                daily_vit_c_mg += res["daily_vit_c_yield_mg"]
                daily_thiamine_mg += res["daily_thiamine_yield_mg"]
                daily_protein_g += res["daily_protein_yield_g"]
                daily_kcal += res["daily_calories_kcal"]
                cultivar_summaries.append(res)

        # Astronaut requirements according to NASA STD-3001
        o2_req_crew_g_day = crew_size * 840.0       # 840g O2 per astronaut/day
        co2_prod_crew_g_day = crew_size * 1000.0    # 1000g CO2 per astronaut/day
        vit_c_req_crew_mg_day = crew_size * 90.0    # 90mg Vitamin C per astronaut/day
        protein_req_crew_g_day = crew_size * 85.0   # 85g Protein per astronaut/day

        o2_autonomy_pct = min(100.0, (daily_o2_g / o2_req_crew_g_day) * 100.0)
        co2_closure_pct = min(100.0, (daily_co2_g / co2_prod_crew_g_day) * 100.0)
        vit_c_offset_pct = min(100.0, (daily_vit_c_mg / vit_c_req_crew_mg_day) * 100.0)
        protein_offset_pct = min(100.0, (daily_protein_g / protein_req_crew_g_day) * 100.0)

        # Payload savings: Every 1 kg of fresh produce produced in situ saves packaging & dry mass
        total_biomass_produced_kg = daily_biomass_kg * sol_duration
        launch_mass_saved_kg = total_biomass_produced_kg * 1.25  # including packaging multiplier

        return {
            "crew_size": crew_size,
            "mission_sols": sol_duration,
            "total_chamber_area_m2": total_area,
            "cultivar_breakdown": cultivar_summaries,
            "daily_totals": {
                "edible_produce_kg_day": round(daily_biomass_kg, 2),
                "o2_generation_g_day": round(daily_o2_g, 1),
                "co2_scrubbing_g_day": round(daily_co2_g, 1),
                "water_transpired_l_day": round(daily_water_l, 1),
                "vitamin_c_yield_mg_day": round(daily_vit_c_mg, 1),
                "thiamine_yield_mg_day": round(daily_thiamine_mg, 2),
                "protein_yield_g_day": round(daily_protein_g, 1),
                "caloric_yield_kcal_day": round(daily_kcal, 1),
            },
            "life_support_metrics": {
                "crew_o2_autonomy_pct": round(o2_autonomy_pct, 1),
                "crew_co2_closure_pct": round(co2_closure_pct, 1),
                "vitamin_c_replenishment_pct": round(vit_c_offset_pct, 1),
                "protein_replenishment_pct": round(protein_offset_pct, 1),
                "total_mission_fresh_produce_kg": round(total_biomass_produced_kg, 1),
                "launch_mass_saved_kg": round(launch_mass_saved_kg, 1),
            },
            "scientific_provenance": "ADAU (Ganja) Phytotron Field Selection & NASA TM-2011-216157"
        }
