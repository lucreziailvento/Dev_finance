from fastapi import APIRouter, HTTPException, Query

from ..services.planning import build_plan, build_projection, generate_plan

router = APIRouter()


@router.get("/api/plan/{month}")
def get_plan(month: str):
    try:
        return build_plan(month)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/api/plan/{month}/generate")
def generate(month: str):
    try:
        return generate_plan(month)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/api/projection")
def projection(
    months: int = Query(default=6, ge=1, le=24),
    buffer: float = Query(default=0.0, ge=-0.5, le=0.5),
):
    return build_projection(months=months, buffer=buffer)
