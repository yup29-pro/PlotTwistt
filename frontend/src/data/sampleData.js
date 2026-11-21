/**
 * Offline Sample Data & Demo Presets for PlotTwistt
 * Used for instant testing and offline UI verification without backend dependency.
 */

export const SAMPLE_PRESETS = [
  {
    id: "bellandur-buffer",
    name: "Bellandur Lake Buffer, Bengaluru",
    lat: 12.9352,
    lng: 77.6744,
    intent: "warehouse",
    description: "High flood hazard & 75m NGT wetland buffer constraints.",
  },
  {
    id: "peenya-industrial",
    name: "Peenya 2nd Stage, Bengaluru",
    lat: 13.0315,
    lng: 77.5186,
    intent: "retail",
    description: "Heavy industrial zoning clash with retail commercial footfall.",
  },
  {
    id: "indiranagar-100ft",
    name: "Indiranagar 100ft Road, Bengaluru",
    lat: 12.9784,
    lng: 77.6408,
    intent: "retail",
    description: "High-density retail strip with residential noise & parking bylaws.",
  },
  {
    id: "sarjapur-sprawl",
    name: "Sarjapur Road Extension, Bengaluru",
    lat: 12.8614,
    lng: 77.7785,
    intent: "plot",
    description: "Revenue land conversion delays & acute borewell exhaustion.",
  },
];

