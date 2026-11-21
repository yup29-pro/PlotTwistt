"""Live multi-angle synthesizer for PlotTwistt.

Transforms harvested real-world signals into friction cards. Distances are only
reported when a signal carries real coordinates; otherwise the card says which
place name the source mentions.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from backend.serpapi_collector import haversine_distance

HEADLINE_MAX = 75
TIER_LABELS = {
    "hyperlocal": "Mentions locality",
    "corridor": "Mentions corridor",
    "district": "Area-level",
}
TIER_RANK = {"hyperlocal": 0, "corridor": 1, "district": 2}
SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}


def _mentions(place: Optional[str], text_lower: str) -> bool:
    if not place:
        return False
    return any(word in text_lower for word in place.lower().split() if len(word) > 3)


def estimate_event_distance(
    target_locality: str,
    text: str,
    corridor: Optional[str] = None,
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

    text_lower = text.lower()
    if _mentions(target_locality, text_lower):
        tier = "hyperlocal"
    elif corridor and corridor.lower() != "bengaluru" and _mentions(corridor, text_lower):
        tier = "corridor"
    else:
        tier = "district"
    return {"distance_km": None, "distance_label": TIER_LABELS[tier], "proximity_tier": tier}


def _truncate(title: str) -> str:
    return title[:HEADLINE_MAX] + "..." if len(title) > HEADLINE_MAX else title


async def synthesize_friction_report(
    locality: str,
    intent: str,
    signals_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Synthesize raw search and news signals into maximum actionable friction cards with distance metadata."""
    hierarchy = signals_data.get("hierarchy", {})
    clean_loc = signals_data.get("locality") or locality
    corridor = signals_data.get("corridor") or "Bengaluru"
    raw_signals = signals_data.get("signals", [])

    flags: List[Dict[str, Any]] = []
    seen_urls = set()

    for item in raw_signals:
        url = item.get("url") or ""
        title = item.get("title") or ""
        snippet = item.get("snippet") or title

        if not title or len(title) < 10 or url in seen_urls:
            continue

        seen_urls.add(url)
        combined_text = f"{title} {snippet}".lower()

        # Classify category & severity
        if any(k in combined_text for k in ["acquisition", "demolition", "illegal", "encroach", "dispute", "bda", "buffer", "deed"]):
            category = "zoning_buffer_row"
            severity = "high" if any(k in combined_text for k in ["demolition", "acquisition", "illegal"]) else "medium"
            headline = f"Land & Zoning Alert: {_truncate(title)}"
            explanation = f"Statutory property and master plan record near {clean_loc} indicates active zoning or land regularization scrutiny."
        elif any(k in combined_text for k in ["murder", "robbery", "crime", "police", "arrest", "attack", "accident", "protest", "mob"]):
            category = "civic_neighbor_friction"
            severity = "high" if any(k in combined_text for k in ["murder", "dacoit", "shoot"]) else "medium"
            headline = f"Law & Order Incident: {_truncate(title)}"
            explanation = "Police jurisdiction reports document local law enforcement activity, road accidents, or civic friction in the surrounding vicinity."
        elif any(k in combined_text for k in ["waterlog", "flood", "rain", "drain", "bescom", "power", "shutdown", "tanker"]):
            category = "flooding_drainage"
            severity = "high" if "severe" in combined_text or intent == "warehouse" else "medium"
            headline = f"Civic Infrastructure & Drainage: {_truncate(title)}"
            explanation = f"Monsoon drainage conditions, stormwater channels, or civic utility adjustments active in {clean_loc}."
        elif any(k in combined_text for k in ["traffic", "jam", "pothole", "bmtc", "bottleneck", "expressway"]):
            category = "civic_neighbor_friction"
            severity = "medium"
            headline = f"Transit Bottleneck: {_truncate(title)}"
            explanation = f"Road and arterial transport conditions report commuter congestion and heavy movement friction along {corridor}."
        else:
            category = "civic_neighbor_friction"
            severity = "low"
            headline = f"Neighborhood Notice: {_truncate(title)}"
            explanation = f"Local observation regarding commerce and accessibility in {clean_loc}."

        # Compute estimated distance from target
        dist_meta = estimate_event_distance(
            clean_loc,
            f"{title} {snippet}",
            corridor=corridor,
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
        })

    flags.sort(key=lambda f: (TIER_RANK[f["proximity_tier"]], SEVERITY_RANK[f["severity"]]))
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
    }
