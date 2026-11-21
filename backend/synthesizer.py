"""Live multi-angle synthesizer for PlotTwistt.

Transforms harvested real-world signals into friction cards. Distances are only
reported when a signal carries real coordinates; otherwise the card says which
place name the source mentions.
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from backend.place_distance import DISTANCE_VERSION, distance_fields, locate_places, search_area_label
from backend.serpapi_collector import haversine_distance

HEADLINE_MAX = 75
# Tier values are unchanged for the frontend; labels describe where the locality appears.
TIER_LABELS = {
    "hyperlocal": "Names locality",  # in the title
    "corridor": "Mentions locality",  # only in the snippet
    "district": "Area-level",  # absent, or only city/state names
}
# City/state names never count as naming the locality.
GENERIC_PLACES = {"bengaluru", "bangalore", "karnataka", "india"}
TIER_RANK = {"hyperlocal": 0, "corridor": 1, "district": 2}
SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}
# Friction score: severity weight x how specifically the source names the site.
SCORE_WEIGHTS = {"high": 25, "medium": 12, "low": 4}
TIER_MULTIPLIER = {"hyperlocal": 1.0, "corridor": 0.6, "district": 0.3}


def verdict_for(score: int) -> str:
    """0-30 Low, 31-70 Moderate, 71-100 High."""
    return "Low" if score <= 30 else "Moderate" if score <= 70 else "High"


def compute_friction_score(flags: List[Dict[str, Any]]) -> Tuple[int, str]:
    """Return (score 0-100, verdict). Geodata and title-named flags count fully."""
    total = sum(
        SCORE_WEIGHTS.get(f["severity"], 0) * TIER_MULTIPLIER.get(f["proximity_tier"], 0.3)
        for f in flags
    )
    score = int(round(100 * (1 - math.exp(-total / 80))))  # saturating curve, never a hard cap
    return score, verdict_for(score)


def _mentions(place: Optional[str], text: str) -> bool:
    if not place:
        return False
    text_lower = text.lower()
    words = [w for w in place.lower().split() if len(w) > 3 and w not in GENERIC_PLACES]
    return any(word in text_lower for word in words)


def estimate_event_distance(
    target_locality: str,
    title: str,
    snippet: str = "",
    target_lat: Optional[float] = None,
    target_lng: Optional[float] = None,
    signal_lat: Optional[float] = None,
    signal_lng: Optional[float] = None,
) -> Dict[str, Any]:
    """Real distance when both points have coordinates; otherwise a mention-based tier."""
    if None not in (target_lat, target_lng, signal_lat, signal_lng):
        dist_km = haversine_distance(target_lat, target_lng, signal_lat, signal_lng)
        tier = "hyperlocal" if dist_km < 1.5 else "corridor" if dist_km < 4.0 else "district"
        return {"distance_km": dist_km, "distance_label": f"{dist_km} km from target", "proximity_tier": tier}

    if _mentions(target_locality, title):
        tier = "hyperlocal"
    elif _mentions(target_locality, snippet):
        tier = "corridor"
    else:
        tier = "district"
    return {"distance_km": None, "distance_label": TIER_LABELS[tier], "proximity_tier": tier}


def _truncate(title: str) -> str:
    return title[:HEADLINE_MAX] + "..." if len(title) > HEADLINE_MAX else title


def _words(*patterns: str) -> "re.Pattern[str]":
    return re.compile(r"\b(?:" + "|".join(patterns) + r")\b", re.IGNORECASE)


# (topic, category, whole-word pattern). First match wins, so specific topics come first.
TOPIC_RULES: List[Tuple[str, str, "re.Pattern[str]"]] = [
    ("heavy_vehicle", "access_infrastructure", _words(
        r"(?:truck|lorry) bans?", r"ban(?:s|ned|ning)? (?:on )?(?:trucks?|lorries)", r"heavy[- ]vehicles?",
        r"goods vehicles?", r"multi-axle", r"no[- ]entry", r"vehicle restrictions?")),
    ("power_line", "access_infrastructure", _words(
        r"power lines?", r"high[- ]tension", r"HT lines?", r"overhead lines?", r"transmission lines?", r"line clearance")),
    ("narrow_road", "access_infrastructure", _words(
        r"narrow (?:roads?|lanes?|approach|streets?)", r"low bridges?", r"height restrictions?")),
    ("parking", "civic_neighbor_friction", _words(r"parking", r"parked", r"towing", r"towed")),
    ("road_widening", "zoning_buffer_row", _words(
        r"road widening", r"widening", r"demolitions?", r"demolish(?:ed|es|ing)?", r"raze[ds]?", r"razing")),
    ("buffer", "zoning_buffer_row", _words(r"buffer(?: zones?)?", r"NGT", r"wetlands?")),
    ("land_dispute", "zoning_buffer_row", _words(
        r"acquisitions?", r"acquire[ds]?", r"disputes?", r"disputed", r"encroach\w*",
        # Phrase rules only: bare "illegal" (e.g. "illegal parking") is not a zoning signal.
        r"illegal (?:buildings?|constructions?|structures?|layouts?)",
        r"BDA", r"deeds?", r"gramathana", r"revenue land", r"khata", r"land conversion")),
    ("flooding", "flooding_drainage", _words(
        r"waterlog\w*", r"flood\w*", r"inundat\w*", r"rains?", r"rainfall", r"drains?", r"drainage",
        r"rajakaluve", r"storm ?water", r"overflow\w*", r"submerg\w*")),
    ("crime", "civic_neighbor_friction", _words(
        # Bare "police"/"crime" are excluded: police-administration news and section
        # labels like "Crime Files" are not site friction.
        r"murder\w*", r"robber(?:y|ies)", r"crime (?:rates?|spikes?|waves?)", r"arrest\w*", r"attack\w*", r"accidents?",
        r"theft", r"snatching", r"mob")),
    ("traffic", "civic_neighbor_friction", _words(r"traffic", r"jams?", r"potholes?", r"bottlenecks?", r"congestion")),
    ("protest_noise", "civic_neighbor_friction", _words(
        r"protest\w*", r"noise", r"residents?", r"RWA", r"garbage", r"dump\w*")),
    ("utility", "civic_neighbor_friction", _words(
        r"BESCOM", r"power cuts?", r"power outages?", r"outages?", r"shutdowns?", r"tankers?", r"water supply")),
]

# Severity per intent and topic, following SPEC section 1. Unmatched text is "low".
SEVERITY_TABLE: Dict[str, Dict[str, str]] = {
    "warehouse": {
        "heavy_vehicle": "high", "narrow_road": "high", "power_line": "medium", "flooding": "high",
        "buffer": "high", "land_dispute": "medium", "road_widening": "medium", "parking": "low",
        "crime": "medium", "traffic": "medium", "protest_noise": "medium", "utility": "medium",
    },
    "retail": {
        "heavy_vehicle": "low", "narrow_road": "medium", "power_line": "low", "flooding": "medium",
        "buffer": "medium", "land_dispute": "medium", "road_widening": "high", "parking": "high",
        "crime": "medium", "traffic": "medium", "protest_noise": "medium", "utility": "medium",
    },
    "plot": {
        "heavy_vehicle": "low", "narrow_road": "medium", "power_line": "high", "flooding": "medium",
        "buffer": "high", "land_dispute": "high", "road_widening": "medium", "parking": "low",
        "crime": "low", "traffic": "low", "protest_noise": "low", "utility": "medium",
    },
}

HEADLINE_PREFIX = {
    "zoning_buffer_row": "Land & Zoning Alert",
    "flooding_drainage": "Civic Infrastructure & Drainage",
    "access_infrastructure": "Access Constraint",
    "civic_neighbor_friction": "Neighborhood Friction",
}


def classify_signal(text: str, intent: str) -> Tuple[str, str]:
    """Return (category, severity) using whole-word topic rules and the intent severity table."""
    for topic, category, pattern in TOPIC_RULES:
        if pattern.search(text):
            return category, SEVERITY_TABLE.get(intent, {}).get(topic, "medium")
    return "civic_neighbor_friction", "low"


# Directory, index or listing pages: "X - Index", "Home | X", "Contact Us - X", "X - Official Website".
DIRECTORY_TITLE = re.compile(
    r"(?:^|[-|–:]\s*)(?:index|home(?: ?page)?|contact(?: us)?|directory|listings?)\s*(?:$|[-|–:])"
    r"|\bofficial (?:website|web ?site|portal)\b",
    re.IGNORECASE,
)
# Business/hotel openings; only noise when the title carries no friction keyword.
OPENING_TITLE = _words(r"opens?", r"opening", r"launch(?:es|ed)?", r"expands?", r"expansion", r"inaugurat\w*", r"unveils?")


# Social posts: "... - Facebook", "... | LinkedIn", or a social-network URL.
SOCIAL_TITLE = re.compile(r"[-|–]\s*(?:facebook|instagram|x|twitter|linkedin)\s*$", re.IGNORECASE)
SOCIAL_DOMAINS = ("facebook.com", "instagram.com", "x.com", "twitter.com", "linkedin.com")
SHORT_TITLE_WORDS = 5


def _has_friction_keyword(text: str) -> bool:
    return any(pattern.search(text) for _, _, pattern in TOPIC_RULES)


def _is_social_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == d or host.endswith("." + d) for d in SOCIAL_DOMAINS)


def is_noise_title(title: str) -> bool:
    """True for directory/listing pages, social posts, short bare titles and promo openings."""
    if DIRECTORY_TITLE.search(title) or SOCIAL_TITLE.search(title):
        return True
    if len(title.split()) <= SHORT_TITLE_WORDS or OPENING_TITLE.search(title):
        return not _has_friction_keyword(title)
    return False


def is_noise(title: str, url: str = "") -> bool:
    """Noise by title shape or because the source is a social network."""
    return is_noise_title(title) or _is_social_url(url)


def _explanation(category: str, clean_loc: str, corridor: Optional[str]) -> str:
    return {
        "zoning_buffer_row": f"Public record near {clean_loc} points to zoning, buffer, demolition or land-title scrutiny.",
        "flooding_drainage": f"Monsoon drainage, waterlogging or stormwater conditions reported around {clean_loc}.",
        "access_infrastructure": f"Vehicle access, approach-road or overhead-line constraints reported around {clean_loc}.",
        "civic_neighbor_friction": f"Local civic, traffic, safety or neighbor friction reported around {corridor or clean_loc}.",
    }[category]


async def synthesize_friction_report(
    locality: str,
    intent: str,
    signals_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Synthesize raw search and news signals into maximum actionable friction cards with distance metadata."""
    hierarchy = signals_data.get("hierarchy", {})
    clean_loc = signals_data.get("locality") or locality
    corridor = signals_data.get("corridor")
    raw_signals = signals_data.get("signals", [])

    flags: List[Dict[str, Any]] = []
    mention_texts: List[str] = []  # per news flag without its own coordinates, for place-distance lookup
    search_areas: List[Optional[str]] = []  # the locality each story's search was anchored on
    seen_urls = set()

    for item in raw_signals:
        url = item.get("url") or ""
        title = item.get("title") or ""
        snippet = item.get("snippet") or title

        if not title or len(title) < 10 or url in seen_urls or is_noise(title, url):
            continue

        seen_urls.add(url)
        category, severity = classify_signal(f"{title} {snippet}", intent)
        headline = f"{HEADLINE_PREFIX[category]}: {_truncate(title)}"
        explanation = _explanation(category, clean_loc, corridor)

        # Compute estimated distance from target
        dist_meta = estimate_event_distance(
            clean_loc,
            title,
            snippet,
            target_lat=signals_data.get("target_lat"),
            target_lng=signals_data.get("target_lng"),
            signal_lat=item.get("lat"),
            signal_lng=item.get("lng"),
        )

        flags.append({
            "id": f"flag-{len(flags) + 1}",
            "category": category,
            "severity": severity,
            "headline": headline,
            "explanation": explanation,
            "quote": snippet if len(snippet) > 15 else title,
            "source_title": f"{item.get('source', 'Local News')} - {title}",
            "url": url,
            "distance_km": dist_meta["distance_km"],
            "distance_label": dist_meta["distance_label"],
            "proximity_tier": dist_meta["proximity_tier"],
            "distance_basis": "source coordinates" if dist_meta["distance_km"] is not None else None,
            "distance_method": "mentioned_place" if dist_meta["distance_km"] is not None else "none",
            "distance_within_locality": False,
        })
        mention_texts.append(f"{title} {snippet}" if dist_meta["distance_km"] is None else "")
        search_areas.append(item.get("origin_target"))

    # Approximate distance from the pin to the most specific place each story names.
    # No pin from the request? Use the coordinates the place lookup resolved.
    pin_lat = signals_data.get("target_lat")
    pin_lng = signals_data.get("target_lng")
    if pin_lat is None or pin_lng is None:
        pin_lat, pin_lng = hierarchy.get("resolved_lat"), hierarchy.get("resolved_lng")
    pin_names = [hierarchy.get("locality"), clean_loc, hierarchy.get("hyperlocal")]
    places, distance_lookup_failed = await locate_places(mention_texts, pin_names)
    for flag, text, place, area in zip(flags, mention_texts, places, search_areas):
        if text:
            flag.update(distance_fields(pin_lat, pin_lng, place, search_area_label(area, pin_names)))

    flags.extend(dict(f) for f in signals_data.get("extra_flags", []))  # e.g. geodata hazards
    # Within a tier, closer first (unknown distance last), then severity. An in-locality estimate
    # only claims "under 1.5 km", so it sorts as 1.5 km rather than beating an exact nearby feature.
    def _sort_km(f: Dict[str, Any]) -> float:
        km = f.get("distance_km")
        if km is None:
            return float("inf")
        return max(km, 1.5) if f.get("distance_within_locality") else km

    flags.sort(key=lambda f: (
        TIER_RANK[f["proximity_tier"]],
        _sort_km(f),
        SEVERITY_RANK[f["severity"]],
        not f.get("geodata"),
    ))
    for i, flag in enumerate(flags, start=1):
        flag["id"] = f"flag-{i}"

    high_count = sum(1 for f in flags if f["severity"] == "high")
    if not flags:
        overall_risk = "low"
        summary = (
            f"Few public signals were found for {clean_loc}. That is not proof of a clean site; "
            f"verify on the ground before committing."
        )
    else:
        overall_risk = "high" if high_count >= 2 else "medium" if high_count or len(flags) >= 3 else "low"
        summary = (
            f"Radar scan for {clean_loc} found {len(flags)} public friction signal(s), "
            f"ordered by how specifically each source mentions the site."
        )

    return {
        "location": locality,
        "hierarchy": hierarchy,
        "overall_risk": overall_risk,
        "summary": summary,
        "flags": flags,
        "total_flags": len(flags),
        # Internal: a place lookup failed, so some distances are missing; the scan must not be cached.
        "distance_lookup_failed": distance_lookup_failed,
        "distance_version": DISTANCE_VERSION,
    }
