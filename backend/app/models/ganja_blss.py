"""
Ganja Space-Agro Bio-regenerative Life Support System (G-BLSS) Model.
Calibrated with agricultural data from Azerbaijan State Agricultural University (ADAU), Ganja,
and NASA JSC Advanced Life Support Baseline Values (NASA/TP-2015-218570).
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import math
import numpy as np


@dataclass
class GanjaCultivar:
    """Agronomic and bio-regenerative characteristics of Ganja-selected crop cultivars."""
    id: str
    name: str
    scientific_name: str
    origin: str  # e.g., "ADAU Ganja Selection & Agronomy Lab"
    growth_cycle_days: int
    daily_edible_biomass_g_m2: float
    harvest_index: float  # ratio of edible biomass to total biomass (0.0 - 1.0)
    energy_kcal_100g: float
    protein_g_100g: float
    vitamin_c_mg_100g: float
    thiamine_mg_100g: float
    potassium_mg_100g: float
    iron_mg_100g: float
    o2_production_g_m2_day: float
    co2_absorption_g_m2_day: float
    water_transpiration_l_m2_day: float
    regolith_salinity_tolerance_ds_m: float  # Electrical conductivity tolerance (dS/m)
    perchlorate_remediation_pct: float  # Regolith ClO4- bioremediation potential (%)


# Catalog of Ganja ADAU-optimized cultivars for Martian Controlled Ecological Life Support Systems (CELSS)
GANJA_CULTIVARS: Dict[str, GanjaCultivar] = {
    "GC-26": GanjaCultivar(
        id="GC-26",
        name="ADAU Ganja Chickpea (Noxud) GC-26",
        scientific_name="Cicer arietinum L. var. Ganja-26",
        origin="Azerbaijan State Agricultural University (ADAU), Ganja",
        growth_cycle_days=65,
        daily_edible_biomass_g_m2=28.5,
        harvest_index=0.55,
        energy_kcal_100g=364.0,
        protein_g_100g=22.8,
        vitamin_c_mg_100g=4.0,
        thiamine_mg_100g=0.48,
        potassium_mg_100g=875.0,
        iron_mg_100g=6.2,
        o2_production_g_m2_day=34.2,
        co2_absorption_g_m2_day=45.6,
        water_transpiration_l_m2_day=3.8,
        regolith_salinity_tolerance_ds_m=7.8,
        perchlorate_remediation_pct=34.0,
    ),
    "GHM-01": GanjaCultivar(
        id="GHM-01",
        name="Ganja Rapid Hydroponic Microgreens GHM-01",
        scientific_name="Raphanus sativus & Lepidium sativum (Ganja Mix)",
        origin="Ganja Agro-Bio Incubator & Hydroponic Station",
        growth_cycle_days=14,
        daily_edible_biomass_g_m2=82.0,
        harvest_index=0.88,
        energy_kcal_100g=31.0,
        protein_g_100g=3.2,
        vitamin_c_mg_100g=148.0,  # Hyper-dense Ascorbic Acid to arrest Sol-450 scurvy
        thiamine_mg_100g=0.22,
        potassium_mg_100g=420.0,
        iron_mg_100g=2.8,
        o2_production_g_m2_day=48.5,
        co2_absorption_g_m2_day=66.8,
        water_transpiration_l_m2_day=5.2,
        regolith_salinity_tolerance_ds_m=5.4,
        perchlorate_remediation_pct=18.5,
    ),
    "GA-04": GanjaCultivar(
        id="GA-04",
        name="Western Ganja Halotolerant Alfalfa GA-04",
        scientific_name="Medicago sativa L. ssp. ganjensis",
        origin="ADAU Forage & Soil Rehabilitation Department, Ganja",
        growth_cycle_days=30,
        daily_edible_biomass_g_m2=65.0,
        harvest_index=0.72,
        energy_kcal_100g=23.0,
        protein_g_100g=4.0,
        vitamin_c_mg_100g=8.2,
        thiamine_mg_100g=0.14,
        potassium_mg_100g=310.0,
        iron_mg_100g=3.1,
        o2_production_g_m2_day=55.0,
        co2_absorption_g_m2_day=74.5,
        water_transpiration_l_m2_day=6.1,
        regolith_salinity_tolerance_ds_m=11.2,
        perchlorate_remediation_pct=62.0,  # Primary bioremediator of Martian regolith salts
    ),
    "GP-FERM": GanjaCultivar(
        id="GP-FERM",
        name="Western Azerbaijan Probiotic Bio-Matrix GP-Ferm",
        scientific_name="Lactobacillus plantarum & L. casei (Ganja Strain)",
        origin="Ganja Traditional Bio-Fermentation Collection & ADAU Biotech",
        growth_cycle_days=3,
        daily_edible_biomass_g_m2=120.0,
        harvest_index=0.98,
        energy_kcal_100g=65.0,
        protein_g_100g=6.8,
        vitamin_c_mg_100g=26.0,
        thiamine_mg_100g=0.55,
        potassium_mg_100g=280.0,
        iron_mg_100g=1.9,
        o2_production_g_m2_day=0.0,
        co2_absorption_g_m2_day=5.0,
        water_transpiration_l_m2_day=0.0,
        regolith_salinity_tolerance_ds_m=14.0,
        perchlorate_remediation_pct=42.0,
    ),
}


class GanjaBLSSEngine:
    """
    Bioregenerative Life Support mass balance calculator.
    Models interaction between Ganja cultivars, LED lighting, CO2 scrubbing,
    and nutritional output over mission sols.
    """

    @staticmethod
    def calculate_bioregenerative_yield(
        cultivar_id: str,
        growth_area_m2: float,
        sols: int,
        led_ppfd_umol_m2_s: float = 400.0,
        photoperiod_hours: float = 16.0,
    ) -> Dict[str, float]:
        """
        Calculate total mass, gas exchange, and micronutrient production
        for a given Ganja crop cultivar in Martian hydroponic modules.
        """
        cultivar = GANJA_CULTIVARS.get(cultivar_id)
        if not cultivar:
            raise ValueError(f"Cultivar {cultivar_id} not found in Ganja BLSS database.")

        # Light Use Efficiency (LUE) factor relative to nominal 400 umol/m2/s at 16h
        nominal_dli = (400.0 * 16.0 * 3600) / 1e6  # Daily Light Integral (mol/m2/day)
        actual_dli = (led_ppfd_umol_m2_s * photoperiod_hours * 3600) / 1e6
        light_factor = min(1.35, max(0.4, math.sqrt(actual_dli / nominal_dli)))

        daily_edible_g = cultivar.daily_edible_biomass_g_m2 * growth_area_m2 * light_factor
        total_edible_biomass_kg = (daily_edible_g * sols) / 1000.0

        daily_o2_g = cultivar.o2_production_g_m2_day * growth_area_m2 * light_factor
        daily_co2_scrubbed_g = cultivar.co2_absorption_g_m2_day * growth_area_m2 * light_factor
        daily_water_transpired_l = cultivar.water_transpiration_l_m2_day * growth_area_m2

        # Nutritional yields per sol across entire chamber
        daily_vit_c_mg = (daily_edible_g / 100.0) * cultivar.vitamin_c_mg_100g
        daily_thiamine_mg = (daily_edible_g / 100.0) * cultivar.thiamine_mg_100g
        daily_protein_g = (daily_edible_g / 100.0) * cultivar.protein_g_100g
        daily_calories_kcal = (daily_edible_g / 100.0) * cultivar.energy_kcal_100g

        return {
            "cultivar_id": cultivar.id,
            "cultivar_name": cultivar.name,
            "growth_area_m2": growth_area_m2,
            "simulation_sols": sols,
            "light_factor": round(light_factor, 3),
            "daily_edible_kg": round(daily_edible_g / 1000.0, 3),
            "total_edible_biomass_kg": round(total_edible_biomass_kg, 2),
            "daily_o2_generated_g": round(daily_o2_g, 2),
            "daily_co2_absorbed_g": round(daily_co2_scrubbed_g, 2),
            "daily_water_recycled_l": round(daily_water_transpired_l, 2),
            "daily_vit_c_yield_mg": round(daily_vit_c_mg, 2),
            "daily_thiamine_yield_mg": round(daily_thiamine_mg, 3),
            "daily_protein_yield_g": round(daily_protein_g, 2),
            "daily_calories_kcal": round(daily_calories_kcal, 1),
            "perchlorate_remediation_capacity_pct": cultivar.perchlorate_remediation_pct,
        }
