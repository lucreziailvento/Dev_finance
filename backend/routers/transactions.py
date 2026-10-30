from fastapi import APIRouter, Query

from ..app_common import get_macro
from ..db import ALL_TRANSACTIONS, db_cursor, execute, write
from ..schemas import CategoryUpdate, DescriptionUpdate

router = APIRouter()


@router.get("/api/transactions")
def list_transactions(
    month: str = Query(default=""),
    search: str = Query(default=""),
    kind: str = Query(default="all"),
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
):
    """Elenco transazioni filtrabile, usato dal registro della UI.

    Senza `month` cerca su tutto lo storico: serve a ritrovare un movimento
    anche quando il mese visualizzato non ha dati.
    """
    where = ["date IS NOT NULL", "date != ''"]
    params = []
    if month:
        where.append("SUBSTR(date, 1, 7) = %s")
        params.append(month)
    if search:
        where.append("LOWER(description) LIKE %s")
        params.append(f"%{search.lower()}%")
    if kind == "expense":
        where.append("amount < 0")
    elif kind == "income":
        where.append("amount > 0")
    clause = " AND ".join(where)

    with db_cursor() as cursor:
        total = execute(
            cursor,
            f"SELECT COUNT(*) AS cnt FROM {ALL_TRANSACTIONS} AS all_transactions WHERE {clause}",
            params,
        ).fetchone()["cnt"]
        rows = execute(
            cursor,
            f"""
            SELECT date, description, amount, source, macro_category, micro_category, hash_id
            FROM {ALL_TRANSACTIONS} AS all_transactions
            WHERE {clause}
            ORDER BY date DESC, hash_id
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        ).fetchall()

    return {"total": int(total or 0), "transactions": [dict(row) for row in rows]}


@router.post("/api/transactions/update-description")
def upd_desc(payload: DescriptionUpdate):
    write(
        "UPDATE transactions SET description = %s WHERE hash_id = %s",
        (payload.new_description, payload.hash_id),
    )
    return {"status": "success"}


@router.post("/api/transactions/update-category")
def upd_cat(payload: CategoryUpdate):
    micro = payload.new_micro_category
    macro = get_macro(micro)
    write(
        "UPDATE transactions SET micro_category = %s, macro_category = %s WHERE hash_id = %s",
        (micro, macro, payload.hash_id),
    )
    return {"status": "success", "macro": macro}
