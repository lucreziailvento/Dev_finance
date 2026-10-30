"""Test dell'export CSV."""

from fastapi.testclient import TestClient

from backend.app import app
from backend.tests.helpers import insert_transactions


def test_export_transactions_csv(temp_db):
    insert_transactions([
        ("2026-06-01", "Spesa Conad", -25.5, "Spesa Alimentare", "Carta"),
        ("2026-06-02", "Stipendio", 2000.0, "Entrate_Lavoro", "Conto"),
    ])

    with TestClient(app) as client:
        response = client.get("/api/export/transactions.csv")

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]

    body = response.content.decode("utf-8")
    assert body.startswith("\ufeff")  # BOM per Excel
    lines = [line for line in body.lstrip("\ufeff").splitlines() if line]

    assert lines[0] == "data;descrizione;importo;fonte;macro_categoria;micro_categoria;id"
    assert len(lines) == 3
    assert "2026-06-01;Spesa Conad;-25.50;Carta;Spese Fisse;Spesa Alimentare;" in lines[1]
    assert "2026-06-02;Stipendio;2000.00;Conto;Entrate;Entrate_Lavoro;" in lines[2]
