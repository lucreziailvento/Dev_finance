import os
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import FileResponse
try:
    from parser import esegui_etl_storico
    from db import get_conn_and_cursor, commit_and_close, execute, init_db, insert_on_conflict
except ImportError:
    from backend.parser import esegui_etl_storico
    from backend.db import get_conn_and_cursor, commit_and_close, execute, init_db, insert_on_conflict

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(title="DevFinance Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIST = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")
os.makedirs(DATA_DIR, exist_ok=True)

MACRO_BY_MICRO = {
    "Entrate_Lavoro": "Entrate",
    "Altre Entrate": "Entrate",
    "Investimenti & Risparmio": "Investimenti",
    "Giroconto": "Trasferimento Interno",
    "Svago & Ristorazione": "Spese Variabili",
    "Shopping & Lifestyle": "Spese Variabili",
    "Trasporti & Viaggi": "Spese Variabili",
    "Sport & Salute": "Spese Variabili",
    "Aperitivi": "Spese Variabili",
    "Regali": "Spese Variabili",
    "Casa & Arredamento": "Spese Variabili",
    "Spesa Alimentare": "Spese Fisse",
    "Affitto & Condominio": "Spese Fisse",
    "Utenze & Bollette": "Spese Fisse",
    "Abbonamenti Digitali": "Spese Fisse",
    "Altro": "Spese Variabili",
}

def get_macro(micro):
    return MACRO_BY_MICRO.get(micro, "Spese Variabili")

# ── Pydantic models ──

class DescriptionUpdate(BaseModel):
    hash_id: str
    new_description: str

class CategoryUpdate(BaseModel):
    hash_id: str
    new_micro_category: str

class ForecastEntry(BaseModel):
    date: str
    planned_income: float = 0
    planned_expenses: float = 0
    notes: str = ''

class BudgetAllocationEntry(BaseModel):
    micro_category: str
    planned_amount: float

class ManualRecord(BaseModel):
    date: str
    description: str
    amount: float
    micro_category: str
    type: str

# ── INGEST ──

@app.post("/api/ingest")
async def ingest(fineco_file: UploadFile = File(...), revolut_file: UploadFile = File(...)):
    try:
        path_f = os.path.join(DATA_DIR, "uploaded_fineco.xlsx")
        path_r = os.path.join(DATA_DIR, "uploaded_revolut.csv")
        with open(path_f, "wb") as f:
            shutil.copyfileobj(fineco_file.file, f)
        with open(path_r, "wb") as f:
            shutil.copyfileobj(revolut_file.file, f)
        df = esegui_etl_storico(path_f, path_r)
        if df.empty:
            return {"status": "success", "records_added": 0}
        df_clean = df.drop_duplicates(subset=['hash_id'])
        conn, c = get_conn_and_cursor()
        added = 0
        sql = insert_on_conflict("transactions",
            ["date", "description", "amount", "source", "macro_category", "micro_category", "hash_id"],
            None, "hash_id")
        for _, row in df_clean.iterrows():
            execute(c, sql, (row['date'], row['description'], row['amount'], row['source'], row['macro_category'], row['micro_category'], row['hash_id']))
            if c.rowcount > 0:
                added += 1
        commit_and_close(conn)
        return {"status": "success", "records_added": added}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── MANUAL RECORDS ──

@app.post("/api/manual-records")
def add_manual(payload: ManualRecord):
    try:
        amount = abs(payload.amount) if payload.type == 'entrata' else -abs(payload.amount)
        macro = "Entrate" if payload.type == 'entrata' else get_macro(payload.micro_category)
        conn, c = get_conn_and_cursor()
        execute(c, "INSERT INTO manual_records (date, description, amount, macro_category, micro_category) VALUES (%s, %s, %s, %s, %s)",
                (payload.date, payload.description, amount, macro, payload.micro_category))
        commit_and_close(conn)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/manual-records")
def list_manual():
    conn, c = get_conn_and_cursor()
    execute(c, "SELECT id, date, description, amount, macro_category, micro_category FROM manual_records ORDER BY date DESC")
    rows = [dict(r) for r in c.fetchall()]
    commit_and_close(conn)
    return rows

@app.delete("/api/manual-records/{id}")
def delete_manual(id: int):
    conn, c = get_conn_and_cursor()
    execute(c, "DELETE FROM manual_records WHERE id = %s", (id,))
    commit_and_close(conn)
    return {"status": "success"}

@app.put("/api/manual-records/{id}")
def update_manual(id: int, payload: ManualRecord):
    conn, c = get_conn_and_cursor()
    amount = abs(payload.amount) if payload.type == 'entrata' else -abs(payload.amount)
    macro = "Entrate" if payload.type == 'entrata' else get_macro(payload.micro_category)
    execute(c, "UPDATE manual_records SET date = %s, description = %s, amount = %s, macro_category = %s, micro_category = %s WHERE id = %s",
            (payload.date, payload.description, amount, macro, payload.micro_category, id))
    commit_and_close(conn)
    return {"status": "success"}

# ── FORECAST ──

