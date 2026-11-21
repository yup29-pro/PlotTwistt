"""PlotTwistt FastAPI Main Application."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend import cache
from backend.cache import PRESETS, get_demo_analysis
from backend.schemas import AnalyzeRequest, AnalyzeResponse, HealthResponse, Preset
from backend.serpapi_collector import collect_location_signals
from backend.synthesizer import synthesize_friction_report

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("plottwistt")

app = FastAPI(
    title="PlotTwistt API",
    description="Land & Civic Friction Radar API for Beyond 9TO5 Buildathon",
    version="1.0.0",
)

# Enable CORS for Vite frontend (http://localhost:5173) and any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
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


@app.post("/api/analyze", response_model=AnalyzeResponse, status_code=status.HTTP_200_OK)
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
            return {**cached, "data_source": "cache"}

    try:
        logger.info("Executing live SerpApi collector for '%s' (%s)...", locality, intent)
        raw_signals = await collect_location_signals(locality, intent, lat, lng)
    except Exception as exc:
        logger.warning("Live collection failed (%s). Trying demo fallback.", type(exc).__name__)
        return _demo_response(locality)

    result = await synthesize_friction_report(locality, intent, raw_signals)
    result.update(
        data_source="live",
        degraded=raw_signals.get("failed_searches", 0) > 0,
        analyzed_at=_utc_now(),
    )
    cache.save_cached_response(locality, intent, result)
    return result
