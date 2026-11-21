"""PlotTwistt FastAPI Main Application."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware

from backend import auth, cache
from backend.cache import PRESETS, get_demo_analysis
from backend.geodata import collect_water_hazards
from backend.place_distance import DISTANCE_VERSION
from backend.schemas import AnalyzeRequest, AnalyzeResponse, HealthResponse, Preset
from backend.serpapi_collector import collect_location_signals
from backend.suggest import suggest as suggest_places
from backend.synthesizer import compute_friction_score, synthesize_friction_report

load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("plottwistt")

app = FastAPI(
    title="PlotTwistt API",
    description="Land & Civic Friction Radar API for Beyond 9TO5 Buildathon",
    version="1.0.0",
)


def _cors_origins() -> List[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Time budgets for one scan (seconds): the whole analysis, and the Overpass lake check inside it.
ANALYSIS_BUDGET_SECONDS = 15.0
OVERPASS_BUDGET_SECONDS = 6.0

# Simple in-memory per-IP rate limits (single process only).
RATE_LIMIT_REQUESTS = 10  # /api/analyze
SUGGEST_RATE_LIMIT_REQUESTS = 60  # /api/suggest: debounced keystrokes, so a higher ceiling
AUTH_RATE_LIMIT_REQUESTS = 5  # each of /api/auth/login and /api/auth/signup
RATE_LIMIT_WINDOW_SECONDS = 60.0
_rate_buckets: Dict[str, Deque[float]] = defaultdict(deque)
_suggest_buckets: Dict[str, Deque[float]] = defaultdict(deque)
_login_buckets: Dict[str, Deque[float]] = defaultdict(deque)
_signup_buckets: Dict[str, Deque[float]] = defaultdict(deque)


def reset_rate_limits() -> None:
    for buckets in (_rate_buckets, _suggest_buckets, _login_buckets, _signup_buckets):
        buckets.clear()


def _check_rate(request: Request, buckets: Dict[str, Deque[float]], limit: int, what: str) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    bucket = buckets[ip]
    while bucket and now - bucket[0] >= RATE_LIMIT_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: at most {limit} {what} per minute.",
            headers={"Retry-After": str(int(RATE_LIMIT_WINDOW_SECONDS - (now - bucket[0])) + 1)},
        )
    bucket.append(now)


def enforce_rate_limit(request: Request) -> None:
    _check_rate(request, _rate_buckets, RATE_LIMIT_REQUESTS, "analyses")


def enforce_suggest_rate_limit(request: Request) -> None:
    _check_rate(request, _suggest_buckets, SUGGEST_RATE_LIMIT_REQUESTS, "suggestion lookups")


def enforce_login_rate_limit(request: Request) -> None:
    _check_rate(request, _login_buckets, AUTH_RATE_LIMIT_REQUESTS, "sign-in attempts")


def enforce_signup_rate_limit(request: Request) -> None:
    _check_rate(request, _signup_buckets, AUTH_RATE_LIMIT_REQUESTS, "sign-ups")


@app.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
@app.get("/api/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def health_check():
    """Health check endpoint to verify service availability."""
    return {
        "status": "ok",
        "service": "PlotTwistt Radar API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/presets", response_model=List[Preset], status_code=status.HTTP_200_OK)
def get_presets():
    """Return curated reference locations with distinct friction profiles."""
    return PRESETS


# ---------- Auth (optional: guests can use everything, /api/analyze stays open) ----------

def _auth_call(fn, *args):
    try:
        return fn(*args)
    except auth.AuthError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from None


@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED, dependencies=[Depends(enforce_signup_rate_limit)])
def auth_signup(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Create an account. Returns {token, user}."""
    return _auth_call(auth.signup, payload.get("name"), payload.get("email"), payload.get("password"))


