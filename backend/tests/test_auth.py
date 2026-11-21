"""Email + password auth: scrypt hashes in SQLite, HMAC-signed 7-day tokens, generic login errors."""

from __future__ import annotations

import sqlite3
import time

import pytest

import backend.auth as auth
import backend.main as main

PASSWORD = "correct horse battery"
SIGNUP = {"name": "Asha Rao", "email": "Asha@Example.com", "password": PASSWORD}


@pytest.fixture(autouse=True)
def isolated_auth(monkeypatch, tmp_path):
    monkeypatch.setattr(auth, "DB_PATH", tmp_path / "users.db")
    monkeypatch.setattr(auth, "ENV_PATH", tmp_path / ".env")
    monkeypatch.setenv("AUTH_SECRET", "test-secret-" + "x" * 40)
    yield


def signup(client, **overrides):
    return client.post("/api/auth/signup", json={**SIGNUP, **overrides})


def login(client, email="asha@example.com", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_signup_returns_token_and_public_user(client):
    res = signup(client)
    assert res.status_code == 201
    body = res.json()
    assert set(body) == {"token", "user"}
    assert body["user"] == {"name": "Asha Rao", "email": "asha@example.com"}
    assert auth.verify_token(body["token"])["email"] == "asha@example.com"


def test_login_success_returns_a_valid_7_day_token(client):
    signup(client)
    res = login(client, email="ASHA@example.com")
    assert res.status_code == 200
    claims = auth.verify_token(res.json()["token"])
    assert claims["email"] == "asha@example.com"
    assert 7 * 86400 - 60 <= claims["exp"] - time.time() <= 7 * 86400


def test_wrong_password_gets_the_generic_error(client):
    signup(client)
    res = login(client, password="wrong password!")
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_unknown_email_gets_the_same_generic_error(client):
    res = login(client, email="nobody@example.com")
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_duplicate_email_is_reported_on_signup(client):
    signup(client)
    res = signup(client, email="asha@EXAMPLE.com", name="Someone Else")
    assert res.status_code == 409
    assert "already" in res.json()["detail"].lower()


@pytest.mark.parametrize("email", ["not-an-email", "a@b", "a@@b.com", "a b@c.com", "@example.com", "x" * 250 + "@a.com"])
def test_signup_rejects_bad_emails(client, email):
    res = signup(client, email=email)
    assert res.status_code == 422
    assert isinstance(res.json()["detail"], str)


def test_signup_rejects_short_passwords(client):
    res = signup(client, password="1234567")
    assert res.status_code == 422
    assert "8" in res.json()["detail"]


def test_signup_requires_a_name(client):
    assert signup(client, name="   ").status_code == 422


def test_plain_password_is_never_stored(client):
    signup(client)
    signup(client, email="second@example.com")  # same password, different user
    raw = auth.DB_PATH.read_bytes()
    assert PASSWORD.encode() not in raw
    with sqlite3.connect(auth.DB_PATH) as db:
        rows = db.execute("SELECT * FROM users").fetchall()
    for row in rows:
        assert all(PASSWORD not in str(col) for col in row)
    with sqlite3.connect(auth.DB_PATH) as db:
        hashes = [r[0] for r in db.execute("SELECT password_hash FROM users")]
    assert len(set(hashes)) == 2  # per-user salt


def test_login_is_rate_limited_per_ip(client):
    for _ in range(main.AUTH_RATE_LIMIT_REQUESTS):
        assert login(client).status_code == 401
    assert login(client).status_code == 429


def test_signup_is_rate_limited_per_ip(client):
    for i in range(main.AUTH_RATE_LIMIT_REQUESTS):
        assert signup(client, email=f"user{i}@example.com").status_code == 201
    assert signup(client, email="one-more@example.com").status_code == 429


def test_tampered_token_is_rejected(client):
    token = signup(client).json()["token"]
    payload, sig = token.split(".")
    forged = payload[:-2] + ("AA" if payload[-2:] != "AA" else "BB") + "." + sig
    assert auth.verify_token(forged) is None
    assert auth.verify_token(token + "x") is None
    assert auth.verify_token("garbage") is None


def test_expired_token_is_rejected(monkeypatch):
    token = auth.issue_token("asha@example.com", now=time.time() - 8 * 86400)
    assert auth.verify_token(token) is None


def test_token_signed_with_another_secret_is_rejected(monkeypatch):
    token = auth.issue_token("asha@example.com")
    monkeypatch.setenv("AUTH_SECRET", "a-different-secret-" + "y" * 40)
    assert auth.verify_token(token) is None


def test_me_returns_the_user_for_a_valid_token(client):
    token = signup(client).json()["token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"name": "Asha Rao", "email": "asha@example.com"}
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_missing_secret_is_generated_and_saved_to_env(monkeypatch):
    monkeypatch.delenv("AUTH_SECRET", raising=False)
    secret = auth.get_secret()
    assert len(secret) >= 43
    assert f"AUTH_SECRET={secret}" in auth.ENV_PATH.read_text()
    assert auth.get_secret() == secret  # stable once created


def test_analyze_stays_open_to_guests(client, collector):
    res = client.post("/api/analyze", json={"location": "Bellandur", "intent": "warehouse"})
    assert res.status_code == 200
