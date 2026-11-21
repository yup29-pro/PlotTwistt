"""Approximate distances for news flags, from the most specific place each one names."""

from __future__ import annotations

import asyncio

import pytest

import backend.place_distance as pd
from backend.geodata import hazard_flag
from backend.synthesizer import synthesize_friction_report

# A pin in Koramangala 1st Block, on the HSR Layout side of Koramangala.
KORA_PIN = (12.9279, 77.6271)
SILK_BOARD = {"name": "Silk Board Junction", "area": "BTM Layout", "lat": 12.9177, "lng": 77.6233}


@pytest.fixture(autouse=True)
def fresh_cache():
    pd.clear_cache()
    yield
    pd.clear_cache()


@pytest.fixture
def photon(monkeypatch):
    state = {"queries": [], "results": {}}

    async def fake_fetch(q):
        state["queries"].append(q)
        hit = state["results"].get(q.lower())
        return [hit] if hit else []

    monkeypatch.setattr(pd, "fetch_photon", fake_fetch)
    return state


def signal(title, snippet="", url=None):
    return {"title": title, "snippet": snippet or title, "url": url or f"https://example.com/{abs(hash(title))}", "source": "Test"}


def scan(signals, pin=KORA_PIN, locality="Koramangala", extra=None):
    data = {
        "locality": locality,
        "hierarchy": {"hyperlocal": locality, "city": "Bengaluru"},
        "signals": signals,
        "extra_flags": extra or [],
    }
    if pin:
        data["target_lat"], data["target_lng"] = pin
    return asyncio.run(synthesize_friction_report(locality, "warehouse", data))["flags"]


# ---- finding the place ----

def test_builtin_match_is_whole_word_and_longest_first():
    assert pd.find_known_place("Drain overflow in Electronic City Phase 2 again")["name"] == "Electronic City Phase 2"
    assert pd.find_known_place("Flooding in HSR Layout after rain")["name"] == "HSR Layout"
    assert pd.find_known_place("Agarwal family sells plot") is None  # "Agara" is not a whole word here


def test_city_and_state_never_count_as_a_place():
    assert pd.find_known_place("Bengaluru traffic worsens across Karnataka") is None
    assert pd.extract_place_phrase("Heavy rain in Bengaluru tonight") is None


def test_place_phrase_after_a_preposition():
    assert pd.extract_place_phrase("Protest held near Silk Board Junction on Monday") == "Silk Board Junction"
    assert pd.extract_place_phrase("Potholes on the stretch") is None


# ---- distances on flags ----

def test_mentioned_locality_gives_an_approximate_distance():
    flag = scan([signal("Severe flooding in HSR Layout after overnight rain")])[0]
    assert flag["distance_method"] == "mentioned_place"
    assert flag["distance_basis"] == "HSR Layout"
    assert 2.0 <= flag["distance_km"] <= 3.0
    assert flag["distance_km"] == round(flag["distance_km"], 1)


def test_city_only_story_has_no_distance(photon):
    flag = scan([signal("Bengaluru traffic jams worsen as monsoon arrives")])[0]
    assert flag["distance_km"] is None
    assert flag["distance_method"] == "none"
    assert flag["distance_basis"] is None
    assert photon["queries"] == []


def test_geodata_flag_keeps_its_exact_distance():
    geo = hazard_flag({"id": 7, "kind": "lake", "name": "Bellandur Lake", "distance_m": 42.0})
    flag = next(f for f in scan([], extra=[geo]) if f["headline"] == geo["headline"])
    assert flag["distance_km"] == 0.042
    assert flag["distance_method"] == "osm_feature"
    assert flag["distance_basis"] == "Bellandur Lake"


def test_unknown_place_is_looked_up_with_photon(photon):
    photon["results"]["silk board junction"] = SILK_BOARD
    flag = scan([signal("Waterlogging near Silk Board Junction stalls trucks")])[0]
    assert photon["queries"] == ["Silk Board Junction"]
    assert flag["distance_method"] == "mentioned_place"
    assert flag["distance_basis"] == "Silk Board Junction"
    assert 1.0 <= flag["distance_km"] <= 1.5


def test_photon_lookups_are_capped_per_scan(photon):
    titles = [f"Road caved in near Alpha{i} Street yesterday" for i in "ABCDEFGH"]
    scan([signal(t) for t in titles])
    assert len(photon["queries"]) == pd.MAX_LOOKUPS_PER_SCAN == 6


def test_photon_lookups_are_cached(photon):
    photon["results"]["silk board junction"] = SILK_BOARD
    scan([signal("Waterlogging near Silk Board Junction stalls trucks")])
    scan([signal("Accident near Silk Board Junction blocks traffic")])
    assert photon["queries"] == ["Silk Board Junction"]


def test_photon_failure_means_unknown_distance(monkeypatch):
    async def boom(q):
        raise RuntimeError("down")

    monkeypatch.setattr(pd, "fetch_photon", boom)
    flag = scan([signal("Waterlogging near Silk Board Junction stalls trucks")])[0]
    assert flag["distance_km"] is None and flag["distance_method"] == "none"


def test_same_locality_as_pin_is_within_locality():
    flag = scan([signal("Koramangala residents oppose new warehouse")])[0]
    assert flag["distance_method"] == "mentioned_place"
    assert flag["distance_basis"] == "Koramangala"
    assert flag["distance_within_locality"] is True
    centre = pd.find_known_place("Koramangala")
    assert flag["distance_km"] == round(pd.haversine_km(*KORA_PIN, centre["lat"], centre["lng"]), 1)


def test_no_pin_means_no_distance():
    flag = scan([signal("Severe flooding in HSR Layout after overnight rain")], pin=None)[0]
    assert flag["distance_km"] is None and flag["distance_method"] == "none"


