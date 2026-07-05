# FinScreen — FastAPI Backend

Self-contained Python/FastAPI backend server.
Run everything from **inside this `backend/` folder**.

---

## Project Structure

```
backend/
├── main.py                 ← App entry point
├── requirements.txt        ← Python dependencies
├── .env                    ← Environment variables (gitignored)
├── finscreen.db            ← SQLite database (gitignored, auto-created)
├── venv/                   ← Python virtualenv (gitignored)
│
├── core/
│   ├── config.py           ← Settings (pydantic-settings, loads .env)
│   ├── database.py         ← SQLAlchemy async models
│   └── security.py         ← JWT token helpers
│
├── middleware/
│   └── auth.py             ← JWT auth middleware / dependency
│
├── services/
│   ├── finedge_service.py  ← FinEdge proxy + LRU cache + retry
│   └── scheduler.py        ← APScheduler cron alert jobs
│
└── routers/
    ├── auth.py             ← POST /api/auth/login, /signup, /logout
    ├── finedge.py          ← GET  /api/finscreen/... (all market data)
    ├── watchlist.py        ← CRUD /api/watchlists/
    ├── screener.py         ← POST /api/screener/run + saved screens
    ├── payments.py         ← POST /api/payments/initiate (PayU)
    ├── portfolio.py        ← CRUD /api/portfolio/
    ├── queries.py          ← CRUD /api/queries/
    └── admin.py            ← GET  /api/admin/
```

---

## Setup & Run

### Step 1 — Create virtualenv and install dependencies

```bash
cd backend

python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS / Linux

pip install -r requirements.txt
```

### Step 2 — Configure environment

Copy `.env` from the root example:
```bash
cp ../.env.example .env
```

Edit `.env` and set your real FinEdge API keys and JWT secrets.

### Step 3 — Start the server

```bash
# Development (auto-reload on file changes)
uvicorn main:app --reload --port 8000

# Production (multiple workers)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

SQLite database (`finscreen.db`) is created automatically on first run.

---

## API Docs

| URL | Description |
|---|---|
| http://localhost:8000/docs | Swagger UI (interactive) |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Health check |

---

## Route Reference

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login + set auth cookies |
| GET | `/api/auth/profile` | Get current user (or guest) |
| POST | `/api/auth/logout` | Logout + clear cookies |
| GET | `/api/finscreen/...` | All market data (FinEdge proxy) |
| GET/POST | `/api/watchlists/` | Watchlist CRUD |
| POST | `/api/screener/run` | Run stock screener |
| GET | `/api/screener/saved` | Saved screens |
| POST | `/api/payments/initiate` | PayU payment initiation |
| GET/POST | `/api/portfolio/` | Portfolio CRUD |
| GET/POST | `/api/queries/` | Saved queries CRUD |
| GET | `/api/admin/` | Admin dashboard |

---

## Production — Switch to PostgreSQL

In `.env`:
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/finscreen
```
