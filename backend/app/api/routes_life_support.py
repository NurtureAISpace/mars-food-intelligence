"""
NurtureAISpace — Life Support System API Routes.
Author: Faruk (Computer Engineering & Life Support Simulation)
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from app.services.life_support_service import LifeSupportService

router = APIRouter(prefix="/life-support", tags=["Life Support & ECLSS Simulation (Faruk)"])
service = LifeSupportService()


class LifeSupportSimRequest(BaseModel):
    mission_duration_sols: int = Field(450, ge=50, le=1200, description="Total simulation length in Sols")
    crew_size: int = Field(4, ge=2, le=10, description="Number of astronauts in crew")
    dust_storm_sol: Optional[int] = Field(200, description="Sol when global dust storm begins")
    dust_storm_duration: int = Field(60, ge=10, le=200, description="Dust storm duration in Sols")
    o2_leak_sol: Optional[int] = Field(320, description="Sol when cabin seal micro-leak begins")
    o2_leak_duration: int = Field(25, ge=5, le=100, description="O2 leak duration in Sols")
    greenhouse_area_m2: float = Field(24.0, ge=0.0, le=100.0, description="Greenhouse bio-regenerative area")
    enable_closed_loop: bool = Field(True, description="Enable Sabatier & WRS 95%+ recycling loop")


@router.get("/telemetry")
def get_life_support_telemetry(
    sol: int = Query(450, ge=0, le=1200, description="Current mission Sol"),
    crew_size: int = Query(4, ge=2, le=10, description="Crew size"),
    dust_storm_active: bool = Query(False, description="Flag indicating dust storm event"),
    o2_leak_active: bool = Query(False, description="Flag indicating cabin O2 leak event")
):
    """
    Returns instantaneous ECLSS telemetry:
    Oxygen Generation (OGS), Sabatier recovery, Regolith Moisture, Power & Atmosphere.
    """
    return service.get_snapshot_telemetry(
        sol=sol,
        crew_size=crew_size,
        dust_storm_active=dust_storm_active,
        o2_leak_active=o2_leak_active
    )


@router.get("/regolith-sensors")
def get_regolith_moisture_sensors():
    """
    Returns live telemetry from IoT capacitive moisture sensor nodes
    embedded in Martian regolith beds and hydroponic modules.
    """
    return {
        "count": len(service.default_sensor_nodes),
        "sensors": service.get_regolith_sensors(),
        "controller": "Automated Closed-Loop Micro-Irrigation PID Subsystem",
        "data_provenance": "synthetic illustrative sensor readings"
    }


@router.post("/simulate")
def simulate_eclss_mission(req: LifeSupportSimRequest):
    """
    Runs a dynamic Sol-by-Sol life support and regolith hydro-management simulation,
    evaluating system resilience under dust storms and cabin depressurization leaks.
    """
    return service.simulate_eclss_timeline(
        mission_duration_sols=req.mission_duration_sols,
        crew_size=req.crew_size,
        dust_storm_sol=req.dust_storm_sol,
        dust_storm_duration=req.dust_storm_duration,
        o2_leak_sol=req.o2_leak_sol,
        o2_leak_duration=req.o2_leak_duration,
        greenhouse_area_m2=req.greenhouse_area_m2,
        enable_closed_loop=req.enable_closed_loop
    )
