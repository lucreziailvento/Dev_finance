"""Snapshot dei numeri "contratto" esposti dall'API.

Serve a garantire che un refactoring non cambi i valori che l'utente vede
(entrate, spese, investito, categorie, previsioni, budget, record manuali).

Il baseline viene generato con il codice *pre-refactoring* e poi confrontato
con l'output del codice nuovo. Vengono catturati solo i campi esistenti,
quindi l'aggiunta di nuovi campi non fa fallire il test.
"""

import json
from pathlib import Path

BASELINE = Path(__file__).with_name("golden_baseline.json")

# Campi che non fanno parte del contratto numerico (es. timestamp) e che
# possono cambiare senza conseguenze sui dati.
IGNORED_KEYS = {"error", "detail"}


def _num(value):
    """Normalizza i numeri: Postgres restituisce Decimal, SQLite float."""
    if value is None:
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return value


def _months(client, limit=12):
    stats = client.get("/api/stats").json()
    # /api/stats usa la chiave "mo", /api/trend usa "month": qui accettiamo entrambe.
    months = [row.get("mo") or row.get("month") for row in stats.get("monthly", [])]
    return sorted({month for month in months if month})[-limit:]


def _dashboard(client, month):
    data = client.get(f"/api/dashboard/{month}").json()
    return {
        "income": _num(data.get("income")),
        "expenses": _num(data.get("expenses")),
        "savings": _num(data.get("savings")),
        "invested": _num(data.get("invested")),
        "investable": _num(data.get("investable")),
        "transfers": _num(data.get("transfers")),
        "categories": sorted(
            [_num(c.get("amount")), c.get("name")] for c in data.get("categories", [])
        ),
        "transactions": sorted(
            [
                t.get("date"),
                _num(t.get("amount")),
                t.get("macro_category"),
                t.get("micro_category"),
                t.get("hash_id"),
            ]
            for t in data.get("transactions", [])
        ),
    }


def _trend(client):
    series = client.get("/api/trend?months=24").json().get("series", [])
    return [
        {
            "month": row.get("month"),
            "income": _num(row.get("income")),
            "expenses": _num(row.get("expenses")),
            "invested": _num(row.get("invested")),
            "savings": _num(row.get("savings")),
        }
        for row in series
    ]


def _stats(client):
    data = client.get("/api/stats").json()
    categories = {
        month: sorted([c.get("name"), _num(c.get("amount"))] for c in rows)
        for month, rows in data.get("categories_per_month", {}).items()
    }
    sources = {
        month: sorted([s.get("source"), s.get("count"), _num(s.get("amount"))] for s in rows)
        for month, rows in data.get("sources_per_month", {}).items()
    }
    return {
        "monthly": [
            {
                "month": row.get("mo") or row.get("month"),
                "income": _num(row.get("income")),
                "expenses": _num(row.get("expenses")),
                "invested": _num(row.get("invested")),
                "total_out": _num(row.get("total_out")),
            }
            for row in data.get("monthly", [])
        ],
        "categories_per_month": categories,
        "sources_per_month": sources,
        "top_descriptions": [
            [row.get("description"), row.get("count"), _num(row.get("total"))]
            for row in data.get("top_descriptions", [])
        ],
    }


def _budget_averages(client):
    data = client.get("/api/budget-averages").json()
    return {
        "med_monthly_income": _num(data.get("med_monthly_income")),
        "med_monthly_expenses": _num(data.get("med_monthly_expenses")),
        "mean_monthly_income": _num(data.get("mean_monthly_income")),
        "mean_monthly_expenses": _num(data.get("mean_monthly_expenses")),
        "num_months": data.get("num_months"),
        "category_averages": [
            {
                "name": row.get("name"),
                "med_amount": _num(row.get("med_amount")),
                "mean_amount": _num(row.get("mean_amount")),
                "months_active": row.get("months_active"),
                "pct": _num(row.get("pct")),
            }
            for row in data.get("category_averages", [])
        ],
    }


def _etf_plan(client):
    data = client.get("/api/etf-plan?months=12&buffer=0.2").json()
    return {
        "months": data.get("months"),
        "buffer": data.get("buffer"),
        "med_income": _num(data.get("med_income")),
        "med_expenses": _num(data.get("med_expenses")),
        "med_invested": _num(data.get("med_invested")),
        "med_investable": _num(data.get("med_investable")),
        "recommended_monthly": data.get("recommended_monthly"),
        "series": [
            {
                "month": row.get("month"),
                "income": _num(row.get("income")),
                "expenses": _num(row.get("expenses")),
                "invested": _num(row.get("invested")),
                "transfers": _num(row.get("transfers")),
                "savings": _num(row.get("savings")),
                "investable": _num(row.get("investable")),
            }
            for row in data.get("series", [])
        ],
    }


def _forecast(client, month):
    data = client.get(f"/api/forecast/{month}").json()
    return {
        "forecasts": sorted(
            [
                row.get("date"),
                _num(row.get("planned_income")),
                _num(row.get("planned_expenses")),
                row.get("notes"),
            ]
            for row in data.get("forecasts", [])
        ),
        "actuals": {
            date: [_num(v.get("actual_income")), _num(v.get("actual_expenses"))]
            for date, v in data.get("actuals", {}).items()
        },
    }


def _manual_records(client):
    rows = client.get("/api/manual-records").json()
    return sorted(
        [
            row.get("id"),
            row.get("date"),
            _num(row.get("amount")),
            row.get("macro_category"),
            row.get("micro_category"),
            row.get("description"),
        ]
        for row in rows
    )


def collect(client):
    """Raccoglie tutti i numeri che devono restare identici."""
    months = _months(client)
    snapshot = {
        "months": months,
        "trend": _trend(client),
        "stats": _stats(client),
        "budget_averages": _budget_averages(client),
        "etf_plan": _etf_plan(client),
        "manual_records": _manual_records(client),
    }
    for month in months:
        snapshot[f"dashboard:{month}"] = _dashboard(client, month)
        snapshot[f"forecast:{month}"] = _forecast(client, month)
        snapshot[f"allocations:{month}"] = {
            key: _num(value)
            for key, value in client.get(f"/api/budget-allocations/{month}").json().items()
        }
    return snapshot


def write_baseline(client, path=BASELINE):
    path.write_text(
        json.dumps(collect(client), indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path


if __name__ == "__main__":
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

    from fastapi.testclient import TestClient

    from backend.app import app

    with TestClient(app) as test_client:
        written = write_baseline(test_client)
    print(f"Baseline scritto in {written}")
