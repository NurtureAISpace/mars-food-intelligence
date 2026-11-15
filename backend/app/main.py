import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.services.checkin_service import DEFAULT_STORE_PATH
from app.services.demo_seed import seed_if_empty
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_datalab import router as datalab_router
from app.api.routes_prediction import router as prediction_router
from app.api.routes_optimization import router as optimization_router
from app.api.routes_simulator import router as simulator_router
from app.api.routes_health import router as health_router
from app.api.routes_life_support import router as life_support_router
from app.api.routes_real_data import router as real_data_router
from app.api import routes_health

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Check-ins live in a JSON file. A hosted free instance (Render) starts with an empty disk after every restart:
    # create the folder, and seed the labeled demo check-ins (C001-C003) when the store is empty.
    DEFAULT_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        n = seed_if_empty(routes_health.checkin_service)
        if n:
            log.info("Check-in store was empty: seeded %d labeled demo check-ins (C001-C003)", n)
    except Exception:  # a seeding problem must never stop the API
        log.exception("Demo check-in seeding failed")
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Space nutrition, vitamin degradation and astronaut crew-health early-warning prototype by NurtureAISpace. Data provenance: docs/DATA_SOURCES.md (real NASA OSDR data, cited literature, and clearly labeled synthetic scenario data).",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for front-end access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Register API routers under v1
api_prefix = settings.API_V1_STR
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(datalab_router, prefix=api_prefix)
app.include_router(prediction_router, prefix=api_prefix)
app.include_router(optimization_router, prefix=api_prefix)
app.include_router(simulator_router, prefix=api_prefix)
app.include_router(health_router, prefix=api_prefix)
app.include_router(life_support_router, prefix=api_prefix)
app.include_router(real_data_router, prefix=api_prefix)


@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "status": "OPERATIONAL",
        "sol_target": "Sol-450",
        "api_docs": "/docs",
        "endpoints": [
            f"{api_prefix}/dashboard/telemetry",
            f"{api_prefix}/datalab/catalog",
            f"{api_prefix}/datalab/audit",
            f"{api_prefix}/datalab/validation-benchmarks",
            f"{api_prefix}/prediction/shelf-life",
            f"{api_prefix}/prediction/cooling-failure-impact",
            f"{api_prefix}/optimization/solve-diet",
            f"{api_prefix}/simulator/run",
            f"{api_prefix}/health/crew",
            f"{api_prefix}/health/astronaut/{{astronaut_id}}/timeline",
            f"{api_prefix}/health/alerts",
            f"{api_prefix}/health/checkin",
            f"{api_prefix}/health/checkins?astronaut_id=",
            f"{api_prefix}/health/checkin/guide",
            f"{api_prefix}/life-support/telemetry",
            f"{api_prefix}/life-support/regolith-sensors",
            f"{api_prefix}/life-support/simulate",
            f"{api_prefix}/real-data/i4"
        ]
    }


@app.get("/healthz")
def healthcheck():
    return {"status": "HEALTHY", "subsystems": ["Arrhenius-Kinetics", "SciPy-Optimizer", "Sol-Simulator", "Data-Pipeline", "ECLSS-LifeSupport"]}
