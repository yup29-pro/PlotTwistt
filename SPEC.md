# PlotTwistt API Contract & Specification

**PlotTwistt** is a Land & Civic Friction Radar that inspects site headaches for prospective land buyers, tenants, and builders based on intent (`warehouse`, `retail`, or `plot`).

---

## 1. Intent Definitions
- `warehouse`: Sensitive to heavy vehicle access restrictions, waterlogging/submersion, low bridges, narrow approach roads, industrial zoning buffers, neighbor noise complaints.
- `retail`: Sensitive to customer footfall visibility, civic road widening/demolition, parking/traffic police towing zones, stormwater drains overflowing into basements, local commercial tax disputes.
- `plot`: Sensitive to lake buffer zones (NGT rulings), revenue land vs gramathana classification, Rajakaluve (storm drain) encroachment notices, builder legal disputes, high-tension power line clearance.

---

## 2. Shared Data Models

The Pydantic models in `backend/schemas.py` are the source of truth; every route declares `response_model=`.

### Intent
`warehouse` | `retail` | `plot`

### Category
- `flooding_drainage` – waterlogging, rain, drains, rajakaluve, stormwater overflow
- `zoning_buffer_row` – lake buffers (NGT), demolition, road widening, land acquisition, disputes, illegal layouts
- `civic_neighbor_friction` – crime, traffic, potholes, parking/towing, protests, noise, utility outages
- `access_infrastructure` – heavy-vehicle bans, narrow approach roads, low bridges, power-line clearance

### Severity
- `low`: informational or minor historic occurrence.
- `medium`: notable constraint requiring verification or operational adjustments.
- `high`: major barrier, legal block, or severe recurring disruption.

Severity is assigned per intent from the sensitivities in section 1 (e.g. flooding and heavy-vehicle bans are `high` for `warehouse`; parking/towing and road widening are `high` for `retail`; buffers, land disputes and power-line clearance are `high` for `plot`).

### Flag
```json
{
  "id": "flag-1",
  "category": "flooding_drainage",
  "severity": "high",
  "headline": "Civic Infrastructure & Drainage: Bellandur lake overflow floods Outer Ring Road",
  "explanation": "Monsoon drainage conditions or stormwater channels reported in Bellandur.",
  "quote": "Stormwater drains overflowed near Bellandur, flooding basements.",
  "source_title": "Deccan Herald - Bellandur lake overflow floods Outer Ring Road",
  "url": "https://www.deccanherald.com/...",
  "distance_km": null,
  "distance_label": "Names locality",
  "proximity_tier": "hyperlocal"
}
```
- `distance_km` is only set when the source signal carries real coordinates (haversine from the target; tiers <1.5 km / <4 km / beyond). Otherwise it is `null` and the tier says where the locality appears in the source:
  - `hyperlocal` – "Names locality": the locality is in the title.
  - `corridor` – "Mentions locality": the locality is only in the snippet.
  - `district` – "Area-level": the locality is not found, or the source only names the city/state (Bengaluru, Bangalore, Karnataka, India).
- Flags are sorted by tier (hyperlocal first), then severity (high first), so city-wide pieces sink to the bottom.
- Stories that name a distant Bengaluru hub (BTM, Silk Board, Whitefield, Koramangala…) but neither the target locality nor its corridor are dropped in the collector.
- Noise is dropped before classification: directory/index/listing pages, social posts (Facebook, Instagram, X/Twitter, LinkedIn titles or URLs), titles of five words or fewer with no friction keyword, and business openings with no friction keyword.
- `url` is the publisher link. The frontend only renders it as a link if it starts with `http://` or `https://`.
- Google redirect links (`google.com/goto`, `/url`, `/amp/s/`) are unwrapped from their `url`/`q` parameter before classification; a destination that is not a plain http(s) URL with a host drops the signal. Generic source labels are replaced with the publisher domain.

