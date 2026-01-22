"""Collection endpoints for seller collection runs.

Admin endpoints for:
- Settings configuration
- Run CRUD (create, list, pause, cancel)
- Progress tracking (placeholder for WebSocket in later phase)
- Schedule configuration (cron-based automated runs)
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.auth import require_permission_key, require_permission_key_flexible
from app.services.activity_stream import get_activity_stream
from app.database import get_supabase
from app.models import (
    CollectionHistoryEntry,
    CollectionHistoryResponse,
    CollectionRunCreate,
    CollectionRunListResponse,
    CollectionRunResponse,
    CollectionScheduleResponse,
    CollectionScheduleUpdate,
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
from app.services.scheduler import (
    add_schedule,
    get_next_run_time,
    remove_schedule,
    validate_cron,
)

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


@router.get("/runs/history", response_model=CollectionHistoryResponse)
async def get_collection_history(
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get collection run history with full statistics.

    Returns completed, failed, and cancelled runs sorted by completion time.
    Includes duration calculation and seller counts.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    runs, total = await service.get_history(org_id, limit=limit, offset=offset)

    return CollectionHistoryResponse(
        runs=[
            CollectionHistoryEntry(
                id=r["id"],
                name=r["name"],
                status=r["status"],
                started_at=r.get("started_at"),
                completed_at=r.get("completed_at"),
                duration_seconds=r.get("duration_seconds"),
                categories_count=r["categories_count"],
                products_total=r["products_total"],
                products_searched=r["products_searched"],
                sellers_found=r["sellers_found"],
                sellers_new=r["sellers_new"],
                failed_items=r["failed_items"],
                created_by=r["created_by"],
                seller_count_snapshot=r.get("seller_count_snapshot"),
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


@router.get("/runs/{run_id}/breakdown")
async def get_run_breakdown(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Get per-category breakdown for a completed run.

    Returns products and sellers counts grouped by category.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    supabase = get_supabase()

    # Verify run exists and belongs to org
    run_result = (
        supabase.table("collection_runs")
        .select("id, status")
        .eq("id", run_id)
        .eq("org_id", org_id)
        .execute()
    )
    if not run_result.data:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get all items for this run, extract category_id from data JSONB
    items_result = (
        supabase.table("collection_items")
        .select("data")
        .eq("run_id", run_id)
        .execute()
    )

    # Aggregate by category
    category_stats: dict[str, dict] = {}
    for item in items_result.data or []:
        data = item.get("data", {}) or {}
        cat_id = data.get("category_id", "unknown")
        if cat_id not in category_stats:
            category_stats[cat_id] = {
                "category_id": cat_id,
                "products_count": 0,
                "sellers_found": 0,
            }
        category_stats[cat_id]["products_count"] += 1
        # If item has sellers_found in data, add it
        category_stats[cat_id]["sellers_found"] += data.get("sellers_found", 0)

    return {
        "run_id": run_id,
        "categories": list(category_stats.values()),
    }


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
        try:
            logger.info(f"Starting collection pipeline for run {run_id}")

            # Phase 1: Amazon collection
            amazon_result = await service.run_amazon_collection(
                run_id=run_id,
                org_id=org_id,
                category_ids=run["category_ids"],
            )

            # If Amazon failed or was paused/cancelled, don't continue to eBay
            if amazon_result.get("status") in ("failed", "paused", "cancelled"):
                logger.info(f"Collection {run_id} ended after Amazon phase: {amazon_result.get('status')}")
                return

            # Brief pause to let UI show Amazon phase at 100% before transitioning
            print(f"\n[COLLECTION] Transitioning to eBay phase in 3 seconds...")
            await asyncio.sleep(3)

            # Phase 2: eBay seller search
            await service.run_ebay_seller_search(run_id=run_id, org_id=org_id)
            logger.info(f"Collection {run_id} completed")

        except Exception as e:
            logger.exception(f"Collection pipeline failed for {run_id}: {e}")

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
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Resume a paused collection.

    This restarts the background task from where it left off using checkpoint data.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    # First update the status
    result = await service.resume_run(run_id, org_id)

    if "error" in result:
        if result["error"] == "not_found":
            raise HTTPException(status_code=404, detail=result["message"])
        else:
            raise HTTPException(status_code=400, detail=result["message"])

    # Get run data to check checkpoint and determine where to resume
    run = await service.get_run(run_id, org_id)
    checkpoint = run.get("checkpoint") or {}
    phase = checkpoint.get("phase", "amazon")

    # Restart background task from checkpoint
    async def resume_collection():
        try:
            logger.info(f"Resuming collection pipeline for run {run_id} from phase: {phase}")

            if phase in ("amazon", None):
                # Resume or restart Amazon collection
                amazon_result = await service.run_amazon_collection(
                    run_id=run_id,
                    org_id=org_id,
                    category_ids=run["category_ids"],
                )

                # If Amazon failed or was paused/cancelled, don't continue to eBay
                if amazon_result.get("status") in ("failed", "paused", "cancelled"):
                    logger.info(f"Collection {run_id} ended after Amazon phase: {amazon_result.get('status')}")
                    return

                # Brief pause before transitioning
                print(f"\n[COLLECTION] Transitioning to eBay phase in 3 seconds...")
                await asyncio.sleep(3)

                # Phase 2: eBay seller search
                await service.run_ebay_seller_search(run_id=run_id, org_id=org_id)

            elif phase == "amazon_complete":
                # Amazon done, start eBay
                print(f"\n[COLLECTION] Resuming from eBay phase...")
                await service.run_ebay_seller_search(run_id=run_id, org_id=org_id)

            elif phase == "ebay_search":
                # Resume eBay search
                print(f"\n[COLLECTION] Resuming eBay search from checkpoint...")
                await service.run_ebay_seller_search(run_id=run_id, org_id=org_id)

            logger.info(f"Collection {run_id} completed after resume")

        except Exception as e:
            logger.exception(f"Resumed collection pipeline failed for {run_id}: {e}")

    background_tasks.add_task(resume_collection)

    return {"ok": True, "status": "running", "message": f"Collection resumed from {phase} phase"}


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
            phase=progress.get("phase", "amazon"),
            products_found=progress.get("products_found", 0),
            started_at=progress.get("started_at"),
            checkpoint=progress.get("checkpoint"),
            departments_total=progress["departments_total"] or 0,
            departments_completed=progress["departments_completed"] or 0,
            categories_total=progress["categories_total"] or 0,
            categories_completed=progress["categories_completed"] or 0,
            products_total=progress["products_total"] or 0,
            products_searched=progress["products_searched"] or 0,
            sellers_found=progress["sellers_found"] or 0,
            sellers_new=progress["sellers_new"] or 0,
            worker_status=[
                WorkerStatus(**w) for w in (progress["worker_status"] or [])
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


async def verify_token_for_sse(token: str | None) -> dict:
    """
    Verify JWT token from query param for SSE endpoints.

    EventSource doesn't support Authorization headers, so we accept
    the token as a query parameter instead.

    .. deprecated::
        Use :func:`app.auth.require_permission_key_flexible` instead.
        This function is kept for backwards compatibility.
    """
    import jwt as pyjwt
    import os

    if not token:
        raise HTTPException(status_code=401, detail="Token required")

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET")

    try:
        unverified_header = pyjwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        if alg == "HS256":
            if not supabase_jwt_secret:
                raise HTTPException(status_code=500, detail="JWT secret not configured")
            payload = pyjwt.decode(
                token,
                supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=f"{supabase_url}/auth/v1",
            )
        else:
            from jwt import PyJWKClient
            jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            jwks_client = PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience="authenticated",
                issuer=f"{supabase_url}/auth/v1",
            )

        user_id = payload["sub"]

        # Fetch membership to get org_id
        supabase = get_supabase()
        default_org_id = "a0000000-0000-0000-0000-000000000001"

        membership_result = (
            supabase.table("memberships")
            .select("id, role, org_id")
            .eq("user_id", user_id)
            .eq("org_id", default_org_id)
            .execute()
        )

        if not membership_result.data:
            raise HTTPException(status_code=403, detail="No membership found")

        membership = membership_result.data[0]

        # Only allow admins for automation endpoints
        if membership["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin required")

        return {"user_id": user_id, "membership": membership}

    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


@router.get("/runs/{run_id}/activity")
async def stream_activity(
    run_id: str,
    user: dict = Depends(require_permission_key_flexible("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Stream real-time activity events for a collection run via SSE.

    Events include:
    - fetching: Worker starting to fetch a category/product
    - found: Sellers found for a product
    - error: Error occurred
    - rate_limited: Waiting due to rate limit
    - complete: Phase or run complete

    Accepts token via query param or Authorization header.
    Uses flexible auth for EventSource compatibility.
    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    # Verify run exists and belongs to org
    run = await service.get_run(run_id, org_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    stream_manager = get_activity_stream()
    queue = await stream_manager.get_or_create(run_id)

    async def event_generator():
        """Generate SSE events from activity queue."""
        while True:
            try:
                # Wait for event with timeout for keepalive
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Send keepalive comment
                yield ": keepalive\n\n"
            except asyncio.CancelledError:
                # Client disconnected
                break
            except Exception as e:
                logger.error(f"Activity stream error: {e}")
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


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


# ============================================================
# Schedule Endpoints
# ============================================================


@router.get("/schedule", response_model=CollectionScheduleResponse)
async def get_schedule(
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get collection schedule for the organization.

    Returns current schedule configuration or defaults if none exists.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    supabase = get_supabase()

    # Get schedule with preset name join
    result = (
        supabase.table("collection_schedules")
        .select("*, amazon_category_presets(name)")
        .eq("org_id", org_id)
        .execute()
    )

    if not result.data:
        # Return defaults (no schedule configured)
        return CollectionScheduleResponse(
            cron_expression="0 0 1 * *",  # 1st of month at midnight
            enabled=False,
            notify_email=False,
        )

    schedule = result.data[0]
    preset_data = schedule.get("amazon_category_presets")

    # Get next run time from scheduler
    next_run = get_next_run_time(schedule["id"]) if schedule.get("enabled") else None

    return CollectionScheduleResponse(
        id=schedule["id"],
        preset_id=schedule.get("preset_id"),
        preset_name=preset_data["name"] if preset_data else None,
        cron_expression=schedule["cron_expression"],
        enabled=schedule["enabled"],
        notify_email=schedule["notify_email"],
        last_run_at=schedule.get("last_run_at"),
        next_run_at=next_run.isoformat() if next_run else None,
    )


@router.patch("/schedule", response_model=CollectionScheduleResponse)
async def update_schedule(
    body: CollectionScheduleUpdate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Update collection schedule.

    Creates schedule if none exists. Validates cron expression.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    supabase = get_supabase()

    # Validate cron if provided
    if body.cron_expression and not validate_cron(body.cron_expression):
        raise HTTPException(status_code=400, detail="Invalid cron expression")

    # Check if schedule exists
    existing = (
        supabase.table("collection_schedules")
        .select("id")
        .eq("org_id", org_id)
        .execute()
    )

    update_data = body.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if existing.data:
        # Update existing
        schedule_id = existing.data[0]["id"]
        result = (
            supabase.table("collection_schedules")
            .update(update_data)
            .eq("id", schedule_id)
            .execute()
        )
        schedule = result.data[0]

        # Update scheduler
        if schedule["enabled"] and schedule.get("preset_id"):
            add_schedule(
                schedule_id,
                org_id,
                schedule["preset_id"],
                schedule["cron_expression"],
            )
        else:
            remove_schedule(schedule_id)
    else:
        # Create new
        insert_data = {
            "org_id": org_id,
            "cron_expression": body.cron_expression or "0 0 1 * *",
            "preset_id": body.preset_id,
            "enabled": body.enabled or False,
            "notify_email": body.notify_email or False,
        }
        result = (
            supabase.table("collection_schedules")
            .insert(insert_data)
            .execute()
        )
        schedule = result.data[0]

        # Add to scheduler if enabled
        if schedule["enabled"] and schedule.get("preset_id"):
            add_schedule(
                schedule["id"],
                org_id,
                schedule["preset_id"],
                schedule["cron_expression"],
            )

    # Get preset name
    preset_name = None
    if schedule.get("preset_id"):
        preset_result = (
            supabase.table("amazon_category_presets")
            .select("name")
            .eq("id", schedule["preset_id"])
            .execute()
        )
        if preset_result.data:
            preset_name = preset_result.data[0]["name"]

    # Get next run time
    next_run = get_next_run_time(schedule["id"]) if schedule.get("enabled") else None

    return CollectionScheduleResponse(
        id=schedule["id"],
        preset_id=schedule.get("preset_id"),
        preset_name=preset_name,
        cron_expression=schedule["cron_expression"],
        enabled=schedule["enabled"],
        notify_email=schedule["notify_email"],
        last_run_at=schedule.get("last_run_at"),
        next_run_at=next_run.isoformat() if next_run else None,
    )
