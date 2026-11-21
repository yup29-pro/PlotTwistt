"""Collector tests with httpx.AsyncClient.get monkeypatched (no network)."""

import asyncio
import logging

import httpx
import pytest

from backend import serpapi_collector as collector

FAKE_KEY = "test-secret-key-123"


def _response(payload):
    return httpx.Response(200, json=payload, request=httpx.Request("GET", collector.SERPAPI_URL))


@pytest.fixture
def fake_get(monkeypatch):
    monkeypatch.setenv("SERPAPI_API_KEY", FAKE_KEY)
    state = {"inflight": 0, "max_inflight": 0, "timeouts": [], "fail_queries": 0, "fail_all": False}

    async def get(self, url, params=None, timeout=None, **kwargs):
        state["timeouts"].append((params["engine"], timeout))
        if params["engine"] == "google_maps":
            return _response({})
        state["inflight"] += 1
        state["max_inflight"] = max(state["max_inflight"], state["inflight"])
        await asyncio.sleep(0.01)
        state["inflight"] -= 1
        if state["fail_all"] or state["fail_queries"] > 0:
            state["fail_queries"] -= 1
            raise httpx.ConnectError(f"boom {url}?api_key={params['api_key']}")
        if params["engine"] == "google_news":
            return _response({"news_results": [{"title": "Bellandur news item", "link": "https://e.com/n"}]})
        return _response({"organic_results": [{"title": "Bellandur web item", "link": "https://e.com/w"}]})

    monkeypatch.setattr(httpx.AsyncClient, "get", get)
    return state


def collect():
    return asyncio.run(collector.collect_location_signals("Bellandur", "warehouse", 12.93, 77.67))


def test_searches_run_in_parallel(fake_get):
    result = collect()
    assert fake_get["max_inflight"] == 5
    assert result["failed_searches"] == 0
    assert result["total_searches"] == 5


def test_timeouts(fake_get):
    collect()
    timeouts = dict(fake_get["timeouts"])
    assert timeouts["google_maps"] == 8.0
    assert {t for e, t in fake_get["timeouts"] if e != "google_maps"} == {10.0}


def test_partial_failures_are_counted(fake_get):
    fake_get["fail_queries"] = 2
    result = collect()
    assert result["failed_searches"] == 2
    assert result["total_signals"] == 3


def test_all_failures_raise(fake_get):
    fake_get["fail_all"] = True
    with pytest.raises(RuntimeError):
        collect()


def test_failures_logged_without_key_or_url(fake_get, caplog):
    fake_get["fail_queries"] = 2
    with caplog.at_level(logging.DEBUG):
        collect()
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 2
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert FAKE_KEY not in text
    assert "serpapi.com/search.json?" not in text
