"""Email + password accounts for the demo.

- Users live in SQLite (backend/data/users.db, gitignored).
- Passwords: hashlib.scrypt with a random per-user salt; compared with hmac.compare_digest.
- Tokens: base64url(JSON claims) + "." + base64url(HMAC-SHA256), 7-day expiry, secret from AUTH_SECRET.
  The algorithm is fixed here, never read from the token. Tokens are stateless, so they can't be
  revoked before expiry; logging out only discards the client copy.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

BACKEND_DIR = Path(__file__).resolve().parent
DB_PATH = BACKEND_DIR / "data" / "users.db"
ENV_PATH = BACKEND_DIR.parent / ".env"

TOKEN_TTL_SECONDS = 7 * 24 * 3600
TOKEN_VERSION = 1

# scrypt cost: n=2**14, r=8, p=1 (~16 MiB, tens of ms per hash).
SCRYPT_N, SCRYPT_R, SCRYPT_P, SCRYPT_DKLEN = 2**14, 8, 1, 64
SALT_BYTES = 16

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 256  # long passphrases are fine; this only caps hashing work
MAX_NAME_LENGTH = 80
MAX_EMAIL_LENGTH = 254
# Pragmatic address check: one @, no spaces, a dot in the domain, no empty labels.
EMAIL_RE = re.compile(r"^[^@\s]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$")

_secret_lock = threading.Lock()


class AuthError(Exception):
    """A user-facing auth failure with an HTTP status."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# ---------- secret ----------

def get_secret() -> str:
    """AUTH_SECRET from the environment; generated and appended to .env once if missing."""
    secret = os.getenv("AUTH_SECRET", "").strip()
    if secret:
        return secret
    with _secret_lock:
        secret = os.getenv("AUTH_SECRET", "").strip()
        if secret:
            return secret
        secret = secrets.token_urlsafe(48)
        existing = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
        sep = "" if not existing or existing.endswith("\n") else "\n"
        with open(ENV_PATH, "a", encoding="utf-8") as f:
            f.write(f"{sep}AUTH_SECRET={secret}\n")
        os.environ["AUTH_SECRET"] = secret
        return secret


# ---------- passwords ----------

def _scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P,
        dklen=SCRYPT_DKLEN, maxmem=64 * 1024 * 1024,
    )


def hash_password(password: str) -> tuple[str, str]:
    salt = secrets.token_bytes(SALT_BYTES)
    return salt.hex(), _scrypt(password, salt).hex()


def check_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    return hmac.compare_digest(_scrypt(password, bytes.fromhex(salt_hex)).hex(), hash_hex)


# Used for unknown emails so a failed login costs the same time either way.
_DUMMY_SALT, _DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ---------- tokens ----------

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(get_secret().encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest())


def issue_token(email: str, now: Optional[float] = None) -> str:
    issued = int(now if now is not None else time.time())
    claims = {"v": TOKEN_VERSION, "email": email, "iat": issued, "exp": issued + TOKEN_TTL_SECONDS}
    payload = _b64(json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    return f"{payload}.{_sign(payload)}"


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Claims for a genuine, unexpired token; None otherwise."""
    try:
        payload, signature = token.split(".")
        if not hmac.compare_digest(_sign(payload), signature):
            return None
        claims = json.loads(_unb64(payload))
    except (ValueError, TypeError, AttributeError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    if not isinstance(claims, dict) or claims.get("v") != TOKEN_VERSION:
        return None
    exp = claims.get("exp")
    if not isinstance(exp, int) or exp <= time.time() or not isinstance(claims.get("email"), str):
        return None
    return claims


# ---------- storage ----------

def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.execute(
        """CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"""
    )
    return db


def _public(name: str, email: str) -> Dict[str, str]:
    return {"name": name, "email": email}


# ---------- validation ----------

def normalize_email(email: Any) -> str:
    value = email.strip().lower() if isinstance(email, str) else ""
    if not value or len(value) > MAX_EMAIL_LENGTH or not EMAIL_RE.match(value):
        raise AuthError(422, "Enter a valid email address, like name@example.com.")
    return value


def validate_password(password: Any) -> str:
    if not isinstance(password, str) or len(password) < MIN_PASSWORD_LENGTH:
        raise AuthError(422, f"Use at least {MIN_PASSWORD_LENGTH} characters for your password.")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise AuthError(422, f"Use at most {MAX_PASSWORD_LENGTH} characters for your password.")
    return password


def validate_name(name: Any) -> str:
    value = " ".join(name.split()) if isinstance(name, str) else ""
    if not value:
        raise AuthError(422, "Enter your name.")
    if len(value) > MAX_NAME_LENGTH:
        raise AuthError(422, f"Keep your name under {MAX_NAME_LENGTH} characters.")
    return value


# ---------- flows ----------

def signup(name: Any, email: Any, password: Any) -> Dict[str, Any]:
    name = validate_name(name)
    email = normalize_email(email)
    password = validate_password(password)
    salt, digest = hash_password(password)
    try:
        with _connect() as db:
            db.execute(
                "INSERT INTO users (email, name, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (email, name, salt, digest, int(time.time())),
            )
    except sqlite3.IntegrityError:
        raise AuthError(409, "An account with this email already exists. Sign in instead.") from None
    return {"token": issue_token(email), "user": _public(name, email)}


def login(email: Any, password: Any) -> Dict[str, Any]:
    generic = AuthError(401, "Invalid email or password")
    if not isinstance(email, str) or not isinstance(password, str) or len(password) > MAX_PASSWORD_LENGTH:
        raise generic
    email = email.strip().lower()
    with _connect() as db:
        row = db.execute("SELECT name, salt, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None:
        check_password(password, _DUMMY_SALT, _DUMMY_HASH)  # same cost as a real check
        raise generic
    name, salt, digest = row
    if not check_password(password, salt, digest):
        raise generic
    return {"token": issue_token(email), "user": _public(name, email)}


def user_for_token(token: str) -> Optional[Dict[str, str]]:
    claims = verify_token(token)
    if claims is None:
        return None
    with _connect() as db:
        row = db.execute("SELECT name, email FROM users WHERE email = ?", (claims["email"],)).fetchone()
    return _public(*row) if row else None
