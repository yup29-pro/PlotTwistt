"""Distances and the response cache: never serve or store results with missing distances."""

from __future__ import annotations

import backend.cache as cache
import backend.place_distance as pd
from backend.tests.conftest import make_signals

BODY = {"location": "Bellandur", "lat": 12.9352, "lng": 77.6744, "intent": "warehouse"}


def test_cached_scan_from_before_distances_is_ignored(client, collector):
    old = {
        "location": "Bellandur", "hierarchy": {}, "overall_risk": "low", "summary": "old",
        "flags": [{"id": "flag-1", "category": "civic_neighbor_friction", "severity": "low", "headline": "Old card",
                   "explanation": "x", "quote": "x", "source_title": "x", "url": "https://example.com/old",
                   "distance_km": None, "distance_label": "Area-level", "proximity_tier": "district"}],
        "total_flags": 1, "friction_score": 4, "verdict": "Low", "data_source": "live", "degraded": False,
        "analyzed_at": "2026-01-01T00:00:00+00:00",
    }
    cache.save_cached_response("Bellandur", "warehouse", old)
    body = client.post("/api/analyze", json=BODY).json()
    assert collector["calls"] == 1
    assert body["data_source"] == "live"
    assert all("distance_method" in f for f in body["flags"])


def test_scan_with_failed_place_lookup_is_not_cached(client, collector, monkeypatch):
    async def boom(q):
        raise RuntimeError("down")

    monkeypatch.setattr(pd, "fetch_photon", boom)
    collector["result"] = make_signals([{"title": "Waterlogging near Silk Board Junction stalls trucks",
                                         "url": "https://example.com/sb", "source": "T", "snippet": "x"}])
    client.post("/api/analyze", json=BODY)
    client.post("/api/analyze", json=BODY)
    assert collector["calls"] == 2


def test_complete_scan_is_cached(client, collector):
    client.post("/api/analyze", json=BODY)
    client.post("/api/analyze", json=BODY)
    assert collector["calls"] == 1


def test_cached_scan_from_an_older_distance_version_is_ignored(client, collector):
    client.post("/api/analyze", json=BODY)  # cache a current scan
    assert collector["calls"] == 1
    saved = cache.get_cached_response("Bellandur", "warehouse")
    saved.pop("distance_version", None)  # as written by the previous release
    cache.save_cached_response("Bellandur", "warehouse", saved)
    client.post("/api/analyze", json=BODY)
    assert collector["calls"] == 2
