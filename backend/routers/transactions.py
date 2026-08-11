from fastapi import APIRouter

from ..db import get_conn_and_cursor, commit_and_close, execute
from ..schemas import DescriptionUpdate, CategoryUpdate
from ..app_common import get_macro

router = APIRouter()


@router.post("/api/transactions/update-description")
def upd_desc(payload: DescriptionUpdate):
    conn, c = get_conn_and_cursor()
    execute(c, "UPDATE transactions SET description = %s WHERE hash_id = %s", (payload.new_description, payload.hash_id))
    commit_and_close(conn)
    return {"status": "success"}


@router.post("/api/transactions/update-category")
def upd_cat(payload: CategoryUpdate):
    micro = payload.new_micro_category
    macro = get_macro(micro)
    conn, c = get_conn_and_cursor()
    execute(c, "UPDATE transactions SET micro_category = %s, macro_category = %s WHERE hash_id = %s", (micro, macro, payload.hash_id))
    commit_and_close(conn)
    return {"status": "success", "macro": macro}
