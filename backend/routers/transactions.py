from fastapi import APIRouter

from ..app_common import get_macro
from ..db import write
from ..schemas import CategoryUpdate, DescriptionUpdate

router = APIRouter()


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
