"""Whole-word classifier and per-intent severity table."""

import pytest

from backend.synthesizer import classify_signal


def test_train_is_not_rain():
    category, _ = classify_signal("Namma Metro train services extended to Whitefield", "plot")
    assert category != "flooding_drainage"


@pytest.mark.parametrize("text", ["Heavy rain lashes the city", "Choked drain floods street", "Rains expected"])
def test_rain_and_drain_are_flooding(text):
    assert classify_signal(text, "plot")[0] == "flooding_drainage"


@pytest.mark.parametrize(
    "text",
    [
        "Traffic police enforce heavy vehicle ban on service road",
        "Truck ban during peak hours extended",
        "Narrow road leaves fire engines stuck",
        "Residents demand power line clearance near layout",
        "High-tension lines run over plots",
    ],
)
def test_access_infrastructure_topics(text):
    assert classify_signal(text, "warehouse")[0] == "access_infrastructure"


def test_flooding_severity_depends_on_intent():
    text = "Waterlogging reported after rain"
    assert classify_signal(text, "warehouse") == ("flooding_drainage", "high")
    assert classify_signal(text, "plot")[1] == "medium"


def test_parking_and_towing_high_for_retail_only():
    text = "Traffic police begin towing illegally parked vehicles"
    assert classify_signal(text, "retail") == ("civic_neighbor_friction", "high")
    assert classify_signal(text, "plot")[1] != "high"


def test_heavy_vehicle_ban_high_for_warehouse():
    assert classify_signal("Heavy vehicle ban on ORR", "warehouse") == ("access_infrastructure", "high")
    assert classify_signal("Heavy vehicle ban on ORR", "plot")[1] != "high"


def test_power_line_clearance_high_for_plot():
    assert classify_signal("Power line clearance dispute", "plot") == ("access_infrastructure", "high")


def test_lake_buffer_high_for_plot():
    assert classify_signal("NGT orders lake buffer zone cleared", "plot") == ("zoning_buffer_row", "high")


def test_road_widening_high_for_retail():
    assert classify_signal("BBMP road widening to demolish shopfronts", "retail") == ("zoning_buffer_row", "high")


def test_unmatched_text_is_low_civic():
    assert classify_signal("New cafe opens on main street", "plot") == ("civic_neighbor_friction", "low")
