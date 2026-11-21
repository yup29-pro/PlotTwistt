"""Search-box suggestions: built-in Bengaluru localities first, OSM Nominatim as a fallback."""

from __future__ import annotations

import logging
from difflib import SequenceMatcher
from typing import Dict, List

import httpx

from backend.localities import LOCALITIES

logger = logging.getLogger("plottwistt.suggest")

MAX_RESULTS = 6
MIN_LOCAL_BEFORE_FALLBACK = 3
FUZZY_CUTOFF = 0.75

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_TIMEOUT = 3.0
# Nominatim's usage policy requires an identifying User-Agent.
NOMINATIM_HEADERS = {"User-Agent": "PlotTwistt/1.0 (civic friction radar demo)", "Accept": "application/json"}
# Greater Bengaluru bounding box: left, top, right, bottom.
BENGALURU_VIEWBOX = "77.35,13.25,77.85,12.75"

Suggestion = Dict[str, object]

_cache: Dict[str, List[Suggestion]] = {}
_CACHE_MAX = 500


def clear_cache() -> None:
    _cache.clear()


def _item(name: str, area: str, lat: float, lng: float) -> Suggestion:
    return {"name": name, "area": area, "lat": lat, "lng": lng}


def match_localities(q: str, limit: int = MAX_RESULTS) -> List[Suggestion]:
    """Prefix matches, then contains matches, then fuzzy matches; case-insensitive."""
    needle = q.strip().lower()
    prefix, contains, fuzzy = [], [], []
    for name, area, lat, lng in LOCALITIES:
        hay = name.lower()
        if hay.startswith(needle) or any(word.startswith(needle) for word in hay.split()[1:]):
            # Whole-name prefix beats a later-word prefix ("JP Nagar" for "naga" ranks after "Nagarbhavi").
            prefix.append((0 if hay.startswith(needle) else 1, len(hay), name, area, lat, lng))
        elif needle in hay:
            contains.append((hay.index(needle), len(hay), name, area, lat, lng))
        else:
            score = max(
                SequenceMatcher(None, needle, hay).ratio(),
                SequenceMatcher(None, needle, hay[: len(needle)]).ratio(),
            )
            if score >= FUZZY_CUTOFF:
                fuzzy.append((-score, len(hay), name, area, lat, lng))
    ranked = sorted(prefix) + sorted(contains) + sorted(fuzzy)
    return [_item(*row[2:]) for row in ranked[:limit]]


async def fetch_nominatim(q: str) -> List[Suggestion]:
    """Raw Nominatim lookup bounded to Bengaluru. Raises on network or HTTP errors."""
    params = {
        "q": q,
        "format": "jsonv2",
        "limit": MAX_RESULTS,
        "viewbox": BENGALURU_VIEWBOX,
        "bounded": 1,
        "addressdetails": 1,
    }
    async with httpx.AsyncClient(timeout=NOMINATIM_TIMEOUT) as client:
        res = await client.get(NOMINATIM_URL, params=params, headers=NOMINATIM_HEADERS)
        res.raise_for_status()
        rows = res.json()
    out: List[Suggestion] = []
    for row in rows:
        try:
            address = row.get("address") or {}
            name = row.get("name") or row["display_name"].split(",")[0]
            area = address.get("suburb") or address.get("neighbourhood") or address.get("city_district") or "Bengaluru"
            out.append(_item(name, area, float(row["lat"]), float(row["lon"])))
        except (KeyError, TypeError, ValueError):
            continue
    return out


async def suggest(q: str) -> List[Suggestion]:
    local = match_localities(q)
    if len(local) >= MIN_LOCAL_BEFORE_FALLBACK:
        return local

    key = q.strip().lower()
    remote = _cache.get(key)
    if remote is None:
        try:
            remote = await fetch_nominatim(key)
        except Exception as exc:  # network, timeout, HTTP or parse error: local results still answer
            logger.warning("Nominatim lookup failed (%s); returning local matches only.", type(exc).__name__)
            return local
        if len(_cache) >= _CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[key] = remote

    seen = {s["name"].lower() for s in local}
    merged = local + [s for s in remote if s["name"].lower() not in seen]
    return merged[:MAX_RESULTS]
