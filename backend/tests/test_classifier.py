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


@pytest.mark.parametrize(
    "text",
    ["Idea to reduce traffic congestion - ban trucks during day time", "Traffic crawls as vehicle restrictions kick in"],
)
def test_truck_bans_in_any_word_order_are_access(text):
    assert classify_signal(text, "warehouse")[0] == "access_infrastructure"


def test_police_administration_news_is_low():
    text = "Bengaluru police restructured into five commissionerates under a Chief Commissioner"
    assert classify_signal(text, "warehouse") == ("civic_neighbor_friction", "low")


def test_police_crime_news_still_flags():
    assert classify_signal("Police arrest gang after robbery near lake", "warehouse")[1] == "medium"


@pytest.mark.parametrize(
    "text",
    [
        "This building is illegal. But it'll never be razed",
        "BBMP to raze encroachments on lake bed",
        "Civic body razes shops near junction",
        "Illegal construction on stormwater drain",
        "Authorities flag illegal structures near lake",
        "Illegal building sealed by BBMP",
    ],
)
def test_raze_and_illegal_construction_are_zoning(text):
    assert classify_signal(text, "plot")[0] == "zoning_buffer_row"


@pytest.mark.parametrize("text", ["Traffic police crack down on illegal parking", "Illegal parking chokes main road"])
def test_illegal_parking_stays_civic(text):
    assert classify_signal(text, "retail") == ("civic_neighbor_friction", "high")


def test_bare_illegal_is_not_zoning():
    assert classify_signal("Illegal liquor sale busted", "plot")[0] != "zoning_buffer_row"
