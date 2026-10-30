from fastapi import APIRouter

from ..db import ALL_TRANSACTIONS, db_cursor, execute, write
from ..schemas import ForecastEntry
from ..services.finance import round2

router = APIRouter()

ACTUALS_SQL = f"""
    SELECT date,
           COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS actual_income,
           COALESCE(SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                             THEN ABS(amount) ELSE 0 END), 0) AS actual_expenses
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE SUBSTR(date, 1, 7) = %s
    GROUP BY date
    ORDER BY date
"""


@router.get("/api/forecast/{month}")
def get_forecast(month: str):
    with db_cursor() as cursor:
        forecasts = [
            dict(row)
            for row in execute(
                cursor,
                """
                SELECT date, planned_income, planned_expenses, notes
                FROM daily_forecast
                WHERE SUBSTR(date, 1, 7) = %s
                ORDER BY date
                """,
                (month,),
            ).fetchall()
        ]
        actuals = {
            row["date"]: {
                "actual_income": round2(row["actual_income"]),
                "actual_expenses": round2(row["actual_expenses"]),
            }
            for row in execute(cursor, ACTUALS_SQL, (month,)).fetchall()
        }
    return {"forecasts": forecasts, "actuals": actuals}


@router.post("/api/forecast")
def upsert_forecast(payload: ForecastEntry):
    write(
        """
        INSERT INTO daily_forecast (date, planned_income, planned_expenses, notes)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT(date) DO UPDATE SET
            planned_income = excluded.planned_income,
            planned_expenses = excluded.planned_expenses,
            notes = excluded.notes
        """,
        (payload.date, payload.planned_income, payload.planned_expenses, payload.notes),
    )
    return {"status": "success"}


@router.delete("/api/forecast/{date}")
def delete_forecast(date: str):
    write("DELETE FROM daily_forecast WHERE date = %s", (date,))
    return {"status": "success"}
