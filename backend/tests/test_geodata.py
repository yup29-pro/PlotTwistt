"""Geodata hazard tests (offline; Overpass is never called)."""

import pytest

from backend import geodata

PIN = (12.9352, 77.6744)


def test_nearest_distance_metres():
    lat, lng = PIN
    # A drain running east-west ~0.0004 deg (~44 m) north of the pin.
    line = [(lat + 0.0004, lng - 0.001), (lat + 0.0004, lng + 0.001)]
    assert geodata.nearest_distance_m(lat, lng, line, closed=False) == pytest.approx(44.2, abs=1.0)
    # A closed lake polygon containing the pin is 0 m away.
    square = [(lat - 0.001, lng - 0.001), (lat - 0.001, lng + 0.001), (lat + 0.001, lng + 0.001),
              (lat + 0.001, lng - 0.001), (lat - 0.001, lng - 0.001)]
    assert geodata.nearest_distance_m(lat, lng, square, closed=True) == 0


@pytest.mark.parametrize(
    "kind, metres, expected",
    [
        ("lake", 42, "high"), ("lake", 75, "high"), ("lake", 76, "medium"), ("lake", 200, "medium"),
        ("lake", 201, None), ("drain", 50, "high"), ("drain", 51, "medium"), ("drain", 300, None),
    ],
)
def test_buffer_thresholds(kind, metres, expected):
    assert geodata.hazard_severity(kind, metres) == expected


def test_hazard_flag_shape():
    flag = geodata.hazard_flag({"id": 123, "kind": "lake", "name": "Bellandur Lake", "distance_m": 42})
    assert flag["severity"] == "high"
    assert flag["headline"] == "Pin is 42 m from Bellandur Lake — inside 75 m NGT buffer"
    assert flag["url"] == "https://www.openstreetmap.org/way/123"
    assert flag["distance_km"] == 0.042


LAKE_RESPONSE = {"elements": [{
    "type": "way", "id": 7, "tags": {"natural": "water", "name": "Bellandur Lake"},
    "geometry": [{"lat": 12.9356, "lon": 77.6740}, {"lat": 12.9356, "lon": 77.6750}],
}]}


def _fake_post(responses, calls):
    import httpx

    async def post(self, url, **kwargs):
        calls.append(url)
        result = responses.get(url)
        if isinstance(result, Exception):
            raise result
        return httpx.Response(result[0], json=result[1], request=httpx.Request("POST", url))

    return post


def test_falls_back_to_next_overpass_server(monkeypatch):
    import asyncio

    import httpx

    calls = []
    first, second = geodata.OVERPASS_URLS[0], geodata.OVERPASS_URLS[1]
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post({first: (502, {}), second: (200, LAKE_RESPONSE)}, calls))
    flags = asyncio.run(geodata.collect_water_hazards(*PIN))
    assert calls[:2] == [first, second]
    assert flags[0]["headline"].startswith("Pin is 44 m from Bellandur Lake")


def test_successful_lookup_is_cached_per_pin(monkeypatch):
    import asyncio

    import httpx

    calls = []
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post({geodata.OVERPASS_URLS[0]: (200, LAKE_RESPONSE)}, calls))
    asyncio.run(geodata.collect_water_hazards(*PIN))
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post({}, calls := []))  # would fail if called
    flags = asyncio.run(geodata.collect_water_hazards(*PIN))
    assert calls == [] and len(flags) == 1


def test_all_servers_failing_raises(monkeypatch):
    import asyncio

    import httpx

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post({u: (502, {}) for u in geodata.OVERPASS_URLS}, []))
    with pytest.raises(RuntimeError):
        asyncio.run(geodata.collect_water_hazards(*PIN))


def test_query_radius_covers_medium_threshold():
    assert geodata.MEDIUM_RADIUS_M < geodata.SEARCH_RADIUS_M <= 300


def test_slow_first_server_leaves_time_for_the_others(monkeypatch):
    import asyncio

    import httpx

    timeouts = []

    async def post(self, url, timeout=None, **kwargs):
        timeouts.append(timeout)
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr(httpx.AsyncClient, "post", post)
    with pytest.raises(RuntimeError):
        asyncio.run(geodata.collect_water_hazards(*PIN))
    assert len(timeouts) == len(geodata.OVERPASS_URLS)
    assert timeouts[0] <= geodata.OVERPASS_TIMEOUT / len(geodata.OVERPASS_URLS) + 0.01
