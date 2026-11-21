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
from urllib.parse import parse_qs, urlparse

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("plottwistt.collector")

SERPAPI_URL = "https://serpapi.com/search.json"
LOOKUP_TIMEOUT = 8.0
SEARCH_TIMEOUT = 10.0
NEWS_RESULTS_PER_QUERY = 8

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


# Common misspellings of Bengaluru place names (from dc4e427).
LOCALITY_TYPOS = [
    (re.compile(r"\bmadagi\b", re.IGNORECASE), "Magadi"),
    (re.compile(r"\bbydrahalli\b", re.IGNORECASE), "Byadarahalli"),
]


def normalize_locality_typos(text: str) -> str:
    """Fix known whole-word misspellings so searches hit the real place name."""
    for pattern, correct in LOCALITY_TYPOS:
        text = pattern.sub(correct, text)
    return text


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


GOOGLE_REDIRECT_HOSTS = {"google.com", "www.google.com"}
MAX_URL_LENGTH = 2048
# Placeholder or non-publisher "source" values (SerpApi displayed_link shapes, our own defaults).
GENERIC_SOURCES = {"", "civic source", "local news", "news"}
GENERIC_SOURCE_RE = re.compile(
    r"^https?://|›|^\d[\d,.]*\+?\s*[km]?\s+(?:reactions?|comments?|likes?|views?|shares?)$|\bago$",
    re.IGNORECASE,
)


def _is_redirect(parsed) -> bool:
    host = (parsed.hostname or "").lower()
    return host in GOOGLE_REDIRECT_HOSTS and (
        parsed.path in ("/goto", "/url") or parsed.path.startswith("/amp/s/")
    )


def unwrap_redirect_url(url: str) -> str | None:
    """Return the destination of a Google redirect link, the URL itself if it is not one, or None.

    The destination comes only from the `url`/`q` query parameter and must be a plain
    http(s) URL with a host; anything else (javascript:, missing parameter, another
    redirect hop) returns None so the caller drops the signal instead of keeping the redirect.
    """
    parsed = urlparse(url)
    if not _is_redirect(parsed):
        return url
    params = parse_qs(parsed.query)
    target = (params.get("url") or params.get("q") or [""])[0].strip()
    if not target or len(target) > MAX_URL_LENGTH or any(c.isspace() or ord(c) < 32 for c in target):
        return None
    dest = urlparse(target)
    if dest.scheme.lower() not in ("http", "https") or not dest.hostname or _is_redirect(dest):
        return None
    return target


def _source_domain(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _finalize_signal(signal: Dict[str, Any]) -> Dict[str, Any] | None:
    """Unwrap redirects, drop signals without an http(s) URL, and name generic sources by domain."""
    url = unwrap_redirect_url(signal.get("url") or "")
    if url is None:
        return None
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.hostname:
        return None  # every flag needs a clickable receipt
    source = str(signal.get("source") or "").strip()
    if source.lower() in GENERIC_SOURCES or GENERIC_SOURCE_RE.search(source):
        source = _source_domain(url) or source
    return {**signal, "url": url, "source": source}


GENERIC_ADDRESS_PARTS = {"karnataka", "india", "bengaluru", "bangalore", "bengaluru urban", "bangalore urban"}
POSTCODE_RE = re.compile(r"\b\d{6}\b")


def parse_address_parts(address: str) -> tuple[str | None, str | None]:
    """Return (locality, corridor) from a Maps address, most specific part first.

    Postcodes, door numbers, and city/state/country names are skipped. The last
    remaining part is the broader corridor and the one before it the locality; with
    a single part left, that part is the locality and the corridor is None.
    """
    parts = []
    for raw in address.split(","):
        part = POSTCODE_RE.sub("", raw).strip()
        if not part or not re.search(r"[A-Za-z]{2}", part) or part.lower() in GENERIC_ADDRESS_PARTS:
            continue
        parts.append(part)
    if not parts:
        return None, None
    if len(parts) == 1:
        return parts[0], None
    return parts[-2], parts[-1]


async def resolve_hierarchical_location(query: str, lat: float | None = None, lng: float | None = None) -> Dict[str, Any]:
    """Resolve hierarchical location breakdown: Hyperlocal -> Locality -> Corridor -> City."""
    api_key = os.getenv("SERPAPI_API_KEY")
    clean = clean_door_address(normalize_locality_typos(query))

    hierarchy = {
        "raw_query": query,
        "hyperlocal": clean.split(",")[0].strip(),
        "locality": clean.split(",")[0].strip(),
        "corridor": None,
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

                    title = place.get("title", clean)
                    locality, corridor = parse_address_parts(place.get("address", ""))

                    hierarchy["hyperlocal"] = title
                    if locality is not None:
                        hierarchy["locality"] = locality
                    hierarchy["corridor"] = corridor

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
        for it in data.get("news_results", [])[:NEWS_RESULTS_PER_QUERY]:
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
    finalized = (_finalize_signal(sig) for sig in signals)
    return [sig for sig in finalized if sig is not None]


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

    # Only search the corridor when a real one was resolved (and it differs from the target).
    place = f'"{clean_loc}"'
    if corridor and corridor.lower() != clean_loc.lower():
        place = f'{place} OR "{corridor}"'

    # Search queries across 5 distinct angles
    search_targets = [
        # A: Google News for local neighborhood incidents
        {"engine": "google_news", "q": f'"{clean_loc}" Bangalore', "category": "civic_incident"},
        # B: Google News for corridor transit/accidents/crime
        {
            "engine": "google_news",
            "q": f"{place} Bangalore crime OR police OR accident",
            "category": "civic_incident",
        },
        # C: Land disputes, BDA, illegal layouts, and demolition notices
        {
            "engine": "google",
            "q": f"{place} Bangalore (land dispute OR illegal layout OR demolition OR acquisition OR BDA)",
            "category": "zoning_buffer_row",
        },
        # D: Traffic bottlenecks, heavy vehicles, and road conditions
        {
            "engine": "google",
            "q": f"{place} Bangalore (traffic jam OR road condition OR bottleneck OR pothole OR truck ban)",
            "category": "civic_neighbor_friction",
        },
        # E: Flooding, drainage, waterlogging, or power/water supply cuts
        {
            "engine": "google",
            "q": f"{place} Bangalore (waterlogging OR flood OR drain overflow OR BESCOM power shutdown OR water tanker)",
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
