"""
Unit & Integration Tests for ECLSS & Regolith Hydro-Management Simulation.
Author: Faruk (Computer Engineering & Life Support Simulation)
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.life_support_eclss import (
    ECLSSLifeSupportEngine,
    RegolithSensorNode
)
from app.services.life_support_service import LifeSupportService

client = TestClient(app)


def test_metabolic_demands_calculation():
    """Crew consumables use the cited NASA BVAD per-crewmember-day rates, converted to Sols."""
    sol = 1.02749125
    demands = ECLSSLifeSupportEngine.calculate_metabolic_demands(crew_size=4)
    # BVAD REV1 Table 3-33: O2 0.816 kg/CM-d, CO2 1.04 kg/CM-d
    assert demands["o2_demand_kg_sol"] == pytest.approx(4 * 0.816 * sol, rel=1e-6)
    assert demands["co2_output_kg_sol"] == pytest.approx(4 * 1.04 * sol, rel=1e-6)
    # BVAD REV1 Table 4-20: 2.50 kg/CM-d human consumption, 7.32 kg/CM-d hygiene (mature base)
    assert demands["potable_water_demand_l_sol"] == pytest.approx(4 * 2.50 * sol, rel=1e-6)
    assert demands["total_water_demand_l_sol"] == pytest.approx(4 * (2.50 + 7.32) * sol, rel=1e-6)


def test_regolith_hydro_management_microcontroller():
    """Test automated IoT valve triggering on low soil moisture and cutoff on saturation."""
    dry_node = RegolithSensorNode(
        node_id="TEST-01",
        zone_name="Test Tray",
        target_crop="Microgreens",
        depth_cm=5.0,
        volumetric_water_content_pct=35.0,  # Below 38% trigger threshold
        soil_temperature_c=20.0,
        electrical_conductivity_ds_m=2.0,
        regolith_ph=6.5,
        irrigation_valve_open=False,
        status="NOMINAL"
    )

    # 1st step: should trigger valve OPEN
    updated = ECLSSLifeSupportEngine.simulate_hydro_management([dry_node], ambient_temp_c=20.0)
    assert updated[0].irrigation_valve_open is True

    # 2nd step with open valve: moisture should rise
    updated_again = ECLSSLifeSupportEngine.simulate_hydro_management(updated, ambient_temp_c=20.0)
    assert updated_again[0].volumetric_water_content_pct > updated[0].volumetric_water_content_pct


def test_snapshot_telemetry_nominal():
    """Verify baseline life support telemetry generates nominal closed-loop metrics."""
    service = LifeSupportService()
    snap = service.get_snapshot_telemetry(sol=450, crew_size=4)
    assert snap["sol"] == 450
    assert snap["overall_eclss_status"] == "OPTIMAL"
    assert snap["reserves"]["water_loop_closure_pct"] >= 90.0
    assert snap["atmosphere"]["total_pressure_kpa"] == pytest.approx(101.3, abs=0.5)
    assert len(snap["regolith_moisture_sensors"]) == 3
    assert "synthetic" in snap["data_provenance"]


def test_dust_storm_and_leak_contingencies():
    """Verify emergency alerting when dust storm and O2 leaks occur."""
    service = LifeSupportService()
    # Dust storm scenario
    storm_snap = service.get_snapshot_telemetry(sol=200, crew_size=4, dust_storm_active=True)
    assert storm_snap["overall_eclss_status"] == "WARNING"
    assert storm_snap["power"]["solar_power_generated_kwh"] < 60.0
    assert any("Dust Storm" in alert for alert in storm_snap["active_alerts"])

    # Cabin leak scenario
    leak_snap = service.get_snapshot_telemetry(sol=320, crew_size=4, o2_leak_active=True)
    assert leak_snap["overall_eclss_status"] == "CRITICAL"
    assert leak_snap["atmosphere"]["total_pressure_kpa"] < 100.0
    assert any("Depressurization" in alert for alert in leak_snap["active_alerts"])


def test_simulate_eclss_timeline():
    """Test full 450-Sol life support simulation comparing closed-loop vs open-loop."""
    service = LifeSupportService()
    # Closed loop run
    closed_res = service.simulate_eclss_timeline(
        mission_duration_sols=450,
        crew_size=4,
        enable_closed_loop=True
    )
    assert closed_res["final_metrics"]["survival_verdict"] == "NOMINAL_SURVIVED"
    assert closed_res["final_metrics"]["remaining_water_l"] > 1000.0

    # Open loop run
    open_res = service.simulate_eclss_timeline(
        mission_duration_sols=450,
        crew_size=4,
        enable_closed_loop=False
    )
    # Open loop loses water significantly faster
    assert open_res["final_metrics"]["remaining_water_l"] < closed_res["final_metrics"]["remaining_water_l"]


def test_life_support_api_endpoints():
    """Test FastAPI endpoints for Life Support simulation and sensors."""
    # Telemetry
    res = client.get("/api/v1/life-support/telemetry?sol=450&crew_size=4")
    assert res.status_code == 200
    data = res.json()
    assert "atmosphere" in data
    assert "reserves" in data

    # Regolith sensor nodes
    res_sensors = client.get("/api/v1/life-support/regolith-sensors")
    assert res_sensors.status_code == 200
    assert res_sensors.json()["count"] == 3

    # Post simulation
    res_sim = client.post("/api/v1/life-support/simulate", json={
        "mission_duration_sols": 450,
        "crew_size": 4,
        "dust_storm_sol": 200,
        "dust_storm_duration": 40,
        "o2_leak_sol": 300,
        "o2_leak_duration": 20,
        "greenhouse_area_m2": 24.0,
        "enable_closed_loop": True
    })
    assert res_sim.status_code == 200
    sim_data = res_sim.json()
    assert len(sim_data["timeline"]) > 10
    assert "final_metrics" in sim_data