@app.get("/api/forecast/{month}")
def get_forecast(month: str):
    conn, c = get_conn_and_cursor()
    execute(c, """
        SELECT date, planned_income, planned_expenses, notes
        FROM daily_forecast
        WHERE SUBSTR(date, 1, 7) = %s
        ORDER BY date
    """, (month,))
    forecasts = [dict(r) for r in c.fetchall()]
    execute(c, """
        SELECT date,
               COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as actual_income,
               COALESCE(SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti') THEN ABS(amount) ELSE 0 END), 0) as actual_expenses
        FROM (
            SELECT date, amount, macro_category FROM transactions
            UNION ALL
            SELECT date, amount, macro_category FROM manual_records
        )
        WHERE SUBSTR(date, 1, 7) = %s
        GROUP BY date
        ORDER BY date
    """, (month,))
    actuals = {r["date"]: {"actual_income": round(r["actual_income"], 2), "actual_expenses": round(r["actual_expenses"], 2)} for r in c.fetchall()}
    commit_and_close(conn)
    return {"forecasts": forecasts, "actuals": actuals}

@app.post("/api/forecast")
def upsert_forecast(payload: ForecastEntry):
    conn, c = get_conn_and_cursor()
    execute(c, """
        INSERT INTO daily_forecast (date, planned_income, planned_expenses, notes)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT(date) DO UPDATE SET
            planned_income = excluded.planned_income,
            planned_expenses = excluded.planned_expenses,
            notes = excluded.notes
    """, (payload.date, payload.planned_income, payload.planned_expenses, payload.notes))
    commit_and_close(conn)
    return {"status": "success"}

@app.delete("/api/forecast/{date}")
def delete_forecast(date: str):
    conn, c = get_conn_and_cursor()
    execute(c, "DELETE FROM daily_forecast WHERE date = %s", (date,))
    commit_and_close(conn)
    return {"status": "success"}

# ── BUDGET AVERAGES & ALLOCATIONS ──

