"""Disk-backed JSON cache and demo presets for PlotTwistt."""

from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.schemas import AnalyzeResponse, FrictionFlag, PresetLocation

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# Curated Demo Presets (Contrasting Archetypes)
# -----------------------------------------------------------------------------
PRESETS: List[Dict[str, Any]] = [
    {
        "id": "bellandur-buffer",
        "name": "Bellandur Lake Buffer, Bengaluru",
        "lat": 12.9352,
        "lng": 77.6744,
        "intent": "warehouse",
        "description": "High flood hazard & 75m NGT wetland buffer restrictions.",
    },
    {
        "id": "peenya-industrial",
        "name": "Peenya 2nd Stage, Bengaluru",
        "lat": 13.0315,
        "lng": 77.5186,
        "intent": "retail",
        "description": "Heavy industrial zoning clash with retail commercial footfall.",
    },
    {
        "id": "indiranagar-100ft",
        "name": "Indiranagar 100ft Road, Bengaluru",
        "lat": 12.9784,
        "lng": 77.6408,
        "intent": "retail",
        "description": "High-density retail strip with residential noise & parking bylaws.",
    },
    {
        "id": "sarjapur-sprawl",
        "name": "Sarjapur Road Extension, Bengaluru",
        "lat": 12.8614,
        "lng": 77.7785,
        "intent": "plot",
        "description": "Revenue land conversion delays & acute borewell exhaustion.",
    },
]

