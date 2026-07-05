# FinScreen ⚡

A high-performance, production-ready institutional stock screener and financial analytics platform.

This repository consists of two fully self-contained workspaces:

| Workspace | Stack | Port |
|---|---|---|
| `backend/` | Python · FastAPI · SQLAlchemy · SQLite | **8000** |
| `frontend/` | React · TypeScript · Vite · Tailwind CSS v4 · Redux Saga | **3000** |

Each workspace is **completely independent** — you run it from inside its own folder, not from the repo root.

---

## 🏗️ Architecture

```
finscreen/
├── backend/          ← FastAPI server (self-contained Python project)
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── venv/         ← Python virtualenv (gitignored)
│   ├── core/         ← config, database models, JWT security
│   ├── middleware/   ← auth middleware
│   ├── routers/      ← API route handlers
│   └── services/     ← FinEdge proxy, scheduler
│
└── frontend/         ← React + Vite client (self-contained Node project)
    ├── package.json
    ├── vite.config.ts
    ├── .env.local
    ├── src/
    └── node_modules/ ← (gitignored)
```

```mermaid
graph TD
    A[React Client :3000] <-->|Vite proxy /api| B[FastAPI Backend :8000]
    B -->|Rotating Key Proxy| C[FinEdge External Data API]
    B -->|Webhook Handshake| D[PayU Gateway]
    B <-->|SQLAlchemy ORM| E[SQLite / PostgreSQL]
```

---

## 🛠️ Setup

### Prerequisites
- **Python**: 3.11 or higher
- **Node.js**: v20.x or higher / **npm**: v10.x or higher

### 1. Configure environment variables

```bash
# Copy the example file and fill in your values
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

Edit `backend/.env` with your real FinEdge API keys, JWT secrets, etc.
Edit `frontend/.env.local` — only `VITE_API_URL` is needed (default is `http://localhost:8000/api`).

---

## 🚀 Running

### Backend — run from inside `backend/`

```bash
cd backend

# First time: create a virtualenv and install dependencies
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt

# Start the development server (auto-reload)
uvicorn main:app --reload --port 8000
```

FastAPI automatically creates the SQLite database (`backend/finscreen.db`) on first run.

**API Docs (auto-generated):**
- Swagger UI: http://localhost:8000/docs
- ReDoc:       http://localhost:8000/redoc
- Health:      http://localhost:8000/health

### Frontend — run from inside `frontend/`

```bash
cd frontend

# First time: install dependencies
npm install

# Start the Vite dev server
npm run dev
```

The frontend runs at **http://localhost:3000** and proxies all `/api` requests to `localhost:8000`.

---

## 🔧 Other Frontend Commands

```bash
cd frontend

npm run build      # production build → frontend/dist/
npm run preview    # preview the production build locally
npm run lint       # ESLint
npm run test       # Vitest test suite
```

---

## 🏭 Production

### Backend — switch to PostgreSQL

In `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/finscreen
```

Run with multiple workers:
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend — build static assets
```bash
cd frontend
npm run build
# Serve dist/ with nginx or any static host
```

---

## 🔒 Security Notes
- **Never commit secrets** — `.env` and `.env.local` are gitignored
- JWT tokens use `httpOnly` secure cookies — no `localStorage` XSS vectors
- Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in production
