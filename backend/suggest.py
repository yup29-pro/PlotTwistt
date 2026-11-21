"""Search-box suggestions: Photon (OSM) local results, with built-in Bengaluru localities as a fallback."""

from __future__ import annotations

import logging
from difflib import SequenceMatcher
from typing import Any, Dict, List

import httpx

from backend.localities import LOCALITIES

logger = logging.getLogger("plottwistt.suggest")

MAX_RESULTS = 8
MAX_LOCAL_ABOVE_PHOTON = 2
FUZZY_CUTOFF = 0.75

PHOTON_URL = "https://photon.komoot.io/api/"
PHOTON_TIMEOUT = 3.0
PHOTON_HEADERS = {"User-Agent": "PlotTwistt/1.0 (civic friction radar demo)", "Accept": "application/json"}
# Bias towards central Bengaluru and keep results inside the metro area.
PHOTON_BIAS = {"lat": "12.97", "lon": "77.59"}
PHOTON_BBOX = "77.35,12.80,77.85,13.15"
AREA_SEPARATOR = " · "

Suggestion = Dict[str, Any]

_cache: Dict[str, List[Suggestion]] = {}
_CACHE_MAX = 500


def clear_cache() -> None:
    _cache.clear()


def _item(name: str, area: str, lat: float, lng: float) -> Suggestion:
    return {"name": name, "area": area, "lat": lat, "lng": lng}


def match_localities(q: str, limit: int = 6, fuzzy_ok: bool = True) -> List[Suggestion]:
    """Built-in list: prefix matches, then contains matches, then fuzzy matches; case-insensitive."""
    needle = q.strip().lower()
    prefix, contains, fuzzy = [], [], []
    for name, area, lat, lng in LOCALITIES:
        hay = name.lower()
        if hay.startswith(needle) or any(word.startswith(needle) for word in hay.split()[1:]):
            # Whole-name prefix beats a later-word prefix ("JP Nagar" for "naga" ranks after "Nagarbhavi").
            prefix.append((0 if hay.startswith(needle) else 1, len(hay), name, area, lat, lng))
        elif needle in hay:
            contains.append((hay.index(needle), len(hay), name, area, lat, lng))
        elif fuzzy_ok:
            score = max(
                SequenceMatcher(None, needle, hay).ratio(),
                SequenceMatcher(None, needle, hay[: len(needle)]).ratio(),
            )
            if score >= FUZZY_CUTOFF:
                fuzzy.append((-score, len(hay), name, area, lat, lng))
    ranked = sorted(prefix) + sorted(contains) + sorted(fuzzy)
    return [_item(*row[2:]) for row in ranked[:limit]]


def _area(props: Dict[str, Any], name: str) -> str:
    """Sublocality first, then locality/district, e.g. "Koramangala 3rd Block · Koramangala"."""
    parts: List[str] = []
    for key in ("locality", "district", "city", "county"):
        value = (props.get(key) or "").strip()
        if value and value.lower() != name.lower() and value.lower() not in (p.lower() for p in parts):
            parts.append(value)
        if len(parts) == 2:
            break
    return AREA_SEPARATOR.join(parts) or "Bengaluru"


def parse_photon(payload: Dict[str, Any]) -> List[Suggestion]:
    """Photon GeoJSON -> suggestions; skips unnamed or malformed features."""
    out: List[Suggestion] = []
    for feature in payload.get("features", []):
        try:
            props = feature.get("properties") or {}
            name = (props.get("name") or "").strip()
            if not name:
                continue
            lng, lat = feature["geometry"]["coordinates"][:2]
            out.append(_item(name, _area(props, name), float(lat), float(lng)))
        except (KeyError, TypeError, ValueError):
            continue
    return out


async def fetch_photon(q: str) -> List[Suggestion]:
    """Raw Photon lookup biased to Bengaluru. Raises on network or HTTP errors."""
    params = {"q": q, "limit": MAX_RESULTS, "lang": "en", **PHOTON_BIAS, "bbox": PHOTON_BBOX}
    async with httpx.AsyncClient(timeout=PHOTON_TIMEOUT) as client:
        res = await client.get(PHOTON_URL, params=params, headers=PHOTON_HEADERS)
        res.raise_for_status()
        return parse_photon(res.json())


def _dedupe(items: List[Suggestion]) -> List[Suggestion]:
    seen = set()
    out = []
    for item in items:
        key = (item["name"].strip().lower(), item["area"].strip().lower())
        # Same name within ~1 km is the same place even if the area labels differ (built-in vs Photon).
        near = any(
            item["name"].strip().lower() == other["name"].strip().lower()
            and abs(item["lat"] - other["lat"]) < 0.01
            and abs(item["lng"] - other["lng"]) < 0.01
            for other in out
        )
        if key in seen or near:
            continue
        seen.add(key)
        out.append(item)
    return out


async def suggest(q: str) -> List[Suggestion]:
    key = q.strip().lower()
    local = match_localities(key)  # offline fallback keeps typo tolerance

    remote = _cache.get(key)
    if remote is None:
        try:
            remote = await fetch_photon(key)
        except Exception as exc:  # network, timeout, HTTP or parse error: the built-in list still answers
            logger.warning("Photon lookup failed (%s); using the built-in locality list.", type(exc).__name__)
            return _dedupe(local)[:MAX_RESULTS]
        if len(_cache) >= _CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[key] = remote

    # Above Photon, only real (prefix/contains) built-in matches; fuzzy guesses would crowd out local results.
    exact_local = match_localities(key, limit=MAX_LOCAL_ABOVE_PHOTON, fuzzy_ok=False)
    return _dedupe(exact_local + remote)[:MAX_RESULTS]
