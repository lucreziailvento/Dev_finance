import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..db import ALL_TRANSACTIONS, db_cursor, execute

router = APIRouter()

EXPORT_SQL = f"""
    SELECT date, description, amount, source, macro_category, micro_category, hash_id
    FROM {ALL_TRANSACTIONS} AS all_transactions
    ORDER BY date, hash_id
"""


@router.get("/api/export/transactions.csv")
def export_transactions():
    with db_cursor() as cursor:
        rows = [dict(row) for row in execute(cursor, EXPORT_SQL).fetchall()]

    buffer = io.StringIO()
    buffer.write("\ufeff")  # BOM: Excel riconosce gli accenti
    writer = csv.writer(buffer, delimiter=";", lineterminator="\n")
    writer.writerow(["data", "descrizione", "importo", "fonte", "macro_categoria", "micro_categoria", "id"])
    for row in rows:
        writer.writerow([
            row["date"],
            row["description"],
            f"{float(row['amount'] or 0):.2f}",
            row["source"],
            row["macro_category"],
            row["micro_category"],
            row["hash_id"],
        ])

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="devfinance-transactions.csv"'},
    )
