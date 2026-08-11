from fastapi import APIRouter

from ..db import get_conn_and_cursor, commit_and_close, execute
from ..schemas import ForecastEntry

router = APIRouter()


@router.get("/api/forecast/{month}")
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


@router.post("/api/forecast")
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


@router.delete("/api/forecast/{date}")
def delete_forecast(date: str):
    conn, c = get_conn_and_cursor()
    execute(c, "DELETE FROM daily_forecast WHERE date = %s", (date,))
    commit_and_close(conn)
    return {"status": "success"}
