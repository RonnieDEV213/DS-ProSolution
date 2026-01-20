"""Collection endpoints for seller collection runs.

Admin endpoints for:
- Settings configuration
- Cost estimation
- Run CRUD (create, list, pause, cancel)
- Progress tracking (placeholder for WebSocket in later phase)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_permission_key
from app.database import get_supabase
from app.models import (
    CollectionRunCreate,
    CollectionRunListResponse,
    CollectionRunResponse,
    CollectionSettingsResponse,
    CollectionSettingsUpdate,
    CostEstimate,
    EstimateRequest,
)
from app.services.collection import CollectionService

router = APIRouter(prefix="/collection", tags=["collection"])
logger = logging.getLogger(__name__)


def get_collection_service() -> CollectionService:
    """Dependency to get CollectionService instance."""
    supabase = get_supabase()
    return CollectionService(supabase)


# ============================================================
# Settings Endpoints
# ============================================================


@router.get("/settings", response_model=CollectionSettingsResponse)
async def get_settings(
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get collection settings for the organization.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    settings = await service.get_settings(org_id)

    return CollectionSettingsResponse(
        budget_cap_cents=settings["budget_cap_cents"],
        soft_warning_percent=settings["soft_warning_percent"],
        max_concurrent_runs=settings["max_concurrent_runs"],
    )


@router.patch("/settings", response_model=CollectionSettingsResponse)
async def update_settings(
    body: CollectionSettingsUpdate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Update collection settings.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    settings = await service.update_settings(
        org_id,
        budget_cap_cents=body.budget_cap_cents,
        soft_warning_percent=body.soft_warning_percent,
        max_concurrent_runs=body.max_concurrent_runs,
    )

    return CollectionSettingsResponse(
        budget_cap_cents=settings["budget_cap_cents"],
        soft_warning_percent=settings["soft_warning_percent"],
        max_concurrent_runs=settings["max_concurrent_runs"],
    )


# ============================================================
# Estimation Endpoint
# ============================================================


@router.post("/estimate", response_model=CostEstimate)
async def estimate_cost(
    body: EstimateRequest,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get cost estimate for a collection run.

    Returns estimated cost with per-category breakdown and budget status.
    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    if not body.category_ids:
        raise HTTPException(status_code=400, detail="At least one category required")

    estimate = await service.estimate_cost(org_id, body.category_ids)

    return CostEstimate(
        total_cents=estimate["total_cents"],
        breakdown=estimate["breakdown"],
        within_budget=estimate["within_budget"],
        budget_cap_cents=estimate["budget_cap_cents"],
        warning_threshold_cents=estimate["warning_threshold_cents"],
    )


# ============================================================
# Run Endpoints
# ============================================================


@router.post("/runs", response_model=CollectionRunResponse)
async def create_run(
    body: CollectionRunCreate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Create a new collection run.

    Validates budget before creating. Returns 400 if would exceed budget.
    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    if not body.category_ids:
        raise HTTPException(status_code=400, detail="At least one category required")

    result = await service.create_run(
        org_id=org_id,
        user_id=user_id,
        category_ids=body.category_ids,
        name=body.name,
    )

    if "error" in result:
        if result["error"] == "budget_exceeded":
            raise HTTPException(status_code=400, detail=result["message"])
        elif result["error"] == "concurrent_limit":
            raise HTTPException(status_code=429, detail=result["message"])
        else:
            raise HTTPException(status_code=500, detail=result["message"])

    run = result["run"]
    return CollectionRunResponse(
        id=run["id"],
        name=run["name"],
        status=run["status"],
        estimated_cost_cents=run["estimated_cost_cents"],
        actual_cost_cents=run["actual_cost_cents"],
        budget_cap_cents=run["budget_cap_cents"],
        total_items=run["total_items"],
        processed_items=run["processed_items"],
        failed_items=run["failed_items"],
        category_ids=run["category_ids"],
        started_at=run.get("started_at"),
        completed_at=run.get("completed_at"),
        paused_at=run.get("paused_at"),
        created_by=run["created_by"],
        created_at=run["created_at"],
    )


@router.get("/runs", response_model=CollectionRunListResponse)
async def list_runs(
    limit: int = 20,
    offset: int = 0,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    List collection runs for the organization.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    runs, total = await service.list_runs(org_id, limit=limit, offset=offset)

    return CollectionRunListResponse(
        runs=[
            CollectionRunResponse(
                id=r["id"],
                name=r["name"],
                status=r["status"],
                estimated_cost_cents=r["estimated_cost_cents"],
                actual_cost_cents=r["actual_cost_cents"],
                budget_cap_cents=r["budget_cap_cents"],
                total_items=r["total_items"],
                processed_items=r["processed_items"],
                failed_items=r["failed_items"],
                category_ids=r["category_ids"],
                started_at=r.get("started_at"),
                completed_at=r.get("completed_at"),
                paused_at=r.get("paused_at"),
                created_by=r["created_by"],
                created_at=r["created_at"],
            )
            for r in runs
        ],
        total=total,
    )


@router.get("/runs/{run_id}", response_model=CollectionRunResponse)
async def get_run(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get a specific collection run.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    run = await service.get_run(run_id, org_id)

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return CollectionRunResponse(
        id=run["id"],
        name=run["name"],
        status=run["status"],
        estimated_cost_cents=run["estimated_cost_cents"],
        actual_cost_cents=run["actual_cost_cents"],
        budget_cap_cents=run["budget_cap_cents"],
        total_items=run["total_items"],
        processed_items=run["processed_items"],
        failed_items=run["failed_items"],
        category_ids=run["category_ids"],
        started_at=run.get("started_at"),
        completed_at=run.get("completed_at"),
        paused_at=run.get("paused_at"),
        created_by=run["created_by"],
        created_at=run["created_at"],
    )


@router.post("/runs/{run_id}/start")
async def start_run(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Start a pending collection run.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    result = await service.start_run(run_id, org_id)

    if "error" in result:
        if result["error"] == "not_found":
            raise HTTPException(status_code=404, detail=result["message"])
        else:
            raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/runs/{run_id}/pause")
async def pause_run(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Pause a running collection.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    result = await service.pause_run(run_id, org_id)

    if "error" in result:
        if result["error"] == "not_found":
            raise HTTPException(status_code=404, detail=result["message"])
        else:
            raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/runs/{run_id}/resume")
async def resume_run(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Resume a paused collection.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    result = await service.resume_run(run_id, org_id)

    if "error" in result:
        if result["error"] == "not_found":
            raise HTTPException(status_code=404, detail=result["message"])
        else:
            raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Cancel a collection run.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    result = await service.cancel_run(run_id, org_id)

    if "error" in result:
        if result["error"] == "not_found":
            raise HTTPException(status_code=404, detail=result["message"])
        else:
            raise HTTPException(status_code=400, detail=result["message"])

    return result
