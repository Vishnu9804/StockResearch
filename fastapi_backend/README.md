# FinScreen — FastAPI Backend

Complete Python replacement for the Express backend.
Replaces: `backend/` (Node.js/Express/Prisma/TypeScript)
Keeps:    `frontend/` (React/Vite — zero changes except `.env.local`)

---

## Project Structure

```
fastapi_backend/
├── main.py                        ← App entry point (replaces app.ts + index.ts)
├── requirements.txt
├── .env                           ← Environment variables
│
├── core/
│   ├── config.py                  ← Settings (replaces config/index.ts)
│   ├── database.py                ← SQLAlchemy models (replaces prisma/schema.prisma)
│   └── security.py                ← JWT helpers (replaces utils/token.ts)
│
├── middleware/
│   └── auth.py                    ← JWT auth middleware (replaces middlewares/auth.ts)
│
├── services/
│   ├── finedge_service.py         ← FinEdge proxy + cache + retry (replaces finedge.service.ts)
│   └── scheduler.py               ← Cron alerts (replaces services/scheduler.ts)
│
└── routers/
    ├── auth.py                    ← Auth routes (replaces routes/auth.ts + controllers/auth.ts)
    ├── finedge.py                 ← All FinEdge routes (replaces routes/finedge.ts + controllers/finedge.ts)
    ├── watchlist.py               ← Watchlist CRUD (replaces routes/watchlist.ts + controllers/watchlist.ts)
    ├── screener.py                ← Screener + notifications (replaces routes/screener.ts + controllers/screener.ts)
    └── payments.py                ← PayU payments (replaces routes/payments.ts)
```

---

## Setup & Run

### Step 1 — Install Python dependencies
```bash
cd fastapi_backend/
pip install -r requirements.txt
```

### Step 2 — Configure environment
Edit `.env` and set your real FinEdge API keys:
```
FINEDGE_API_KEY_1=your_real_key_1
FINEDGE_API_KEY_2=your_real_key_2
FINEDGE_API_KEY_3=your_real_key_3
```

### Step 3 — Run FastAPI
```bash
uvicorn main:app --reload --port 8000
```

FastAPI will auto-create the SQLite database on first run.

### Step 4 — Update frontend
Copy `frontend.env.local` → `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000/api
```

### Step 5 — Run frontend (unchanged)
```bash
cd frontend/
npm run dev
```

---

## API Docs (Free with FastAPI — Express didn't have this!)
- Swagger UI: http://localhost:8000/docs
- ReDoc:       http://localhost:8000/redoc
- Health:      http://localhost:8000/health

---

## Route Mapping (Express → FastAPI)

| Express Route               | FastAPI Route               |
|-----------------------------|-----------------------------|
| POST /api/auth/signup       | POST /api/auth/signup       |
| POST /api/auth/login        | POST /api/auth/login        |
| GET  /api/auth/profile      | GET  /api/auth/profile      |
| POST /api/auth/logout       | POST /api/auth/logout       |
| GET  /api/finedge/stock-symbols        | GET /api/finedge/stock-symbols       |
| GET  /api/finedge/company/:s/profile   | GET /api/finedge/company/{s}/profile |
| GET  /api/finedge/company/:s/financials/pl | GET /api/finedge/company/{s}/financials/pl |
| GET  /api/finedge/company/:s/ratios    | GET /api/finedge/company/{s}/ratios  |
| GET  /api/finedge/market/indices       | GET /api/finedge/market/indices      |
| ... (all routes identical, : → {})   |                             |
| GET  /api/watchlists        | GET  /api/watchlists        |
| POST /api/watchlists        | POST /api/watchlists        |
| POST /api/screener/run      | POST /api/screener/run      |
| GET  /api/screener/saved    | GET  /api/screener/saved    |
| POST /api/payments/initiate | POST /api/payments/initiate |

---

## Production Deployment

Switch SQLite → PostgreSQL in `.env`:
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/finscreen
```

Run with multiple workers:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```
