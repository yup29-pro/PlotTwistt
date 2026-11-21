"""Approximate distance from the pin to the most specific place a news item names.

1. Built-in Bengaluru localities (backend/localities.py): whole-word, longest name first.
2. Otherwise a capitalised place phrase after "in/at/near/on", looked up with Photon
   (same bbox and timeout as /api/suggest), at most MAX_LOOKUPS_PER_SCAN per scan, in parallel, cached.

City or state names alone (Bengaluru, Karnataka...) never count as a place. Distances are
straight-line from the pin to the place's centre, rounded to 0.1 km; they are estimates of
where a story is about, not where an event happened.
"""

from __future__ import annotations

import asyncio
import logging
import math
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from backend.localities import LOCALITIES
from backend.suggest import fetch_photon  # module attribute so tests can replace it

logger = logging.getLogger("plottwistt.place_distance")

MAX_LOOKUPS_PER_SCAN = 6
# Bump when the distance rules change, so scans cached under older rules are rescanned.
DISTANCE_VERSION = 2
LOOKUP_BUDGET_SECONDS = 3.5  # all Photon lookups for one scan, in parallel
GENERIC_PLACES = {"bengaluru", "bangalore", "karnataka", "india", "bbmp", "bda", "city", "state"}
STOP_WORDS = {
    "the", "a", "an", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december", "today", "tomorrow", "yesterday",
}

# A phrase with one of these words names an organisation, not a place ("Bengaluru Police").
# Kept to words that never name a place: "Silk Board" and "Metro station" are real places.
ORG_WORDS = {
    "police", "court", "authority", "corporation", "government", "govt", "department", "dept",
    "commission", "ministry", "council", "university", "party", "limited", "ltd", "company",
    "bescom", "bwssb", "news", "times", "herald",
}

Place = Dict[str, Any]

# Longest names first so "Electronic City Phase 2" wins over "Electronic City".
_KNOWN = sorted(
    (
        (name, lat, lng, re.compile(r"(?<![A-Za-z0-9])" + re.escape(name) + r"(?![A-Za-z0-9])", re.IGNORECASE))
        for name, _area, lat, lng in LOCALITIES
        if name.lower() not in GENERIC_PLACES
    ),
    key=lambda row: -len(row[0]),
)
# "in|at|near|on" + capitalised words (numbers like "100ft" or "2nd" allowed after the first word).
_PHRASE = re.compile(r"\b(?:in|at|near|on)\s+((?:[A-Z][\w'.&-]*)(?:\s+(?:[A-Z0-9][\w'.&-]*))*)")

_cache: Dict[str, Optional[Place]] = {}
_CACHE_MAX = 1000


def clear_cache() -> None:
    _cache.clear()


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def find_known_place(text: str) -> Optional[Place]:
    """Longest built-in locality named in `text` (whole word, written with a capital letter)."""
    for name, lat, lng, pattern in _KNOWN:
        for match in pattern.finditer(text):
            if match.group(0)[0].isupper():  # "majestic lake" is not Majestic
                return {"name": name, "lat": lat, "lng": lng}
    return None


def extract_place_phrase(text: str) -> Optional[str]:
    """First capitalised place phrase after in/at/near/on that isn't just a city, state or date."""
    for match in _PHRASE.finditer(text):
        words = match.group(1).split()
        while words and words[0].lower() in STOP_WORDS:
            words.pop(0)
        # Trim trailing dates ("on Monday") and stray punctuation.
        while words and words[-1].strip(".,'").lower() in STOP_WORDS:
            words.pop()
        # A leading city/state name is an adjective here ("Bengaluru Silk Board Junction").
        while words and words[0].strip(".,'").lower() in GENERIC_PLACES:
            words.pop(0)
        phrase = " ".join(words).strip(" .,'-")
        if not phrase:
            continue
        if any(w.strip(".,'").lower() in ORG_WORDS for w in phrase.split()):
            continue
        return phrase
    return None


_KNOWN_BY_NAME = {name.lower(): (name, lat, lng) for name, _area, lat, lng in LOCALITIES}


def usable_pin_names(names: Iterable[Optional[str]]) -> List[str]:
    """Locality names that identify the scanned area. Skips city/state names and bare
    sub-areas like "5th Block", which also exist in other localities."""
    out: List[str] = []
    for name in names:
        name = (name or "").strip()
        if not name or name.lower() in GENERIC_PLACES or name[0].isdigit():
            continue
        if name.lower() not in (n.lower() for n in out):
            out.append(name)
    return out


def search_area_label(origin: Optional[str], pin_names: Iterable[Optional[str]]) -> Optional[str]:
    """Readable name for the area a search was anchored on. A bare sub-area like "5th Block"
    exists in many localities, so it is prefixed with the scanned locality."""
    origin = (origin or "").strip()
    if not origin or origin.lower() in GENERIC_PLACES:
        return None
    if origin[0].isdigit():
        parent = next((n for n in usable_pin_names(pin_names) if n.lower() != origin.lower()), None)
        return f"{parent} {origin}" if parent else None
    return origin


