"""GET /api/suggest: Photon local results, with the built-in locality list as an offline fallback."""

from __future__ import annotations

import json

import httpx
import pytest

import backend.main as main
import backend.suggest as suggest

PHOTON_KORA = {
    "type": "FeatureCollection",
    "features": [
        {
            "geometry": {"type": "Point", "coordinates": [77.6254, 12.9283]},
            "properties": {"name": "Koramangala 3rd Block", "osm_key": "place", "osm_value": "neighbourhood",
                           "district": "Kormangala East", "county": "Bangalore South"},
        },
        {
            "geometry": {"type": "Point", "coordinates": [77.6118, 12.9343]},
            "properties": {"name": "Forum Mall", "osm_key": "shop", "osm_value": "mall", "street": "Hosur Road",
                           "locality": "Koramangala 3rd Block", "district": "Koramangala"},
        },
        {
            "geometry": {"type": "Point", "coordinates": [77.6189, 12.9348]},
            "properties": {"name": "Koramangala 5th Block", "osm_key": "place", "osm_value": "neighbourhood",
                           "district": "A Adugodi", "county": "Bangalore South"},
        },
        {  # exact duplicate of the first item
            "geometry": {"type": "Point", "coordinates": [77.6254, 12.9283]},
            "properties": {"name": "Koramangala 3rd Block", "osm_key": "place", "osm_value": "neighbourhood",
                           "district": "Kormangala East", "county": "Bangalore South"},
        },
        {  # no name: skipped
            "geometry": {"type": "Point", "coordinates": [77.6, 12.9]},
            "properties": {"osm_key": "highway", "district": "Koramangala"},
        },
    ],
}


@pytest.fixture(autouse=True)
def fresh_suggest_cache():
    suggest.clear_cache()
    yield
    suggest.clear_cache()


@pytest.fixture
def photon(monkeypatch):
    """Replace the raw Photon fetch with canned parsed items; records the queries it receives."""
    state = {"queries": [], "result": suggest.parse_photon(PHOTON_KORA)}

    async def fake_fetch(q):
        state["queries"].append(q)
        result = state["result"]
        if isinstance(result, Exception):
            raise result
        return list(result)

    monkeypatch.setattr(suggest, "fetch_photon", fake_fetch)
    return state


def names(response):
    return [item["name"] for item in response.json()]


# ---- Built-in list ranking (the offline fallback) ----

def test_local_prefix_match_comes_first():
    assert suggest.match_localities("kora")[0]["name"] == "Koramangala"


def test_local_prefix_is_case_insensitive():
    assert suggest.match_localities("INDRA")[0]["name"] == "Indiranagar"


def test_local_prefix_ranks_before_contains():
    result = [s["name"] for s in suggest.match_localities("naga")]
    assert result[0].lower().startswith("naga")
    assert any("nagar" in n.lower() and not n.lower().startswith("naga") for n in result)


def test_local_fuzzy_match_catches_a_typo():
    assert "Koramangala" in [s["name"] for s in suggest.match_localities("koramangla")]


# ---- Photon parsing and the request we send ----

def test_parse_photon_builds_name_area_and_coordinates():
    items = suggest.parse_photon(PHOTON_KORA)
    by_name = {i["name"]: i for i in items}
    assert by_name["Koramangala 3rd Block"] == {
        "name": "Koramangala 3rd Block", "area": "Kormangala East · Bangalore South", "lat": 12.9283, "lng": 77.6254,
    }
    assert by_name["Forum Mall"]["area"] == "Koramangala 3rd Block · Koramangala"
    assert all(i["name"] for i in items)


