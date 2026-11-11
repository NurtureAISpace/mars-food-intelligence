from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes_dashboard import router as dashboard_router
from app.api.routes_datalab import router as datalab_router
from app.api.routes_prediction import router as prediction_router
from app.api.routes_optimization import router as optimization_router
from app.api.routes_simulator import router as simulator_router
from app.api.routes_ganja import router as ganja_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Mission-Grade Space Nutrition, Degradation Kinetics & Bio-Regenerative Life Support Intelligence System by NurtureAI",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for front-end access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers under v1
api_prefix = settings.API_V1_STR
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(datalab_router, prefix=api_prefix)
app.include_router(prediction_router, prefix=api_prefix)
app.include_router(optimization_router, prefix=api_prefix)
app.include_router(simulator_router, prefix=api_prefix)
app.include_router(ganja_router, prefix=api_prefix)


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
            f"{api_prefix}/ganja/cultivars",
            f"{api_prefix}/ganja/simulate-blss"
        ]
    }


@app.get("/healthz")
def healthcheck():
    return {"status": "HEALTHY", "subsystems": ["Arrhenius-Kinetics", "SciPy-Optimizer", "Sol-Simulator", "Data-Pipeline"]}
