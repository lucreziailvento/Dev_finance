from fastapi import APIRouter, HTTPException

from ..services.imports import delete_import, list_imports

router = APIRouter()


@router.get("/api/imports")
def get_imports():
    """Lotti di importazione registrati, dal più recente."""
    return {"imports": list_imports()}


@router.delete("/api/imports/{batch_id}")
def remove_import(batch_id: int):
    """Annulla un caricamento: elimina solo le transazioni di quel lotto."""
    result = delete_import(batch_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Importazione non trovata")
    return result
