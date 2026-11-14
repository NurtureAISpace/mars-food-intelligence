from fastapi import APIRouter
from app.pipeline.ingest import load_raw_catalog, load_crop_models, load_crop_models_meta

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/telemetry")
def get_mission_dashboard_telemetry(sol: int = 450, crew_size: int = 4):
    """
    Returns high-level real-time Mars habitat mission telemetry at a given Sol.
    """
    catalog = load_raw_catalog()
    crops = load_crop_models()

    total_items = len(catalog)
    # Estimate baseline food mass remaining at Sol 450
    initial_mass_kg = crew_size * 1.6 * 600 * 1.2
    consumed_mass_kg = crew_size * 1.5 * sol
    remaining_mass_kg = max(0.0, initial_mass_kg - consumed_mass_kg)

    # Calculate current crop harvest capacity
    daily_crop_harvest_g = sum(c["daily_yield_g_per_m2"] for c in crops) * (18.0 / len(crops))
    
    # Caloric security calculation
    days_of_food_left = remaining_mass_kg / (crew_size * 1.5) if crew_size > 0 else 0
    security_index = min(100.0, round((days_of_food_left / 150.0) * 100.0, 1))

    # Chilling power draw
    power_draw_kw = round((remaining_mass_kg * 0.45 + 18.0 * 120.0) / 1000.0, 2)

    return {
        "mission_sol": sol,
        "sol_milestone": "Sol-450 Target Phase (Surface Ops)",
        "crew_size": crew_size,
        "food_security_index_pct": security_index,
        "remaining_food_mass_kg": round(remaining_mass_kg, 1),
        "days_of_rations_remaining": round(days_of_food_left, 1),
        "daily_crop_harvest_biomass_g": round(daily_crop_harvest_g, 1),
        "total_active_crops": len(crops),
        "habitat_cooling_power_kw": power_draw_kw,
        "data_provenance": ("synthetic scenario: food mass, harvest, power and advisories are illustrative "
                            "values computed from assumed constants and the synthetic catalog/crop data"),
        "active_alerts": [
            {
                "level": "INFO",
                "message": f"Sol {sol}: Photobioreactor Spirulina cycle on schedule (4-day turnover)"
            },
            {
                "level": "WARNING" if sol > 400 else "NORMAL",
                "message": f"Sol {sol}: Ambient storage Thiamine reserves experiencing continuous Arrhenius degradation"
            }
        ]
    }


@router.get("/crop-status")
def get_crop_status():
    """
    Returns live bio-regenerative agriculture chamber status.
    """
    crops = load_crop_models()
    return {
        "greenhouse_total_area_m2": 18.0,
        "active_systems": ["Hydroponic Racks", "Closed Photobioreactor", "Aeroponic Chambers"],
        "crops": crops,
        "data_provenance": load_crop_models_meta()["data_provenance"]
    }
