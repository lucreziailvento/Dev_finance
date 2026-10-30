# DevFinance

Web app per il controllo delle finanze personali: import degli estratti conto
(Fineco `.xlsx`, Revolut `.csv`), classificazione automatica delle transazioni,
dashboard mensile, analisi storica, budget e piano di investimento ETF.

```
backend/    FastAPI + SQLite locale / PostgreSQL (Neon in produzione)
frontend/   React 19 + Vite + Tailwind (build servita dal backend)
mobile/     Wrapper Expo/WebView
api/        Entry point Vercel
```

## Avvio locale

```bash
pip install -r requirements.txt
cd frontend && npm ci && npm run build && cd ..
python3 -m backend.app
# http://localhost:8000
```

Il backend serve sia le API (`/api/*`) sia il frontend compilato da
`frontend/dist`. Per lo sviluppo della UI: `cd frontend && npm run dev`
(Vite su :5173, le API arrivano dal backend su :8000 tramite `devfinance_api_url`).

## Database

Il backend sceglie il database all'avvio:

| Condizione              | Database                          |
| ----------------------- | --------------------------------- |
| `DATABASE_URL` impostata | PostgreSQL (Neon) — usato su Vercel |
| `DATABASE_URL` assente   | `backend/portfolio_v2.db` (SQLite) |

`init_db()` crea solo tabelle/indici mancanti: non modifica né cancella dati.

### Backup prima di toccare lo schema

```bash
python3 -m backend.scripts.backup_db
# SQLite  -> backups/<timestamp>/portfolio_v2.db + dump .sql
# Postgres -> backups/<timestamp>/neon.sql (richiede pg_dump)
```

## Test

```bash
pip install -r requirements-dev.txt
python3 -m pytest
```

- `backend/tests/test_golden.py` confronta i numeri esposti dall'API con
  `golden_baseline.json`, generato sul database locale: serve a dimostrare che
  un refactoring **non cambia i valori visti dall'utente**.
- `backend/tests/test_contracts.py` verifica che i campi letti dalla UI
  esistano davvero.

Se la logica di calcolo cambia **intenzionalmente**, rigenera il baseline e
revisiona il diff prima del commit:

```bash
python3 -m backend.tests.golden
git diff backend/tests/golden_baseline.json
```

Attenzione: il baseline è legato al contenuto di `portfolio_v2.db`. Dopo un
nuovo import di transazioni va rigenerato.

## Deploy (Vercel)

`vercel.json` compila il frontend e monta `api/index.py`. Le variabili
d'ambiente (`DATABASE_URL`) vanno impostate nel progetto Vercel, non committate.
