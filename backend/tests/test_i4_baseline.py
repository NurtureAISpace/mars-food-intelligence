"""Toy-number tests for the personal-baseline z-score used in scripts/i4_baseline_demo.py (no network, no data files)."""

import importlib.util
import math
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "i4_baseline_demo.py"
_spec = importlib.util.spec_from_file_location("i4_baseline_demo", _SCRIPT)
demo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(demo)


def test_zscore_uses_personal_sd_when_above_floor():
    # baseline 10, 12, 14 -> mean 12, sample SD 2; floor = 0.05 * range width 20 = 1.0 < 2
    mean, sd, src, n = demo.baseline_stats([10.0, 12.0, 14.0], ref_width=20.0)
    assert (mean, sd, src, n) == (pytest.approx(12.0), pytest.approx(2.0), "personal", 3)
    assert demo.zscore(17.0, mean, sd) == pytest.approx(2.5)
    assert demo.zscore(8.0, mean, sd) == pytest.approx(-2.0)


def test_zscore_falls_back_to_floor_for_quiet_small_baseline():
    # identical baseline values -> sample SD 0; floor = 0.05 * 40 = 2.0 keeps z finite and sane
    mean, sd, src, n = demo.baseline_stats([100.0, 100.0, 100.0], ref_width=40.0)
    assert (mean, sd, src, n) == (pytest.approx(100.0), pytest.approx(2.0), "floor", 3)
    assert demo.zscore(105.0, mean, sd) == pytest.approx(2.5)


def test_baseline_ignores_missing_and_handles_no_range():
    # NaN dropped -> n=2; no reference range -> floor = 2% of mean = 1.0 > sample SD 0.707
    mean, sd, src, n = demo.baseline_stats([50.0, float("nan"), 49.0], ref_width=float("nan"))
    assert n == 2 and src == "floor"
    assert mean == pytest.approx(49.5) and sd == pytest.approx(0.99)


def test_zscore_undefined_cases_return_nan():
    assert math.isnan(demo.zscore(float("nan"), 1.0, 1.0))
    assert math.isnan(demo.zscore(1.0, 1.0, 0.0))
    assert demo.baseline_stats([])[3] == 0