### AnalyzeResponse
```json
{
  "location": "Bellandur",
  "hierarchy": { "hyperlocal": "Bellandur", "locality": "Bellandur", "corridor": "Outer Ring Road", "city": "Bengaluru" },
  "overall_risk": "high",
  "summary": "Radar scan for Bellandur found 7 public friction signals...",
  "flags": [ ...Flag... ],
  "total_flags": 7,
  "friction_score": 64,
  "verdict": "Moderate",
  "lake_buffer_breach": false,
  "data_source": "live",
  "degraded": false,
  "analyzed_at": "2026-11-21T11:15:00+00:00"
}
```
- `overall_risk` is computed from real flags only. With 0 flags it is `low` and the summary says few public signals were found. No filler flags are ever added.
- `friction_score` (0–100) = round(100 × (1 − e^(−total / 80))), where total = Σ weight × multiplier, so the score saturates smoothly instead of capping at 100. Weights: high 25, medium 12, low 4. Multipliers: 1.0 for geodata and "Names locality", 0.6 for "Mentions locality", 0.3 for "Area-level".
- `verdict`: `Low` (0–30), `Moderate` (31–70), `High` (71–100).
- `lake_buffer_breach`: `true` when OpenStreetMap puts a lake within 75 m of the pin (the UI draws a red 75 m ring).
- `data_source`: `live` (fresh SerpApi results), `cache` (served from the file cache), `demo` (curated sample data, shown with a DEMO banner).
- `degraded`: `true` when some of the live searches failed, or when demo data is served because live collection failed.
- `analyzed_at`: ISO 8601 UTC timestamp.

### Preset
```json
{ "id": "bellandur-lake-corridor", "name": "Bellandur Lake Buffer, Bengaluru", "lat": 12.9352, "lng": 77.6744, "intent": "warehouse", "description": "..." }
```

---

## 3. Endpoints

### `GET /health` (alias `GET /api/health`)
```json
{ "status": "ok", "service": "PlotTwistt Radar API", "timestamp": "2026-11-21T11:15:00+00:00" }
```

### `GET /api/presets`
Returns `Preset[]`.

### `POST /api/analyze?refresh=false`

**Query parameters**
- `refresh` (bool, default `false`): skip the cache read and run a live collection.

**Request body**
```json
{ "location": "Bellandur", "lat": 12.9352, "lng": 77.6744, "intent": "warehouse" }
```
or
```json
{ "location": { "locality": "Bellandur", "address": "Bellandur ORR", "lat": 12.9352, "lng": 77.6744, "city": "Bengaluru" }, "intent": "warehouse" }
```
- `location`: string (1–200 chars) or the location object. `lat`/`lng` are optional, constrained to [-90, 90] / [-180, 180].
- `intent`: an Intent value (default `warehouse`).

**Behaviour**
1. Unless `refresh=true`, a cached result for (locality, intent) younger than `CACHE_TTL_HOURS` (default 24) is returned with `data_source: "cache"`.
2. Otherwise SerpApi is queried (5 searches in parallel). When `lat`/`lng` are given, one Overpass (OpenStreetMap) query runs alongside it for lakes (`natural=water`) and drains (`waterway=drain|canal|stream`) within 250 m (three public servers tried in turn within 8 s; results cached per pin for 7 days): a lake ≤75 m or a drain ≤50 m is a `high` flag, anything ≤200 m is `medium`, with the OSM way as the receipt URL and a real `distance_km`. A geodata or synthesizer failure sets `degraded: true` instead of failing the request. A geodata-only failure does not stop the scan from being cached. Results are returned with `data_source: "live"` (`degraded: true` if some searches failed). Only complete results with at least one flag are cached; degraded or empty results are retried next time.
3. If collection fails entirely: a known demo locality (Bellandur, Peenya, Indiranagar, Sarjapur) returns demo data with `data_source: "demo"`; any other locality returns **503**.

**Responses**
- `200` – `AnalyzeResponse`
- `422` – invalid body (unknown intent, out-of-range coordinates, overlong location)
- `429` – more than 10 requests per minute from one IP
- `503` – live data unavailable and no demo data for this locality
