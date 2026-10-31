from fastapi import APIRouter, HTTPException, Query

from ..app_common import get_macro
from ..db import ALL_TRANSACTIONS, db_cursor, execute, write
from ..schemas import AmountUpdate, CategoryUpdate, DescriptionUpdate, TransactionDeleteFilter
from ..services.imports import delete_transactions as delete_transactions_by_filter
from ..services.imports import list_sources

router = APIRouter()


@router.get("/api/transactions")
def list_transactions(
    month: str = Query(default=""),
    search: str = Query(default=""),
    kind: str = Query(default="all"),
    source: str = Query(default=""),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
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
    if source:
        where.append("source = %s")
        params.append(source)
    if date_from:
        where.append("date >= %s")
        params.append(date_from)
    if date_to:
        where.append("date <= %s")
        params.append(date_to)
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


@router.get("/api/transactions/sources")
def transaction_sources():
    """Fonti importate disponibili, con conteggi e intervallo di date."""
    return {"sources": list_sources()}


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


@router.post("/api/transactions/update-amount")
def upd_amount(payload: AmountUpdate):
    """Aggiorna l'importo mantenendo il segno originale (spesa/entrata)."""
    amount = abs(float(payload.amount))
    hash_id = payload.hash_id

    if hash_id.startswith("manual_"):
        raw_id = hash_id.replace("manual_", "", 1)
        if not raw_id.isdigit():
            raise HTTPException(status_code=400, detail="Identificativo non valido")
        changed = write(
            "UPDATE manual_records SET amount = CASE WHEN amount < 0 THEN -%s ELSE %s END "
            "WHERE id = %s",
            (amount, amount, int(raw_id)),
        )
    else:
        changed = write(
            "UPDATE transactions SET amount = CASE WHEN amount < 0 THEN -%s ELSE %s END "
            "WHERE hash_id = %s",
            (amount, amount, hash_id),
        )

    if not changed:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    return {"status": "success", "amount": amount}


@router.delete("/api/transactions/{hash_id}")
def delete_transaction(hash_id: str):
    """Elimina una singola transazione, manuale o importata."""
    if hash_id.startswith("manual_"):
        raw_id = hash_id.replace("manual_", "", 1)
        if not raw_id.isdigit():
            raise HTTPException(status_code=400, detail="Identificativo non valido")
        deleted = write("DELETE FROM manual_records WHERE id = %s", (int(raw_id),))
    else:
        with db_cursor(commit=True) as cursor:
            result = execute(
                cursor,
                "DELETE FROM transactions WHERE hash_id = %s",
                (hash_id,),
            )
            deleted = int(result.rowcount or 0)
            # Il collegamento al lotto non deve restare appeso a una riga sparita.
            execute(
                cursor,
                "DELETE FROM import_batch_transactions WHERE hash_id = %s",
                (hash_id,),
            )

    if not deleted:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    return {"status": "success", "deleted": int(deleted)}


@router.post("/api/transactions/delete-range")
def delete_range(payload: TransactionDeleteFilter):
    """Eliminazione massiva di transazioni importate per fonte e/o periodo."""
    if not (payload.source.strip() or payload.date_from.strip() or payload.date_to.strip()):
        raise HTTPException(
            status_code=400,
            detail="Indica almeno una fonte o un intervallo di date",
        )
    try:
        return delete_transactions_by_filter(
            payload.source,
            payload.date_from,
            payload.date_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
