"""Test di pianificazione, ricorrenze e proiezione su un DB temporaneo."""

from datetime import date

import pytest

import backend.db as db
from backend.services.planning import build_plan, build_projection, generate_plan
from backend.services.recurring import detect_recurring
from backend.tests.helpers import insert_transactions

TODAY = date(2026, 6, 30)


def _seed_history():
    rows = []
    for month in range(1, 7):
        rows.append((f"2026-{month:02d}-27", "Stipendio", 2000.0, "Entrate_Lavoro", "Conto"))
        rows.append((f"2026-{month:02d}-01", "iliad", -9.99, "Abbonamenti Digitali", "Carta"))
        # Spesa quotidiana: tanti movimenti vari, non deve diventare ricorrente.
        for day, amount in ((5, -42.10), (12, -18.50), (19, -63.20), (24, -27.90)):
            rows.append((f"2026-{month:02d}-{day:02d}", "Conad", amount, "Spesa Alimentare", "Carta"))
    insert_transactions(rows)


def _set_forecast(day, income, expenses, notes):
    with db.db_cursor(commit=True) as cursor:
        db.execute(
            cursor,
            """
            INSERT INTO daily_forecast (date, planned_income, planned_expenses, notes)
            VALUES (%s, %s, %s, %s)
            """,
            (f"2026-07-{day:02d}", income, expenses, notes),
        )


def test_detect_recurring_finds_salary_and_subscription(temp_db):
    _seed_history()
    with db.db_cursor() as cursor:
        rows = [dict(row) for row in db.execute(
            cursor, "SELECT * FROM transactions"
        ).fetchall()]

    items = {item["key"]: item for item in detect_recurring(rows, TODAY)}

    assert "stipendio" in items
    assert items["stipendio"]["kind"] == "income"
    assert items["stipendio"]["monthly_impact"] == pytest.approx(2000.0)
    assert items["iliad"]["kind"] == "expense"
    assert items["iliad"]["monthly_impact"] == pytest.approx(9.99)
    # La spesa al supermercato non è un abbonamento.
    assert "conad" not in items


def test_build_plan_totals_and_staleness(temp_db):
    _seed_history()

    plan = build_plan("2026-06", today=TODAY)

    assert plan["month"] == "2026-06"
    assert plan["days_in_month"] == 30
    assert len(plan["days"]) == 30
    assert plan["last_data_date"] == "2026-06-27"
    assert plan["data_stale_days"] == 3
    assert plan["totals"]["actual_income"] == pytest.approx(2000.0)
    assert plan["totals"]["actual_savings"] == pytest.approx(
        plan["totals"]["actual_income"] - plan["totals"]["actual_expenses"]
    )
    assert plan["has_plan"] is False
    titles = [alert["title"] for alert in plan["alerts"]]
    assert "Dati non aggiornati" not in titles
    assert all(item["active"] for item in plan["recurring"])


def test_build_plan_projects_from_history_when_month_is_empty(temp_db):
    _seed_history()

    plan = build_plan("2026-07", today=TODAY)

    # Luglio non ha movimenti: la proiezione usa le mediane, non zero.
    assert plan["projected_income"] > 0
    assert plan["projected_expenses"] > 0
    assert plan["projected_savings"] == pytest.approx(
        plan["projected_income"] - plan["projected_expenses"]
    )


def test_current_month_with_plan_combines_history_and_remaining_days(temp_db):
    _seed_history()
    today = date(2026, 7, 15)

    generate_plan("2026-07", today=today)
    plan = build_plan("2026-07", today=today)

    assert plan["totals"]["actual_expenses"] == 0
    assert plan["totals"]["planned_remaining"] > 0
    # I giorni passati sono stimati con le mediane, i restanti col piano.
    assert plan["projected_expenses"] > plan["totals"]["planned_remaining"]
    assert plan["projected_savings"] == pytest.approx(
        plan["projected_income"] - plan["projected_expenses"]
    )


def test_generate_plan_preserves_manual_rows(temp_db):
    _seed_history()
    _set_forecast(15, 0, 100.0, "Spesa pianificata a mano")
    _set_forecast(16, 0, 1.0, "[auto] vecchio piano")

    result = generate_plan("2026-07", today=TODAY)

    assert result["status"] == "success"
    assert result["days_written"] > 0
    assert result["days_skipped_manual"] == 1

    plan = build_plan("2026-07", today=TODAY)
    by_day = {day["day"]: day for day in plan["days"]}

    manual = by_day[15]
    assert manual["planned_expenses"] == pytest.approx(100.0)
    assert manual["notes"] == "Spesa pianificata a mano"

    auto = by_day[16]
    assert auto["notes"].startswith("[auto]")
    assert auto["planned_expenses"] != pytest.approx(1.0)

    # Le ricorrenze finiscono nei giorni giusti e il piano ha un totale.
    assert plan["has_plan"] is True
    assert plan["totals"]["planned_expenses"] > 0
    assert plan["totals"]["planned_income"] > 0


def test_generate_plan_rejects_past_month(temp_db):
    _seed_history()

    with pytest.raises(ValueError):
        generate_plan("2026-05", today=TODAY)


def test_projection_is_cumulative_and_uses_history(temp_db):
    _seed_history()

    projection = build_projection(months=3, buffer=0.0, today=TODAY)

    assert projection["months"] == 3
    assert len(projection["points"]) == 3
    assert [point["month"] for point in projection["points"]] == [
        "2026-07", "2026-08", "2026-09",
    ]
    assert projection["med_income"] == pytest.approx(2000.0)
    assert projection["med_expenses"] > 0

    previous = projection["points"][0]["cumulative"]
    for point in projection["points"][1:]:
        assert point["cumulative"] == pytest.approx(previous + point["net"], abs=0.02)
        previous = point["cumulative"]
