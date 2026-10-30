from fastapi import APIRouter, HTTPException

from ..app_common import get_macro
from ..db import db_cursor, execute, write
from ..schemas import ManualRecord

router = APIRouter()


def _signed_amount(payload: ManualRecord):
    return abs(payload.amount) if payload.type == 'entrata' else -abs(payload.amount)


def _normalize(payload: ManualRecord):
    macro = "Entrate" if payload.type == 'entrata' else get_macro(payload.micro_category)
    return _signed_amount(payload), macro


@router.post("/api/manual-records")
def add_manual(payload: ManualRecord):
    try:
        amount, macro = _normalize(payload)
        write(
            "INSERT INTO manual_records (date, description, amount, macro_category, micro_category) "
            "VALUES (%s, %s, %s, %s, %s)",
            (payload.date, payload.description, amount, macro, payload.micro_category),
        )
        return {"status": "success"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/manual-records")
def list_manual():
    with db_cursor() as cursor:
        rows = [
            dict(row)
            for row in execute(
                cursor,
                "SELECT id, date, description, amount, macro_category, micro_category "
                "FROM manual_records ORDER BY date DESC",
            ).fetchall()
        ]
    return rows


@router.delete("/api/manual-records/{id}")
def delete_manual(id: int):
    write("DELETE FROM manual_records WHERE id = %s", (id,))
    return {"status": "success"}


@router.put("/api/manual-records/{id}")
def update_manual(id: int, payload: ManualRecord):
    amount, macro = _normalize(payload)
    write(
        "UPDATE manual_records SET date = %s, description = %s, amount = %s, "
        "macro_category = %s, micro_category = %s WHERE id = %s",
        (payload.date, payload.description, amount, macro, payload.micro_category, id),
    )
    return {"status": "success"}
