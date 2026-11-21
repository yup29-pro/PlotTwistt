# SPEC.md — PlotTwistt Architecture & Specification

## 1. Overview
**PlotTwistt** is a Land & Civic Friction Radar built for the **Beyond 9TO5 Buildathon**.
It detects hidden friction points (waterlogging / Rajakaluve drainage, National Green Tribunal (NGT) lake/river buffer setbacks, Right-of-Way (ROW) zoning, and neighborhood civic disputes) for prospective commercial and residential land users.

---

## 2. API Contract

### Base URL
`http://localhost:8000`

### Endpoints

#### `GET /health`
Returns system status.
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "app": "PlotTwistt",
  "version": "1.0.0"
}
```

#### `GET /api/presets`
Returns curated demo locations for one-click testing of contrasting friction archetypes.
- **Response**: `200 OK`
```json
[
  {
    "id": "bellandur-buffer",
    "name": "Bellandur Lake Buffer, Bengaluru",
    "lat": 12.9352,
    "lng": 77.6744,
    "intent": "warehouse",
    "description": "High flood hazard & 75m NGT wetland buffer constraints."
  },
  {
    "id": "peenya-industrial",
    "name": "Peenya 2nd Stage, Bengaluru",
    "lat": 13.0315,
    "lng": 77.5186,
    "intent": "retail",
    "description": "Heavy industrial zoning clash with commercial retail footfall."
  },
  {
    "id": "indiranagar-100ft",
    "name": "Indiranagar 100ft Road, Bengaluru",
    "lat": 12.9784,
    "lng": 77.6408,
    "intent": "retail",
    "description": "Established commercial artery with noise and parking bylaws."
  },
  {
    "id": "sarjapur-sprawl",
    "name": "Sarjapur Road Extension, Bengaluru",
    "lat": 12.8614,
    "lng": 77.7785,
    "intent": "plot",
    "description": "Revenue land conversion uncertainty & groundwater depletion."
  }
]
```

#### `POST /api/analyze`
Main intelligence scan endpoint. Analyzes a given site for environmental, zoning, and civic friction.

- **Query Parameters**:
  - `refresh` (boolean, default: `false`): When `true`, forces cache invalidation and upstream re-collection.

- **Request Body**:
```json
{
  "location": "Bellandur Lake Buffer, Bengaluru",
  "lat": 12.9352,
  "lng": 77.6744,
  "intent": "warehouse"
}
```

- **Request Schema**:
  - `location` (string, required): Human-readable address or landmark name.
  - `lat` (float, optional): Latitude coordinate.
  - `lng` (float, optional): Longitude coordinate.
  - `intent` (string, optional, default: `"warehouse"`): Intent category: `"warehouse"`, `"retail"`, or `"plot"`.

- **Response Body**:
```json
{
  "location": "Bellandur Lake Buffer, Bengaluru",
  "overall_risk": "high",
  "summary": "Critical vulnerability to monsoon inundation and strict 75-meter NGT lake buffer zone enforcement. Strong civic opposition exists against heavy goods vehicles along feeder roads.",
  "flags": [
    {
      "id": "flag-1",
      "category": "flooding_drainage",
      "severity": "high",
      "headline": "Encroached Rajakaluve Primary Drain Overflow",
      "explanation": "Logistics operations face 3-4 feet of standing floodwater during high-intensity monsoons, endangering ground-level cargo storage.",
      "quote": "BWSSB and BBMP joint survey flagged 14 primary stormwater drain encroachments across the Bellandur lake feeder canals.",
      "source_title": "BBMP Stormwater Drain Master Audit Report",
      "url": "https://bangalorewater.gov.in/notices/drainage-audit"
    },
    {
      "id": "flag-2",
      "category": "zoning_buffer_row",
      "severity": "high",
      "headline": "NGT 75m Non-Construction Buffer Restriction",
      "explanation": "Warehousing and loading bays within 75 meters of the lake boundary are subject to immediate demolition and sealing notices.",
      "quote": "No permanent or semi-permanent commercial warehousing structure may operate inside the designated 75-meter buffer from lake boundary.",
      "source_title": "National Green Tribunal Southern Zone Ruling (OA No. 125)",
      "url": "https://greentribunal.gov.in/judgements/bellandur-buffer-order"
    },
    {
      "id": "flag-3",
      "category": "civic_neighbor_friction",
      "severity": "medium",
      "headline": "RWA Boycott Against Logistics Truck Ingress",
      "explanation": "Local residents actively barricade entry roads between 10 PM and 6 AM, causing delayed night deliveries.",
      "quote": "Residents Federation submitted formal police petition to restrict heavy multi-axle freight movement through Bellandur village arterial links.",
      "source_title": "Citizen Matters Bengaluru Civic Watch",
      "url": "https://citizenmatters.in/bengaluru-bellandur-traffic-trucks"
    }
  ]
}
```

- **Enums & Fields**:
  - `overall_risk`: `"low" | "medium" | "high"`
  - `category`: `"flooding_drainage" | "zoning_buffer_row" | "civic_neighbor_friction"`
  - `severity`: `"low" | "medium" | "high"`
  - `intent`: `"warehouse" | "retail" | "plot"`

---

## 3. Cache Architecture
- **Disk-backed Storage**: Responses are persisted in `backend/cache/<slug>.json`.
- **Slug Formulation**: Normalized lower-case, alphanumeric string with underscores combining `location` and `intent`:
  `slug = f"{sanitize(location)}_{intent}"`
- **Cache Hit / Miss**:
  - If `refresh=false` and cache file exists, serve immediately with zero API latency.
  - If cache file does not exist or `refresh=true`, trigger pipeline:
    1. Check for registered preset data.
    2. Attempt dynamic upstream calls to `collect_location_signals` (Teammate 1) and `synthesize_friction` (Teammate 2).
    3. If upstream modules or keys are absent, fallback to rich synthetic signals to ensure end-to-end functionality.
    4. Save sanitized payload into disk cache.

---

## 4. Branch & Merge Roadmap
| Branch | Owner | Responsibilities | Status |
| :--- | :--- | :--- | :--- |
| `feat/api-cache-setup` | Teammate 4 | FastAPI app, Pydantic schemas, disk cache, demo presets, fallback generator, repo root files. | Implemented |
| `feat/serpapi-collector`| Teammate 1 | SerpAPI / Google Maps & News query pipelines in `backend/serpapi_collector.py`. | Upstream |
| `feat/synthesizer` | Teammate 2 | Gemini / LLM extraction & synthesis in `backend/synthesizer.py`. | Upstream |
| `feat/map-receipt-ui` | Teammate 3 | React + Vite + Leaflet UI in `frontend/` (MapCanvas, FrictionFeed, ReceiptDrawer). | Implemented |

---

## 5. Teammate Isolation Rules
- Teammate 4 owns: `.env.example`, `.gitignore`, `README.md`, `SPEC.md`, `backend/__init__.py`, `backend/schemas.py`, `backend/cache.py`, `backend/main.py`, `backend/requirements.txt`, `backend/cache/`.
- Teammate 3 owns: `frontend/**`.
- Teammate 1 & 2 own: `backend/serpapi_collector.py` and `backend/synthesizer.py`.
- `backend/main.py` uses dynamic conditional imports to remain completely resilient prior to merging branches 1 & 2.
