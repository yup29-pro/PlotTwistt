"""FastAPI Backend Entry Point for PlotTwistt."""

from __future__ import annotations
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas import AnalyzeRequest, AnalyzeResponse, PresetLocation
from backend.cache import (
    PRESETS,
    get_cached_analysis,
    save_cached_analysis,
    get_preset_analysis,
    generate_fallback_analysis
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("plottwist.api")

# Safe dynamic imports for teammate modules (Branches 1 & 2)
try:
    from backend.serpapi_collector import collect_location_signals
    logger.info("Successfully imported backend.serpapi_collector.")
except (ImportError, ModuleNotFoundError):
    collect_location_signals = None
    logger.info("backend.serpapi_collector not found; using fallback/cache radar.")

try:
    from backend.synthesizer import synthesize_friction
    logger.info("Successfully imported backend.synthesizer.")
except (ImportError, ModuleNotFoundError):
    synthesize_friction = None
    logger.info("backend.synthesizer not found; using fallback/cache radar.")

# Initialize FastAPI app
app = FastAPI(
    title="PlotTwistt API",
    description="Land & Civic Friction Radar — Uncovering hidden real estate friction.",
    version="1.0.0"
)

# Permissive CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", summary="Health Check")
async def health_check():
    """Service health check status."""
    return {
        "status": "ok",
        "app": "PlotTwistt",
        "version": "1.0.0",
        "collector_loaded": collect_location_signals is not None,
        "synthesizer_loaded": synthesize_friction is not None
    }


@app.get("/api/presets", response_model=List[PresetLocation], summary="Get Curated Demo Presets")
async def get_presets():
    """Return contrasting demo locations for one-click testing."""
    return PRESETS


@app.post("/api/analyze", response_model=AnalyzeResponse, summary="Analyze Land & Civic Friction")
async def analyze_location(
    request: AnalyzeRequest,
    refresh: bool = Query(
        default=False,
        description="Force refresh to bypass disk cache and re-collect signals."
    )
):
    """
    Scan a location for environmental, zoning, and civic friction based on user intent.
    Supports disk caching, preset demo archetypes, and dynamic upstream integration.
    """
    location = request.location.strip()
    if not location:
        raise HTTPException(status_code=400, detail="Location name cannot be empty.")

    intent = (request.intent or "warehouse").strip().lower()
    if intent not in ["warehouse", "retail", "plot"]:
        intent = "warehouse"

    # Step 1: Check Disk Cache (unless refresh is forced)
    if not refresh:
        cached = get_cached_analysis(location, intent)
        if cached:
            logger.info("Cache HIT for %s (%s)", location, intent)
            return cached

    # Step 2: Check Pre-configured Presets
    preset_data = get_preset_analysis(location, intent)
    if preset_data and not refresh:
        logger.info("Preset matched for %s (%s)", location, intent)
        save_cached_analysis(location, intent, preset_data)
        return preset_data

    # Step 3: Upstream Dynamic Collection (Branches 1 & 2 integration)
    result_data = None
    if collect_location_signals and synthesize_friction:
        try:
            logger.info("Invoking dynamic collector & synthesizer for %s", location)
            raw_signals = await collect_location_signals(
                location=location,
                lat=request.lat,
                lng=request.lng,
                intent=intent
            )
            synthesized = await synthesize_friction(
                location=location,
                intent=intent,
                signals=raw_signals
            )
            if synthesized:
                result_data = synthesized
        except Exception as e:
            logger.error("Error invoking upstream modules: %s. Falling back to radar cache.", e)

    # Step 4: Fallback Generation (Ensures app is 100% operational before branches 1 & 2 merge)
    if not result_data:
        if preset_data:
            result_data = preset_data
        else:
            logger.info("Generating realistic fallback analysis for %s (%s)", location, intent)
            result_data = generate_fallback_analysis(
                location=location,
                lat=request.lat,
                lng=request.lng,
                intent=intent
            )

    # Step 5: Save into Disk Cache
    try:
        save_cached_analysis(location, intent, result_data)
    except Exception as e:
        logger.warning("Could not persist to disk cache: %s", e)

    return result_data


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
