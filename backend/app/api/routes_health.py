from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.ml.crew_data import CrewScenario
from app.services.checkin_service import CheckinIn, CheckinService
from app.services.crew_health_service import CrewHealthService

router = APIRouter(prefix="/health", tags=["Crew Health Monitoring"])
service = CrewHealthService()
checkin_service = CheckinService(crew_service=service)

_MAX_SOL = CrewScenario().mission_sols - 1


_SCENARIO_Q = Query(None, description="Demo preset id from GET /health/scenarios; overrides the failure_* params")


def _scenario(failure_enabled: bool, cooling_failure_sol: int, failure_duration_sols: int,
              failure_peak_temp_c: float, scenario: Optional[str] = None) -> CrewScenario:
    if scenario is not None:
        try:
            return service.preset_scenario(scenario)
        except KeyError as e:
            raise HTTPException(status_code=422, detail=str(e))
    return service.build_scenario(
        failure_enabled=failure_enabled,
        cooling_failure_sol=cooling_failure_sol,
        failure_duration_sols=failure_duration_sols,
        failure_peak_temp_c=failure_peak_temp_c,
    )


@router.get("/scenarios")
def get_scenarios():
    """Demo scenario presets (hypothetical stress tests; physics and thresholds are identical in all)."""
    return service.scenarios()


@router.get("/crew")
def get_crew_health(
    sol: Optional[int] = Query(None, ge=0, le=_MAX_SOL, description="Mission Sol to assess (default: last Sol)"),
    failure_enabled: bool = Query(True, description="Simulate the habitat cooling failure event"),
    cooling_failure_sol: int = Query(150, ge=0, le=_MAX_SOL),
    failure_duration_sols: int = Query(45, ge=1, le=300),
    failure_peak_temp_c: float = Query(29.5, ge=-20.0, le=60.0),
    scenario: Optional[str] = _SCENARIO_Q,
):
    """Crew status snapshot at a Sol: NOMINAL / WATCH / ACT per astronaut with explainable assessment."""
    sc = _scenario(failure_enabled, cooling_failure_sol, failure_duration_sols, failure_peak_temp_c, scenario)
    return service.crew_snapshot(sc, sol)


@router.get("/astronaut/{astronaut_id}/timeline")
def get_astronaut_timeline(
    astronaut_id: str,
    failure_enabled: bool = Query(True),
    cooling_failure_sol: int = Query(150, ge=0, le=_MAX_SOL),
    failure_duration_sols: int = Query(45, ge=1, le=300),
    failure_peak_temp_c: float = Query(29.5, ge=-20.0, le=60.0),
    scenario: Optional[str] = _SCENARIO_Q,
):
    """Full-mission Sol-by-Sol timeline (pools, intake, vitals, z-scores, status) for one astronaut."""
    sc = _scenario(failure_enabled, cooling_failure_sol, failure_duration_sols, failure_peak_temp_c, scenario)
    try:
        return service.astronaut_timeline(sc, astronaut_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/parameters")
def get_model_parameters():
    """Model parameters with literature source + status, and the literature range check."""
    return service.parameters()


@router.get("/alerts")
def get_crew_alerts(
    sol: Optional[int] = Query(None, ge=0, le=_MAX_SOL, description="Only alerts raised up to this Sol"),
    failure_enabled: bool = Query(True),
    cooling_failure_sol: int = Query(150, ge=0, le=_MAX_SOL),
    failure_duration_sols: int = Query(45, ge=1, le=300),
    failure_peak_temp_c: float = Query(29.5, ge=-20.0, le=60.0),
    scenario: Optional[str] = _SCENARIO_Q,
):
    """Explainable early-warning alerts (first WATCH / first ACT per astronaut)."""
    sc = _scenario(failure_enabled, cooling_failure_sol, failure_duration_sols, failure_peak_temp_c, scenario)
    return service.alerts(sc, sol)


# ---------------------------------------------------------------------------
# Daily Check-in (astronaut self-assessment)
# ---------------------------------------------------------------------------
@router.post("/checkin")
def post_checkin(payload: CheckinIn):
    """Submit today's self-measurements; returns colour-coded, explained result per indicator and overall
    NOMINAL / WATCH / ACT. Decision-support prototype, not a medical device."""
    return checkin_service.submit(payload)


@router.get("/checkins")
def get_checkins(astronaut_id: str = Query(..., pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$")):
    """Check-in history (oldest first) and current streak for one astronaut."""
    return checkin_service.history(astronaut_id)


@router.get("/checkin/guide")
def get_checkin_guide():
    """How to measure each indicator, reference ranges with sources, daily routine and input limits."""
    return checkin_service.guide()
