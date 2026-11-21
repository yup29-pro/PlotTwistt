"""SerpApi multi-angle collector and geocoding helper for PlotTwistt.

Provides:
- Hierarchical location categorization (Ward/Sub-locality -> Locality -> Corridor -> Taluk/City)
- Multi-query signal harvesting across hyper-local sources (crime, civic, roads, disputes, power)
- Distance estimation from target coordinates
"""

from __future__ import annotations
import asyncio
import math
import os
import re
import logging
from typing import Any, Dict, List
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("plottwistt.collector")

SERPAPI_URL = "https://serpapi.com/search.json"
LOOKUP_TIMEOUT = 8.0
SEARCH_TIMEOUT = 10.0

# httpx logs full request URLs (including api_key) at INFO; keep it quiet.
logging.getLogger("httpx").setLevel(logging.WARNING)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance between two points in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def clean_door_address(address: str) -> str:
    """Strip door numbers, plot markers, and numeric crosses from raw query."""
    cleaned = re.sub(
        r"^(?:no\.?|plot|door|flat|survey|sy\.?)\s*[\d\w\-\/]+[,\s]*",
        "",
        address,
        flags=re.IGNORECASE,
    ).strip()

    cleaned = re.sub(
        r"^(\d+(?:st|nd|rd|th)?\s*(?:main|cross|stage|phase|block)?\s*(?:road|rd)?\s*(?:cross|main)?\s*)+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()

    return cleaned if cleaned and len(cleaned) >= 3 else address.strip()


async def resolve_hierarchical_location(query: str, lat: float | None = None, lng: float | None = None) -> Dict[str, Any]:
    """Resolve hierarchical location breakdown: Hyperlocal -> Locality -> Corridor -> City."""
    api_key = os.getenv("SERPAPI_API_KEY")
    clean = clean_door_address(query)

    hierarchy = {
        "raw_query": query,
        "hyperlocal": clean.split(",")[0].strip(),
        "locality": clean.split(",")[0].strip(),
        "corridor": "Bengaluru",
        "city": "Bengaluru",
        "resolved_lat": lat,
        "resolved_lng": lng,
        "display_hierarchy": f"{clean} • Bengaluru",
    }

    if not api_key:
        return hierarchy

    # Try geocoding with Google Maps via SerpApi to get exact hierarchy & coordinates
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                SERPAPI_URL,
                params={
                    "engine": "google_maps",
                    "q": f"{clean} Bangalore",
                    "api_key": api_key,
                },
                timeout=LOOKUP_TIMEOUT,
            )
            if res.status_code == 200:
                data = res.json()
                place = data.get("place_results", {})
                if not place and data.get("local_results"):
                    place = data.get("local_results")[0]

                if place:
                    gps = place.get("gps_coordinates") or {}
                    if gps.get("latitude") and gps.get("longitude"):
                        hierarchy["resolved_lat"] = gps["latitude"]
                        hierarchy["resolved_lng"] = gps["longitude"]

                    address_str = place.get("address", "")
                    title = place.get("title", clean)
                    parts = [p.strip() for p in address_str.split(",") if p.strip()]

                    hierarchy["hyperlocal"] = title
                    if len(parts) >= 2:
                        hierarchy["locality"] = parts[0]
                        hierarchy["corridor"] = parts[1] if len(parts) > 2 else parts[0]

                    hierarchy["display_hierarchy"] = " ❯ ".join(
                        [p for p in [title, hierarchy.get("locality"), hierarchy.get("corridor"), "Bengaluru"] if p]
                    )
    except Exception as exc:
        logger.warning("Location lookup failed (%s); using unresolved hierarchy", type(exc).__name__)

    return hierarchy