def _names_pin_locality(text: str, pin_names: List[str]) -> Optional[str]:
    for name in sorted(pin_names, key=len, reverse=True):
        if re.search(r"(?<![A-Za-z0-9])" + re.escape(name) + r"(?![A-Za-z0-9])", text, re.IGNORECASE):
            return name
    return None


async def _lookup(phrase: str) -> Optional[Place]:
    key = phrase.lower()
    if key in _cache:
        return _cache[key]
    results = await fetch_photon(phrase)
    place = None
    if results:
        top = results[0]
        place = {"name": phrase, "lat": float(top["lat"]), "lng": float(top["lng"])}
    if len(_cache) >= _CACHE_MAX:
        _cache.pop(next(iter(_cache)))
    _cache[key] = place  # "no result" is cached too; failures (exceptions) are not
    return place


async def locate_places(
    texts: Iterable[str], pin_names: Iterable[Optional[str]] = ()
) -> Tuple[List[Optional[Place]], bool]:
    """For each text, the place to measure to, and whether any lookup failed.

    Priority: the scanned locality itself (within=True, measured to its centre), then the
    longest built-in locality, then a Photon lookup of a place phrase. A within-locality
    place keeps lat/lng None when its centre couldn't be found.
    """
    texts = list(texts)
    names = usable_pin_names(pin_names)
    plan: List[Tuple[str, Optional[str]]] = []  # (kind, name); kind: within | known | phrase | none
    found: List[Optional[Place]] = []
    for text in texts:
        own = _names_pin_locality(text, names) if text else None
        if own:
            known = _KNOWN_BY_NAME.get(own.lower())
            found.append({"name": own, "lat": known[1], "lng": known[2], "within": True} if known else None)
            plan.append(("within", own))
            continue
        known = find_known_place(text) if text else None
        if known:
            found.append({**known, "within": False})
            plan.append(("known", None))
            continue
        phrase = extract_place_phrase(text) if text else None
        found.append(None)
        plan.append(("phrase", phrase) if phrase else ("none", None))

    # Lookups: the scanned locality's centre first, then story phrases; capped, parallel, cached.
    wanted: List[str] = []
    for kind in ("within", "phrase"):
        for (k, name), place in zip(plan, found):
            if k == kind and name and place is None and name.lower() not in _cache:
                if name.lower() not in (w.lower() for w in wanted):
                    wanted.append(name)
    wanted = wanted[:MAX_LOOKUPS_PER_SCAN]

    failed = False
    if wanted:
        try:
            outcomes = await asyncio.wait_for(
                asyncio.gather(*(_lookup(w) for w in wanted), return_exceptions=True), LOOKUP_BUDGET_SECONDS
            )
            errors = [o for o in outcomes if isinstance(o, BaseException)]
            if errors:
                failed = True
                logger.warning("%d place lookup(s) failed (%s).", len(errors), type(errors[0]).__name__)
        except asyncio.TimeoutError:
            failed = True
            logger.warning("Place lookups exceeded %.1f s; distances left unknown.", LOOKUP_BUDGET_SECONDS)

    for i, (kind, name) in enumerate(plan):
        if found[i] is not None or not name:
            continue
        hit = _cache.get(name.lower())
        if kind == "within":
            found[i] = {"name": name, "lat": hit["lat"] if hit else None, "lng": hit["lng"] if hit else None, "within": True}
        elif hit:
            found[i] = {**hit, "within": False}
    return found, failed


def distance_fields(
    pin_lat: Optional[float], pin_lng: Optional[float], place: Optional[Place], search_area: Optional[str] = None
) -> Dict[str, Any]:
    """distance_km / distance_basis / distance_method / distance_within_locality for one news flag.

    mentioned_place: straight line from the pin to the named place (or the scanned locality's centre).
    search_area: nothing measurable, but the story came from a search anchored on that locality; no km.
    none: no place and no locality link.
    """
    pin_ok = pin_lat is not None and pin_lng is not None
    if place and pin_ok and place.get("lat") is not None and place.get("lng") is not None:
        return {
            "distance_km": round(haversine_km(pin_lat, pin_lng, place["lat"], place["lng"]), 1),
            "distance_basis": place["name"],
            "distance_method": "mentioned_place",
            "distance_within_locality": bool(place.get("within")),
        }
    area = place["name"] if place and place.get("within") else search_area
    if area and area.lower() not in GENERIC_PLACES:
        return {"distance_km": None, "distance_basis": area, "distance_method": "search_area", "distance_within_locality": False}
    return {"distance_km": None, "distance_basis": None, "distance_method": "none", "distance_within_locality": False}
