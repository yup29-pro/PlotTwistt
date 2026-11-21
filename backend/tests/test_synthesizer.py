"""Synthesizer tests: no invented distances, no filler flags."""

import asyncio

from backend.serpapi_collector import haversine_distance
from backend.synthesizer import synthesize_friction_report
from backend.tests.conftest import make_signals


def run(signals, intent="warehouse"):
    return asyncio.run(synthesize_friction_report("Bellandur", intent, make_signals(signals)))


def sig(title, url="https://example.com/x", snippet="", **extra):
    return {"title": title, "url": url, "source": "Test", "snippet": snippet or title, **extra}


def test_distance_is_none_without_coordinates():
    data = make_signals([sig("Bellandur residents protest garbage dumping")])
    data.pop("target_lat")
    data.pop("target_lng")
    flags = asyncio.run(synthesize_friction_report("Bellandur", "warehouse", data))["flags"]
    assert flags[0]["distance_km"] is None
    assert flags[0]["distance_method"] == "none"
    assert flags[0]["proximity_tier"] == "hyperlocal"
    assert flags[0]["distance_label"] == "Names locality"


def test_tier_names_locality_when_in_title():
    flag = run([sig("Bellandur residents protest garbage", snippet="Residents gathered on Sunday.")])["flags"][0]
    assert (flag["proximity_tier"], flag["distance_label"]) == ("hyperlocal", "Names locality")


def test_tier_mentions_locality_when_only_in_snippet():
    flag = run([sig("Residents protest garbage dumping", snippet="Protest held near Bellandur lake.")])["flags"][0]
    assert (flag["proximity_tier"], flag["distance_label"]) == ("corridor", "Mentions locality")


def test_tier_area_level_when_locality_absent():
    flag = run([sig("Bengaluru Traffic Alert: Avoid THESE Routes For Congestion",
                    snippet="Commuters across Bengaluru, Karnataka face jams.")])["flags"][0]
    assert (flag["proximity_tier"], flag["distance_label"]) == ("district", "Area-level")


def test_tier_area_level_when_target_is_only_a_city():
    data = make_signals([sig("Bengaluru residents protest garbage dumping")])
    data["locality"] = "Bengaluru"
    flag = asyncio.run(synthesize_friction_report("Bengaluru", "plot", data))["flags"][0]
    assert flag["proximity_tier"] == "district"


def test_city_wide_piece_sorted_below_named_locality():
    flags = run([
        sig("Bengaluru Traffic Alert: Avoid THESE Routes For Congestion", url="https://e.com/city",
            snippet="Commuters across Bengaluru face jams."),
        sig("Garbage piles up in a residential lane", url="https://e.com/snippet",
            snippet="Residents of Bellandur complain."),
        sig("Bellandur residents protest garbage dumping", url="https://e.com/title"),
    ])["flags"]
    assert [f["url"] for f in flags] == ["https://e.com/title", "https://e.com/snippet", "https://e.com/city"]


def test_distance_computed_from_real_coordinates():
    flags = run([sig("Residents protest garbage dumping", lat=12.9452, lng=77.6744)])["flags"]
    expected = haversine_distance(12.9352, 77.6744, 12.9452, 77.6744)
    assert flags[0]["distance_km"] == expected


def test_no_filler_flags_for_sparse_results():
    report = run([sig("Bellandur residents protest garbage dumping")])
    assert report["total_flags"] == len(report["flags"]) == 1


def test_zero_flags_is_low_risk_with_honest_summary():
    report = run([])
    assert report["flags"] == []
    assert report["overall_risk"] == "low"
    assert "few public signals" in report["summary"].lower()


def test_short_title_not_truncated():
    title = "Bellandur residents protest garbage dumping"
    headline = run([sig(title)])["flags"][0]["headline"]
    assert headline.endswith(title)
    assert "..." not in headline


def test_long_title_truncated():
    title = "Bellandur residents protest garbage dumping " + "x" * 60
    headline = run([sig(title)])["flags"][0]["headline"]
    assert headline.endswith("...")
    assert title[:75] in headline


def test_sorted_by_tier_then_severity():
    flags = run([
        sig("Bengaluru city traffic jam worsens", url="https://e.com/district"),
        sig("Bellandur traffic jam worsens", url="https://e.com/local-medium"),
        sig("Bellandur flood after heavy rain", url="https://e.com/local-high"),
    ])["flags"]
    assert [f["url"] for f in flags] == [
        "https://e.com/local-high",
        "https://e.com/local-medium",
        "https://e.com/district",
    ]


def test_state_or_city_corridor_does_not_count_as_corridor_mention():
    data = make_signals([sig("Karnataka High Court to BDA in land dispute")])
    data["corridor"] = "Karnataka"
    flags = asyncio.run(synthesize_friction_report("Bellandur", "plot", data))["flags"]
    assert flags[0]["proximity_tier"] == "district"


def test_missing_corridor_is_not_replaced_with_city():
    data = make_signals([sig("Bengaluru residents protest garbage dumping")])
    data["corridor"] = None
    flag = asyncio.run(synthesize_friction_report("Bellandur", "plot", data))["flags"][0]
    assert "along Bengaluru" not in flag["explanation"]
    assert flag["proximity_tier"] == "district"