async def _run_search(
    client: httpx.AsyncClient, st: Dict[str, str], api_key: str, clean_loc: str
) -> List[Dict[str, Any]]:
    """Run one SerpApi search and normalise its results. Raises on HTTP or network failure."""
    params = {"engine": st["engine"], "q": st["q"], "api_key": api_key, "gl": "in", "hl": "en"}
    if st["engine"] == "google":
        params["num"] = 6

    res = await client.get(SERPAPI_URL, params=params, timeout=SEARCH_TIMEOUT)
    res.raise_for_status()
    data = res.json()

    signals: List[Dict[str, Any]] = []
    if st["engine"] == "google_news":
        for it in data.get("news_results", [])[:4]:
            src = it.get("source")
            src_name = src.get("name", "Local News") if isinstance(src, dict) else str(src or "News")
            signals.append({
                "title": it.get("title", ""),
                "url": it.get("link", ""),
                "source": src_name,
                "date": it.get("date", ""),
                "snippet": it.get("snippet", it.get("title", "")),
                "category": st["category"],
                "origin_target": clean_loc,
            })
    else:
        for it in data.get("organic_results", [])[:4]:
            link = it.get("link", "")
            if "rajakaluve.org" in link or "youtube.com" in link:
                continue
            signals.append({
                "title": it.get("title", ""),
                "url": link,
                "source": it.get("displayed_link", "Civic Source"),
                "snippet": it.get("snippet", ""),
                "category": st["category"],
                "origin_target": clean_loc,
            })
    return signals


async def collect_location_signals(
    locality: str, intent: str, lat: float | None = None, lng: float | None = None
) -> Dict[str, Any]:
    """Query SerpApi across multiple lenses and local sources to get maximum actionable friction points."""
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise ValueError("SERPAPI_API_KEY environment variable not configured.")

    # 1. Resolve geographic hierarchy & coordinates
    hierarchy = await resolve_hierarchical_location(locality, lat, lng)
    target_lat = hierarchy["resolved_lat"]
    target_lng = hierarchy["resolved_lng"]
    clean_loc = hierarchy["hyperlocal"]
    corridor = hierarchy["corridor"]

    # Search queries across 5 distinct angles
    search_targets = [
        # A: Google News for local neighborhood incidents
        {"engine": "google_news", "q": f'"{clean_loc}" Bangalore', "category": "civic_incident"},
        # B: Google News for corridor transit/accidents/crime
        {
            "engine": "google_news",
            "q": f"{clean_loc} OR {corridor} Bangalore crime OR police OR accident",
            "category": "civic_incident",
        },
        # C: Land disputes, BDA, illegal layouts, and demolition notices
        {
            "engine": "google",
            "q": f'"{clean_loc}" OR "{corridor}" Bangalore (land dispute OR illegal layout OR demolition OR acquisition OR BDA)',
            "category": "zoning_buffer_row",
        },
        # D: Traffic bottlenecks, heavy vehicles, and road conditions
        {
            "engine": "google",
            "q": f'"{clean_loc}" OR "{corridor}" Bangalore (traffic jam OR road condition OR bottleneck OR pothole OR truck ban)',
            "category": "civic_neighbor_friction",
        },
        # E: Flooding, drainage, waterlogging, or power/water supply cuts
        {
            "engine": "google",
            "q": f'"{clean_loc}" OR "{corridor}" Bangalore (waterlogging OR flood OR drain overflow OR BESCOM power shutdown OR water tanker)',
            "category": "flooding_drainage",
        },
    ]

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *(_run_search(client, st, api_key, clean_loc) for st in search_targets),
            return_exceptions=True,
        )

    collected_signals: List[Dict[str, Any]] = []
    failed = 0
    for st, result in zip(search_targets, results):
        if isinstance(result, BaseException):
            failed += 1
            # Log only the exception type: httpx messages can embed the request URL and api_key.
            logger.warning("SerpApi %s search (%s) failed: %s", st["engine"], st["category"], type(result).__name__)
        else:
            collected_signals.extend(result)

    if failed == len(search_targets):
        raise RuntimeError(f"All {failed} SerpApi searches failed")

    return {
        "locality": clean_loc,
        "corridor": corridor,
        "hierarchy": hierarchy,
        "target_lat": target_lat,
        "target_lng": target_lng,
        "intent": intent,
        "signals": collected_signals,
        "total_signals": len(collected_signals),
        "failed_searches": failed,
        "total_searches": len(search_targets),
    }
