from fastapi import APIRouter

from ..db import get_conn_and_cursor, commit_and_close, execute

router = APIRouter()


@router.get("/api/dashboard/{month}")
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
