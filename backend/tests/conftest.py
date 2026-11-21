"""Shared fixtures: no network, isolated cache, no API key."""

from __future__ import annotations

import copy

import httpx
import pytest
from fastapi.testclient import TestClient

import backend.cache as cache
import backend.main as main


def make_signals(signals=None, failed=0, total=5):
    """Collector output shaped like collect_location_signals()."""
    if signals is None:
        signals = [
            {
                "title": "Bellandur lake overflow floods Outer Ring Road after heavy rain",
                "url": "https://example.com/news/bellandur-flood",
                "source": "Deccan Herald",
                "snippet": "Stormwater drains overflowed near Bellandur, flooding basements.",
            },
            {
                "title": "BDA issues demolition notices for illegal layout near Outer Ring Road",
                "url": "https://example.com/news/demolition",
                "source": "The Hindu",
                "snippet": "Encroachments on the lake buffer to be cleared.",
            },
        ]
    return {
        "locality": "Bellandur",
        "corridor": "Outer Ring Road",
        "hierarchy": {"hyperlocal": "Bellandur", "corridor": "Outer Ring Road", "city": "Bengaluru"},
        "target_lat": 12.9352,
        "target_lng": 77.6744,
        "intent": "warehouse",
        "signals": copy.deepcopy(signals),
        "total_signals": len(signals),
        "failed_searches": failed,
        "total_searches": total,
    }


async def _no_network(self, *args, **kwargs):
    raise RuntimeError("Network access is disabled in tests")


@pytest.fixture(autouse=True)
def isolate(monkeypatch, tmp_path):
    monkeypatch.delenv("SERPAPI_API_KEY", raising=False)
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(httpx.AsyncClient, "send", _no_network)

    async def no_hazards(lat, lng):
        return []

    monkeypatch.setattr(main, "collect_water_hazards", no_hazards)
    reset = getattr(main, "reset_rate_limits", None)
    if reset:
        reset()
    yield


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def collector(monkeypatch):
    """Replace the live collector; returns a dict that records calls."""
    state = {"calls": 0, "result": make_signals()}

    async def fake_collect(locality, intent, lat=None, lng=None):
        state["calls"] += 1
        result = state["result"]
        if isinstance(result, Exception):
            raise result
        return copy.deepcopy(result)

    monkeypatch.setattr(main, "collect_location_signals", fake_collect)
    return state
