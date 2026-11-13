from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.ml.crew_data import CrewScenario
from app.services.crew_health_service import CrewHealthService

router = APIRouter(prefix="/health", tags=["Crew Health Monitoring"])
service = CrewHealthService()

_MAX_SOL = CrewScenario().mission_sols - 1


def _scenario(failure_enabled: bool, cooling_failure_sol: int, failure_duration_sols: int,
              failure_peak_temp_c: float) -> CrewScenario:
    return service.build_scenario(
        failure_enabled=failure_enabled,
        cooling_failure_sol=cooling_failure_sol,
        failure_duration_sols=failure_duration_sols,
        failure_peak_temp_c=failure_peak_temp_c,
    )


@router.get("/crew")
def get_crew_health(
    sol: Optional[int] = Query(None, ge=0, le=_MAX_SOL, description="Mission Sol to assess (default: last Sol)"),
    failure_enabled: bool = Query(True, description="Simulate the habitat cooling failure event"),
    cooling_failure_sol: int = Query(150, ge=0, le=_MAX_SOL),
    failure_duration_sols: int = Query(45, ge=1, le=300),
    failure_peak_temp_c: float = Query(29.5, ge=-20.0, le=60.0),
):
    """Crew status snapshot at a Sol: NOMINAL / WATCH / ACT per astronaut with explainable assessment."""
    sc = _scenario(failure_enabled, cooling_failure_sol, failure_duration_sols, failure_peak_temp_c)
    return service.crew_snapshot(sc, sol)


@router.get("/astronaut/{astronaut_id}/timeline")
def get_astronaut_timeline(
    astronaut_id: str,
    failure_enabled: bool = Query(True),
    cooling_failure_sol: int = Query(150, ge=0, le=_MAX_SOL),
    failure_duration_sols: int = Query(45, ge=1, le=300),
    failure_peak_temp_c: float = Query(29.5, ge=-20.0, le=60.0),
):
    """Full-mission Sol-by-Sol timeline (pools, intake, vitals, z-scores, status) for one astronaut."""
    sc = _scenario(failure_enabled, cooling_failure_sol, failure_duration_sols, failure_peak_temp_c)
    try:
        return service.astronaut_timeline(sc, astronaut_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/alerts")
def get_crew_alerts(
    sol: Optional[int] = Query(None, ge=0, le=_MAX_SOL, description="Only alerts raised up to this Sol"),
    failure_enabled: bool = Query(True),
    cooling_failure_sol: int = Query(150, ge=0, le=_MAX_SOL),
    failure_duration_sols: int = Query(45, ge=1, le=300),
    failure_peak_temp_c: float = Query(29.5, ge=-20.0, le=60.0),
):
    """Explainable early-warning alerts (first WATCH / first ACT per astronaut)."""
    sc = _scenario(failure_enabled, cooling_failure_sol, failure_duration_sols, failure_peak_temp_c)
    return service.alerts(sc, sol)
