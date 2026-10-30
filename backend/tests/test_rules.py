"""Test delle regole di categorizzazione apprese."""

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.services.rules import (
    delete_rule,
    list_rules,
    match_rule,
    normalize_pattern,
    rule_from_transaction,
    upsert_rule,
)
from backend.tests.helpers import insert_transactions

TRANSACTIONS = [
    ("2026-06-01", "PAGAMENTO POS CONAD MILANO", -25.0, "Altro", "Carta"),
    ("2026-06-05", "PAGAMENTO POS CONAD BOLOGNA", -12.0, "Altro", "Carta"),
    ("2026-06-10", "BONIFICO STIPENDIO ACME", 2000.0, "Altre Entrate", "Conto"),
]


def test_normalize_pattern_removes_noise():
    assert normalize_pattern("  PAGAMENTO POS  CONAD n.123  ") == "pagamento pos conad n"


def test_upsert_rule_applies_to_existing_transactions(temp_db):
    insert_transactions(TRANSACTIONS)

    result = upsert_rule("conad", "Spesa Alimentare", apply_existing=True)

    assert result["updated_transactions"] == 2
    assert result["macro_category"] == "Spese Fisse"

    rules = list_rules()
    assert len(rules) == 1
    assert rules[0]["pattern"] == "conad"
    assert rules[0]["matches"] == 2

    matches = [row for row in _transactions() if "CONAD" in row["description"]]
    assert all(row["micro_category"] == "Spesa Alimentare" for row in matches)
    assert all(row["macro_category"] == "Spese Fisse" for row in matches)


def test_upsert_rule_rejects_short_pattern(temp_db):
    with pytest.raises(ValueError):
        upsert_rule("ab", "Altro")


def test_match_rule_respects_source_and_specificity(temp_db):
    upsert_rule("stipendio", "Entrate_Lavoro", source="Conto")
    upsert_rule("bonifico stipendio", "Altre Entrate")

    rules = list_rules()
    rule = match_rule("BONIFICO STIPENDIO ACME", "Conto", rules)
    assert rule["micro_category"] == "Altre Entrate"

    # Con fonte diversa la regola legata al conto non si applica.
    no_source = match_rule("BONIFICO STIPENDIO ACME", "Carta", rules)
    assert no_source["micro_category"] == "Altre Entrate"


def test_rule_from_transaction_and_delete(temp_db):
    insert_transactions(TRANSACTIONS)
    hash_id = _transactions()[0]["hash_id"]

    created = rule_from_transaction(hash_id)
    assert created["pattern"].startswith("pagamento pos conad")
    assert created["micro_category"] == "Altro"

    rule_id = list_rules()[0]["id"]
    assert delete_rule(rule_id) == 1
    assert delete_rule(rule_id) == 0
    assert list_rules() == []


def test_rules_api_crud(temp_db):
    insert_transactions(TRANSACTIONS)

    with TestClient(app) as client:
        created = client.post("/api/rules", json={
            "pattern": "conad",
            "micro_category": "Spesa Alimentare",
            "apply_existing": True,
        })
        assert created.status_code == 200
        assert created.json()["updated_transactions"] == 2

        rules = client.get("/api/rules").json()
        assert len(rules) == 1

        removed = client.delete(f"/api/rules/{rules[0]['id']}")
        assert removed.status_code == 200
        assert client.get("/api/rules").json() == []


def _transactions():
    import backend.db as db

    with db.db_cursor() as cursor:
        return [dict(row) for row in db.execute(cursor, "SELECT * FROM transactions").fetchall()]
