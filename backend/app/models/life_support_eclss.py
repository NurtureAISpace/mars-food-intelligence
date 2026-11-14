"""
NurtureAISpace — ECLSS & Regolith Hydro-Management Simulation Model.
Author: Faruk (Computer Engineering & Life Support Simulation)

Models closed-loop Environmental Control and Life Support Systems (ECLSS):
1. Oxygen Generation System (OGS) via water electrolysis (2H2O -> 2H2 + O2)
2. Carbon Dioxide Removal Assembly (CDRA) & Sabatier Carbon-Loop Recovery (CO2 + 4H2 -> CH4 + 2H2O)
3. Regolith Soil Moisture & Closed-Loop Hydro-Management (VWC % telemetry, automated irrigation valves)
4. Water Recovery System (WRS - Urine Processor + Graywater distillation)
5. Power, Cabin Atmosphere (pO2, pCO2, pressure) & Contingency Fault Injection

Data provenance: per-crewmember O2/CO2/water rates are cited from NASA BVAD (see
ECLSSLifeSupportEngine). Stoichiometric ratios follow from the reaction equations. Everything
else (reserves, power, sensor readings, recovery efficiencies, event effects) is a synthetic
scenario assumption.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
import math

from app.core.constants import SOL_IN_EARTH_DAYS

LIFE_SUPPORT_DATA_PROVENANCE = (
    "synthetic scenario; per-crewmember O2, CO2 and water rates from NASA BVAD "
    "(NASA/TP-2015-218570/REV1, Tables 3-33 and 4-20); stoichiometric ratios from the reaction "
    "equations; reserves, power, sensor readings, recovery efficiencies and event effects are assumed"
)


@dataclass
class RegolithSensorNode:
    """
    IoT Sensor Node Telemetry embedded in Martian Regolith Simulant (MGS-1)
    and Hydroponic Cultivation Trays.
    """
    node_id: str
    zone_name: str
    target_crop: str
    depth_cm: float
    volumetric_water_content_pct: float  # VWC % (Nominal: 35.0% - 55.0%)
    soil_temperature_c: float            # Nominal: 18.0 - 24.0 C
    electrical_conductivity_ds_m: float  # Salinity EC (Nominal: 1.2 - 2.8 dS/m)
    regolith_ph: float                   # Nominal: 6.2 - 6.8
    irrigation_valve_open: bool = False
    status: str = "NOMINAL"              # NOMINAL, DRY_WARNING, SATURATED, SALINE_STRESS


@dataclass
class HabitatAtmosphere:
    """Intra-habitat atmospheric state (nominal values are scenario assumptions)."""
    total_pressure_kpa: float = 101.325   # Standard 1 atm habitat
    partial_pressure_o2_kpa: float = 21.3 # 21.0% O2 nominal
    partial_pressure_co2_kpa: float = 0.4 # Nominal < 0.53 kPa (4 mmHg)
    cabin_temperature_c: float = 21.5
    relative_humidity_pct: float = 48.0


@dataclass
class LifeSupportTelemetrySnapshot:
    """Sol telemetry for habitat life support, power, and hydro balance."""
    sol: int
    crew_size: int
    atmosphere: HabitatAtmosphere
    o2_reserve_kg: float
    water_potable_reserve_l: float
    water_recovery_efficiency_pct: float
    co2_scrubbed_kg_day: float
    o2_generated_kg_day: float
    sabutier_water_recovered_l_day: float
    power_generated_kwh_day: float
    power_consumed_kwh_day: float
    battery_state_of_charge_pct: float
    dust_storm_active: bool
    o2_leak_active: bool
    sensor_nodes: List[RegolithSensorNode] = field(default_factory=list)
    system_alerts: List[str] = field(default_factory=list)
    life_support_status: str = "OPTIMAL" # OPTIMAL, WARNING, CRITICAL, EMERGENCY


class ECLSSLifeSupportEngine:
    """
    First-principles Life Support & Closed-Loop Simulation Engine.
    Engineered by Faruk (Computer Engineering & Life Support Simulation).
    """

    # Per-crewmember rates per Earth day (kg/CM-d) from NASA Life Support Baseline Values and
    # Assumptions Document (BVAD): Anderson MS, Ewert MK, Keener JF. NASA/TP-2015-218570/REV1,
    # Jan 2018. https://ntrs.nasa.gov/citations/20180001338 (page numbers = printed page numbers).
    O2_CONSUMPTION_KG_PER_CM_DAY = 0.816      # Table 3-33 "Oxygen Consumed", p. 63
    CO2_PRODUCTION_KG_PER_CM_DAY = 1.04       # Table 3-33 "Carbon Dioxide Load", p. 63
    POTABLE_WATER_KG_PER_CM_DAY = 2.50        # Table 4-20 "Total Human Consumption" (2.00 drinking + 0.50 food rehydration), p. 77
    HYGIENE_WATER_KG_PER_CM_DAY = 7.32        # Table 4-20 "Total Hygiene", Mature Planetary Base column, p. 77
    METABOLIC_WATER_KG_PER_CM_DAY = 0.345     # Table 3-33 footnote 82, p. 63

    # Converted to per Sol (1 Sol = 1.02749 Earth days); water mass taken as 1 kg = 1 L.
    O2_CONSUMPTION_KG_PERSON_SOL = O2_CONSUMPTION_KG_PER_CM_DAY * SOL_IN_EARTH_DAYS
    CO2_PRODUCTION_KG_PERSON_SOL = CO2_PRODUCTION_KG_PER_CM_DAY * SOL_IN_EARTH_DAYS
    POTABLE_WATER_NEED_L_PERSON_SOL = POTABLE_WATER_KG_PER_CM_DAY * SOL_IN_EARTH_DAYS
    HYGIENE_WATER_NEED_L_PERSON_SOL = HYGIENE_WATER_KG_PER_CM_DAY * SOL_IN_EARTH_DAYS
    METABOLIC_WATER_OUTPUT_L_PERSON_SOL = METABOLIC_WATER_KG_PER_CM_DAY * SOL_IN_EARTH_DAYS

    # Stoichiometry constants
    WATER_TO_O2_ELECTROLYSIS_RATIO = 1.126   # kg H2O required per kg O2 (2H2O -> 2H2 + O2)
    H2_YIELD_PER_KG_O2 = 0.126               # kg H2 generated alongside 1 kg O2
    SABATIER_WATER_RECOVERY_RATIO = 0.818    # kg H2O formed per kg CO2 reacted with H2

    @classmethod
    def calculate_metabolic_demands(cls, crew_size: int) -> Dict[str, float]:
        """Calculates total crew metabolic exchange rates per Sol."""
        return {
            "o2_demand_kg_sol": crew_size * cls.O2_CONSUMPTION_KG_PERSON_SOL,
            "co2_output_kg_sol": crew_size * cls.CO2_PRODUCTION_KG_PERSON_SOL,
            "potable_water_demand_l_sol": crew_size * cls.POTABLE_WATER_NEED_L_PERSON_SOL,
            "total_water_demand_l_sol": crew_size * (cls.POTABLE_WATER_NEED_L_PERSON_SOL + cls.HYGIENE_WATER_NEED_L_PERSON_SOL)
        }

    @classmethod
    def simulate_hydro_management(
        cls,
        nodes: List[RegolithSensorNode],
        ambient_temp_c: float = 21.0,
        irrigation_threshold_vwc: float = 38.0,
        cutoff_threshold_vwc: float = 50.0
    ) -> List[RegolithSensorNode]:
        """
        Closed-loop automated micro-irrigation controller.
        Emulates embedded IoT microcontroller valve actuations based on regolith VWC%.
        """
        updated_nodes: List[RegolithSensorNode] = []
        for node in nodes:
            vwc = node.volumetric_water_content_pct
            ec = node.electrical_conductivity_ds_m
            valve = node.irrigation_valve_open
            status = "NOMINAL"

            # Evapotranspiration dynamic (drops by 1.2% - 2.5% per Sol depending on temperature)
            transpiration_rate = 1.8 * (1.0 + (ambient_temp_c - 20.0) * 0.04)

            if valve:
                # Irrigation active: moisture increases by 8.5% per step
                vwc = min(58.0, vwc + 8.5)
                # Salinity dilution effect
                ec = max(1.1, ec - 0.05)
                if vwc >= cutoff_threshold_vwc:
                    valve = False  # Shut valve
            else:
                vwc = max(12.0, vwc - transpiration_rate)
                # Salinity concentration effect as moisture drops
                ec = min(5.5, ec + 0.03)
                if vwc <= irrigation_threshold_vwc:
                    valve = True  # Trigger pulse irrigation valve

            # Status classification
            if vwc < 25.0:
                status = "DRY_WARNING"
            elif ec > 4.5:
                status = "SALINE_STRESS"
            elif vwc > 55.0:
                status = "SATURATED"
            else:
                status = "NOMINAL"

            updated_nodes.append(RegolithSensorNode(
                node_id=node.node_id,
                zone_name=node.zone_name,
                target_crop=node.target_crop,
                depth_cm=node.depth_cm,
                volumetric_water_content_pct=round(vwc, 1),
                soil_temperature_c=round(ambient_temp_c - 1.5, 1),
                electrical_conductivity_ds_m=round(ec, 2),
                regolith_ph=node.regolith_ph,
                irrigation_valve_open=valve,
                status=status
            ))

        return updated_nodes