export const SAMPLE_ANALYSES = {
  "bellandur-buffer": {
    location: "Bellandur Lake Buffer, Bengaluru",
    overall_risk: "high",
    summary:
      "Critical vulnerability to monsoon inundation and strict 75-meter NGT lake buffer zone enforcement. Strong civic opposition restricts heavy logistics transit through neighborhood roads.",
    flags: [
      {
        id: "flag-1",
        category: "flooding_drainage",
        severity: "high",
        headline: "Encroached Rajakaluve Primary Drain Overflow Vulnerability",
        explanation:
          "Low-lying plots adjacent to Bellandur wetland experience 3-4 feet of standing floodwater during moderate-to-heavy monsoons, endangering floor cargo storage.",
        quote:
          "BWSSB and BBMP joint survey identified 14 severe primary drain encroachments along the Bellandur lake basin causing regular backflow.",
        source_title: "BBMP Stormwater Drain Master Audit Report",
        url: "https://bangalorewater.gov.in/notices/drainage-audit",
      },
      {
        id: "flag-2",
        category: "zoning_buffer_row",
        severity: "high",
        headline: "NGT 75m Non-Construction Lake Buffer Order",
        explanation:
          "Warehousing, loading ramps, and parking structures within 75 meters of the lake edge are subject to summary demolition and power severance.",
        quote:
          "No permanent or semi-permanent commercial warehousing structure may operate inside the designated 75-meter buffer from lake boundary.",
        source_title: "National Green Tribunal Southern Zone Ruling (OA No. 125)",
        url: "https://greentribunal.gov.in/judgements/bellandur-buffer-order",
      },
      {
        id: "flag-3",
        category: "civic_neighbor_friction",
        severity: "medium",
        headline: "Resident Federation Curfew on Freight Trucks",
        explanation:
          "Local RWA clusters enforce an informal barrier banning multi-axle freight vehicles from 10 PM to 6 AM on feeder links.",
        quote:
          "Bellandur Forum submitted police petition demanding strict night truck bans to combat road collapse and noise pollution.",
        source_title: "Citizen Matters Bengaluru Civic Watch",
        url: "https://citizenmatters.in/bengaluru-bellandur-traffic-trucks",
      },
    ],
  },
  "peenya-industrial": {
    location: "Peenya 2nd Stage, Bengaluru",
    overall_risk: "medium",
    summary:
      "Industrial Master Plan zoning blocks purely consumer retail footfall permissions. High ambient particulate matter and heavy machinery noise create hostile customer environments.",
    flags: [
      {
        id: "flag-1",
        category: "zoning_buffer_row",
        severity: "high",
        headline: "KIADB Industrial Zone Retail License Bar",
        explanation:
          "Properties designated as General Industrial (I-2) cannot obtain municipal retail trade licenses without complex Land Use Change approval.",
        quote:
          "Commercial showroom and retail establishment licenses remain barred within Peenya Industrial Area Sector 2 without BDA zoning reclassification.",
        source_title: "Karnataka Industrial Areas Development Board Gazette Notification",
        url: "https://kiadb.karnataka.gov.in/zoning-guidelines",
      },
      {
        id: "flag-2",
        category: "flooding_drainage",
        severity: "medium",
        headline: "Chemical Effluent Runoff Ingress During Rains",
        explanation:
          "Surface stormwater channels carry industrial chemical effluent spills across low pavement levels during sudden showers.",
        quote:
          "KSPCB inspection noted illegal discharge overflow entering roadside open drains during peak precipitation in Peenya 2nd Phase.",
        source_title: "Karnataka State Pollution Control Board Inspection Findings",
        url: "https://kspcb.karnataka.gov.in/reports/peenya-drain-audit",
      },
      {
        id: "flag-3",
        category: "civic_neighbor_friction",
        severity: "low",
        headline: "Heavy Transport Union Loading Bay Disputes",
        explanation:
          "Local industrial transport associations monopolize street parking and dispute curbside customer vehicle standing.",
        quote:
          "Peenya Small Scale Industries Association submitted traffic grievances regarding unauthorized container staging blocking commercial frontages.",
        source_title: "Bangalore Traffic Police Traffic Advisory",
        url: "https://btp.gov.in/advisories/peenya-freight-congestion",
      },
    ],
  },
  "indiranagar-100ft": {
    location: "Indiranagar 100ft Road, Bengaluru",
    overall_risk: "low",
    summary:
      "Prime commercial corridor with strong footfall and stable drainage. Primary friction stems from vocal resident associations pursuing sound decibel and valet parking litigation.",
    flags: [
      {
        id: "flag-1",
        category: "civic_neighbor_friction",
        severity: "medium",
        headline: "RWA Public Interest Litigation Against Night Decibels",
        explanation:
          "I-Care resident coalition actively reports rooftop and late-night retail audio past 10:00 PM, triggering frequent municipal inspections.",
        quote:
          "High Court directed BBMP and Police to rigorously penalize commercial establishments violating silence zone norms in Indiranagar residential borders.",
        source_title: "Karnataka High Court PIL Order on Indiranagar Commercialization",
        url: "https://karnatakajudiciary.kar.nic.in/indiranagar-rwa-pil",
      },
      {
        id: "flag-2",
        category: "zoning_buffer_row",
        severity: "low",
        headline: "BBMP Mandatory Dedicated Parking Mandate",
        explanation:
          "Commercial plots with less than 40ft road frontage face punitive parking cess if unable to provide subterranean customer parking.",
        quote:
          "Establishments on 100ft Road lacking off-street parking facilities face suspension of commercial occupancy certificates.",
        source_title: "BBMP Commercial Building By-law Circular 2024",
        url: "https://bbmp.gov.in/circulars/commercial-parking-mandate",
      },
      {
        id: "flag-3",
        category: "flooding_drainage",
        severity: "low",
        headline: "Localized Puddle Pooling at Secondary Intersections",
        explanation:
          "Main 100ft road drains effectively, but junction ramps experience minor 4-inch puddling for 30 minutes following cloudbursts.",
        quote:
          "Stormwater desilting along 100ft Road completed with 90% flow clearance recorded at HAL 2nd Stage feeder points.",
        source_title: "BBMP Ward 112 Monsoon Preparedness Brief",
        url: "https://bbmp.gov.in/monsoon-bulletins",
      },
    ],
  },
  "sarjapur-sprawl": {
    location: "Sarjapur Road Extension, Bengaluru",
    overall_risk: "high",
    summary:
      "Extensive DC conversion backlogs and revenue layout regularization disputes. Critical dependence on unregulated water tanker mafias due to depleted aquifers.",
    flags: [
      {
        id: "flag-1",
        category: "zoning_buffer_row",
        severity: "high",
        headline: "Unapproved Agricultural Land Layout Disputed Titles",
        explanation:
          "Multiple plot segments lack valid BDA/BMRDA conversion approval and carry pending Revenue Department show-cause notices.",
        quote:
          "Sub-registrar office cautioned buyers against unregistered gramathana layout deeds executed without single-window conversion.",
        source_title: "Department of Stamps and Registration Land Alert",
        url: "https://kaveri.karnataka.gov.in/notices/sarjapur-layouts",
      },
      {
        id: "flag-2",
        category: "civic_neighbor_friction",
        severity: "high",
        headline: "Severe Aquifer Depletion & Private Tanker Cartel",
        explanation:
          "Borewells drilled to 1,400 feet produce minimal yield; resident clusters face price gouging and supply stoppages from private tanker cartels.",
        quote:
          "Central Ground Water Authority declared Sarjapur-Anekal taluk an over-exploited dark zone with severe commercial extraction limits.",
        source_title: "Central Ground Water Authority Assessment Report",
        url: "https://cgwa-noc.gov.in/reports/bengaluru-urban-groundwater",
      },
      {
        id: "flag-3",
        category: "flooding_drainage",
        severity: "medium",
        headline: "Missing Secondary Canal Runoff Flooding",
        explanation:
          "Rapid layout development without master storm drains turns access roads into impassable mud ditches during pre-monsoon showers.",
        quote:
          "Revenue layouts in Sarjapur rural fringe lack secondary gutter networks, causing runoff accumulation over low-lying plot segments.",
        source_title: "Bengaluru Rural District Disaster Management Plan",
        url: "https://bengalururural.nic.in/disaster-management-drainage",
      },
    ],
  },
};

export function getSampleAnalysis(location = "", intent = "warehouse") {
  const locLower = location.toLowerCase();
  if (locLower.includes("peenya")) return SAMPLE_ANALYSES["peenya-industrial"];
  if (locLower.includes("indiranagar")) return SAMPLE_ANALYSES["indiranagar-100ft"];
  if (locLower.includes("sarjapur")) return SAMPLE_ANALYSES["sarjapur-sprawl"];
  return SAMPLE_ANALYSES["bellandur-buffer"];
}
