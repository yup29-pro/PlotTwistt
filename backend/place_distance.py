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
from typing import Any, Dict, Iterable, List, Optional

from backend.localities import LOCALITIES
from backend.suggest import fetch_photon  # module attribute so tests can replace it

logger = logging.getLogger("plottwistt.place_distance")

MAX_LOOKUPS_PER_SCAN = 6
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


async def locate_mentions(texts: Iterable[str]) -> List[Optional[Place]]:
    """For each text, the most specific place it names (or None)."""
    texts = list(texts)
    found: List[Optional[Place]] = [find_known_place(t) for t in texts]
    phrases: List[Optional[str]] = [None if f else extract_place_phrase(t) for t, f in zip(texts, found)]

    pending: List[str] = []
    for phrase in phrases:
        if phrase and phrase.lower() not in _cache and phrase.lower() not in (p.lower() for p in pending):
            pending.append(phrase)
    pending = pending[:MAX_LOOKUPS_PER_SCAN]

    if pending:
        try:
            outcomes = await asyncio.wait_for(
                asyncio.gather(*(_lookup(p) for p in pending), return_exceptions=True), LOOKUP_BUDGET_SECONDS
            )
            failures = [o for o in outcomes if isinstance(o, BaseException)]
            if failures:
                logger.warning("%d place lookup(s) failed (%s).", len(failures), type(failures[0]).__name__)
        except asyncio.TimeoutError:
            logger.warning("Place lookups exceeded %.1f s; distances left unknown.", LOOKUP_BUDGET_SECONDS)

    for i, phrase in enumerate(phrases):
        if phrase and found[i] is None:
            found[i] = _cache.get(phrase.lower())
    return found


def distance_fields(
    pin_lat: Optional[float], pin_lng: Optional[float], place: Optional[Place], pin_names: Iterable[str] = ()
) -> Dict[str, Any]:
    """distance_km / distance_basis / distance_method / distance_within_locality for one news flag."""
    if place is None or pin_lat is None or pin_lng is None:
        return {"distance_km": None, "distance_basis": None, "distance_method": "none", "distance_within_locality": False}
    within = place["name"].lower() in {n.lower() for n in pin_names if n}
    return {
        "distance_km": round(haversine_km(pin_lat, pin_lng, place["lat"], place["lng"]), 1),
        "distance_basis": place["name"],
        "distance_method": "mentioned_place",
        "distance_within_locality": within,
    }
