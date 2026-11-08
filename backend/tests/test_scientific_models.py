import pytest
from app.core.scientific_models import (
    celsius_to_kelvin,
    arrhenius_rate_constant,
    first_order_retention,
    zero_order_retention,
    half_life_days,
    calculate_composite_space_food_index
)


def test_temperature_conversion():
    assert celsius_to_kelvin(0.0) == pytest.approx(273.15)
    assert celsius_to_kelvin(25.0) == pytest.approx(298.15)
    assert celsius_to_kelvin(-20.0) == pytest.approx(253.15)


def test_arrhenius_kinetics_rate_increase_with_temp():
    A = 36100.0
    Ea = 42.31  # kJ/mol
    
    k_chilled = arrhenius_rate_constant(A, Ea, 4.0)
    k_ambient = arrhenius_rate_constant(A, Ea, 21.0)
    k_hot = arrhenius_rate_constant(A, Ea, 35.0)

    # Higher temperature MUST result in strictly faster degradation
    assert 0 < k_chilled < k_ambient < k_hot
    # Typically rate increases ~2.5x per 17C rise
    assert (k_ambient / k_chilled) > 2.5


def test_first_order_retention_decay():
    c0 = 100.0
    k = 0.005 # day^-1
    c_10d = first_order_retention(c0, k, 10.0)
    c_100d = first_order_retention(c0, k, 100.0)

    assert c_10d < c0
    assert c_100d < c_10d
    assert c_100d > 0.0


def test_half_life():
    k = 0.001
    hl = half_life_days(k, order=1)
    # ln(2)/0.001 ~ 693.14 days
    assert 690 < hl < 695


def test_composite_food_viability_index():
    perfect_score = calculate_composite_space_food_index(100.0, 100.0, 100.0, 10.0, 100.0)
    assert perfect_score == 100.0

    degraded_score = calculate_composite_space_food_index(50.0, 40.0, 30.0, 5.0, 80.0)
    assert 0.0 < degraded_score < 60.0