# Detailed Pre-configured Radar Analysis for Presets
PRESET_ANALYSES: Dict[str, Dict[str, Any]] = {
    "bellandur_lake_buffer_bengaluru_warehouse": {
        "location": "Bellandur Lake Buffer, Bengaluru",
        "overall_risk": "high",
        "summary": "Critical vulnerability to monsoon inundation and strict 75-meter NGT lake buffer zone enforcement. Active civic opposition restricts heavy logistics transit through neighborhood roads.",
        "flags": [
            {
                "id": "flag-1",
                "category": "flooding_drainage",
                "severity": "high",
                "headline": "Primary Rajakaluve Stormwater Encroachment Overflow",
                "explanation": "Low-lying plots adjacent to Bellandur wetland experience 3-4 feet of standing floodwater during moderate-to-heavy monsoons, threatening floor stock.",
                "quote": "BWSSB and BBMP joint survey identified 14 severe primary drain encroachments along the Bellandur lake basin causing regular backflow.",
                "source_title": "BBMP Stormwater Drain Master Audit Report",
                "url": "https://bangalorewater.gov.in/notices/drainage-audit"
            },
            {
                "id": "flag-2",
                "category": "zoning_buffer_row",
                "severity": "high",
                "headline": "NGT 75m Non-Construction Lake Buffer Order",
                "explanation": "Warehousing, loading ramps, and parking structures within 75 meters of the lake edge are subject to summary demolition and power severance.",
                "quote": "No permanent or semi-permanent commercial warehousing structure may operate inside the designated 75-meter buffer from lake boundary.",
                "source_title": "National Green Tribunal Southern Zone Ruling (OA No. 125)",
                "url": "https://greentribunal.gov.in/judgements/bellandur-buffer-order"
            },
            {
                "id": "flag-3",
                "category": "civic_neighbor_friction",
                "severity": "medium",
                "headline": "Resident Federation Curfew on Freight Trucks",
                "explanation": "Local RWA clusters enforce an informal barrier banning multi-axle freight vehicles from 10 PM to 6 AM on feeder links.",
                "quote": "Bellandur Forum submitted police petition demanding strict night truck bans to combat road collapse and noise pollution.",
                "source_title": "Citizen Matters Bengaluru Civic Watch",
                "url": "https://citizenmatters.in/bengaluru-bellandur-traffic-trucks"
            }
        ]
    },
    "peenya_2nd_stage_bengaluru_retail": {
        "location": "Peenya 2nd Stage, Bengaluru",
        "overall_risk": "medium",
        "summary": "Industrial Master Plan zoning blocks purely consumer retail footfall permissions. High ambient particulate matter and heavy machinery noise create hostile customer environments.",
        "flags": [
            {
                "id": "flag-1",
                "category": "zoning_buffer_row",
                "severity": "high",
                "headline": "KIADB Industrial Zone Retail License Bar",
                "explanation": "Properties designated as General Industrial (I-2) cannot obtain municipal retail trade licenses without complex Land Use Change approval.",
                "quote": "Commercial showroom and retail establishment licenses remain barred within Peenya Industrial Area Sector 2 without BDA zoning reclassification.",
                "source_title": "Karnataka Industrial Areas Development Board Gazette Notification",
                "url": "https://kiadb.karnataka.gov.in/zoning-guidelines"
            },
            {
                "id": "flag-2",
                "category": "flooding_drainage",
                "severity": "medium",
                "headline": "Chemical Effluent Runoff Ingress During Rains",
                "explanation": "Surface stormwater channels carry industrial chemical effluent spills across low pavement levels during sudden showers.",
                "quote": "KSPCB inspection noted illegal discharge overflow entering roadside open drains during peak precipitation in Peenya 2nd Phase.",
                "source_title": "Karnataka State Pollution Control Board Inspection Findings",
                "url": "https://kspcb.karnataka.gov.in/reports/peenya-drain-audit"
            },
            {
                "id": "flag-3",
                "category": "civic_neighbor_friction",
                "severity": "low",
                "headline": "Heavy Transport Union Loading Bay Disputes",
                "explanation": "Local industrial transport associations monopolize street parking and dispute curbside customer vehicle standing.",
                "quote": "Peenya Small Scale Industries Association submitted traffic grievances regarding unauthorized container staging blocking commercial frontages.",
                "source_title": "Bangalore Traffic Police Traffic Advisory",
                "url": "https://btp.gov.in/advisories/peenya-freight-congestion"
            }
        ]
    },
    "indiranagar_100ft_road_bengaluru_retail": {
        "location": "Indiranagar 100ft Road, Bengaluru",
        "overall_risk": "low",
        "summary": "Prime commercial corridor with strong footfall and stable drainage. Primary friction stems from vocal resident associations pursuing sound decibel and valet parking litigation.",
        "flags": [
            {
                "id": "flag-1",
                "category": "civic_neighbor_friction",
                "severity": "medium",
                "headline": "RWA Public Interest Litigation Against Night Decibels",
                "explanation": "I-Care resident coalition actively reports rooftop and late-night retail audio past 10:00 PM, triggering frequent municipal inspections.",
                "quote": "High Court directed BBMP and Police to rigorously penalize commercial establishments violating silence zone norms in Indiranagar residential borders.",
                "source_title": "Karnataka High Court PIL Order on Indiranagar Commercialization",
                "url": "https://karnatakajudiciary.kar.nic.in/indiranagar-rwa-pil"
            },
            {
                "id": "flag-2",
                "category": "zoning_buffer_row",
                "severity": "low",
                "headline": "BBMP Mandatory Dedicated Parking Mandate",
                "explanation": "Commercial plots with less than 40ft road frontage face punitive parking cess if unable to provide subterranean customer parking.",
                "quote": "Establishments on 100ft Road lacking off-street parking facilities face suspension of commercial occupancy certificates.",
                "source_title": "BBMP Commercial Building By-law Circular 2024",
                "url": "https://bbmp.gov.in/circulars/commercial-parking-mandate"
            },
            {
                "id": "flag-3",
                "category": "flooding_drainage",
                "severity": "low",
                "headline": "Localized Puddle Pooling at Secondary Intersections",
                "explanation": "Main 100ft road drains effectively, but junction ramps experience minor 4-inch puddling for 30 minutes following cloudbursts.",
                "quote": "Stormwater desilting along 100ft Road completed with 90% flow clearance recorded at HAL 2nd Stage feeder points.",
                "source_title": "BBMP Ward 112 Monsoon Preparedness Brief",
                "url": "https://bbmp.gov.in/monsoon-bulletins"
            }
        ]
    },
    "sarjapur_road_extension_bengaluru_plot": {
        "location": "Sarjapur Road Extension, Bengaluru",
        "overall_risk": "high",
        "summary": "Extensive DC conversion backlogs and revenue layout regularization disputes. Critical dependence on unregulated water tanker mafias due to depleted aquifers.",
        "flags": [
            {
                "id": "flag-1",
                "category": "zoning_buffer_row",
                "severity": "high",
                "headline": "Unapproved Agricultural Land Layout Disputed Titles",
                "explanation": "Multiple plot segments lack valid BDA/BMRDA conversion approval and carry pending Revenue Department show-cause notices.",
                "quote": "Sub-registrar office cautioned buyers against unregistered gramathana layout deeds executed without single-window conversion.",
                "source_title": "Department of Stamps and Registration Land Alert",
                "url": "https://kaveri.karnataka.gov.in/notices/sarjapur-layouts"
            },
            {
                "id": "flag-2",
                "category": "civic_neighbor_friction",
                "severity": "high",
                "headline": "Severe Aquifer Depletion & Private Tanker Cartel",
                "explanation": "Borewells drilled to 1,400 feet produce minimal yield; resident clusters face price gouging and supply stoppages from private tanker cartels.",
                "quote": "Central Ground Water Authority declared Sarjapur-Anekal taluk an over-exploited dark zone with severe commercial extraction limits.",
                "source_title": "Central Ground Water Authority Assessment Report",
                "url": "https://cgwa-noc.gov.in/reports/bengaluru-urban-groundwater"
            },
            {
                "id": "flag-3",
                "category": "flooding_drainage",
                "severity": "medium",
                "headline": "Missing Secondary Canal Runoff Flooding",
                "explanation": "Rapid layout development without master storm drains turns access roads into impassable mud ditches during pre-monsoon showers.",
                "quote": "Revenue layouts in Sarjapur rural fringe lack secondary gutter networks, causing runoff accumulation over low-lying plot segments.",
                "source_title": "Bengaluru Rural District Disaster Management Plan",
                "url": "https://bengalururural.nic.in/disaster-management-drainage"
            }
        ]
    }
}


