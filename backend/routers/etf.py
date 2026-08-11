from fastapi import APIRouter, Query

from ..db import get_conn_and_cursor, commit_and_close, execute
from ..services.finance import build_clean_monthly_series, median, round_to_10

router = APIRouter()

DEFAULT_BUFFER = 0.20


@router.get("/api/etf-plan")
def etf_plan(months: int = Query(default=12, ge=1, le=48), buffer: float = Query(default=DEFAULT_BUFFER, ge=0, le=0.5)):
    conn, c = get_conn_and_cursor()
    execute(c, """
        SELECT date, amount, description, macro_category, micro_category FROM transactions
        UNION ALL
        SELECT date, amount, description, macro_category, micro_category FROM manual_records
        WHERE date IS NOT NULL AND date != ''
    """)
    rows = [dict(r) for r in c.fetchall()]
    commit_and_close(conn)

    series = build_clean_monthly_series(rows)[-months:]

    investable_vals = [m["investable"] for m in series if m["investable"] >= 0]
    med_investable = median(investable_vals)
    recommended = max(0, round_to_10(med_investable * (1 - buffer)))

    return {
        "months": months,
        "buffer": buffer,
        "med_income": round(median([m["income"] for m in series]), 2),
        "med_expenses": round(median([m["expenses"] for m in series]), 2),
        "med_invested": round(median([m["invested"] for m in series]), 2),
        "med_investable": round(med_investable, 2),
        "recommended_monthly": recommended,
        "series": series,
    }
