"""Pianificazione e previsione.

- `build_plan`: piano del mese (giorno per giorno) + proiezione di fine mese.
- `generate_plan`: riempie il piano automaticamente da ricorrenze e medie,
  senza mai sovrascrivere le righe inserite a mano.
- `build_projection`: proiezione a N mesi basata sulle mediane storiche.
"""

from collections import defaultdict
from datetime import date, timedelta
from statistics import median

from ..db import ALL_TRANSACTIONS, db_cursor, execute
from ..services.finance import build_clean_monthly_series, round2
from ..services.periods import add_months, month_bounds, parse_date, parse_month
from ..services.recurring import detect_recurring, occurrences_in_month

HISTORY_DAYS = 800
AUTO_PREFIX = "[auto]"

HISTORY_SQL = f"""
    SELECT date, description, amount, source, macro_category, micro_category
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE date IS NOT NULL AND date != '' AND date >= %s
"""

ACTUALS_SQL = f"""
    SELECT date,
           COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS actual_income,
           COALESCE(SUM(CASE WHEN amount < 0
                             AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
                             THEN ABS(amount) ELSE 0 END), 0) AS actual_expenses
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE SUBSTR(date, 1, 7) = %s
    GROUP BY date
"""

CATEGORIES_SQL = f"""
    SELECT micro_category, SUM(ABS(amount)) AS tot
    FROM {ALL_TRANSACTIONS} AS all_transactions
    WHERE SUBSTR(date, 1, 7) = %s
      AND amount < 0
      AND macro_category NOT IN ('Trasferimento Interno', 'Investimenti')
    GROUP BY micro_category
"""

FORECAST_SQL = """
    SELECT date, planned_income, planned_expenses, notes
    FROM daily_forecast
    WHERE SUBSTR(date, 1, 7) = %s
    ORDER BY date
"""

ALLOCATIONS_SQL = """
    SELECT micro_category, planned_amount
    FROM budget_allocations
    WHERE month = %s
"""


def load_history_rows(today=None):
    today = today or date.today()
    start = (today - timedelta(days=HISTORY_DAYS)).isoformat()
    with db_cursor() as cursor:
        return [dict(row) for row in execute(cursor, HISTORY_SQL, (start,)).fetchall()]


def _history_medians(rows, today):
    current_month = today.strftime("%Y-%m")
    series = build_clean_monthly_series(rows)
    history = [row for row in series if row["month"] < current_month][-12:]
    if not history:
        history = series[-12:]
    return {
        "months": len(history),
        "income": median([row["income"] for row in history]) if history else 0.0,
        "expenses": median([row["expenses"] for row in history]) if history else 0.0,
        "invested": median([row["invested"] for row in history]) if history else 0.0,
    }


def _alerts(plan, today):
    alerts = []
    is_current = plan["month"] == today.strftime("%Y-%m")
    is_future = plan["month"] > today.strftime("%Y-%m")

    stale_days = plan.get("data_stale_days")
    if (is_current or is_future) and stale_days is not None and stale_days > 45:
        alerts.append({
            "level": "warning",
            "title": "Dati non aggiornati",
            "detail": (
                f"L'ultima transazione risale a {stale_days} giorni fa: "
                "importa gli estratti conto per un piano affidabile."
            ),
        })

    if is_current and not plan["has_plan"]:
        alerts.append({
            "level": "info",
            "title": "Nessun piano per questo mese",
            "detail": "Genera il piano automatico per vedere giorno per giorno quanto puoi spendere.",
        })

    if plan["projected_savings"] < 0:
        alerts.append({
            "level": "warning",
            "title": "Risparmio previsto negativo",
            "detail": f"Al ritmo attuale chiuderesti il mese a {plan['projected_savings']:.2f} €.",
        })

    if plan["budget"]["total_planned"] > 0 and plan["budget"]["spent"] > plan["budget"]["total_planned"]:
        alerts.append({
            "level": "warning",
            "title": "Budget superato",
            "detail": (
                f"Speso {plan['budget']['spent']:.2f} € su "
                f"{plan['budget']['total_planned']:.2f} € pianificati."
            ),
        })

    for allocation in plan["budget"]["allocations"]:
        if allocation["planned"] > 0 and allocation["spent"] > allocation["planned"]:
            alerts.append({
                "level": "warning",
                "title": f"Budget {allocation['name']} superato",
                "detail": f"{allocation['spent']:.2f} € su {allocation['planned']:.2f} €.",
            })

    upcoming = plan["upcoming_total"]
    if is_current and upcoming > 0:
        alerts.append({
            "level": "info",
            "title": "Scadenze nei prossimi 7 giorni",
            "detail": f"Circa {upcoming:.2f} € tra abbonamenti e pagamenti ricorrenti.",
        })

    if is_current and plan["has_plan"] and plan["days_left"] > 0 and plan["totals"]["planned_remaining"] <= 0:
        alerts.append({
            "level": "info",
            "title": "Piano incompleto",
            "detail": f"Restano {plan['days_left']} giorni senza spese pianificate.",
        })

    return alerts


