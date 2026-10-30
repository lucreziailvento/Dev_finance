"""Test dei percorsi di scrittura su una copia temporanea del database.

Nessun test tocca `backend/portfolio_v2.db`: la fixture `isolated_db`
(definita in `conftest.py`) prepara una copia in `tmp_path`."""

from fastapi.testclient import TestClient

from backend.app import app


def test_manual_record_crud(isolated_db):
    with TestClient(app) as client:
        before = len(client.get("/api/manual-records").json())

        created = client.post("/api/manual-records", json={
            "date": "2099-01-10",
            "description": "TEST REFACTOR",
            "amount": 42.5,
            "micro_category": "Altro",
            "type": "spesa",
        })
        assert created.status_code == 200

        rows = client.get("/api/manual-records").json()
        assert len(rows) == before + 1
        record = next(row for row in rows if row["description"] == "TEST REFACTOR")
        assert record["amount"] == -42.5
        assert record["macro_category"] == "Spese Variabili"

        updated = client.put(f"/api/manual-records/{record['id']}", json={
            "date": "2099-01-11",
            "description": "TEST REFACTOR UPDATED",
            "amount": 50,
            "micro_category": "Entrate_Lavoro",
            "type": "entrata",
        })
        assert updated.status_code == 200
        record = next(row for row in client.get("/api/manual-records").json() if row["id"] == record["id"])
        assert record["description"] == "TEST REFACTOR UPDATED"
        assert record["amount"] == 50
        assert record["macro_category"] == "Entrate"

        assert client.delete(f"/api/manual-records/{record['id']}").status_code == 200
        assert len(client.get("/api/manual-records").json()) == before


def test_budget_allocations_roundtrip(isolated_db):
    month = "2099-02"
    with TestClient(app) as client:
        assert client.get(f"/api/budget-allocations/{month}").json() == {}

        saved = client.put(f"/api/budget-allocations/{month}", json=[
            {"micro_category": "Altro", "planned_amount": 123.45},
            {"micro_category": "Spesa Alimentare", "planned_amount": 300},
            {"micro_category": "Ignorata", "planned_amount": 0},
        ])
        assert saved.status_code == 200

        allocations = client.get(f"/api/budget-allocations/{month}").json()
        assert allocations["Altro"] == 123.45
        assert allocations["Spesa Alimentare"] == 300
        assert "Ignorata" not in allocations

        # Un secondo salvataggio sostituisce, non somma.
        client.put(f"/api/budget-allocations/{month}", json=[
            {"micro_category": "Altro", "planned_amount": 10},
        ])
        assert client.get(f"/api/budget-allocations/{month}").json() == {"Altro": 10}


def test_forecast_roundtrip(isolated_db):
    with TestClient(app) as client:
        payload = {
            "date": "2099-03-15",
            "planned_income": 1000,
            "planned_expenses": 500,
            "notes": "test",
        }
        assert client.post("/api/forecast", json=payload).status_code == 200

        forecasts = client.get("/api/forecast/2099-03").json()["forecasts"]
        assert len(forecasts) == 1
        assert forecasts[0]["notes"] == "test"

        assert client.delete("/api/forecast/2099-03-15").status_code == 200
        assert client.get("/api/forecast/2099-03").json()["forecasts"] == []
