"""File cache, demo presets, and safe fallbacks for PlotTwistt."""

from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

CACHE_DIR = Path(__file__).resolve().parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Curated reference presets across Bengaluru with contrasting friction profiles
PRESETS: List[Dict[str, Any]] = [
    {
        "id": "bellandur-lake-corridor",
        "name": "Bellandur Lake Buffer, Bengaluru",
        "lat": 12.9352,
        "lng": 77.6744,
        "intent": "warehouse",
        "description": "High flood hazard & 75m NGT wetland buffer restrictions.",
    },
    {
        "id": "peenya-industrial-area",
        "name": "Peenya 2nd Stage, Bengaluru",
        "lat": 13.0315,
        "lng": 77.5186,
        "intent": "retail",
        "description": "Heavy industrial zoning clash with retail commercial footfall.",
    },
    {
        "id": "indiranagar-100ft-road",
        "name": "Indiranagar 100ft Road, Bengaluru",
        "lat": 12.9784,
        "lng": 77.6408,
        "intent": "retail",
        "description": "High-density retail strip with residential noise & parking bylaws.",
    },
    {
        "id": "sarjapur-road-greenfield",
        "name": "Sarjapur Road Extension, Bengaluru",
        "lat": 12.8614,
        "lng": 77.7785,
        "intent": "plot",
        "description": "Revenue land conversion delays & acute borewell exhaustion.",
    },
]

