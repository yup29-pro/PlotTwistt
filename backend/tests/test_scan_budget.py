"""/api/analyze never hangs: a total time budget, a shorter Overpass budget, partial results marked degraded."""

from __future__ import annotations

import asyncio
import time

import pytest

import backend.main as main

BODY = {"location": "Bellandur", "lat": 12.9352, "lng": 77.6744, "intent": "warehouse"}
from backend.geodata import hazard_flag

HAZARD = hazard_flag({"id": 1, "kind": "lake", "name": "Bellandur Lake", "distance_m": 40.0})


@pytest.fixture
def budgets(monkeypatch):
    monkeypatch.setattr(main, "ANALYSIS_BUDGET_SECONDS", 0.6)
    monkeypatch.setattr(main, "OVERPASS_BUDGET_SECONDS", 0.2)


def set_hazards(monkeypatch, result=None, delay=0.0, error=None):
    async def hazards(lat, lng):
        await asyncio.sleep(delay)
        if error:
            raise error
        return list(result or [])

    monkeypatch.setattr(main, "collect_water_hazards", hazards)


def test_lake_check_ok_when_overpass_answers(client, collector, monkeypatch, budgets):
    set_hazards(monkeypatch, result=[])
    body = client.post("/api/analyze", json=BODY).json()
    assert body["lake_check"] == "ok"
    assert body["degraded"] is False


def test_slow_overpass_is_cut_off_and_marked_unavailable(client, collector, monkeypatch, budgets):
    set_hazards(monkeypatch, result=[HAZARD], delay=5)
    start = time.monotonic()
    res = client.post("/api/analyze", json=BODY)
    elapsed = time.monotonic() - start
    assert res.status_code == 200
    body = res.json()
    assert elapsed < 1.5
    assert body["lake_check"] == "unavailable"
    assert body["degraded"] is True
    assert body["total_flags"] > 0  # the SerpApi signals still came back


def test_failed_overpass_is_marked_unavailable(client, collector, monkeypatch, budgets):
    set_hazards(monkeypatch, error=RuntimeError("overpass down"))
    body = client.post("/api/analyze", json=BODY).json()
    assert body["lake_check"] == "unavailable"
    assert body["degraded"] is True


def test_no_coordinates_means_lake_check_not_run(client, collector, monkeypatch, budgets):
    set_hazards(monkeypatch, result=[HAZARD])
    body = client.post("/api/analyze", json={"location": "Bellandur", "intent": "warehouse"}).json()
    assert body["lake_check"] == "not_run"


def test_slow_search_returns_what_finished_within_the_budget(client, monkeypatch, budgets):
    async def slow_collect(locality, intent, lat=None, lng=None):
        await asyncio.sleep(10)

    monkeypatch.setattr(main, "collect_location_signals", slow_collect)
    set_hazards(monkeypatch, result=[HAZARD])
    start = time.monotonic()
    res = client.post("/api/analyze", json=BODY)
    elapsed = time.monotonic() - start
    assert res.status_code == 200
    body = res.json()
    assert elapsed < 1.5
    assert body["degraded"] is True
    assert body["lake_check"] == "ok"
    assert [f["headline"] for f in body["flags"]] == [HAZARD["headline"]]


def test_timed_out_scan_is_not_cached(client, monkeypatch, budgets):
    calls = {"n": 0}

    async def slow_collect(locality, intent, lat=None, lng=None):
        calls["n"] += 1
        await asyncio.sleep(10)

    monkeypatch.setattr(main, "collect_location_signals", slow_collect)
    set_hazards(monkeypatch, result=[HAZARD])
    client.post("/api/analyze", json=BODY)
    client.post("/api/analyze", json=BODY)
    assert calls["n"] == 2
