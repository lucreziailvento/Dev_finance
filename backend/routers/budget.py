from fastapi import APIRouter

from ..db import ALL_TRANSACTIONS, db_cursor, execute
from ..schemas import BudgetAllocationEntry
from ..services.finance import median, round2

router = APIRouter()

MONTHLY_TOTALS_SQL = f"""
    SELECT SUBSTR(date, 1, 7) AS mo,
           SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
           SUM(CASE WHEN amount < 0 AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                    THEN ABS(amount) ELSE 0 END) AS expenses
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE date IS NOT NULL AND date != ''
    GROUP BY mo
    ORDER BY mo
"""

CATEGORY_MONTHLY_SQL = f"""
    SELECT micro_category, SUBSTR(date, 1, 7) AS mo, SUM(ABS(amount)) AS tot
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE date IS NOT NULL AND date != ''
      AND amount < 0
      AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
    GROUP BY micro_category, mo
"""


@router.get("/api/budget-averages")
def budget_averages():
    with db_cursor() as cursor:
        months = [dict(row) for row in execute(cursor, MONTHLY_TOTALS_SQL).fetchall()]
        category_rows = [dict(row) for row in execute(cursor, CATEGORY_MONTHLY_SQL).fetchall()]

    incomes = sorted([float(m["income"]) for m in months]) or [0]
    expenses = sorted([float(m["expenses"]) for m in months]) or [0]

    med_income = round2(median(incomes))
    med_expenses = round2(median(expenses))
    mean_income = round2(sum(incomes) / len(incomes))
    mean_expenses = round2(sum(expenses) / len(expenses))

    values_by_category = {}
    for row in category_rows:
        values_by_category.setdefault(row["micro_category"], []).append(float(row["tot"]))

    category_averages = []
    total_med_expenses = 0.0
    for name, values in sorted(
        values_by_category.items(), key=lambda item: median(item[1]), reverse=True
    ):
        med = round2(median(values))
        total_med_expenses += med
        category_averages.append({
            "name": name,
            "med_amount": med,
            "mean_amount": round2(sum(values) / len(values)),
            "months_active": len(values),
        })

    for row in category_averages:
        row["pct"] = (
            round((row["med_amount"] / total_med_expenses) * 100, 1) if total_med_expenses else 0
        )

    return {
        "med_monthly_income": med_income,
        "med_monthly_expenses": med_expenses,
        "mean_monthly_income": mean_income,
        "mean_monthly_expenses": mean_expenses,
        "num_months": len(months),
        "category_averages": category_averages,
    }


@router.get("/api/budget-allocations/{month}")
def get_allocations(month: str):
    with db_cursor() as cursor:
        rows = execute(
            cursor,
            "SELECT micro_category, planned_amount FROM budget_allocations WHERE month = %s",
            (month,),
        ).fetchall()
    return {row["micro_category"]: row["planned_amount"] for row in rows}


@router.put("/api/budget-allocations/{month}")
def save_allocations(month: str, payload: list[BudgetAllocationEntry]):
    # DELETE + INSERT nella stessa transazione: se qualcosa fallisce si torna
    # esattamente allo stato precedente, senza perdere il budget del mese.
    with db_cursor(commit=True) as cursor:
        execute(cursor, "DELETE FROM budget_allocations WHERE month = %s", (month,))
        for entry in payload:
            if entry.planned_amount > 0:
                execute(
                    cursor,
                    "INSERT INTO budget_allocations (month, micro_category, planned_amount) VALUES (%s, %s, %s)",
                    (month, entry.micro_category, entry.planned_amount),
                )
    return {"status": "success"}