DEMO_PRESET_ANALYSES: Dict[str, Dict[str, Any]] = {
    "bellandur": {
        "location": "Bellandur Lake Buffer, Bengaluru",
        "overall_risk": "high",
        "summary": "Critical vulnerability to monsoon inundation and strict 75-meter NGT lake buffer zone enforcement. Freight transit restrictions on neighborhood links.",
        "flags": [
            {
                "id": "flag-1",
                "category": "flooding_drainage",
                "severity": "high",
                "headline": "Encroached Rajakaluve Primary Drain Overflow Vulnerability",
                "explanation": "Low-lying plots adjacent to Bellandur wetland experience 3-4 feet of standing floodwater during moderate-to-heavy monsoons.",
                "quote": "BWSSB and BBMP joint survey identified 14 severe primary drain encroachments along the Bellandur lake basin causing regular backflow.",
                "source_title": "BBMP Stormwater Drain Master Audit Report",
                "url": "https://bangalorewater.gov.in/notices/drainage-audit",
            },
            {
                "id": "flag-2",
                "category": "zoning_buffer_row",
                "severity": "high",
                "headline": "NGT 75m Non-Construction Lake Buffer Order",
                "explanation": "Warehousing and commercial structures within 75 meters of the lake edge are subject to summary demolition and power severance.",
                "quote": "No permanent or semi-permanent commercial warehousing structure may operate inside the designated 75-meter buffer from lake boundary.",
                "source_title": "National Green Tribunal Southern Zone Ruling (OA No. 125)",
                "url": "https://greentribunal.gov.in/judgements/bellandur-buffer-order",
            },
            {
                "id": "flag-3",
                "category": "civic_neighbor_friction",
                "severity": "medium",
                "headline": "Resident Federation Curfew on Freight Trucks",
                "explanation": "Local RWA clusters enforce an informal barrier banning multi-axle freight vehicles from 10 PM to 6 AM on feeder links.",
                "quote": "Bellandur Forum submitted police petition demanding strict night truck bans to combat road collapse and noise pollution.",
                "source_title": "Citizen Matters Bengaluru Civic Watch",
                "url": "https://citizenmatters.in/bengaluru-bellandur-traffic-trucks",
            },
        ],
    },
    "peenya": {
        "location": "Peenya 2nd Stage, Bengaluru",
        "overall_risk": "medium",
        "summary": "Industrial Master Plan zoning blocks consumer retail permissions. Heavy machinery noise and logistics congestion create challenging retail conditions.",
        "flags": [
            {
                "id": "flag-1",
                "category": "zoning_buffer_row",
                "severity": "high",
                "headline": "KIADB Industrial Zone Retail License Bar",
                "explanation": "Properties designated as General Industrial (I-2) cannot obtain retail trade licenses without complex Land Use Change approval.",
                "quote": "Commercial showroom and retail establishment licenses remain barred within Peenya Industrial Area Sector 2 without BDA zoning reclassification.",
                "source_title": "Karnataka Industrial Areas Development Board Gazette Notification",
                "url": "https://kiadb.karnataka.gov.in/zoning-guidelines",
            },
            {
                "id": "flag-2",
                "category": "flooding_drainage",
                "severity": "medium",
                "headline": "Chemical Effluent Runoff Ingress During Rains",
                "explanation": "Surface stormwater channels carry industrial effluent spills across low pavement levels during sudden downpours.",
                "quote": "KSPCB inspection noted illegal discharge overflow entering roadside open drains during peak precipitation.",
                "source_title": "KSPCB Industrial Corridor Water Quality Assessment",
                "url": "https://kspcb.karnataka.gov.in/inspections/peenya-effluent",
            },
        ],
    },
    "indiranagar": {
        "location": "Indiranagar 100ft Road, Bengaluru",
        "overall_risk": "low",
        "summary": "Prime commercial strip with strong footfall. Primary friction stems from vocal resident associations pursuing sound decibel and parking litigation.",
        "flags": [
            {
                "id": "flag-1",
                "category": "civic_neighbor_friction",
                "severity": "medium",
                "headline": "RWA Public Interest Litigation Against Night Decibels",
                "explanation": "Resident coalition actively reports late-night retail audio past 10:00 PM, triggering frequent municipal inspections.",
                "quote": "High Court directed BBMP and Police to rigorously penalize commercial establishments violating silence zone norms in Indiranagar.",
                "source_title": "Karnataka High Court PIL Order on Indiranagar Commercialization",
                "url": "https://karnatakajudiciary.kar.nic.in/indiranagar-rwa-pil",
            },
            {
                "id": "flag-2",
                "category": "zoning_buffer_row",
                "severity": "low",
                "headline": "BBMP Mandatory Dedicated Parking Mandate",
                "explanation": "Commercial plots face punitive parking cess if unable to provide subterranean customer parking.",
                "quote": "Establishments lacking off-street parking facilities face suspension of commercial occupancy certificates.",
                "source_title": "BBMP Commercial Building By-law Circular",
                "url": "https://bbmp.gov.in/circulars/commercial-parking-mandate",
            },
        ],
    },
    "sarjapur": {
        "location": "Sarjapur Road Extension, Bengaluru",
        "overall_risk": "high",
        "summary": "Extensive DC conversion backlogs and revenue layout regularization disputes. Critical dependence on unregulated water tankers.",
        "flags": [
            {
                "id": "flag-1",
                "category": "zoning_buffer_row",
                "severity": "high",
                "headline": "Unapproved Agricultural Land Layout Disputed Titles",
                "explanation": "Multiple plot segments lack valid BDA conversion approval and carry pending Revenue Department show-cause notices.",
                "quote": "Sub-registrar office cautioned buyers against unregistered gramathana layout deeds executed without single-window conversion.",
                "source_title": "Department of Stamps and Registration Land Alert",
                "url": "https://kaveri.karnataka.gov.in/notices/sarjapur-layouts",
            },
            {
                "id": "flag-2",
                "category": "civic_neighbor_friction",
                "severity": "high",
                "headline": "Severe Aquifer Depletion & Private Tanker Reliance",
                "explanation": "Borewells produce minimal yield; resident clusters face price volatility and supply stoppages from private tanker operators.",
                "quote": "Central Ground Water Authority declared Sarjapur-Anekal taluk an over-exploited dark zone with severe commercial extraction limits.",
                "source_title": "Central Ground Water Authority Assessment Report",
                "url": "https://cgwa-noc.gov.in/reports/bengaluru-urban-groundwater",
            },
        ],
    },
}


def get_frontend_compatible_fallback(locality: str, intent: str) -> Dict[str, Any]:
    """Return structured fallback matching the exact format expected by the frontend."""
    loc_lower = locality.lower()
    for key, data in DEMO_PRESET_ANALYSES.items():
        if key in loc_lower:
            return data
    # Default to bellandur profile if unrecognized
    return DEMO_PRESET_ANALYSES["bellandur"]


def make_cache_slug(locality: str, intent: str) -> str:
    """Generate a clean filesystem slug for caching responses."""
    locality_clean = re.sub(r"[^a-zA-Z0-9]+", "-", locality.lower()).strip("-")
    intent_clean = intent.lower()
    return f"{locality_clean}_{intent_clean}"


def get_cached_response(locality: str, intent: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached response if present."""
    slug = make_cache_slug(locality, intent)
    cache_file = CACHE_DIR / f"{slug}.json"
    if not cache_file.exists():
        return None
    try:
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_cached_response(data: Dict[str, Any]) -> None:
    """Save response to cache."""
    try:
        locality = data.get("location", "unknown")
        intent = data.get("intent", "warehouse")
        slug = make_cache_slug(locality, intent)
        cache_file = CACHE_DIR / f"{slug}.json"
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