def build_plan(month, today=None):
    today = today or date.today()
    year, month_number = parse_month(month)
    _, _, days_in_month = month_bounds(month)
    is_current = month == today.strftime("%Y-%m")
    is_future = (year, month_number) > (today.year, today.month)

    rows = load_history_rows(today)

    with db_cursor() as cursor:
        forecasts = [dict(row) for row in execute(cursor, FORECAST_SQL, (month,)).fetchall()]
        actuals = [dict(row) for row in execute(cursor, ACTUALS_SQL, (month,)).fetchall()]
        categories = [dict(row) for row in execute(cursor, CATEGORIES_SQL, (month,)).fetchall()]
        allocations = [dict(row) for row in execute(cursor, ALLOCATIONS_SQL, (month,)).fetchall()]

    recurring = [item for item in detect_recurring(rows, today) if item["active"]]

    # Quanto sono vecchi i dati: sotto il piano c'è sempre l'ultimo estratto conto.
    last_data_date = max(
        (moment for moment in (parse_date(row.get("date")) for row in rows) if moment),
        default=None,
    )
    data_stale_days = (today - last_data_date).days if last_data_date else None

    forecast_by_day = {int(row["date"][8:10]): row for row in forecasts}
    actual_by_day = {int(row["date"][8:10]): row for row in actuals}

    recurring_by_day = defaultdict(list)
    for item in recurring:
        for expected in occurrences_in_month(item, year, month_number):
            recurring_by_day[expected.day].append(item)

    days = []
    for day in range(1, days_in_month + 1):
        date_str = f"{month}-{day:02d}"
        forecast_row = forecast_by_day.get(day) or {}
        actual_row = actual_by_day.get(day) or {}
        days.append({
            "date": date_str,
            "day": day,
            "actual_income": round2(actual_row.get("actual_income")),
            "actual_expenses": round2(actual_row.get("actual_expenses")),
            "planned_income": round2(forecast_row.get("planned_income")),
            "planned_expenses": round2(forecast_row.get("planned_expenses")),
            "notes": forecast_row.get("notes") or "",
            "recurring": [
                {"name": item["name"], "amount": item["monthly_impact"], "kind": item["kind"]}
                for item in recurring_by_day.get(day, [])
            ],
        })

    actual_income = round2(sum(day["actual_income"] for day in days))
    actual_expenses = round2(sum(day["actual_expenses"] for day in days))
    planned_income = round2(sum(day["planned_income"] for day in days))
    planned_expenses = round2(sum(day["planned_expenses"] for day in days))

    remaining_days = [day for day in days if day["date"] > today.isoformat()] if is_current else []
    planned_remaining = round2(sum(day["planned_expenses"] for day in remaining_days))
    planned_remaining_income = round2(sum(day["planned_income"] for day in remaining_days))

    if is_current and today.day <= days_in_month:
        empty_month = actual_income == 0 and actual_expenses == 0
        if empty_month:
            # Mese corrente senza movimenti (dati non ancora importati):
            # stimo i giorni passati dalle mediane e aggiungo il piano residuo.
            baseline = _history_medians(rows, today)
            pace_expenses = round2(baseline["expenses"])
            pace_income = round2(baseline["income"])
            has_remaining_plan = planned_remaining > 0 or planned_remaining_income > 0
            elapsed_ratio = max(0, today.day - 1) / days_in_month
            projected_expenses = (
                round2(pace_expenses * elapsed_ratio + planned_remaining)
                if has_remaining_plan else pace_expenses
            )
            projected_income = (
                round2(pace_income * elapsed_ratio + planned_remaining_income)
                if has_remaining_plan else pace_income
            )
        else:
            pace_expenses = round2(actual_expenses / today.day * days_in_month)
            pace_income = round2(actual_income / today.day * days_in_month)
            projected_expenses = (
                round2(actual_expenses + planned_remaining) if planned_remaining > 0 else pace_expenses
            )
            projected_income = (
                round2(actual_income + planned_remaining_income)
                if planned_remaining_income > 0
                else pace_income
            )
        days_left = max(0, days_in_month - today.day)
    elif is_future:
        # Mese futuro senza piano: stima dalle mediane storiche.
        baseline = _history_medians(rows, today)
        pace_expenses = planned_expenses or round2(baseline["expenses"])
        pace_income = planned_income or round2(baseline["income"])
        projected_expenses = planned_expenses or pace_expenses
        projected_income = planned_income or pace_income
        days_left = days_in_month
    else:
        pace_expenses = actual_expenses
        pace_income = actual_income
        projected_expenses = actual_expenses
        projected_income = actual_income
        days_left = 0

    projected_savings = round2(projected_income - projected_expenses)

    spent_by_category = {row["micro_category"]: round2(row["tot"]) for row in categories}
    allocation_rows = []
    for row in allocations:
        planned = round2(row["planned_amount"])
        spent = spent_by_category.get(row["micro_category"], 0.0)
        allocation_rows.append({
            "name": row["micro_category"],
            "planned": planned,
            "spent": spent,
            "pct": round(spent / planned * 100, 1) if planned > 0 else 0,
        })
    allocation_rows.sort(key=lambda item: item["spent"], reverse=True)

    total_planned_budget = round2(sum(row["planned"] for row in allocation_rows))
    budget_spent = round2(sum(row["spent"] for row in allocation_rows))

    upcoming_limit = today + timedelta(days=7)
    upcoming_total = round2(sum(
        item["monthly_impact"]
        for item in recurring
        if item["kind"] == "expense"
        and today.isoformat() <= item["next_expected"] <= upcoming_limit.isoformat()
    ))

    plan = {
        "month": month,
        "today": today.isoformat(),
        "days_in_month": days_in_month,
        "days_left": days_left,
        "has_plan": bool(forecasts),
        "last_data_date": last_data_date.isoformat() if last_data_date else None,
        "data_stale_days": data_stale_days,
        "days": days,
        "totals": {
            "actual_income": actual_income,
            "actual_expenses": actual_expenses,
            "actual_savings": round2(actual_income - actual_expenses),
            "planned_income": planned_income,
            "planned_expenses": planned_expenses,
            "planned_remaining": planned_remaining,
        },
        "pace": {
            "expenses": pace_expenses,
            "income": pace_income,
        },
        "projected_expenses": projected_expenses,
        "projected_income": projected_income,
        "projected_savings": projected_savings,
        "budget": {
            "total_planned": total_planned_budget,
            "spent": budget_spent,
            "remaining": round2(total_planned_budget - budget_spent),
            "allocations": allocation_rows,
        },
        "recurring": recurring,
        "upcoming_total": upcoming_total,
    }
    plan["alerts"] = _alerts(plan, today)
    return plan


