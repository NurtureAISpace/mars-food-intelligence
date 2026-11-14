"""
NurtureAISpace — Life Support System Service.
Author: Faruk Karimli (Computer Engineering & Life Support Simulation)

Orchestrates ECLSS life support mass-balance, regolith IoT sensors,
power generation, and contingency simulation.
"""

from typing import Dict, List, Any, Optional
from app.models.life_support_eclss import (
    RegolithSensorNode,
    HabitatAtmosphere,
    LifeSupportTelemetrySnapshot,
    ECLSSLifeSupportEngine
)
from app.models.ganja_blss import GANJA_CULTIVARS, GanjaBLSSEngine


class LifeSupportService:
    """Service layer for Environmental Control & Life Support Systems (ECLSS)."""

    def __init__(self):
        # Initialize default calibrated sensor nodes for Martian greenhouse modules
        self.default_sensor_nodes: List[RegolithSensorNode] = [
            RegolithSensorNode(
                node_id="SN-GHM-01",
                zone_name="Zone Alpha — Hydroponic Microgreen Tray",
                target_crop="Ganja Microgreens GHM-01",
                depth_cm=8.0,
                volumetric_water_content_pct=44.5,
                soil_temperature_c=20.5,
                electrical_conductivity_ds_m=1.85,
                regolith_ph=6.4,
                irrigation_valve_open=False,
                status="NOMINAL"
            ),
            RegolithSensorNode(
                node_id="SN-GC-26-A",
                zone_name="Zone Beta — Regolith Simulant Chickpea Bed",
                target_crop="ADAU Ganja Chickpea GC-26",
                depth_cm=18.0,
                volumetric_water_content_pct=41.2,
                soil_temperature_c=20.0,
                electrical_conductivity_ds_m=2.30,
                regolith_ph=6.5,
                irrigation_valve_open=False,
                status="NOMINAL"
            ),
            RegolithSensorNode(
                node_id="SN-GA-04",
                zone_name="Zone Gamma — Halotolerant Alfalfa Bioreactor",
                target_crop="Ganja Alfalfa GA-04",
                depth_cm=25.0,
                volumetric_water_content_pct=47.0,
                soil_temperature_c=19.8,
                electrical_conductivity_ds_m=3.10,
                regolith_ph=6.7,
                irrigation_valve_open=False,
                status="NOMINAL"
            ),
            RegolithSensorNode(
                node_id="SN-GP-FERM",
                zone_name="Zone Delta — Probiotic Fermentation Matrix",
                target_crop="Ganja Probiotics GP-FERM",
                depth_cm=5.0,
                volumetric_water_content_pct=52.0,
                soil_temperature_c=22.0,
                electrical_conductivity_ds_m=2.90,
                regolith_ph=6.3,
                irrigation_valve_open=False,
                status="NOMINAL"
            ),
        ]

    def get_regolith_sensors(self) -> List[Dict[str, Any]]:
        """Returns the status and telemetry of all greenhouse regolith moisture sensor nodes."""
        return [
            {
                "node_id": node.node_id,
                "zone_name": node.zone_name,
                "target_crop": node.target_crop,
                "depth_cm": node.depth_cm,
                "volumetric_water_content_pct": node.volumetric_water_content_pct,
                "soil_temperature_c": node.soil_temperature_c,
                "electrical_conductivity_ds_m": node.electrical_conductivity_ds_m,
                "regolith_ph": node.regolith_ph,
                "irrigation_valve_open": node.irrigation_valve_open,
                "status": node.status
            }
            for node in self.default_sensor_nodes
        ]

    def get_snapshot_telemetry(
        self,
        sol: int = 450,
        crew_size: int = 4,
        dust_storm_active: bool = False,
        o2_leak_active: bool = False
    ) -> Dict[str, Any]:
        """Returns instantaneous snapshot of ECLSS telemetry at a specified Sol."""
        demands = ECLSSLifeSupportEngine.calculate_metabolic_demands(crew_size)

        # Baseline oxygen and water reserves
        base_o2_reserve = 350.0  # kg O2 in high-pressure tanks
        base_water_reserve = 2400.0 # L potable water

        # Bio-regenerative contribution from default 24m2 greenhouse
        biomass_res = GanjaBLSSEngine.calculate_bioregenerative_yield("GHM-01", 8.0, 1)
        chickpea_res = GanjaBLSSEngine.calculate_bioregenerative_yield("GC-26", 10.0, 1)
        alfalfa_res = GanjaBLSSEngine.calculate_bioregenerative_yield("GA-04", 4.0, 1)

        daily_o2_from_plants_g = (
            biomass_res["daily_o2_generated_g"] +
            chickpea_res["daily_o2_generated_g"] +
            alfalfa_res["daily_o2_generated_g"]
        )
        daily_o2_from_plants_kg = daily_o2_from_plants_g / 1000.0

        daily_co2_scrubbed_by_plants_kg = (
            biomass_res["daily_co2_absorbed_g"] +
            chickpea_res["daily_co2_absorbed_g"] +
            alfalfa_res["daily_co2_absorbed_g"]
        ) / 1000.0

        daily_water_transpired_l = (
            biomass_res["daily_water_recycled_l"] +
            chickpea_res["daily_water_recycled_l"] +
            alfalfa_res["daily_water_recycled_l"]
        )

        # OGS Electrolysis needed for remaining O2
        remaining_o2_needed = max(0.0, demands["o2_demand_kg_sol"] - daily_o2_from_plants_kg)
        electrolysis_water_needed_l = remaining_o2_needed * ECLSSLifeSupportEngine.WATER_TO_O2_ELECTROLYSIS_RATIO
        h2_produced_kg = remaining_o2_needed * ECLSSLifeSupportEngine.H2_YIELD_PER_KG_O2

        # Sabatier Reactor: reacts crew CO2 with H2 to recover water
        crew_co2_kg = demands["co2_output_kg_sol"]
        sabutier_water_recovered_l = min(crew_co2_kg * ECLSSLifeSupportEngine.SABATIER_WATER_RECOVERY_RATIO, h2_produced_kg * 8.9)

        # Water Recovery System (WRS): graywater + urine recovery + plant transpiration
        hygiene_and_humidity_water = crew_size * 12.5 + daily_water_transpired_l
        wrs_recovery_l = hygiene_and_humidity_water * 0.94 + sabutier_water_recovered_l

        net_water_delta = wrs_recovery_l - demands["total_water_demand_l_sol"] - electrolysis_water_needed_l
        recovery_efficiency_pct = min(99.2, max(85.0, (wrs_recovery_l / (demands["total_water_demand_l_sol"] + 1e-6)) * 100.0))

        # Solar and power balance
        nominal_solar_kwh = 180.0
        power_generated = nominal_solar_kwh * (0.28 if dust_storm_active else 1.0)
        power_consumed = 115.0  # Life support, thermal loops, LED phytotrons
        battery_soc = 62.0 if dust_storm_active else 96.5

        # Atmosphere
        p_o2 = 18.2 if o2_leak_active else 21.3
        p_co2 = 0.62 if o2_leak_active else 0.38
        cabin_pressure = 94.5 if o2_leak_active else 101.3

        alerts = []
        if dust_storm_active:
            alerts.append("WEATHER HAZARD: Global Martian Dust Storm Active — Solar Output Down 72%, Relying on Auxiliary Fuel Cells")
        if o2_leak_active:
            alerts.append("PRESSURE WARNING: Slow Depressurization Leak Detected in Hab Airloop — Auto-Injecting Buffer O2")
        if recovery_efficiency_pct > 95.0:
            alerts.append(f"LIFE SUPPORT NOMINAL: Closed-loop water recycling running at {recovery_efficiency_pct:.1f}% efficiency")

        status = "CRITICAL" if o2_leak_active else ("WARNING" if dust_storm_active else "OPTIMAL")

        # Run one hydro management step for the snapshot
        updated_sensors = ECLSSLifeSupportEngine.simulate_hydro_management(self.default_sensor_nodes)

        return {
            "sol": sol,
            "crew_size": crew_size,
            "atmosphere": {
                "total_pressure_kpa": round(cabin_pressure, 1),
                "partial_pressure_o2_kpa": round(p_o2, 1),
                "partial_pressure_co2_kpa": round(p_co2, 2),
                "cabin_temperature_c": 21.5,
                "relative_humidity_pct": 52.0
            },
            "reserves": {
                "o2_reserve_kg": round(base_o2_reserve, 1),
                "potable_water_l": round(base_water_reserve + (net_water_delta * 0.1), 1),
                "water_loop_closure_pct": round(recovery_efficiency_pct, 1)
            },
            "daily_rates": {
                "crew_o2_consumption_kg": round(demands["o2_demand_kg_sol"], 2),
                "plant_o2_generation_kg": round(daily_o2_from_plants_kg, 2),
                "ogs_electrolysis_o2_kg": round(remaining_o2_needed, 2),
                "co2_absorbed_by_crops_kg": round(daily_co2_scrubbed_by_plants_kg, 2),
                "sabatier_water_recovered_l": round(sabutier_water_recovered_l, 2),
                "water_transpired_crops_l": round(daily_water_transpired_l, 2),
                "net_water_daily_delta_l": round(net_water_delta, 2)
            },
            "power": {
                "solar_power_generated_kwh": round(power_generated, 1),
                "power_consumed_kwh": round(power_consumed, 1),
                "battery_state_of_charge_pct": round(battery_soc, 1)
            },
            "contingencies": {
                "dust_storm_active": dust_storm_active,
                "o2_leak_active": o2_leak_active
            },
            "regolith_moisture_sensors": [
                {
                    "node_id": s.node_id,
                    "zone_name": s.zone_name,
                    "target_crop": s.target_crop,
                    "volumetric_water_content_pct": s.volumetric_water_content_pct,
                    "electrical_conductivity_ds_m": s.electrical_conductivity_ds_m,
                    "irrigation_valve_open": s.irrigation_valve_open,
                    "status": s.status
                }
                for s in updated_sensors
            ],
            "active_alerts": alerts,
            "overall_eclss_status": status,
            "author": "Faruk Karimli (Computer Engineering & Life Support Simulation)"
        }

    def simulate_eclss_timeline(
        self,
        mission_duration_sols: int = 450,
        crew_size: int = 4,
        dust_storm_sol: Optional[int] = 200,
        dust_storm_duration: int = 60,
        o2_leak_sol: Optional[int] = 320,
        o2_leak_duration: int = 25,
        greenhouse_area_m2: float = 24.0,
        enable_closed_loop: bool = True
    ) -> Dict[str, Any]:
        """
        Sol-by-Sol dynamic life support simulation over the full mission duration.
        Evaluates system resilience against solar storms and pressure failures.
        """
        timeline = []
        alerts_log = []

        current_o2_kg = 400.0
        current_water_l = 3000.0
        current_battery_soc = 98.0

        current_sensors = [RegolithSensorNode(**vars(s)) for s in self.default_sensor_nodes]

        step = 10
        demands = ECLSSLifeSupportEngine.calculate_metabolic_demands(crew_size)

        for sol in range(0, mission_duration_sols + 1, step):
            is_dust_storm = (
                dust_storm_sol is not None and
                dust_storm_sol <= sol < (dust_storm_sol + dust_storm_duration)
            )
            is_o2_leak = (
                o2_leak_sol is not None and
                o2_leak_sol <= sol < (o2_leak_sol + o2_leak_duration)
            )

            # Update soil moisture sensors
            current_sensors = ECLSSLifeSupportEngine.simulate_hydro_management(
                current_sensors,
                ambient_temp_c=22.0 if not is_dust_storm else 19.5
            )

            # Power balance
            nominal_solar = 180.0
            solar_yield = nominal_solar * (0.28 if is_dust_storm else 1.0)
            daily_power_need = 115.0

            if solar_yield < daily_power_need:
                # Discharging battery
                current_battery_soc = max(25.0, current_battery_soc - 2.5)
            else:
                # Recharging battery
                current_battery_soc = min(100.0, current_battery_soc + 3.0)

            # Oxygen and Water mass balance
            # Crop contribution scaled by area
            plant_o2_kg = (greenhouse_area_m2 / 24.0) * 1.85
            crew_o2_kg = demands["o2_demand_kg_sol"]
            leak_rate_kg = 1.2 if is_o2_leak else 0.0

            net_o2_loss = max(0.0, crew_o2_kg + leak_rate_kg - plant_o2_kg)
            current_o2_kg = max(50.0, current_o2_kg - (net_o2_loss * (step / 30.0)))

            # Water closed loop
            if enable_closed_loop:
                # WRS 95% closure + Sabatier recovery
                water_loss_per_sol = demands["total_water_demand_l_sol"] * 0.05
            else:
                # Open loop (no recycling)
                water_loss_per_sol = demands["total_water_demand_l_sol"]

            current_water_l = max(100.0, current_water_l - (water_loss_per_sol * step))

            # Logging alerts
            sol_alerts = []
            if is_dust_storm and sol == dust_storm_sol:
                sol_alerts.append(f"SOL-{sol}: Martian Dust Storm event initiated. Solar production decreased by 72%.")
            if is_o2_leak and sol == o2_leak_sol:
                sol_alerts.append(f"SOL-{sol}: Intra-habitat seal micro-fracture. Cabin O2 venting detected.")

            alerts_log.extend(sol_alerts)

            avg_vwc = sum(s.volumetric_water_content_pct for s in current_sensors) / len(current_sensors)
            active_valves = sum(1 for s in current_sensors if s.irrigation_valve_open)

            timeline.append({
                "sol": sol,
                "o2_reserve_kg": round(current_o2_kg, 1),
                "potable_water_reserve_l": round(current_water_l, 1),
                "battery_soc_pct": round(current_battery_soc, 1),
                "power_generation_kwh": round(solar_yield, 1),
                "avg_regolith_moisture_vwc": round(avg_vwc, 1),
                "active_irrigation_valves": active_valves,
                "dust_storm_active": is_dust_storm,
                "o2_leak_active": is_o2_leak,
                "life_support_index_pct": round(
                    min(100.0, (current_o2_kg / 400.0 * 40.0) + (current_water_l / 3000.0 * 40.0) + (current_battery_soc * 0.2)),
                    1
                )
            })

        return {
            "mission_sols": mission_duration_sols,
            "crew_size": crew_size,
            "closed_loop_enabled": enable_closed_loop,
            "final_metrics": {
                "remaining_o2_kg": round(current_o2_kg, 1),
                "remaining_water_l": round(current_water_l, 1),
                "final_battery_soc_pct": round(current_battery_soc, 1),
                "survival_verdict": "NOMINAL_SURVIVED" if current_o2_kg > 80.0 and current_water_l > 300.0 else "MISSION_COMPROMISED"
            },
            "timeline": timeline,
            "alerts": alerts_log,
            "author": "Faruk Karimli (Computer Engineering & Life Support Simulation)"
        }
