"""
Core scientific constants, NASA STD-3001 nutritional dietary reference intakes (DRI),
and Mars orbital & habitat operational parameters.
"""

from typing import Dict, Any

# Universal Gas Constant in J / (mol * K)
R_GAS = 8.314462618

# Temperature conversions
KELVIN_ZERO_CELSIUS = 273.15

# Mars Sol duration in Earth days
SOL_IN_EARTH_DAYS = 1.02749125

# NASA-STD-3001 NASA Space Flight Human-System Standard
# Daily Dietary Reference Intakes (DRI) per astronaut crew member
NASA_STD_3001_REQUIREMENTS: Dict[str, Dict[str, Any]] = {
    "calories_kcal": {
        "min": 2500.0,
        "nominal": 2800.0,
        "max": 3400.0,
        "unit": "kcal",
        "description": "Daily caloric intake required for deep space EVA/intravehicular operations"
    },
    "protein_g": {
        "min": 65.0,
        "nominal": 85.0,
        "max": 140.0,
        "unit": "g",
        "description": "Prevents muscle atrophy under Mars 0.38g gravity"
    },
    "carbohydrates_g": {
        "min": 250.0,
        "nominal": 350.0,
        "max": 450.0,
        "unit": "g",
        "description": "Primary metabolic fuel for neurological and physical endurance"
    },
    "lipids_g": {
        "min": 50.0,
        "nominal": 75.0,
        "max": 100.0,
        "unit": "g",
        "description": "Essential fatty acids and lipid-soluble vitamin carriers"
    },
    "vitamin_c_mg": {
        "min": 75.0,
        "nominal": 90.0,
        "max": 2000.0,
        "unit": "mg",
        "description": "Ascorbic acid: collagen synthesis and microgravity oxidative stress defense"
    },
    "thiamine_b1_mg": {
        "min": 1.1,
        "nominal": 1.2,
        "max": 5.0,
        "unit": "mg",
        "description": "Thiamine pyrophosphate: highly heat-sensitive; deficiency causes cognitive impairment"
    },
    "potassium_mg": {
        "min": 3500.0,
        "nominal": 4700.0,
        "max": 6000.0,
        "unit": "mg",
        "description": "Electrolyte balance and cardiovascular countermeasure in space"
    },
    "iron_mg": {
        "min": 8.0,
        "nominal": 10.0,
        "max": 45.0,
        "unit": "mg",
        "description": "Hemoglobin maintenance (monitored to prevent microgravity iron overload)"
    },
    "hydration_water_l": {
        "min": 2.2,
        "nominal": 2.8,
        "max": 3.5,
        "unit": "L",
        "description": "Hydration requirement per astronaut per day"
    }
}

# Thermal Storage Baselines in Celsius
STORAGE_REGIMES = {
    "DEEP_FREEZE": -20.0,
    "CHILLED": 4.0,
    "AMBIENT_NOMINAL": 21.0,
    "CABIN_OVERHEAT": 32.0,
    "EMERGENCY_PEAK": 42.0
}

# Power draw benchmarks for thermal control per kg food storage (Watts / kg)
COOLING_POWER_WATTS_PER_KG = {
    "DEEP_FREEZE": 1.85,  # Cryo-chilling radiator load
    "CHILLED": 0.45,      # Standard Peltier / heat pump load
    "AMBIENT_NOMINAL": 0.05 # Passive habitat ventilation load
}
