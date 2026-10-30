from fastapi import APIRouter, HTTPException

from ..schemas import RuleCreate, RuleFromTransaction
from ..services.rules import (
    delete_rule,
    list_rules,
    rule_from_transaction,
    upsert_rule,
)

router = APIRouter()


@router.get("/api/rules")
def get_rules():
    return list_rules()


@router.post("/api/rules")
def create_rule(payload: RuleCreate):
    try:
        return upsert_rule(
            payload.pattern,
            payload.micro_category,
            source=payload.source,
            apply_existing=payload.apply_existing,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/api/rules/{rule_id}")
def remove_rule(rule_id: int):
    removed = delete_rule(rule_id)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Regola non trovata")
    return {"status": "success"}


@router.post("/api/rules/from-transaction")
def create_rule_from_transaction(payload: RuleFromTransaction):
    result = rule_from_transaction(
        payload.hash_id,
        micro_category=payload.micro_category or None,
        apply_existing=payload.apply_existing,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    return result
