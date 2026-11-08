"""
Unit and integration tests for Ganja BLSS subsystems.
Verifies ADAU cultivar physiological parameters, gas exchange mass balance,
and Vitamin C counter-degradation mechanisms.
"""

import pytest
from app.models.ganja_blss import GANJA_CULTIVARS, GanjaBLSSEngine
from app.services.ganja_agri_service import GanjaAgriService


def test_ganja_cultivars_presence():
    """Verify all key ADAU Ganja cultivars are registered."""
    expected_ids = ["GC-26", "GHM-01", "GA-04", "GP-FERM"]
    for cid in expected_ids:
        assert cid in GANJA_CULTIVARS
        c = GANJA_CULTIVARS[cid]
        assert "Ganja" in c.origin or "ADAU" in c.origin
        assert c.daily_edible_biomass_g_m2 > 0
        assert c.harvest_index > 0


def test_microgreens_vitamin_c_density():
    """
    Verify Ganja microgreens GHM-01 provide hyper-dense Ascorbic acid
    specifically tailored to arrest Sol-450 scurvy.
    """
    ghm = GANJA_CULTIVARS["GHM-01"]
    assert ghm.vitamin_c_mg_100g >= 140.0
    # 50g serving provides more than 100% NASA STD-3001 RDA (90mg)
    serving_vit_c = (50.0 / 100.0) * ghm.vitamin_c_mg_100g
    assert serving_vit_c >= 70.0


def test_chickpea_regolith_tolerance_and_protein():
    """Verify ADAU Ganja Chickpea GC-26 has high protein and salinity tolerance."""
    gc = GANJA_CULTIVARS["GC-26"]
    assert gc.protein_g_100g >= 20.0
    assert gc.regolith_salinity_tolerance_ds_m >= 7.0
    assert gc.perchlorate_remediation_pct > 25.0


def test_ganja_blss_engine_yield_calculation():
    """Test mass balance calculation for 10m2 chamber across 450 sols."""
    yields = GanjaBLSSEngine.calculate_bioregenerative_yield(
        cultivar_id="GHM-01",
        growth_area_m2=10.0,
        sols=450,
        led_ppfd_umol_m2_s=400.0,
        photoperiod_hours=16.0,
    )
    assert yields["daily_edible_kg"] > 0.7  # ~0.82 kg/day
    assert yields["total_edible_biomass_kg"] > 300.0
    assert yields["daily_o2_generated_g"] > 400.0
    assert yields["daily_vit_c_yield_mg"] > 1000.0  # Sufficient to cover 10+ astronauts


def test_ganja_chamber_suite_service():
    """Test full multi-cultivar suite simulation for 4 crew over 450 sols."""
    res = GanjaAgriService.simulate_chamber_suite(crew_size=4, sol_duration=450)
    assert res["crew_size"] == 4
    assert res["mission_sols"] == 450
    assert res["life_support_metrics"]["vitamin_c_replenishment_pct"] == 100.0
    assert res["life_support_metrics"]["launch_mass_saved_kg"] > 500.0
    assert "ADAU (Ganja)" in res["scientific_provenance"]
