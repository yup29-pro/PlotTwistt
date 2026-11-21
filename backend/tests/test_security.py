"""CORS, rate limiting and the /api/health alias."""

import importlib

from fastapi.testclient import TestClient

import backend.main as main

BELLANDUR = {"location": "Bellandur", "intent": "warehouse"}


def test_api_health_alias(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_cors_default_origin_allowed_without_credentials(client):
    res = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-credentials" not in res.headers


def test_cors_unknown_origin_rejected(client):
    res = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in res.headers


def test_cors_origins_from_env(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example, https://b.example")
    try:
        reloaded = importlib.reload(main)
        res = TestClient(reloaded.app).get("/health", headers={"Origin": "https://b.example"})
        assert res.headers.get("access-control-allow-origin") == "https://b.example"
    finally:
        monkeypatch.delenv("CORS_ORIGINS")
        importlib.reload(main)


def test_rate_limit_returns_429(client, collector):
    codes = [client.post("/api/analyze", json=BELLANDUR).status_code for _ in range(11)]
    assert codes[:10] == [200] * 10
    assert codes[10] == 429
