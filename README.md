# PlotTwistt 🗺️ ⚡
> **Land & Civic Friction Radar** — Uncover hidden real-world site headaches before buying, leasing, or building.
> Built for the Beyond 9TO5 Buildathon.

---

## 💡 What PlotTwistt Solves
When choosing a property for a **warehouse**, **retail store**, or **plot investment**, real-estate listings hide real-world friction:
- **Monsoon Waterlogging & Drains:** Basements getting submerged, rajakaluve (storm drain) overflow.
- **Zoning & Regulatory Traps:** NGT lake buffer zone encroachments, road widening demolition notices, land acquisition disputes.
- **Civic & Operational Headaches:** Heavy truck daytime entry bans, neighbor noise friction, industrial dumping ground smells.

**PlotTwistt** takes a dropped pin or locality search and user intent, queries live search and intelligence feeds via **SerpApi** & **You.com**, and delivers a categorized **Friction Radar** with an indisputable **Receipt Trail** (exact quotes, source publishers, and direct links).

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
│   ├── schemas.py            # Pydantic schemas (Intent, Location, Receipt, AnalysisResult)
│   ├── cache.py              # File-based caching, presets, and safe demo fallbacks
│   ├── main.py               # FastAPI entrypoint (/health, /api/presets, /api/analyze)
│   ├── serpapi_collector.py  # SerpApi signal extractor [Owned by Teammate 1]
│   ├── synthesizer.py        # You.com synthesis agent [Owned by Teammate 2]
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
| `feat/you-synthesizer` | Teammate 2 | `backend/synthesizer.py` (You.com live cited web synthesis & friction scoring) |
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
pytest backend/tests/test_api.py -v

# Start FastAPI server
uvicorn backend.main:app --reload --port 8000
```

### 2. Available Endpoints
- **Health check:** `GET http://localhost:8000/health`
- **Curated Demo Presets:** `GET http://localhost:8000/api/presets`
- **Analyze Site:** `POST http://localhost:8000/api/analyze` (Supports `?refresh=true` to force live recalculation)
- **Interactive OpenAPI docs:** `http://localhost:8000/docs`

---

## 🛡️ Built-in Demo Reliability
- **Smart Response Caching**: Results are cached in `backend/cache/<slug>.json` to ensure zero token wastage and instant replay during live demos.
- **Fail-Safe Fallback**: If external API keys expire, hit quota limits, or network drops, `backend/cache.py` automatically produces structured demo responses matching the `SPEC.md` contract with realistic friction points and receipt citations.


## Showcasing - OFF CAMPUS BENGALURU
-- **CODE - J99W7V**
