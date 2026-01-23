"""Seller management endpoints.

Provides endpoints for:
- Seller CRUD (list, add, update, remove)
- Audit log retrieval
- Diff calculation between snapshots
- Export in multiple formats
"""

import csv
import io
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from app.auth import require_permission_key
from app.database import get_supabase
from app.models import (
    AuditLogEntry,
    AuditLogResponse,
    BulkOperationResponse,
    BulkSellerCreate,
    BulkSellerDelete,
    SellerCreate,
    SellerListResponse,
    SellerResponse,
    SellerUpdate,
)
from app.services.collection import CollectionService

router = APIRouter(prefix="/sellers", tags=["sellers"])
logger = logging.getLogger(__name__)


def get_collection_service() -> CollectionService:
    """Dependency to get CollectionService instance."""
    supabase = get_supabase()
    return CollectionService(supabase)


# ============================================================
# Seller CRUD
# ============================================================


@router.get("", response_model=SellerListResponse)
async def list_sellers(
    limit: int = 1000,
    offset: int = 0,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get all sellers for the organization.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    sellers, total = await service.get_sellers(org_id, limit=limit, offset=offset)

    return SellerListResponse(
        sellers=[
            SellerResponse(
                id=s["id"],
                display_name=s["display_name"],
                normalized_name=s["normalized_name"],
                platform=s["platform"],
                platform_id=s.get("platform_id"),
                times_seen=s["times_seen"],
                first_seen_run_id=s.get("first_seen_run_id"),
                last_seen_run_id=s.get("last_seen_run_id"),
                flagged=s.get("flagged", False),
                created_at=s["created_at"],
            )
            for s in sellers
        ],
        total=total,
    )


@router.post("", response_model=SellerResponse, status_code=201)
async def add_seller(
    data: SellerCreate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Add a new seller manually.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    try:
        seller = await service.add_seller(org_id, user_id, data.name, source="manual")
        return SellerResponse(
            id=seller["id"],
            display_name=seller["display_name"],
            normalized_name=seller["normalized_name"],
            platform=seller["platform"],
            platform_id=seller.get("platform_id"),
            times_seen=seller["times_seen"],
            first_seen_run_id=seller.get("first_seen_run_id"),
            last_seen_run_id=seller.get("last_seen_run_id"),
            created_at=seller["created_at"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# Bulk Operations (must be before /{seller_id} routes)
# ============================================================


@router.post("/bulk", response_model=BulkOperationResponse)
async def bulk_add_sellers(
    data: BulkSellerCreate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Bulk add sellers.

    Accepts a list of seller names and adds them all.
    Logs as a single audit entry.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    success_count, failed_count, errors = await service.bulk_add_sellers(
        org_id, user_id, data.names, source="manual"
    )

    return BulkOperationResponse(
        success_count=success_count,
        failed_count=failed_count,
        errors=errors[:10],  # Limit errors returned
    )


@router.post("/bulk/delete", response_model=BulkOperationResponse)
async def bulk_delete_sellers(
    data: BulkSellerDelete,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Bulk delete sellers.

    Accepts a list of seller IDs and removes them all.
    Logs as a single audit entry.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    success_count, failed_count, errors = await service.bulk_remove_sellers(
        org_id, user_id, data.ids, source="manual"
    )

    return BulkOperationResponse(
        success_count=success_count,
        failed_count=failed_count,
        errors=errors[:10],  # Limit errors returned
    )


@router.post("/{seller_id}/flag")
async def toggle_seller_flag(
    seller_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Toggle the flagged status of a seller.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    try:
        flagged = await service.toggle_seller_flag(org_id, seller_id)
        return {"id": seller_id, "flagged": flagged}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{seller_id}", response_model=SellerResponse)
async def update_seller(
    seller_id: str,
    data: SellerUpdate,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Update a seller's name.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    try:
        seller = await service.update_seller(org_id, user_id, seller_id, data.name)
        return SellerResponse(
            id=seller["id"],
            display_name=seller["display_name"],
            normalized_name=seller["normalized_name"],
            platform=seller["platform"],
            platform_id=seller.get("platform_id"),
            times_seen=seller["times_seen"],
            first_seen_run_id=seller.get("first_seen_run_id"),
            last_seen_run_id=seller.get("last_seen_run_id"),
            created_at=seller["created_at"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{seller_id}", status_code=204)
async def delete_seller(
    seller_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Remove a seller.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    try:
        await service.remove_seller(org_id, user_id, seller_id, source="manual")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================
# Audit Log
# ============================================================


@router.get("/audit-log", response_model=AuditLogResponse)
async def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get audit log of seller changes.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    entries, total = await service.get_audit_log(org_id, limit=limit, offset=offset)

    return AuditLogResponse(
        entries=[
            AuditLogEntry(
                id=e["id"],
                action=e["action"],
                seller_name=e["seller_name"],
                source=e["source"],
                source_run_id=e.get("source_run_id"),
                user_id=e.get("user_id"),
                created_at=e["created_at"],
                affected_count=e["affected_count"],
                seller_count_snapshot=e.get("seller_count_snapshot"),
            )
            for e in entries
        ],
        total=total,
    )


@router.get("/audit-log/{log_id}/sellers")
async def get_sellers_at_log(
    log_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Get the seller list as it was after a specific log entry, plus the diff for that entry.

    Returns:
        - sellers: Full seller list at that point in time
        - count: Number of sellers
        - added: Sellers added by this specific entry
        - removed: Sellers removed by this specific entry

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    try:
        sellers = await service.get_sellers_at_log(org_id, log_id)
        added, removed = await service.get_entry_diff(org_id, log_id)
        return {
            "sellers": sellers,
            "count": len(sellers),
            "added": added,
            "removed": removed,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================
# Export
# ============================================================


@router.get("/export")
async def export_sellers(
    format: str = "json",
    run_id: str | None = None,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Export sellers in specified format (json, csv, text).

    Optional run_id filter to export only sellers from a specific collection run.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    # Get sellers (optionally filtered by run)
    if run_id:
        sellers = await service.get_sellers_by_run(org_id, run_id)
    else:
        sellers, _ = await service.get_sellers(org_id, limit=100000)

    # Generate descriptive filename
    date_str = datetime.now().strftime("%Y-%m-%d")
    suffix = f"_run-{run_id[:8]}" if run_id else "_full"

    if format == "csv":
        # Full metadata CSV with proper headers
        stream = io.StringIO()
        fieldnames = [
            "display_name",
            "platform",
            "feedback_score",
            "times_seen",
            "discovered_at",
            "first_seen_run_id",
        ]
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()

        for s in sellers:
            writer.writerow(
                {
                    "display_name": s["display_name"],
                    "platform": s["platform"],
                    "feedback_score": s.get("feedback_score", ""),
                    "times_seen": s["times_seen"],
                    "discovered_at": s["created_at"],
                    "first_seen_run_id": s.get("first_seen_run_id", ""),
                }
            )

        filename = f"sellers_{date_str}{suffix}.csv"
        stream.seek(0)
        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    elif format == "text":
        # Plain text (names only, for clipboard pasting)
        content = "\n".join(s["display_name"] for s in sellers)
        return PlainTextResponse(content, media_type="text/plain")

    else:  # json (default)
        filename = f"sellers_{date_str}{suffix}.json"
        return JSONResponse(
            content={
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "run_id": run_id,
                "count": len(sellers),
                "sellers": [
                    {
                        "display_name": s["display_name"],
                        "platform": s["platform"],
                        "feedback_score": s.get("feedback_score"),
                        "times_seen": s["times_seen"],
                        "discovered_at": s["created_at"],
                        "first_seen_run_id": s.get("first_seen_run_id"),
                    }
                    for s in sellers
                ],
            },
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
