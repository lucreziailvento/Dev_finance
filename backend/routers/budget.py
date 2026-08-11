from fastapi import APIRouter

from ..db import get_conn_and_cursor, commit_and_close, execute
from ..schemas import BudgetAllocationEntry
from ..services.finance import median

router = APIRouter()


@router.get("/api/budget-averages")
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


@router.get("/api/budget-allocations/{month}")
def get_allocations(month: str):
    conn, c = get_conn_and_cursor()
    execute(c, "SELECT micro_category, planned_amount FROM budget_allocations WHERE month = %s", (month,))
    rows = {r["micro_category"]: r["planned_amount"] for r in c.fetchall()}
    commit_and_close(conn)
    return rows


@router.put("/api/budget-allocations/{month}")
def save_allocations(month: str, payload: list[BudgetAllocationEntry]):
    conn, c = get_conn_and_cursor()
    execute(c, "DELETE FROM budget_allocations WHERE month = %s", (month,))
    for entry in payload:
        if entry.planned_amount > 0:
            execute(c, "INSERT INTO budget_allocations (month, micro_category, planned_amount) VALUES (%s, %s, %s)",
                    (month, entry.micro_category, entry.planned_amount))
    commit_and_close(conn)
    return {"status": "success"}
