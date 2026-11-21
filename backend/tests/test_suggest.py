"""GET /api/suggest: local Bengaluru localities first, Nominatim only as a fallback."""

from __future__ import annotations

import pytest

import backend.main as main
import backend.suggest as suggest


@pytest.fixture(autouse=True)
def fresh_suggest_cache():
    suggest.clear_cache()
    yield
    suggest.clear_cache()


@pytest.fixture
def nominatim(monkeypatch):
    """Replace the raw Nominatim fetch; records the queries it receives."""
    state = {"queries": [], "result": []}

    async def fake_fetch(q):
        state["queries"].append(q)
        result = state["result"]
        if isinstance(result, Exception):
            raise result
        return list(result)

    monkeypatch.setattr(suggest, "fetch_nominatim", fake_fetch)
    return state


def names(response):
    return [item["name"] for item in response.json()]


def test_prefix_match_comes_first(client, nominatim):
    res = client.get("/api/suggest", params={"q": "kora"})
    assert res.status_code == 200
    assert names(res)[0] == "Koramangala"


def test_prefix_is_case_insensitive(client, nominatim):
    res = client.get("/api/suggest", params={"q": "INDRA"})
    assert names(res)[0] == "Indiranagar"


def test_items_have_name_area_and_coordinates(client, nominatim):
    item = client.get("/api/suggest", params={"q": "kora"}).json()[0]
    assert set(item) == {"name", "area", "lat", "lng"}
    assert 12.7 < item["lat"] < 13.3 and 77.3 < item["lng"] < 77.9


def test_prefix_matches_rank_before_contains_matches(client, nominatim):
    # "nagar" starts no locality name but is contained in many; a prefix hit must still win.
    result = names(client.get("/api/suggest", params={"q": "naga"}))
    assert result[0].lower().startswith("naga")
    assert any("nagar" in n.lower() and not n.lower().startswith("naga") for n in result)


def test_fuzzy_match_catches_a_typo(client, nominatim):
    assert "Koramangala" in names(client.get("/api/suggest", params={"q": "koramangla"}))


def test_returns_at_most_six(client, nominatim):
    res = client.get("/api/suggest", params={"q": "na"})
    assert res.status_code == 200
    assert 1 <= len(res.json()) <= 6


@pytest.mark.parametrize("q", ["", "k", " k ", "x" * 61])
def test_rejects_queries_outside_2_to_60_chars(client, nominatim, q):
    assert client.get("/api/suggest", params={"q": q}).status_code == 422
    assert nominatim["queries"] == []


def test_enough_local_matches_skip_nominatim(client, nominatim):
    res = client.get("/api/suggest", params={"q": "nagar"})
    assert res.status_code == 200 and len(res.json()) >= 3
    assert nominatim["queries"] == []


def test_few_local_matches_fall_back_to_nominatim(client, nominatim):
    nominatim["result"] = [{"name": "Zqx Tech Park", "area": "Whitefield, Bengaluru", "lat": 12.97, "lng": 77.75}]
    result = names(client.get("/api/suggest", params={"q": "zqx tech"}))
    assert nominatim["queries"] == ["zqx tech"]
    assert "Zqx Tech Park" in result


def test_nominatim_results_are_cached(client, nominatim):
    nominatim["result"] = [{"name": "Zqx Tech Park", "area": "Bengaluru", "lat": 12.97, "lng": 77.75}]
    client.get("/api/suggest", params={"q": "zqx tech"})
    client.get("/api/suggest", params={"q": "ZQX TECH "})
    assert nominatim["queries"] == ["zqx tech"]


def test_nominatim_failure_still_returns_local_matches(client, nominatim):
    nominatim["result"] = RuntimeError("Nominatim down")
    res = client.get("/api/suggest", params={"q": "zqx tech"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_real_fetch_failure_is_swallowed(client):
    # conftest blocks the network, so the real fetch raises; the endpoint must still answer.
    res = client.get("/api/suggest", params={"q": "zqx tech"})
    assert res.status_code == 200


def test_suggest_is_rate_limited(client, nominatim):
    for _ in range(main.SUGGEST_RATE_LIMIT_REQUESTS):
        assert client.get("/api/suggest", params={"q": "kora"}).status_code == 200
    assert client.get("/api/suggest", params={"q": "kora"}).status_code == 429
