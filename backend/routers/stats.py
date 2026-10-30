from fastapi import APIRouter, Query

from ..db import ALL_TRANSACTIONS, db_cursor, execute
from ..services.finance import round2

router = APIRouter()


@router.get("/api/trend")
def trend(months: int = Query(default=24, ge=1, le=60)):
    sql = f"""
        SELECT SUBSTR(date, 1, 7) AS mo,
               SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
               SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                        THEN ABS(amount) ELSE 0 END) AS expenses,
               SUM(CASE WHEN macro_category = 'Investimenti' THEN ABS(amount) ELSE 0 END) AS invested
        FROM {ALL_TRANSACTIONS} AS all_transactions
        WHERE date IS NOT NULL AND date != ''
        GROUP BY mo
        ORDER BY mo DESC
        LIMIT %s
    """
    with db_cursor() as cursor:
        rows = [dict(row) for row in execute(cursor, sql, (months,)).fetchall()]

    series = []
    for row in reversed(rows):
        income = round2(row["income"])
        expenses = round2(row["expenses"])
        series.append({
            "month": row["mo"],
            "income": income,
            "expenses": expenses,
            "invested": round2(row["invested"]),
            "savings": round2(income - expenses),
        })
    return {"series": series}


@router.get("/api/stats")
def stats():
    monthly_sql = f"""
        SELECT SUBSTR(date, 1, 7) AS mo,
               SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
               SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                        THEN ABS(amount) ELSE 0 END) AS expenses,
               SUM(CASE WHEN macro_category = 'Investimenti' THEN ABS(amount) ELSE 0 END) AS invested,
               SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS total_out
        FROM {ALL_TRANSACTIONS} AS all_transactions
        WHERE date IS NOT NULL AND date != ''
        GROUP BY mo
        ORDER BY mo
    """
    category_sql = f"""
        SELECT SUBSTR(date, 1, 7) AS mo, micro_category, SUM(ABS(amount)) AS tot
        FROM {ALL_TRANSACTIONS} AS all_transactions
        WHERE date IS NOT NULL AND date != ''
          AND amount < 0
          AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
        GROUP BY mo, micro_category
        ORDER BY mo, tot DESC
    """
    source_sql = f"""
        SELECT SUBSTR(date, 1, 7) AS mo, source, COUNT(*) AS cnt, SUM(ABS(amount)) AS tot
        FROM {ALL_TRANSACTIONS} AS all_transactions
        WHERE date IS NOT NULL AND date != ''
        GROUP BY mo, source
        ORDER BY mo
    """
    description_sql = f"""
        SELECT description, COUNT(*) AS cnt, SUM(ABS(amount)) AS tot
        FROM {ALL_TRANSACTIONS} AS all_transactions
        WHERE amount < 0
        GROUP BY description
        ORDER BY tot DESC
        LIMIT 15
    """

    with db_cursor() as cursor:
        monthly = [dict(row) for row in execute(cursor, monthly_sql).fetchall()]
        category_rows = [dict(row) for row in execute(cursor, category_sql).fetchall()]
        source_rows = [dict(row) for row in execute(cursor, source_sql).fetchall()]
        top_rows = [dict(row) for row in execute(cursor, description_sql).fetchall()]

    categories_per_month = {}
    for row in category_rows:
        categories_per_month.setdefault(row["mo"], []).append(
            {"name": row["micro_category"], "amount": round2(row["tot"])}
        )

    sources_per_month = {}
    for row in source_rows:
        sources_per_month.setdefault(row["mo"], []).append(
            {"source": row["source"], "count": row["cnt"], "amount": round2(row["tot"])}
        )

    return {
        "monthly": [
            {
                "mo": row["mo"],
                "income": round2(row["income"]),
                "expenses": round2(row["expenses"]),
                "invested": round2(row["invested"]),
                "total_out": round2(row["total_out"]),
            }
            for row in monthly
        ],
        "categories_per_month": categories_per_month,
        "sources_per_month": sources_per_month,
        "top_descriptions": [
            {"description": row["description"], "count": row["cnt"], "total": round2(row["tot"])}
            for row in top_rows
        ],
    }
