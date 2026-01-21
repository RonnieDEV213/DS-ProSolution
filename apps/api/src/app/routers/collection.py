"""Collection endpoints for seller collection runs.

Admin endpoints for:
- Settings configuration
- Run CRUD (create, list, pause, cancel)
- Progress tracking (placeholder for WebSocket in later phase)
"""

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.auth import require_permission_key
from app.database import get_supabase
from app.models import (
    CollectionRunCreate,
    CollectionRunListResponse,
    CollectionRunResponse,
    CollectionSettingsResponse,
    CollectionSettingsUpdate,
    EnhancedProgress,
    RunTemplateCreate,
    RunTemplateListResponse,
    RunTemplateResponse,
    RunTemplateUpdate,
    WorkerStatus,
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
        max_concurrent_runs=body.max_concurrent_runs,
    )

    return CollectionSettingsResponse(
        max_concurrent_runs=settings["max_concurrent_runs"],
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
        if result["error"] == "concurrent_limit":
            raise HTTPException(status_code=429, detail=result["message"])
        else:
            raise HTTPException(status_code=500, detail=result["message"])

    run = result["run"]
    return CollectionRunResponse(
        id=run["id"],
        name=run["name"],
        status=run["status"],
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


@router.post("/runs/{run_id}/execute")
async def execute_run(
    run_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Execute a collection run (Amazon product fetching + eBay seller search).

    This starts the full collection pipeline in the background:
    1. Amazon best sellers collection
    2. eBay seller search for each Amazon product

    The run must be in 'running' status (call /start first).

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    run = await service.get_run(run_id, org_id)

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run["status"] != "running":
        raise HTTPException(
            status_code=400,
            detail=f"Run must be in 'running' status to execute (current: {run['status']})"
        )

    # Start full collection pipeline in background
    async def run_collection():
        # Phase 1: Amazon collection
        amazon_result = await service.run_amazon_collection(
            run_id=run_id,
            org_id=org_id,
            category_ids=run["category_ids"],
        )

        # If Amazon failed or was paused, don't continue to eBay
        if amazon_result.get("status") in ("failed", "paused"):
            return

        # Phase 2: eBay seller search
        await service.run_ebay_seller_search(run_id=run_id, org_id=org_id)

    background_tasks.add_task(run_collection)

    return {"ok": True, "message": "Collection started (Amazon + eBay)", "run_id": run_id}


@router.post("/runs/{run_id}/execute-ebay")
async def execute_ebay_search(
    run_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Execute eBay seller search for Amazon products in a collection run.

    Searches eBay for each Amazon product with dropshipper filters,
    extracts sellers, and stores new ones (deduped).

    The run must be in 'running' status.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    run = await service.get_run(run_id, org_id)

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run["status"] != "running":
        raise HTTPException(
            status_code=400,
            detail=f"Run must be in 'running' status (current: {run['status']})"
        )

    # Start eBay search in background
    async def run_ebay_search():
        await service.run_ebay_seller_search(run_id=run_id, org_id=org_id)

    background_tasks.add_task(run_ebay_search)

    return {"ok": True, "message": "eBay seller search started", "run_id": run_id}


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


# ============================================================
# Enhanced Progress Endpoint
# ============================================================


@router.get("/runs/{run_id}/progress", response_model=EnhancedProgress)
async def get_run_progress(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get detailed progress for a collection run.

    Returns hierarchical progress (departments, categories, products, sellers)
    and real-time worker status.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    try:
        progress = await service.get_enhanced_progress(org_id, run_id)
        return EnhancedProgress(
            departments_total=progress["departments_total"],
            departments_completed=progress["departments_completed"],
            categories_total=progress["categories_total"],
            categories_completed=progress["categories_completed"],
            products_total=progress["products_total"],
            products_searched=progress["products_searched"],
            sellers_found=progress["sellers_found"],
            sellers_new=progress["sellers_new"],
            worker_status=[
                WorkerStatus(**w) for w in (progress["worker_status"] or [])
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================
# Template Endpoints
# ============================================================


@router.get("/templates", response_model=RunTemplateListResponse)
async def list_templates(
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get all run templates.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    templates = await service.get_templates(org_id)

    return RunTemplateListResponse(
        templates=[
            RunTemplateResponse(
                id=t["id"],
                name=t["name"],
                description=t.get("description"),
                department_ids=t["department_ids"],
                concurrency=t["concurrency"],
                is_default=t["is_default"],
                created_at=t["created_at"],
            )
            for t in templates
        ]
    )


@router.post("/templates", response_model=RunTemplateResponse, status_code=201)
async def create_template(
    data: RunTemplateCreate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Create a new run template.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    try:
        template = await service.create_template(
            org_id=org_id,
            user_id=user_id,
            name=data.name,
            description=data.description,
            department_ids=data.department_ids,
            concurrency=data.concurrency,
            is_default=data.is_default,
        )
        return RunTemplateResponse(
            id=template["id"],
            name=template["name"],
            description=template.get("description"),
            department_ids=template["department_ids"],
            concurrency=template["concurrency"],
            is_default=template["is_default"],
            created_at=template["created_at"],
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/templates/{template_id}", response_model=RunTemplateResponse)
async def update_template(
    template_id: str,
    data: RunTemplateUpdate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Update a run template.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    try:
        updates = data.model_dump(exclude_unset=True)
        template = await service.update_template(org_id, template_id, updates)
        return RunTemplateResponse(
            id=template["id"],
            name=template["name"],
            description=template.get("description"),
            department_ids=template["department_ids"],
            concurrency=template["concurrency"],
            is_default=template["is_default"],
            created_at=template["created_at"],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Delete a run template.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    try:
        await service.delete_template(org_id, template_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
