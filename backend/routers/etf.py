from fastapi import APIRouter, Query

from ..db import ALL_TRANSACTIONS, db_cursor, execute
from ..services.finance import build_clean_monthly_series, median, round2, round_to_10

router = APIRouter()

DEFAULT_BUFFER = 0.20


@router.get("/api/etf-plan")
def etf_plan(
    months: int = Query(default=12, ge=1, le=48),
    buffer: float = Query(default=DEFAULT_BUFFER, ge=0, le=0.5),
):
    with db_cursor() as cursor:
        rows = [
            dict(row)
            for row in execute(
                cursor,
                f"""
                SELECT date, amount, description, macro_category, micro_category
                FROM {ALL_TRANSACTIONS} AS all_transactions
                WHERE date IS NOT NULL AND date != ''
                """,
            ).fetchall()
        ]

    series = build_clean_monthly_series(rows)[-months:]

    investable_values = [m["investable"] for m in series if m["investable"] >= 0]
    med_investable = median(investable_values)
    recommended = max(0, round_to_10(med_investable * (1 - buffer)))

    total_invested = round2(sum(m["invested"] for m in series))
    months_invested = sum(1 for m in series if m["invested"] > 0)

    return {
        "months": months,
        "buffer": buffer,
        "med_income": round2(median([m["income"] for m in series])),
        "med_expenses": round2(median([m["expenses"] for m in series])),
        "med_invested": round2(median([m["invested"] for m in series])),
        "med_investable": round2(med_investable),
        "recommended_monthly": recommended,
        # Campi aggiunti: prima il frontend li leggeva ma non esistevano.
        # `total_invested` è il lordo versato nel periodo analizzato (vendite escluse).
        "total_invested": total_invested,
        "months_invested": months_invested,
        "years_invested": round(months_invested / 12, 2),
        "series": series,
    }