@app.post("/api/auth/login", dependencies=[Depends(enforce_login_rate_limit)])
def auth_login(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Sign in. Every failure returns the same "Invalid email or password"."""
    return _auth_call(auth.login, payload.get("email"), payload.get("password"))


@app.get("/api/auth/me")
def auth_me(authorization: str = Header(default="")) -> Dict[str, str]:
    """The signed-in user for a Bearer token, or 401."""
    scheme, _, token = authorization.partition(" ")
    user = auth.user_for_token(token) if scheme.lower() == "bearer" and token else None
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in", headers={"WWW-Authenticate": "Bearer"})
    return user


@app.get("/api/suggest", status_code=status.HTTP_200_OK, dependencies=[Depends(enforce_suggest_rate_limit)])
async def suggest_endpoint(q: str = Query(default="", max_length=200)) -> List[Dict[str, Any]]:
    """Up to 6 place suggestions {name, area, lat, lng} for the search box."""
    text = q.strip()
    if not 2 <= len(text) <= 60:
        raise HTTPException(
            status_code=422,
            detail="Search text must be 2 to 60 characters.",
        )
    return await suggest_places(text)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_query(request: AnalyzeRequest) -> tuple[str, Optional[float], Optional[float]]:
    """Return (locality, lat, lng) from either request shape; coordinates may be None."""
    if isinstance(request.location, str):
        return request.location, request.lat, request.lng
    loc = request.location
    locality = loc.locality if loc.locality is not None else loc.address
    if locality is None:
        locality = loc.city if loc.city is not None else "Bengaluru"
    lat = loc.lat if loc.lat is not None else request.lat
    lng = loc.lng if loc.lng is not None else request.lng
    return locality, lat, lng


def _demo_response(locality: str) -> Dict[str, Any]:
    """Demo data for a known demo locality; 503 for anything else."""
    demo = get_demo_analysis(locality)
    if demo is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Live data is unavailable right now and there is no demo data for '{locality}'. Please try again later.",
        )
    flags = []
    for flag in demo["flags"]:
        flag = dict(flag)
        flag.setdefault("distance_km", None)
        flag.setdefault("distance_label", "Area-level")
        flag.setdefault("proximity_tier", "district")
        flags.append(flag)
    return {
        **demo,
        "hierarchy": demo.get("hierarchy", {}),
        "flags": flags,
        "total_flags": len(flags),
        "data_source": "demo",
        "degraded": True,
        "analyzed_at": _utc_now(),
    }


def _with_score(result: Dict[str, Any]) -> Dict[str, Any]:
    """Add friction_score, verdict and lake_buffer_breach (recomputed, so old cache files still validate)."""
    score, verdict = compute_friction_score(result["flags"])
    breach = any(
        f.get("geodata") and f["category"] == "zoning_buffer_row" and f["severity"] == "high"
        for f in result["flags"]
    )
    return {**result, "friction_score": score, "verdict": verdict, "lake_buffer_breach": breach}


async def _no_hazards() -> List[Dict[str, Any]]:
    return []


def _hazards_only_result(locality: str, raw_signals: Dict[str, Any], hazards: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Fallback when the synthesizer fails: keep map hazards, never a 500."""
    flags = [dict(f, id=f"flag-{i}") for i, f in enumerate(hazards, start=1)]
    high = any(f["severity"] == "high" for f in flags)
    return {
        "location": locality,
        "hierarchy": raw_signals.get("hierarchy", {}),
        "overall_risk": "high" if high else "medium" if flags else "low",
        "summary": f"Signal analysis failed for {locality}; showing map hazards only.",
        "flags": flags,
        "total_flags": len(flags),
    }


@app.post(
    "/api/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(enforce_rate_limit)],
)
async def analyze_location(
    request: AnalyzeRequest,
    refresh: bool = Query(default=False, description="Bypass cache and force live recalculation"),
):
    """Analyze a location and intent for land, civic, and environmental friction."""
    locality, lat, lng = _resolve_query(request)
    intent = request.intent.value

    if not refresh:
        cached = cache.get_cached_response(locality, intent)
        # Scans cached under older distance rules would show stale "Distance unknown" cards: rescan.
        if cached is not None and cached.get("distance_version") != DISTANCE_VERSION:
            cached = None
        if cached is not None:
            return _with_score({**cached, "data_source": "cache"})

    logger.info("Executing live SerpApi collector for '%s' (%s)...", locality, intent)
    # Searches and the Overpass lake check run in parallel under one total budget; whatever
    # finishes in time is used and the rest is cancelled, so a slow upstream can't hang the scan.
    signals_task = asyncio.create_task(collect_location_signals(locality, intent, lat, lng))
    hazards_task = None
    if lat is not None and lng is not None:
        hazards_task = asyncio.create_task(
            asyncio.wait_for(collect_water_hazards(lat, lng), OVERPASS_BUDGET_SECONDS)
        )
    tasks = [t for t in (signals_task, hazards_task) if t is not None]
    _, pending = await asyncio.wait(tasks, timeout=ANALYSIS_BUDGET_SECONDS)
    for task in pending:
        task.cancel()
    timed_out = signals_task in pending

    if hazards_task is None:
        hazards, lake_check, geo_failed = [], "not_run", False
    elif hazards_task in pending or hazards_task.exception() is not None:
        reason = "timeout" if hazards_task in pending else type(hazards_task.exception()).__name__
        logger.warning("Geodata lookup unavailable (%s); continuing without it.", reason)
        hazards, lake_check, geo_failed = [], "unavailable", True
    else:
        hazards, lake_check, geo_failed = hazards_task.result(), "ok", False

    if timed_out:
        logger.warning("Search collection exceeded the %.0f s budget; returning partial results.", ANALYSIS_BUDGET_SECONDS)
        raw_signals: Any = {"signals": [], "total_signals": 0, "failed_searches": 1, "total_searches": 1}
    elif signals_task.exception() is not None:
        logger.warning("Live collection failed (%s). Trying demo fallback.", type(signals_task.exception()).__name__)
        return _with_score({**_demo_response(locality), "lake_check": lake_check})
    else:
        raw_signals = signals_task.result()

    synth_failed = False
    try:
        result = await synthesize_friction_report(locality, intent, {**raw_signals, "extra_flags": hazards})
    except Exception as exc:
        logger.warning("Synthesizer failed (%s); returning a degraded result.", type(exc).__name__)
        synth_failed = True
        result = _hazards_only_result(locality, raw_signals, hazards)

    result.update(
        data_source="live",
        lake_check=lake_check,
        degraded=timed_out or raw_signals.get("failed_searches", 0) > 0 or geo_failed or synth_failed,
        analyzed_at=_utc_now(),
    )
    result = _with_score(result)
    # Cache only complete, non-empty scans so a partial one is retried next time. A geodata-only
    # failure still marks the result degraded but doesn't block caching, so an Overpass outage
    # doesn't spend SerpApi credits on every repeat scan.
    search_failed = raw_signals.get("failed_searches", 0) > 0
    if not (search_failed or synth_failed or result.get("distance_lookup_failed")) and result["total_flags"] > 0:
        cache.save_cached_response(locality, intent, result)
    return result
