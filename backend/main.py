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
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware

from backend import cache
from backend.cache import PRESETS, get_demo_analysis
from backend.geodata import collect_water_hazards
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

# Simple in-memory per-IP rate limits (single process only).
RATE_LIMIT_REQUESTS = 10  # /api/analyze
SUGGEST_RATE_LIMIT_REQUESTS = 60  # /api/suggest: debounced keystrokes, so a higher ceiling
RATE_LIMIT_WINDOW_SECONDS = 60.0
_rate_buckets: Dict[str, Deque[float]] = defaultdict(deque)
_suggest_buckets: Dict[str, Deque[float]] = defaultdict(deque)


def reset_rate_limits() -> None:
    _rate_buckets.clear()
    _suggest_buckets.clear()


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
        if cached is not None:
            return _with_score({**cached, "data_source": "cache"})

    logger.info("Executing live SerpApi collector for '%s' (%s)...", locality, intent)
    # Geodata only runs with real coordinates, in parallel with the SerpApi searches.
    hazards_task = collect_water_hazards(lat, lng) if lat is not None and lng is not None else _no_hazards()
    raw_signals, hazards = await asyncio.gather(
        collect_location_signals(locality, intent, lat, lng), hazards_task, return_exceptions=True
    )
    geo_failed = isinstance(hazards, BaseException)
    if geo_failed:
        logger.warning("Geodata lookup failed (%s); continuing without it.", type(hazards).__name__)
        hazards = []
    if isinstance(raw_signals, BaseException):
        logger.warning("Live collection failed (%s). Trying demo fallback.", type(raw_signals).__name__)
        return _with_score(_demo_response(locality))

    synth_failed = False
    try:
        result = await synthesize_friction_report(locality, intent, {**raw_signals, "extra_flags": hazards})
    except Exception as exc:
        logger.warning("Synthesizer failed (%s); returning a degraded result.", type(exc).__name__)
        synth_failed = True
        result = _hazards_only_result(locality, raw_signals, hazards)

    result.update(
        data_source="live",
        degraded=raw_signals.get("failed_searches", 0) > 0 or geo_failed or synth_failed,
        analyzed_at=_utc_now(),
    )
    result = _with_score(result)
    # Cache only complete, non-empty scans so a partial one is retried next time. A geodata-only
    # failure still marks the result degraded but doesn't block caching, so an Overpass outage
    # doesn't spend SerpApi credits on every repeat scan.
    search_failed = raw_signals.get("failed_searches", 0) > 0
    if not (search_failed or synth_failed) and result["total_flags"] > 0:
        cache.save_cached_response(locality, intent, result)
    return result