def generate_plan(month, today=None):
    """Genera/aggiorna il piano giornaliero. Le righe manuali sono intoccabili."""
    today = today or date.today()
    year, month_number = parse_month(month)
    if (year, month_number) < (today.year, today.month):
        raise ValueError("Non è possibile generare il piano per un mese passato")

    _, _, days_in_month = month_bounds(month)
    rows = load_history_rows(today)
    medians = _history_medians(rows, today)
    recurring = [item for item in detect_recurring(rows, today) if item["active"]]

    fixed_monthly = sum(
        item["monthly_impact"] for item in recurring if item["kind"] == "expense"
    )
    variable_pool = max(0.0, medians["expenses"] - fixed_monthly)
    variable_daily = round2(variable_pool / days_in_month) if days_in_month else 0.0

    recurring_by_day = defaultdict(list)
    for item in recurring:
        for expected in occurrences_in_month(item, year, month_number):
            recurring_by_day[expected.day].append(item)

    with db_cursor() as cursor:
        existing_rows = [dict(row) for row in execute(cursor, FORECAST_SQL, (month,)).fetchall()]
    existing_notes = {row["date"]: row.get("notes") or "" for row in existing_rows}

    start_day = today.day if month == today.strftime("%Y-%m") else 1
    written = 0
    skipped_manual = 0

    with db_cursor(commit=True) as cursor:
        for day in range(start_day, days_in_month + 1):
            date_str = f"{month}-{day:02d}"
            items = recurring_by_day.get(day, [])
            recurring_expenses = sum(item["monthly_impact"] for item in items if item["kind"] == "expense")
            recurring_income = sum(item["monthly_impact"] for item in items if item["kind"] == "income")
            planned_expenses = round2(recurring_expenses + variable_daily)
            planned_income = round2(recurring_income)
            if planned_expenses <= 0 and planned_income <= 0:
                continue

            current_notes = existing_notes.get(date_str)
            if current_notes is not None and not current_notes.startswith(AUTO_PREFIX):
                skipped_manual += 1
                continue

            names = ", ".join(item["name"] for item in items)
            notes = f"{AUTO_PREFIX} {names}".strip()
            execute(
                cursor,
                """
                INSERT INTO daily_forecast (date, planned_income, planned_expenses, notes)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT(date) DO UPDATE SET
                    planned_income = excluded.planned_income,
                    planned_expenses = excluded.planned_expenses,
                    notes = excluded.notes
                """,
                (date_str, planned_income, planned_expenses, notes),
            )
            written += 1

    return {
        "status": "success",
        "month": month,
        "days_written": written,
        "days_skipped_manual": skipped_manual,
        "variable_daily": variable_daily,
        "recurring_count": len(recurring),
    }


def build_projection(months=6, buffer=0.0, today=None):
    today = today or date.today()
    rows = load_history_rows(today)
    medians = _history_medians(rows, today)

    current_month = today.strftime("%Y-%m")
    series = build_clean_monthly_series(rows)
    current = next((row for row in series if row["month"] == current_month), None)
    start_savings = current["savings"] if current else 0.0

    cumulative = start_savings
    points = []
    for step in range(1, months + 1):
        month = add_months(current_month, step)
        expenses = medians["expenses"] * (1 + buffer)
        net = medians["income"] - expenses - medians["invested"]
        cumulative += net
        points.append({
            "month": month,
            "income": round2(medians["income"]),
            "expenses": round2(expenses),
            "invested": round2(medians["invested"]),
            "net": round2(net),
            "cumulative": round2(cumulative),
        })

    return {
        "months": months,
        "buffer": buffer,
        "start_savings": round2(start_savings),
        "history_months": medians["months"],
        "med_income": round2(medians["income"]),
        "med_expenses": round2(medians["expenses"]),
        "med_invested": round2(medians["invested"]),
        "points": points,
    }
