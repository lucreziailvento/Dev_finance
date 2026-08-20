from fastapi import APIRouter, Query

from ..db import get_conn_and_cursor, commit_and_close, execute

router = APIRouter()


@router.get("/api/trend")
def trend(months: int = Query(default=24, ge=1, le=60)):
    conn, c = get_conn_and_cursor()
    execute(c, """
        SELECT SUBSTR(date, 1, 7) as mo,
               SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti') THEN ABS(amount) ELSE 0 END) as expenses,
               SUM(CASE WHEN macro_category = 'Investimenti' THEN ABS(amount) ELSE 0 END) as invested
        FROM (
            SELECT date, amount, macro_category FROM transactions
            UNION ALL
            SELECT date, amount, macro_category FROM manual_records
        )
        WHERE date IS NOT NULL AND date != ''
        GROUP BY mo ORDER BY mo DESC
        LIMIT %s
    """, (months,))
    rows = [dict(r) for r in c.fetchall()]
    commit_and_close(conn)
    series = []
    for r in reversed(rows):
        income = round(float(r["income"]), 2)
        expenses = round(float(r["expenses"]), 2)
        invested = round(float(r["invested"]), 2)
        series.append({
            "month": r["mo"],
            "income": income,
            "expenses": expenses,
            "invested": invested,
            "savings": round(income - expenses, 2),
        })
    return {"series": series}


@router.get("/api/stats")
def stats():
    conn, c = get_conn_and_cursor()
    execute(c, """
        SELECT SUBSTR(date, 1, 7) as mo, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
               SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno','Investimenti') THEN ABS(amount) ELSE 0 END) as expenses,
               SUM(CASE WHEN macro_category = 'Investimenti' THEN ABS(amount) ELSE 0 END) as invested,
               SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_out
        FROM (
            SELECT date, amount, macro_category FROM transactions
            UNION ALL
            SELECT date, amount, macro_category FROM manual_records
        )
        WHERE date IS NOT NULL AND date != ''
        GROUP BY mo ORDER BY mo
    """)
    monthly = [dict(r) for r in c.fetchall()]

    execute(c, """
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
        GROUP BY mo, micro_category ORDER BY mo, tot DESC
    """)
    cat_rows = [dict(r) for r in c.fetchall()]

    execute(c, """
        SELECT SUBSTR(date, 1, 7) as mo, source,
               COUNT(*) as cnt, SUM(ABS(amount)) as tot
        FROM (
            SELECT date, amount, source FROM transactions
            UNION ALL
            SELECT date, amount, 'Manuale' as source FROM manual_records
        )
        WHERE date IS NOT NULL AND date != ''
        GROUP BY mo, source ORDER BY mo
    """)
    source_rows = [dict(r) for r in c.fetchall()]

    execute(c, """
        SELECT description, COUNT(*) as cnt, SUM(ABS(amount)) as tot
        FROM (
            SELECT description, amount FROM transactions
            UNION ALL
            SELECT description, amount FROM manual_records
        )
        WHERE amount < 0
        GROUP BY description ORDER BY tot DESC LIMIT 15
    """)
    top_desc = [dict(r) for r in c.fetchall()]

    commit_and_close(conn)

    cat_per_month = {}
    for r in cat_rows:
        cat_per_month.setdefault(r["mo"], []).append({"name": r["micro_category"], "amount": round(float(r["tot"]), 2)})

    source_per_month = {}
    for r in source_rows:
        source_per_month.setdefault(r["mo"], []).append({"source": r["source"], "count": r["cnt"], "amount": round(float(r["tot"]), 2)})

    for m in monthly:
        m["income"] = round(float(m["income"]), 2)
        m["expenses"] = round(float(m["expenses"]), 2)
        m["invested"] = round(float(m["invested"]), 2)
        m["total_out"] = round(float(m["total_out"]), 2)

    return {
        "monthly": monthly,
        "categories_per_month": cat_per_month,
        "sources_per_month": source_per_month,
        "top_descriptions": [{"description": r["description"], "count": r["cnt"], "total": round(float(r["tot"]), 2)} for r in top_desc],
    }
