# PlotTwistt 📍
### Land & Civic Friction Radar (Beyond 9TO5 Buildathon)

PlotTwistt uncovers hidden land risks, drainage vulnerabilities, zoning/buffer sanctions, and neighborhood civil resistance before you commit to commercial real estate, logistics warehouses, or land plots.

---

## 🚀 Quickstart

### 1. Backend Setup
```bash
# From repository root
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r backend/requirements.txt
cp .env.example .env

# Run FastAPI backend
uvicorn backend.main:app --reload --port 8000
```
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- Presets: [http://localhost:8000/api/presets](http://localhost:8000/api/presets)

### 2. Frontend Setup
```bash
# In another terminal
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧠 Architecture & API Contract
See [`SPEC.md`](SPEC.md) for full endpoint specifications, Pydantic schemas, and category taxonomy.

### Key Endpoints:
- `GET /health`: Healthcheck.
- `GET /api/presets`: Curated demo locations with contrasting risk archetypes.
- `POST /api/analyze`: Main intelligence radar endpoint.
  - Supports query parameter `?refresh=true` to invalidate cache.
  - Key payload parameters: `location`, `lat`, `lng`, `intent` (`warehouse` | `retail` | `plot`).

---

## 🛡️ Repository Structure & Branch Plan

```text
plottwist/
├── .env.example
├── .gitignore
├── README.md
├── SPEC.md
├── backend/
│   ├── __init__.py
│   ├── main.py                # FastAPI entry point with CORS & routes
│   ├── schemas.py             # Pydantic v2 data models
│   ├── cache.py               # Disk cache & fallback preset generator
│   ├── requirements.txt       # Python dependencies
│   ├── cache/                 # Cached analysis JSON storage
│   ├── serpapi_collector.py   # (Owned by Teammate 1)
│   └── synthesizer.py         # (Owned by Teammate 2)
└── frontend/                  # (Owned by Teammate 3)
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── components/
        │   ├── MapCanvas.jsx
        │   ├── FrictionFeed.jsx
        │   └── ReceiptDrawer.jsx
        └── data/
            └── sampleData.js
```

---

## 🌿 Git Branches & Ownership
- `feat/api-cache-setup`: FastAPI backend, schemas, disk cache, demo presets, documentation.
- `feat/map-receipt-ui`: React + Vite + Leaflet UI, friction feed, receipt slide-over drawer.
- `feat/serpapi-collector`: SerpAPI collector pipeline.
- `feat/synthesizer`: LLM / Gemini synthesis logic.
