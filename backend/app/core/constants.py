"""
Core scientific constants, daily nutrient planning targets, and Mars habitat operational parameters.

Provenance: only the nominal vitamin C (90 mg/day) and thiamine (1.2 mg/day) targets are cited
(NASA JSC 2005 exploration nutrition requirements; see app/data/literature_params.json). All other
targets, storage regimes and cooling-power figures are assumed planning values (no cited source).
"""

from typing import Dict, Any

# Universal Gas Constant in J / (mol * K)
R_GAS = 8.314462618

# Temperature conversions
KELVIN_ZERO_CELSIUS = 273.15

# Mars Sol duration in Earth days
SOL_IN_EARTH_DAYS = 1.02749125

_ASSUMED = "assumed planning target (no cited source)"
_NASA_JSC_2005 = ("NASA JSC 2005, Nutrition Requirements, Standards, and Operating Bands for Exploration Missions "
                  "(NTRS 20200001703); nominal value only, min/max assumed")

# Daily nutrient planning targets per astronaut crew member
DAILY_NUTRIENT_TARGETS: Dict[str, Dict[str, Any]] = {
    "calories_kcal": {
        "min": 2500.0,
        "nominal": 2800.0,
        "max": 3400.0,
        "unit": "kcal",
        "source": _ASSUMED,
        "description": "Daily caloric intake required for deep space EVA/intravehicular operations"
    },
    "protein_g": {
        "min": 65.0,
        "nominal": 85.0,
        "max": 140.0,
        "unit": "g",
        "source": _ASSUMED,
        "description": "Prevents muscle atrophy under Mars 0.38g gravity"
    },
    "carbohydrates_g": {
        "min": 250.0,
        "nominal": 350.0,
        "max": 450.0,
        "unit": "g",
        "source": _ASSUMED,
        "description": "Primary metabolic fuel for neurological and physical endurance"
    },
    "lipids_g": {
        "min": 50.0,
        "nominal": 75.0,
        "max": 100.0,
        "unit": "g",
        "source": _ASSUMED,
        "description": "Essential fatty acids and lipid-soluble vitamin carriers"
    },
    "vitamin_c_mg": {
        "min": 75.0,
        "nominal": 90.0,
        "max": 2000.0,
        "unit": "mg",
        "source": _NASA_JSC_2005,
        "description": "Ascorbic acid: collagen synthesis and microgravity oxidative stress defense"
    },
    "thiamine_b1_mg": {
        "min": 1.1,
        "nominal": 1.2,
        "max": 5.0,
        "unit": "mg",
        "source": _NASA_JSC_2005,
        "description": "Thiamine pyrophosphate: highly heat-sensitive; deficiency causes cognitive impairment"
    },
    "potassium_mg": {
        "min": 3500.0,
        "nominal": 4700.0,
        "max": 6000.0,
        "unit": "mg",
        "source": _ASSUMED,
        "description": "Electrolyte balance and cardiovascular countermeasure in space"
    },
    "iron_mg": {
        "min": 8.0,
        "nominal": 10.0,
        "max": 45.0,
        "unit": "mg",
        "source": _ASSUMED,
        "description": "Hemoglobin maintenance (monitored to prevent microgravity iron overload)"
    },
    "hydration_water_l": {
        "min": 2.2,
        "nominal": 2.8,
        "max": 3.5,
        "unit": "L",
        "source": _ASSUMED,
        "description": "Hydration requirement per astronaut per day"
    }
}

# Thermal Storage Baselines in Celsius (assumed scenario values)
STORAGE_REGIMES = {
    "DEEP_FREEZE": -20.0,
    "CHILLED": 4.0,
    "AMBIENT_NOMINAL": 21.0,
    "CABIN_OVERHEAT": 32.0,
    "EMERGENCY_PEAK": 42.0
}

# Power draw for thermal control per kg food storage (Watts / kg); assumed, no cited source
COOLING_POWER_WATTS_PER_KG = {
    "DEEP_FREEZE": 1.85,  # Cryo-chilling radiator load
    "CHILLED": 0.45,      # Standard Peltier / heat pump load
    "AMBIENT_NOMINAL": 0.05 # Passive habitat ventilation load
}
