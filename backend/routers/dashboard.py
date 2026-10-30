from fastapi import APIRouter, HTTPException

from ..db import ALL_TRANSACTIONS, db_cursor, execute
from ..services.finance import round2

router = APIRouter()

# Una sola query invece di quattro: stessi totali, un quarto delle connessioni.
TOTALS_SQL = f"""
    SELECT
        COALESCE(SUM(CASE WHEN macro_category = 'Entrate' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                          THEN ABS(amount) ELSE 0 END), 0) AS expenses,
        COALESCE(SUM(CASE WHEN macro_category = 'Investimenti' THEN ABS(amount) ELSE 0 END), 0) AS invested,
        COALESCE(SUM(CASE WHEN macro_category = 'Trasferimento Interno' THEN ABS(amount) ELSE 0 END), 0) AS transfers
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE SUBSTR(date, 1, 7) = %s
"""

CATEGORIES_SQL = f"""
    SELECT micro_category, SUM(ABS(amount)) AS tot
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE SUBSTR(date, 1, 7) = %s
      AND amount < 0
      AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
    GROUP BY micro_category
    ORDER BY tot DESC
"""

TRANSACTIONS_SQL = f"""
    SELECT date, description, amount, source, macro_category, micro_category, hash_id
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE SUBSTR(date, 1, 7) = %s
    ORDER BY date DESC, hash_id DESC
"""


@router.get("/api/dashboard/{month}")
def dashboard(month: str):
    try:
        with db_cursor() as cursor:
            totals = execute(cursor, TOTALS_SQL, (month,)).fetchone()
            income = round2(totals["income"])
            expenses = round2(totals["expenses"])
            invested = round2(totals["invested"])
            transfers = round2(totals["transfers"])

            categories = [
                {"name": row["micro_category"], "amount": round2(row["tot"])}
                for row in execute(cursor, CATEGORIES_SQL, (month,)).fetchall()
            ]
            transactions = [
                dict(row) for row in execute(cursor, TRANSACTIONS_SQL, (month,)).fetchall()
            ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    savings = round2(income - expenses)
    return {
        "income": income,
        "expenses": expenses,
        "savings": savings,
        "invested": invested,
        "investable": round2(savings - invested),
        "transfers": transfers,
        "categories": categories,
        "transactions": transactions,
    }