def test_closer_flags_come_first_within_a_tier():
    flags = scan([
        signal("Flood warning issued in Yelahanka for low-lying plots"),
        signal("Flood warning issued in HSR Layout for low-lying plots"),
    ])
    assert [f["distance_basis"] for f in flags] == ["HSR Layout", "Yelahanka"]
    assert flags[0]["proximity_tier"] == flags[1]["proximity_tier"]


@pytest.mark.parametrize("text", [
    "Police bust fake marks card racket in Bengaluru Police limits",
    "Notice issued by the High Court on Bangalore Development Authority plots",
    "Strike at Karnataka Power Corporation offices",
])
def test_organisations_named_after_the_city_are_not_places(text):
    assert pd.extract_place_phrase(text) is None


def test_leading_city_name_is_dropped_from_a_real_place():
    assert pd.extract_place_phrase("Flooding near Bengaluru Silk Board Junction") == "Silk Board Junction"


# ---- scanned-locality mentions, search-anchored stories, pin fallback ----

def anchored(title, locality="Koramangala"):
    return {**signal(title), "origin_target": locality}


def test_scanned_locality_far_from_centre_is_measured_to_the_centre():
    pin = (12.9200, 77.6400)  # inside Koramangala's search area but ~2.4 km from its centre
    flag = scan([signal("Koramangala residents oppose new warehouse")], pin=pin)[0]
    assert flag["distance_method"] == "mentioned_place"
    assert flag["distance_within_locality"] is True
    assert flag["distance_basis"] == "Koramangala"
    assert 2.0 <= flag["distance_km"] <= 2.8


def test_scanned_locality_beats_another_named_place():
    flag = scan([signal("Koramangala traders protest; HSR Layout residents join")])[0]
    assert flag["distance_basis"] == "Koramangala" and flag["distance_within_locality"] is True


def test_scanned_locality_not_in_builtin_list_uses_photon_centre(photon):
    photon["results"]["turahalli"] = {"name": "Turahalli", "area": "x", "lat": 12.8836, "lng": 77.5270}
    flag = scan([signal("Turahalli buffer zone row heats up")], pin=(12.8900, 77.5300), locality="Turahalli")[0]
    assert photon["queries"] == ["Turahalli"]
    assert flag["distance_method"] == "mentioned_place" and flag["distance_within_locality"] is True
    assert flag["distance_basis"] == "Turahalli"
    assert flag["distance_km"] < 1.5


def test_story_from_a_locality_search_without_a_place_is_in_the_area(photon):
    flag = scan([anchored("Police arrest three after drunken fight over girl")])[0]
    assert flag["distance_method"] == "search_area"
    assert flag["distance_basis"] == "Koramangala"
    assert flag["distance_km"] is None
    assert photon["queries"] == []


def test_story_with_no_place_and_no_locality_link_stays_unknown(photon):
    flag = scan([signal("Police arrest three after drunken fight over girl")])[0]
    assert flag["distance_method"] == "none" and flag["distance_basis"] is None


def test_missing_pin_falls_back_to_the_resolved_coordinates():
    data = {
        "locality": "Koramangala",
        "hierarchy": {"hyperlocal": "Koramangala", "resolved_lat": KORA_PIN[0], "resolved_lng": KORA_PIN[1]},
        "signals": [signal("Severe flooding in HSR Layout after overnight rain")],
    }
    flag = asyncio.run(synthesize_friction_report("Koramangala", "warehouse", data))["flags"][0]
    assert flag["distance_method"] == "mentioned_place" and 2.0 <= flag["distance_km"] <= 3.0


def test_lookup_failure_is_reported_so_the_scan_is_not_cached(monkeypatch):
    async def boom(q):
        raise RuntimeError("down")

    monkeypatch.setattr(pd, "fetch_photon", boom)
    data = {"locality": "Koramangala", "hierarchy": {}, "target_lat": KORA_PIN[0], "target_lng": KORA_PIN[1],
            "signals": [signal("Waterlogging near Silk Board Junction stalls trucks")]}
    report = asyncio.run(synthesize_friction_report("Koramangala", "warehouse", data))
    assert report["distance_lookup_failed"] is True
    ok = asyncio.run(synthesize_friction_report("Koramangala", "warehouse", {**data, "signals": [signal("Flooding in HSR Layout")]}))
    assert ok["distance_lookup_failed"] is False


def test_exact_nearby_feature_sorts_above_an_in_locality_estimate():
    geo = hazard_flag({"id": 9, "kind": "lake", "name": "Koramangala Lake", "distance_m": 60.0})
    centre = pd.find_known_place("Koramangala")
    flags = scan([signal("Koramangala residents oppose new warehouse")], pin=(centre["lat"], centre["lng"]), extra=[geo])
    assert flags[1]["distance_km"] == 0.0  # pin sits on the centre, yet the 60 m lake still leads
    assert flags[0]["distance_method"] == "osm_feature"
    assert flags[1]["distance_within_locality"] is True


def test_bare_sub_area_search_is_labelled_with_its_locality(photon):
    data = {
        "locality": "5th Block",
        "hierarchy": {"hyperlocal": "5th Block", "locality": "Koramangala"},
        "target_lat": KORA_PIN[0], "target_lng": KORA_PIN[1],
        "signals": [{**signal("Police arrest three after drunken fight over girl"), "origin_target": "5th Block"}],
    }
    flag = asyncio.run(synthesize_friction_report("Koramangala 5th Block", "warehouse", data))["flags"][0]
    assert flag["distance_method"] == "search_area"
    assert flag["distance_basis"] == "Koramangala 5th Block"
