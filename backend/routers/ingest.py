import os
import shutil
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException

from ..db import get_conn_and_cursor, commit_and_close, execute, insert_on_conflict
from ..parser import esegui_etl_storico

router = APIRouter()


@router.post("/api/ingest")
async def ingest(fineco_file: UploadFile = File(...), revolut_file: UploadFile = File(...)):
    try:
        path_f = os.path.join(tempfile.gettempdir(), "uploaded_fineco.xlsx")
        path_r = os.path.join(tempfile.gettempdir(), "uploaded_revolut.csv")
        with open(path_f, "wb") as f:
            shutil.copyfileobj(fineco_file.file, f)
        with open(path_r, "wb") as f:
            shutil.copyfileobj(revolut_file.file, f)
        df = esegui_etl_storico(path_f, path_r)
        if df.empty:
            return {"status": "success", "records_added": 0}
        df_clean = df.drop_duplicates(subset=['hash_id'])
        conn, c = get_conn_and_cursor()
        added = 0
        sql = insert_on_conflict(
            "transactions",
            ["date", "description", "amount", "source", "macro_category", "micro_category", "hash_id"],
            None, "hash_id")
        for _, row in df_clean.iterrows():
            execute(c, sql, (row['date'], row['description'], row['amount'], row['source'], row['macro_category'], row['micro_category'], row['hash_id']))
            if c.rowcount > 0:
                added += 1
        commit_and_close(conn)
        return {"status": "success", "records_added": added}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