@app.get("/api/budget-averages")
def budget_averages():
    conn, c = get_conn_and_cursor()
    execute(c, """
        SELECT SUBSTR(date, 1, 7) as mo,
               SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti') THEN ABS(amount) ELSE 0 END) as expenses
        FROM (
            SELECT date, amount, macro_category FROM transactions
            UNION ALL
            SELECT date, amount, macro_category FROM manual_records
        )
        WHERE date IS NOT NULL AND date != ''
        GROUP BY mo ORDER BY mo
    """)
    months = [dict(r) for r in c.fetchall()]
    num_months = len(months)

    incomes = sorted([m["income"] for m in months]) if months else [0]
    expenses_list = sorted([m["expenses"] for m in months]) if months else [0]

    def median(arr):
        n = len(arr)
        if n == 0: return 0
        if n % 2 == 1: return arr[n // 2]
        return (arr[n // 2 - 1] + arr[n // 2]) / 2

    med_income = round(median(incomes), 2)
    med_expenses = round(median(expenses_list), 2)
    mean_income = round(sum(incomes) / len(incomes), 2) if incomes else 0
    mean_expenses = round(sum(expenses_list) / len(expenses_list), 2) if expenses_list else 0

    execute(c, """
        SELECT micro_category, mo, tot FROM (
            SELECT SUBSTR(date, 1, 7) as mo, micro_category,
                   SUM(ABS(amount)) as tot
            FROM (
                SELECT date, amount, micro_category FROM transactions
                WHERE amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                UNION ALL
                SELECT date, amount, micro_category FROM manual_records
                WHERE amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
            )
            WHERE date IS NOT NULL AND date != ''
            GROUP BY mo, micro_category
        ) ORDER BY micro_category, mo
    """)
    cat_rows = [dict(r) for r in c.fetchall()]

    cat_monthly = {}
    for r in cat_rows:
        cat_monthly.setdefault(r["micro_category"], {"values": []})
        cat_monthly[r["micro_category"]]["values"].append(r["tot"])
        cat_monthly[r["micro_category"]]["values"].sort()

    category_averages = []
    total_med_expenses = 0
    for cat, data in sorted(cat_monthly.items(), key=lambda x: median(x[1]["values"]), reverse=True):
        vals = data["values"]
        med = round(median(vals), 2)
        mean = round(sum(vals) / len(vals), 2) if vals else 0
        total_med_expenses += med
        category_averages.append({
            "name": cat, "med_amount": med, "mean_amount": mean, "months_active": len(vals),
        })

    for ca in category_averages:
        ca["pct"] = round((ca["med_amount"] / total_med_expenses) * 100, 1) if total_med_expenses else 0

    commit_and_close(conn)
    return {
        "med_monthly_income": med_income,
        "med_monthly_expenses": med_expenses,
        "mean_monthly_income": mean_income,
        "mean_monthly_expenses": mean_expenses,
        "num_months": num_months,
        "category_averages": category_averages,
    }

@app.get("/api/budget-allocations/{month}")
def get_allocations(month: str):
    conn, c = get_conn_and_cursor()
    execute(c, "SELECT micro_category, planned_amount FROM budget_allocations WHERE month = %s", (month,))
    rows = {r["micro_category"]: r["planned_amount"] for r in c.fetchall()}
    commit_and_close(conn)
    return rows

@app.put("/api/budget-allocations/{month}")
def save_allocations(month: str, payload: list[BudgetAllocationEntry]):
    conn, c = get_conn_and_cursor()
    execute(c, "DELETE FROM budget_allocations WHERE month = %s", (month,))
    for entry in payload:
        if entry.planned_amount > 0:
            execute(c, "INSERT INTO budget_allocations (month, micro_category, planned_amount) VALUES (%s, %s, %s)",
                    (month, entry.micro_category, entry.planned_amount))
    commit_and_close(conn)
    return {"status": "success"}

# ── UPDATE TRANSACTIONS ──

@app.post("/api/transactions/update-description")
def upd_desc(payload: DescriptionUpdate):
    conn, c = get_conn_and_cursor()
    execute(c, "UPDATE transactions SET description = %s WHERE hash_id = %s", (payload.new_description, payload.hash_id))
    commit_and_close(conn)
    return {"status": "success"}

@app.post("/api/transactions/update-category")
def upd_cat(payload: CategoryUpdate):
    micro = payload.new_micro_category
    macro = get_macro(micro)
    conn, c = get_conn_and_cursor()
    execute(c, "UPDATE transactions SET micro_category = %s, macro_category = %s WHERE hash_id = %s", (micro, macro, payload.hash_id))
    commit_and_close(conn)
    return {"status": "success", "macro": macro}

# ── DASHBOARD ──

@app.get("/api/dashboard/{month}")
def dashboard(month: str):
    try:
        conn, c = get_conn_and_cursor()
        execute(c, """
            SELECT COALESCE(SUM(amount), 0) as val FROM (
                SELECT amount FROM transactions WHERE SUBSTR(date, 1, 7) = %s AND macro_category = 'Entrate'
                UNION ALL
                SELECT amount FROM manual_records WHERE SUBSTR(date, 1, 7) = %s AND macro_category = 'Entrate'
            )
        """, (month, month))
        income = round(c.fetchone()["val"], 2)

        execute(c, """
            SELECT COALESCE(SUM(ABS(amount)), 0) as val FROM (
                SELECT amount FROM transactions
                WHERE SUBSTR(date, 1, 7) = %s AND amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                UNION ALL
                SELECT amount FROM manual_records
                WHERE SUBSTR(date, 1, 7) = %s AND amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
            )
        """, (month, month))
        expenses = round(c.fetchone()["val"], 2)

        execute(c, """
            SELECT COALESCE(SUM(ABS(amount)), 0) as val FROM (
                SELECT amount FROM transactions WHERE SUBSTR(date, 1, 7) = %s AND macro_category = 'Investimenti'
                UNION ALL
                SELECT amount FROM manual_records WHERE SUBSTR(date, 1, 7) = %s AND macro_category = 'Investimenti'
            )
        """, (month, month))
        invested = round(c.fetchone()["val"], 2)

        execute(c, """
            SELECT COALESCE(SUM(ABS(amount)), 0) as val FROM (
                SELECT amount FROM transactions WHERE SUBSTR(date, 1, 7) = %s AND macro_category = 'Trasferimento Interno'
                UNION ALL
                SELECT amount FROM manual_records WHERE SUBSTR(date, 1, 7) = %s AND macro_category = 'Trasferimento Interno'
            )
        """, (month, month))
        transfers = round(c.fetchone()["val"], 2)

        savings = round(income - expenses, 2)
        investable = round(savings - invested, 2)

        execute(c, """
            SELECT micro_category, SUM(ABS(amount)) as tot FROM (
                SELECT micro_category, amount FROM transactions
                WHERE SUBSTR(date, 1, 7) = %s AND amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                UNION ALL
                SELECT micro_category, amount FROM manual_records
                WHERE SUBSTR(date, 1, 7) = %s AND amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
            ) GROUP BY micro_category ORDER BY tot DESC
        """, (month, month))
        categories = [{"name": r["micro_category"], "amount": round(r["tot"], 2)} for r in c.fetchall()]

        execute(c, """
            SELECT date, description, amount, source, macro_category, micro_category, hash_id FROM (
                SELECT date, description, amount, source, macro_category, micro_category, hash_id
                FROM transactions WHERE SUBSTR(date, 1, 7) = %s
                UNION ALL
                SELECT date, description, amount, 'Manuale' as source, macro_category, micro_category, 'manual_' || id as hash_id
                FROM manual_records WHERE SUBSTR(date, 1, 7) = %s
            ) ORDER BY date DESC, hash_id DESC
        """, (month, month))
        transactions = [dict(r) for r in c.fetchall()]

        commit_and_close(conn)
        return {
            "income": income, "expenses": expenses, "savings": savings,
            "invested": invested, "investable": investable, "transfers": transfers,
            "categories": categories, "transactions": transactions,
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/health")
def health():
    return {"status": "ok"}

# ── Serve built frontend ──

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if not os.path.isdir(FRONTEND_DIST):
        return {"error": "Frontend not built"}
    file_path = os.path.join(FRONTEND_DIST, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
