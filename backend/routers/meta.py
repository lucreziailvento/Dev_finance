from datetime import date

from fastapi import APIRouter

from ..db import ALL_TRANSACTIONS, db_cursor, execute
from ..services.periods import parse_date

router = APIRouter()


@router.get("/api/meta")
def meta():
    """Stato dei dati: serve alla UI per non mostrare mesi vuoti."""
    with db_cursor() as cursor:
        row = execute(
            cursor,
            f"""
            SELECT MIN(date) AS first_date, MAX(date) AS last_date,
                   COUNT(*) AS total
            FROM {ALL_TRANSACTIONS} AS all_transactions
            WHERE date IS NOT NULL AND date != ''
            """,
        ).fetchone()
        manual = execute(cursor, "SELECT COUNT(*) AS cnt FROM manual_records").fetchone()
        forecasts = execute(cursor, "SELECT COUNT(*) AS cnt FROM daily_forecast").fetchone()
        rules = execute(cursor, "SELECT COUNT(*) AS cnt FROM category_rules").fetchone()

    last_date = row["last_date"]
    latest_month = last_date[:7] if last_date else None
    stale_days = None
    last_parsed = parse_date(last_date)
    if last_parsed is not None:
        stale_days = (date.today() - last_parsed).days

    return {
        "first_date": row["first_date"],
        "last_date": last_date,
        "latest_month": latest_month,
        "data_stale_days": stale_days,
        "transactions": int(row["total"] or 0),
        "manual_records": int(manual["cnt"] or 0),
        "forecast_days": int(forecasts["cnt"] or 0),
        "rules": int(rules["cnt"] or 0),
        "today": date.today().isoformat(),
    }
