"""Test di contratto tra backend e frontend.

Coprono i punti in cui la UI leggeva campi che l'API non restituiva mai
(tab Analisi e tab Investimenti) e la gestione degli errori.
"""

from fastapi.testclient import TestClient

from backend.app import app


def _client():
    return TestClient(app)


def test_health():
    with _client() as client:
        assert client.get("/api/health").json() == {"status": "ok"}


def test_dashboard_returns_all_totals():
    with _client() as client:
        data = client.get("/api/dashboard/2026-05").json()
    for key in ("income", "expenses", "savings", "invested", "investable", "transfers"):
        assert key in data, f"campo mancante: {key}"
        assert isinstance(data[key], (int, float))
    assert isinstance(data["categories"], list)
    assert isinstance(data["transactions"], list)


def test_dashboard_unknown_month_is_empty_not_error():
    with _client() as client:
        response = client.get("/api/dashboard/1999-01")
    assert response.status_code == 200
    data = response.json()
    assert data["income"] == 0
    assert data["transactions"] == []


def test_stats_shape_used_by_frontend():
    with _client() as client:
        data = client.get("/api/stats").json()

    assert set(("monthly", "categories_per_month", "sources_per_month", "top_descriptions")).issubset(data)
    # Il frontend legge array di oggetti {name, amount} / {source, amount}.
    for rows in data["categories_per_month"].values():
        assert isinstance(rows, list)
        for row in rows:
            assert {"name", "amount"}.issubset(row)
    for rows in data["sources_per_month"].values():
        assert isinstance(rows, list)
        for row in rows:
            assert {"source", "amount"}.issubset(row)


def test_etf_plan_exposes_fields_used_by_ui():
    with _client() as client:
        data = client.get("/api/etf-plan").json()

    for key in (
        "recommended_monthly",
        "med_investable",
        "total_invested",
        "months_invested",
        "years_invested",
        "series",
    ):
        assert key in data, f"campo mancante: {key}"


def test_ingest_requires_at_least_one_file():
    with _client() as client:
        response = client.post("/api/ingest")
    assert response.status_code == 400
