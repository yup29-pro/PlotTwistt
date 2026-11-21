"""Friction score: weights by severity, scaled by how specifically the source names the site."""

import pytest

from backend.synthesizer import compute_friction_score, verdict_for


def flag(severity, tier):
    return {"severity": severity, "proximity_tier": tier}


def test_weights_and_tier_multipliers():
    flags = [flag("high", "hyperlocal"), flag("medium", "corridor"), flag("low", "district")]
    # 25*1.0 + 12*0.6 + 4*0.3 = 33.4
    assert compute_friction_score(flags) == (33, "Moderate")
    assert compute_friction_score([flag("high", "hyperlocal")] * 5) == (100, "High")
    assert compute_friction_score([]) == (0, "Low")


@pytest.mark.parametrize("score, verdict", [(0, "Low"), (30, "Low"), (31, "Moderate"), (70, "Moderate"), (71, "High"), (100, "High")])
def test_verdict_bands(score, verdict):
    assert verdict_for(score) == verdict
