# PlotTwistt 🗺️ ⚡
> **Land & Civic Friction Radar** — Uncover hidden real-world site headaches before buying, leasing, or building.
> Built for the Beyond 9TO5 Buildathon.

---

## 💡 What PlotTwistt Solves
When choosing a property for a **warehouse**, **retail store**, or **plot investment**, real-estate listings hide real-world friction:
- **Monsoon Waterlogging & Drains:** Basements getting submerged, rajakaluve (storm drain) overflow.
- **Zoning & Regulatory Traps:** NGT lake buffer zone encroachments, road widening demolition notices, land acquisition disputes.
- **Civic & Operational Headaches:** Heavy truck daytime entry bans, neighbor noise friction, industrial dumping ground smells.

**PlotTwistt** takes a dropped pin or locality search and user intent, queries live search and intelligence feeds via **SerpApi**, and delivers a categorized **Friction Radar** with an indisputable **Receipt Trail** (exact quotes, source publishers, and direct links).

---

## 📂 Repository Architecture

```
PlotTwistt/
├── .env.example              # Template for API keys & cache config
├── .gitignore                # Excludes secrets, caches, and node/python artifacts
├── README.md                 # Project guide & team coordination
├── SPEC.md                   # Shared API contract across backend and frontend
├── backend/
│   ├── __init__.py
│   ├── requirements.txt      # FastAPI, uvicorn, pydantic, httpx, pytest
│   ├── schemas.py            # Pydantic schemas (AnalyzeRequest, Flag, AnalyzeResponse, Preset)
│   ├── cache.py              # File-based caching, presets, and safe demo fallbacks
│   ├── main.py               # FastAPI entrypoint (/health, /api/presets, /api/analyze)
│   ├── serpapi_collector.py  # SerpApi signal extractor [Owned by Teammate 1]
│   ├── synthesizer.py        # Signal classification & friction scoring [Owned by Teammate 2]
│   ├── cache/
│   │   └── .gitkeep
│   └── tests/
│       ├── __init__.py
│       └── test_api.py       # API test suite covering endpoints and cache behavior
└── frontend/
    ├── .gitkeep
    └── src/
        ├── .gitkeep
        ├── components/.gitkeep
        └── data/.gitkeep
```

---

## 🛠️ Branch Ownership & Merge Order

To allow parallel development during the buildathon without merge conflicts:

| Branch | Owner | Focus Area |
|---|---|---|
| `main` | Core / Lead | Baseline schema, cache, fallback responses, FastAPI core, tests |
| `feat/serpapi-collector` | Teammate 1 | `backend/serpapi_collector.py` (SerpApi Google search, Maps & news queries) |
| `feat/you-synthesizer` | Teammate 2 | `backend/synthesizer.py` (signal classification & friction scoring) |
| `feat/frontend-radar` | Teammate 3 | `frontend/` (Map picker, intent selector, friction dials, receipt drawer) |

### Recommended Merge Sequence:
1. **Core Scaffolding (`main`)**: Schemas, cache, safe fallback mock so frontend can develop immediately against `http://localhost:8000`.
2. **`feat/serpapi-collector` into `main`**: Implements raw news and civic signal retrieval.
3. **`feat/you-synthesizer` into `main`**: Plugs live signal summarization and receipt quote extraction into the pipeline.
4. **`feat/frontend-radar` into `main`**: Connects frontend UI to `/api/presets` and `/api/analyze`.

---

## 🚀 Quickstart & Local Setup

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/yup29-pro/PlotTwistt.git
cd PlotTwistt

# Configure environment
cp .env.example .env

# Create and activate virtual environment (optional but recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run test suite
python -m pytest -q backend/tests   # fully mocked, no network

# Start FastAPI server
uvicorn backend.main:app --reload --port 8000
```

### 2. Available Endpoints
- **Health check:** `GET http://localhost:8000/health` (alias `/api/health`)
- **Curated Demo Presets:** `GET http://localhost:8000/api/presets`
- **Analyze Site:** `POST http://localhost:8000/api/analyze` (Supports `?refresh=true` to force live recalculation)
- **Interactive OpenAPI docs:** `http://localhost:8000/docs`

---

## 🛡️ Built-in Demo Reliability
- **Response caching**: Live results are cached in `backend/cache/<locality>_<intent>.json` for `CACHE_TTL_HOURS` (default 24) and served with `data_source: "cache"`. Use `?refresh=true` to bypass.
- **Demo fallback**: If live collection fails entirely, the four preset localities return curated sample data marked `data_source: "demo"` (the UI shows a DEMO banner). Any other locality returns HTTP 503 rather than borrowed data.

