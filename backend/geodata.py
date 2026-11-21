"""OpenStreetMap water hazards near a pin (lakes and drains) via one Overpass query.

No API key is needed. Distances are computed with shapely in a local metric projection
centred on the pin, which is accurate to well under 1% within the 1 km search radius.
"""

from __future__ import annotations

import json
import logging
import math
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx
from shapely.geometry import LineString, Point, Polygon

from backend import cache

logger = logging.getLogger("plottwistt.geodata")

# Public Overpass servers, tried in order within one shared time budget.
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
OVERPASS_TIMEOUT = 8.0  # total budget across all servers
# overpass-api.de answers 406 to the default python-httpx User-Agent.
OVERPASS_HEADERS = {"User-Agent": "PlotTwistt/1.0 (civic friction radar demo)", "Accept": "application/json"}
# Flags only fire within 200 m; Overpass 'around' matches any part of a way, so 250 m finds the same flags as 1 km.
SEARCH_RADIUS_M = 250
GEO_CACHE_TTL_S = 7 * 24 * 3600  # lakes and drains rarely move
# NGT lake buffer and drain buffer; anything within MEDIUM_RADIUS_M is a medium flag.
BUFFER_M = {"lake": 75, "drain": 50}
MEDIUM_RADIUS_M = 200
M_PER_DEG_LAT = 110_540.0
M_PER_DEG_LNG_EQUATOR = 111_320.0


def _project(lat0: float, lng0: float, lat: float, lng: float) -> Tuple[float, float]:
    """Equirectangular projection to metres around (lat0, lng0)."""
    x = (lng - lng0) * M_PER_DEG_LNG_EQUATOR * math.cos(math.radians(lat0))
    y = (lat - lat0) * M_PER_DEG_LAT
    return x, y


def nearest_distance_m(lat: float, lng: float, coords: Sequence[Tuple[float, float]], closed: bool) -> float:
    """Distance in metres from the pin to a way given as (lat, lng) points; 0 if inside a closed area."""
    points = [_project(lat, lng, la, ln) for la, ln in coords]
    if closed and len(points) >= 4:
        geom = Polygon(points)
    elif len(points) >= 2:
        geom = LineString(points)
    else:
        geom = Point(points[0])
    return round(Point(0, 0).distance(geom), 1)


def hazard_severity(kind: str, distance_m: float) -> Optional[str]:
    """'high' inside the buffer, 'medium' within 200 m, otherwise None."""
    if distance_m <= BUFFER_M[kind]:
        return "high"
    if distance_m <= MEDIUM_RADIUS_M:
        return "medium"
    return None


def hazard_flag(feature: Dict[str, Any]) -> Dict[str, Any]:
    """Build a Flag dict for a water feature that is within the medium radius."""
    kind, name, metres = feature["kind"], feature["name"], round(feature["distance_m"])
    severity = hazard_severity(kind, feature["distance_m"])
    if kind == "lake":
        category = "zoning_buffer_row"
        suffix = " — inside 75 m NGT buffer" if severity == "high" else ""
    else:
        category = "flooding_drainage"
        suffix = " — inside 50 m drain buffer" if severity == "high" else ""
    tag = "natural=water" if kind == "lake" else "waterway"
    return {
        "id": f"geo-{feature['id']}",
        "category": category,
        "severity": severity,
        "headline": f"Pin is {metres} m from {name}{suffix}",
        "explanation": (
            f"OpenStreetMap maps {name} {metres} m from the pin. "
            + ("Lakes carry a 75 m NGT no-construction buffer." if kind == "lake"
               else "Storm-water drains carry a 50 m buffer and flood risk.")
        ),
        "quote": f"OpenStreetMap {tag} way {feature['id']} ({name}): nearest edge {metres} m from the pin.",
        "source_title": f"OpenStreetMap - {name}",
        "url": f"https://www.openstreetmap.org/way/{feature['id']}",
        "distance_km": round(feature["distance_m"] / 1000, 3),
        "distance_label": f"{metres} m from pin",
        "proximity_tier": "hyperlocal",
        "geodata": True,
    }


def _overpass_query(lat: float, lng: float) -> str:
    around = f"around:{SEARCH_RADIUS_M},{lat},{lng}"
    return (
        f"[out:json][timeout:{int(OVERPASS_TIMEOUT)}];("
        f'way({around})["natural"="water"];'
        f'way({around})["waterway"~"^(drain|canal|stream)$"];'
        ");out geom;"
    )


def parse_features(lat: float, lng: float, data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Turn Overpass ways into features with their nearest distance to the pin."""
    features = []
    for el in data.get("elements", []):
        geometry = el.get("geometry") or []
        if el.get("type") != "way" or not geometry:
            continue
        tags = el.get("tags", {})
        kind = "lake" if tags.get("natural") == "water" else "drain"
        coords = [(p["lat"], p["lon"]) for p in geometry]
        closed = len(coords) >= 4 and coords[0] == coords[-1]
        default_name = "an unnamed lake" if kind == "lake" else f"an unnamed {tags.get('waterway', 'drain')}"
        features.append({
            "id": el["id"],
            "kind": kind,
            "name": tags.get("name") or default_name,
            "distance_m": nearest_distance_m(lat, lng, coords, closed),
        })
    return features


def _geo_cache_file(lat: float, lng: float):
    return cache.CACHE_DIR / f"geo_{lat:.4f}_{lng:.4f}.json"


def _read_geo_cache(lat: float, lng: float) -> Optional[List[Dict[str, Any]]]:
    path = _geo_cache_file(lat, lng)
    try:
        if time.time() - path.stat().st_mtime > GEO_CACHE_TTL_S:
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _write_geo_cache(lat: float, lng: float, flags: List[Dict[str, Any]]) -> None:
    try:
        cache.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _geo_cache_file(lat, lng).write_text(json.dumps(flags), encoding="utf-8")
    except OSError as exc:
        logger.warning("Could not write geodata cache (%s)", type(exc).__name__)


async def _query_overpass(lat: float, lng: float) -> Dict[str, Any]:
    """POST the query to each server in turn until one answers, within OVERPASS_TIMEOUT overall."""
    deadline = time.monotonic() + OVERPASS_TIMEOUT
    last_error = "timeout"
    async with httpx.AsyncClient() as client:
        for i, url in enumerate(OVERPASS_URLS):
            remaining = deadline - time.monotonic()
            if remaining < 0.5:
                break
            # Fair share of what's left, so one slow server can't starve the others.
            per_server = max(remaining / (len(OVERPASS_URLS) - i), min(2.0, remaining))
            try:
                res = await client.post(
                    url, data={"data": _overpass_query(lat, lng)}, headers=OVERPASS_HEADERS, timeout=per_server
                )
                res.raise_for_status()
                return res.json()
            except Exception as exc:  # any server error: try the next one
                last_error = type(exc).__name__
                logger.warning("Overpass server %s failed (%s)", url.split("/")[2], last_error)
    raise RuntimeError(f"All Overpass servers failed (last: {last_error})")


async def collect_water_hazards(lat: float, lng: float) -> List[Dict[str, Any]]:
    """Return hazard flags for lakes/drains near the pin, nearest first. Raises if no server answers."""
    cached = _read_geo_cache(lat, lng)
    if cached is not None:
        return cached
    data = await _query_overpass(lat, lng)
    flags = [
        hazard_flag(f) for f in sorted(parse_features(lat, lng, data), key=lambda f: f["distance_m"])
        if hazard_severity(f["kind"], f["distance_m"]) is not None
    ]
    _write_geo_cache(lat, lng, flags)
    return flags
