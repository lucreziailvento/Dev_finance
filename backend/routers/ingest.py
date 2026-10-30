import os
import shutil
import tempfile
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..db import db_cursor, execute, insert_on_conflict
from ..parser import esegui_etl_storico

router = APIRouter()


def _save_upload(upload: Optional[UploadFile], suffix: str) -> Optional[str]:
    """Salva l'upload in un file temporaneo e ritorna il path (o None)."""
    if upload is None or not upload.filename:
        return None
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        shutil.copyfileobj(upload.file, handle)
        return handle.name


@router.post("/api/ingest")
async def ingest(
    fineco_file: Optional[UploadFile] = File(default=None),
    revolut_file: Optional[UploadFile] = File(default=None),
):
    if fineco_file is None and revolut_file is None:
        raise HTTPException(status_code=400, detail="Nessun file caricato")

    path_f = _save_upload(fineco_file, ".xlsx")
    path_r = _save_upload(revolut_file, ".csv")
    try:
        df = esegui_etl_storico(path_f, path_r)
        if df.empty:
            return {"status": "success", "records_added": 0}

        df_clean = df.drop_duplicates(subset=['hash_id'])
        sql = insert_on_conflict(
            "transactions",
            ["date", "description", "amount", "source", "macro_category", "micro_category", "hash_id"],
            None,
            "hash_id",
        )

        added = 0
        # Un'unica transazione: o si importa tutto il file, o niente.
        with db_cursor(commit=True) as cursor:
            for _, row in df_clean.iterrows():
                result = execute(
                    cursor,
                    sql,
                    (
                        row['date'],
                        row['description'],
                        float(row['amount']),
                        row['source'],
                        row['macro_category'],
                        row['micro_category'],
                        row['hash_id'],
                    ),
                )
                if result.rowcount > 0:
                    added += 1
        return {"status": "success", "records_added": added}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        for path in (path_f, path_r):
            if path and os.path.exists(path):
                os.unlink(path)
