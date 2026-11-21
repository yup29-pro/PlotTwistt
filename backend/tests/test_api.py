"""API contract tests. Never touch the network (see conftest)."""

from datetime import datetime

from backend.schemas import AnalyzeResponse, IntentType

BELLANDUR = {"location": "Bellandur", "intent": "warehouse"}


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_presets_flat_shape(client):
    res = client.get("/api/presets")
    assert res.status_code == 200
    presets = res.json()
    assert len(presets) >= 3
    for p in presets:
        assert set(p) == {"id", "name", "lat", "lng", "intent", "description"}
        assert p["intent"] in {i.value for i in IntentType}


def test_live_success_matches_contract(client, collector):
    res = client.post("/api/analyze", json=BELLANDUR)
    assert res.status_code == 200
    body = AnalyzeResponse.model_validate(res.json())
    assert body.data_source == "live"
    assert body.degraded is False
    assert body.total_flags == len(body.flags) > 0
    assert datetime.fromisoformat(body.analyzed_at).utcoffset().total_seconds() == 0


def test_location_object_accepted(client, collector):
    payload = {"location": {"locality": "Bellandur", "lat": 12.93, "lng": 77.67}, "intent": "plot"}
    assert client.post("/api/analyze", json=payload).status_code == 200


def test_invalid_intent_is_422(client, collector):
    res = client.post("/api/analyze", json={"location": "Bellandur", "intent": "factory"})
    assert res.status_code == 422


def test_invalid_lat_is_422(client, collector):
    res = client.post("/api/analyze", json={"location": "Bellandur", "lat": 95, "intent": "plot"})
    assert res.status_code == 422


def test_invalid_nested_lng_is_422(client, collector):
    payload = {"location": {"locality": "Bellandur", "lng": 200}, "intent": "plot"}
    assert client.post("/api/analyze", json=payload).status_code == 422


def test_total_failure_known_locality_serves_demo(client, collector):
    collector["result"] = RuntimeError("all searches failed")
    res = client.post("/api/analyze", json=BELLANDUR)
    assert res.status_code == 200
    body = AnalyzeResponse.model_validate(res.json())
    assert body.data_source == "demo"
    assert "Bellandur" in body.location


def test_total_failure_unknown_locality_is_503(client, collector):
    collector["result"] = RuntimeError("all searches failed")
    res = client.post("/api/analyze", json={"location": "Whitefield", "intent": "retail"})
    assert res.status_code == 503
    assert "Whitefield" in res.json()["detail"]


def test_overlong_location_is_422(client, collector):
    res = client.post("/api/analyze", json={"location": "x" * 201, "intent": "plot"})
    assert res.status_code == 422


def test_second_call_served_from_cache(client, collector):
    first = client.post("/api/analyze", json=BELLANDUR).json()
    second = client.post("/api/analyze", json=BELLANDUR).json()
    assert first["data_source"] == "live"
    assert second["data_source"] == "cache"
    assert second["flags"] == first["flags"]
    assert collector["calls"] == 1


def test_refresh_bypasses_cache(client, collector):
    client.post("/api/analyze", json=BELLANDUR)
    res = client.post("/api/analyze?refresh=true", json=BELLANDUR).json()
    assert res["data_source"] == "live"
    assert collector["calls"] == 2


def test_cache_key_includes_intent(client, collector):
    client.post("/api/analyze", json=BELLANDUR)
    res = client.post("/api/analyze", json={"location": "Bellandur", "intent": "retail"}).json()
    assert res["data_source"] == "live"
    assert collector["calls"] == 2


def test_expired_cache_is_ignored(client, collector, tmp_path, monkeypatch):
    import os
    import time

    monkeypatch.setenv("CACHE_TTL_HOURS", "1")
    client.post("/api/analyze", json=BELLANDUR)
    old = time.time() - 2 * 3600
    for f in tmp_path.glob("*.json"):
        os.utime(f, (old, old))
    res = client.post("/api/analyze", json=BELLANDUR).json()
    assert res["data_source"] == "live"
    assert collector["calls"] == 2


def test_partial_failure_sets_degraded(client, collector):
    from backend.tests.conftest import make_signals

    collector["result"] = make_signals(failed=2)
    res = client.post("/api/analyze", json=BELLANDUR).json()
    assert res["data_source"] == "live"
    assert res["degraded"] is True


def test_unmocked_pipeline_without_key_stays_offline(client, tmp_path):
    """Real collector with SERPAPI_API_KEY unset: no network, demo for a known locality."""
    res = client.post("/api/analyze", json=BELLANDUR)
    assert res.status_code == 200
    assert res.json()["data_source"] == "demo"
    assert list(tmp_path.glob("*.json")) == []


def test_demo_results_are_not_cached(client, collector):
    from backend.tests.conftest import make_signals

    collector["result"] = RuntimeError("down")
    assert client.post("/api/analyze", json=BELLANDUR).json()["data_source"] == "demo"
    collector["result"] = make_signals()
    assert client.post("/api/analyze", json=BELLANDUR).json()["data_source"] == "live"