def test_fetch_photon_sends_the_bengaluru_bias_and_bbox(monkeypatch):
    seen = {}

    async def fake_send(self, request, *args, **kwargs):
        seen["url"] = request.url
        seen["timeout"] = request.extensions.get("timeout")
        seen["ua"] = request.headers.get("user-agent", "")
        return httpx.Response(200, content=json.dumps(PHOTON_KORA).encode(), request=request)

    monkeypatch.setattr(httpx.AsyncClient, "send", fake_send)
    import asyncio

    items = asyncio.run(suggest.fetch_photon("kora"))
    params = dict(seen["url"].params)
    assert str(seen["url"]).startswith("https://photon.komoot.io/api/")
    assert params["q"] == "kora" and params["limit"] == "8" and params["lang"] == "en"
    assert params["lat"] == "12.97" and params["lon"] == "77.59"
    assert params["bbox"] == "77.35,12.80,77.85,13.15"
    assert seen["timeout"]["read"] == 3.0
    assert "PlotTwistt" in seen["ua"]
    assert items[0]["name"] == "Koramangala 3rd Block"


# ---- Endpoint ----

def test_kora_lists_photon_blocks_and_landmarks(client, photon):
    res = client.get("/api/suggest", params={"q": "kora"})
    assert res.status_code == 200
    result = names(res)
    assert {"Koramangala 3rd Block", "Forum Mall", "Koramangala 5th Block"} <= set(result)
    assert photon["queries"] == ["kora"]


def test_at_most_two_local_matches_sit_above_photon(client, photon):
    items = client.get("/api/suggest", params={"q": "naga"}).json()
    photon_names = {i["name"] for i in photon["result"]}
    leading_local = [i for i in items if i["name"] not in photon_names]
    assert len(leading_local) <= 2
    first_photon = next(k for k, i in enumerate(items) if i["name"] in photon_names)
    assert all(i["name"] not in photon_names for i in items[:first_photon])
    assert first_photon <= 2


def test_duplicates_are_removed(client, photon):
    items = client.get("/api/suggest", params={"q": "kora"}).json()
    keys = [(i["name"].lower(), i["area"].lower()) for i in items]
    assert len(keys) == len(set(keys))


def test_every_item_has_coordinates(client, photon):
    for item in client.get("/api/suggest", params={"q": "kora"}).json():
        assert set(item) == {"name", "area", "lat", "lng"}
        assert 12.7 < item["lat"] < 13.3 and 77.3 < item["lng"] < 77.9


def test_returns_at_most_eight(client, photon):
    assert len(client.get("/api/suggest", params={"q": "kora"}).json()) <= 8


def test_photon_results_are_cached(client, photon):
    client.get("/api/suggest", params={"q": "kora"})
    client.get("/api/suggest", params={"q": " KORA "})
    assert photon["queries"] == ["kora"]


def test_photon_down_falls_back_to_the_builtin_list(client, photon):
    photon["result"] = RuntimeError("Photon down")
    res = client.get("/api/suggest", params={"q": "kora"})
    assert res.status_code == 200
    assert names(res)[0] == "Koramangala"


def test_real_fetch_failure_is_swallowed(client):
    # conftest blocks the network, so the real Photon fetch raises; the endpoint still answers.
    res = client.get("/api/suggest", params={"q": "indra"})
    assert res.status_code == 200
    assert names(res)[0] == "Indiranagar"


@pytest.mark.parametrize("q", ["", "k", " k ", "x" * 61])
def test_rejects_queries_outside_2_to_60_chars(client, photon, q):
    assert client.get("/api/suggest", params={"q": q}).status_code == 422
    assert photon["queries"] == []


def test_suggest_is_rate_limited(client, photon):
    for _ in range(main.SUGGEST_RATE_LIMIT_REQUESTS):
        assert client.get("/api/suggest", params={"q": "kora"}).status_code == 200
    assert client.get("/api/suggest", params={"q": "kora"}).status_code == 429


def test_fuzzy_local_matches_do_not_sit_above_photon(client, photon):
    items = client.get("/api/suggest", params={"q": "kora"}).json()
    photon_names = {i["name"] for i in photon["result"]}
    for item in items:
        if item["name"] in photon_names:
            break
        assert "kora" in item["name"].lower()