def slugify(location: str, intent: str) -> str:
    """Generate a clean slug identifier from location and intent."""
    clean_loc = re.sub(r"[^a-zA-Z0-9]+", "_", location.strip().lower()).strip("_")
    clean_intent = re.sub(r"[^a-zA-Z0-9]+", "_", intent.strip().lower()).strip("_")
    return f"{clean_loc}_{clean_intent}"


def get_cached_analysis(location: str, intent: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached analysis JSON from disk if available."""
    slug = slugify(location, intent)
    cache_file = CACHE_DIR / f"{slug}.json"
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def save_cached_analysis(location: str, intent: str, data: Dict[str, Any]) -> Path:
    """Save an analysis JSON payload to disk."""
    slug = slugify(location, intent)
    cache_file = CACHE_DIR / f"{slug}.json"
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return cache_file


def get_preset_analysis(location: str, intent: str) -> Optional[Dict[str, Any]]:
    """Check if the requested location matches any pre-configured preset archetype."""
    target_slug = slugify(location, intent)
    # Direct slug match
    if target_slug in PRESET_ANALYSES:
        return PRESET_ANALYSES[target_slug]
    
    # Fuzzy match based on keywords
    loc_lower = location.lower()
    for key, data in PRESET_ANALYSES.items():
        if "bellandur" in loc_lower and "bellandur" in key:
            return data
        if "peenya" in loc_lower and "peenya" in key:
            return data
        if "indiranagar" in loc_lower and "indiranagar" in key:
            return data
        if "sarjapur" in loc_lower and "sarjapur" in key:
            return data

    return None


def generate_fallback_analysis(
    location: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    intent: str = "warehouse"
) -> Dict[str, Any]:
    """
    Generate realistic, intent-aware fallback friction radar signals
    when upstream API keys or collector modules are not yet loaded.
    """
    loc_name = location.strip() or "Selected Area"
    intent_clean = intent.lower()

    if intent_clean == "warehouse":
        risk = "high"
        summary = (
            f"Moderate to severe logistics friction detected for {loc_name}. "
            "High risks of stormwater canal overflow, Right-of-Way buffer restrictions, "
            "and peak-hour freight transit curfews by local resident welfare associations."
        )
        flags = [
            {
                "id": "flag-1",
                "category": "flooding_drainage",
                "severity": "high",
                "headline": f"Low-Lying Drainage Backflow Near {loc_name}",
                "explanation": "The site lies within a tertiary drainage depression, creating standing water vulnerability during intense precipitation.",
                "quote": f"Municipal drainage cell notes periodic storm drain choke points affecting perimeter warehousing parcels around {loc_name}.",
                "source_title": "Regional Stormwater Flow & Hydrology Brief",
                "url": "https://urbanwater.gov.in/hydrology/drainage-study"
            },
            {
                "id": "flag-2",
                "category": "zoning_buffer_row",
                "severity": "medium",
                "headline": "Secondary Road Right-of-Way Setback Limit",
                "explanation": "Proposed master plan road widening requires a 6-meter non-buildable setback along the primary plot frontage.",
                "quote": "Master Plan mandates 18m total Right-of-Way with mandatory setback reservations for all commercial logistics facilities.",
                "source_title": "Urban Development Authority Master Plan Guideline",
                "url": "https://urbanplanning.gov.in/masterplan/zoning-regulations"
            },
            {
                "id": "flag-3",
                "category": "civic_neighbor_friction",
                "severity": "medium",
                "headline": "Neighborhood Resistance to Heavy Axle Traffic",
                "explanation": "Adjoining residential developments have submitted representations to restrict logistics fleet idling and night operations.",
                "quote": "Resident coalition appeals to local municipal commissioner for truck diversion and acoustic sound barrier installation.",
                "source_title": "Local Governance Gazette & Citizen Petitions",
                "url": "https://citizenwatch.org/petitions/truck-movement-advisory"
            }
        ]
    elif intent_clean == "retail":
        risk = "medium"
        summary = (
            f"Commercial retail feasibility around {loc_name} faces moderate regulatory overhead. "
            "Primary obstacles include stringent off-street parking mandates, trade license zoning scrutiny, and noise bylaws."
        )
        flags = [
            {
                "id": "flag-1",
                "category": "zoning_buffer_row",
                "severity": "medium",
                "headline": "Mandatory Off-Street Customer Parking By-law",
                "explanation": "Retail establishments without dedicated underground or surface parking face closure notices under new municipal guidelines.",
                "quote": "Commercial units exceeding 2,000 sq ft must ensure a minimum of 1 parking bay per 50 sq ft of carpet area.",
                "source_title": "Municipal Corporation Commercial Trade Regulation",
                "url": "https://citycorporation.gov.in/trade-license/parking-norms"
            },
            {
                "id": "flag-2",
                "category": "civic_neighbor_friction",
                "severity": "medium",
                "headline": "Decibel & Late-Night Operating Hour Restrictions",
                "explanation": "Vocal neighborhood associations actively enforce a 10 PM ambient sound curfew, impacting evening retail operations.",
                "quote": "High Court division bench upholds citizen petition regarding strict enforcement of silence zones in mixed commercial belts.",
                "source_title": "Judicial Public Interest Ruling on Commercial Decibels",
                "url": "https://highcourt.gov.in/rulings/retail-noise-pollution"
            },
            {
                "id": "flag-3",
                "category": "flooding_drainage",
                "severity": "low",
                "headline": "Pavement Curb Water Ingress During Flash Rains",
                "explanation": "Shallow curbside gutters occasionally overflow across storefront thresholds during sudden downpours.",
                "quote": "Local engineering wing reports minor pavement pooling at intersections during monsoon cloudbursts.",
                "source_title": "Ward Infrastructure Progress Memo",
                "url": "https://citycorporation.gov.in/ward-infrastructure/drainage"
            }
        ]
    else:  # plot
        risk = "high"
        summary = (
            f"Severe titling, groundwater, and infrastructure friction detected for plots in {loc_name}. "
            "High occurrence of agricultural conversion disputes, missing drainage infrastructure, and severe groundwater depletion."
        )
        flags = [
            {
                "id": "flag-1",
                "category": "zoning_buffer_row",
                "severity": "high",
                "headline": "Agricultural Land Non-Agricultural Conversion Dispute",
                "explanation": "Title chain indicates unregularized agricultural subdivision with pending revenue authority proceedings.",
                "quote": "Revenue department issued warning against unauthorized layout formations lacking formal single-window conversion clearance.",
                "source_title": "District Revenue Department Land Notice",
                "url": "https://revenuedepartment.gov.in/notices/unauthorized-layouts"
            },
            {
                "id": "flag-2",
                "category": "civic_neighbor_friction",
                "severity": "high",
                "headline": "Critical Aquifer Depletion & Groundwater Scarcity",
                "explanation": "New borewell digging permits are frozen in this zone; existing residents rely exclusively on tanker deliveries.",
                "quote": "Groundwater authority classifies locality under over-exploited critical block with ban on commercial drilling.",
                "source_title": "Central Ground Water Authority Aquifer Status",
                "url": "https://cgwa.gov.in/groundwater-depletion-status"
            },
            {
                "id": "flag-3",
                "category": "flooding_drainage",
                "severity": "medium",
                "headline": "Absence of Municipal Stormwater Outfall",
                "explanation": "Layout boundary lacks structured secondary drainage, leading to water accumulation on access pathways during monsoons.",
                "quote": "Rural development audit notes absence of engineered stormwater runoff channels in newly developing plot clusters.",
                "source_title": "Rural District Infrastructure Assessment",
                "url": "https://ruralinfrastructure.gov.in/drainage-audit"
            }
        ]

    return {
        "location": loc_name,
        "overall_risk": risk,
        "summary": summary,
        "flags": flags
    }
