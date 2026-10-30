"""Test degli endpoint di supporto: meta dati ed elenco transazioni."""

from fastapi.testclient import TestClient

from backend.app import app
from backend.tests.helpers import insert_transactions

ROWS = [
    ("2026-05-31", "Spesa Conad", -25.5, "Spesa Alimentare", "Carta"),
    ("2026-06-01", "Stipendio", 2000.0, "Entrate_Lavoro", "Conto"),
    ("2026-06-02", "Amazon", -12.0, "Shopping & Lifestyle", "Carta"),
]


def test_meta_reports_latest_month(temp_db):
    insert_transactions(ROWS)

    with TestClient(app) as client:
        payload = client.get("/api/meta").json()

    assert payload["first_date"] == "2026-05-31"
    assert payload["last_date"] == "2026-06-02"
    assert payload["latest_month"] == "2026-06"
    assert payload["transactions"] == 3
    assert payload["manual_records"] == 0
    assert payload["data_stale_days"] is not None


def test_transactions_list_filters(temp_db):
    insert_transactions(ROWS)

    with TestClient(app) as client:
        everything = client.get("/api/transactions").json()
        assert everything["total"] == 3
        assert everything["transactions"][0]["date"] == "2026-06-02"

        expenses = client.get("/api/transactions?kind=expense").json()
        assert expenses["total"] == 2

        june = client.get("/api/transactions?month=2026-06").json()
        assert june["total"] == 2

        search = client.get("/api/transactions?search=conad").json()
        assert search["total"] == 1
        assert search["transactions"][0]["description"] == "Spesa Conad"
