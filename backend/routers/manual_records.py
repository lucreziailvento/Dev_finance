from fastapi import APIRouter, HTTPException

from ..db import get_conn_and_cursor, commit_and_close, execute
from ..schemas import ManualRecord
from ..app_common import get_macro

router = APIRouter()


@router.post("/api/manual-records")
def add_manual(payload: ManualRecord):
    try:
        amount = abs(payload.amount) if payload.type == 'entrata' else -abs(payload.amount)
        macro = "Entrate" if payload.type == 'entrata' else get_macro(payload.micro_category)
        conn, c = get_conn_and_cursor()
        execute(c, "INSERT INTO manual_records (date, description, amount, macro_category, micro_category) VALUES (%s, %s, %s, %s, %s)",
                (payload.date, payload.description, amount, macro, payload.micro_category))
        commit_and_close(conn)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/manual-records")
def list_manual():
    conn, c = get_conn_and_cursor()
    execute(c, "SELECT id, date, description, amount, macro_category, micro_category FROM manual_records ORDER BY date DESC")
    rows = [dict(r) for r in c.fetchall()]
    commit_and_close(conn)
    return rows


@router.delete("/api/manual-records/{id}")
def delete_manual(id: int):
    conn, c = get_conn_and_cursor()
    execute(c, "DELETE FROM manual_records WHERE id = %s", (id,))
    commit_and_close(conn)
    return {"status": "success"}


@router.put("/api/manual-records/{id}")
def update_manual(id: int, payload: ManualRecord):
    conn, c = get_conn_and_cursor()
    amount = abs(payload.amount) if payload.type == 'entrata' else -abs(payload.amount)
    macro = "Entrate" if payload.type == 'entrata' else get_macro(payload.micro_category)
    execute(c, "UPDATE manual_records SET date = %s, description = %s, amount = %s, macro_category = %s, micro_category = %s WHERE id = %s",
            (payload.date, payload.description, amount, macro, payload.micro_category, id))
    commit_and_close(conn)
    return {"status": "success"}
