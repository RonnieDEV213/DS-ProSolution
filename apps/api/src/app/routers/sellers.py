"""Seller management endpoints.

Provides endpoints for:
- Seller CRUD (list, add, update, remove)
- Audit log retrieval
- Diff calculation between snapshots
- Export in multiple formats
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from app.auth import require_permission_key
from app.database import get_supabase
from app.models import (
    AuditLogEntry,
    AuditLogResponse,
    DiffRequest,
    SellerCreate,
    SellerDiff,
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
    Get the seller list as it was after a specific log entry.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    try:
        sellers = await service.get_sellers_at_log(org_id, log_id)
        return {"sellers": sellers, "count": len(sellers)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================
# Diff
# ============================================================


@router.post("/diff", response_model=SellerDiff)
async def calculate_diff(
    request: DiffRequest,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Calculate diff between two seller snapshots.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]

    # Get source sellers
    if request.source == "current":
        source_sellers_data, _ = await service.get_sellers(org_id, limit=100000)
        source_sellers = [s["display_name"] for s in source_sellers_data]
    else:
        if not request.source_id:
            raise HTTPException(
                status_code=400, detail="source_id required when source is 'log'"
            )
        try:
            source_sellers = await service.get_sellers_at_log(org_id, request.source_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    # Get target sellers
    if request.target == "current":
        target_sellers_data, _ = await service.get_sellers(org_id, limit=100000)
        target_sellers = [s["display_name"] for s in target_sellers_data]
    else:
        if not request.target_id:
            raise HTTPException(
                status_code=400, detail="target_id required when target is 'log'"
            )
        try:
            target_sellers = await service.get_sellers_at_log(org_id, request.target_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

    diff = await service.calculate_diff(source_sellers, target_sellers)
    return SellerDiff(**diff)


# ============================================================
# Export
# ============================================================


@router.get("/export")
async def export_sellers(
    format: str = "json",
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """
    Export all sellers in specified format (json, csv, text).

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    sellers, _ = await service.get_sellers(org_id, limit=100000)
    names = [s["display_name"] for s in sellers]

    if format == "csv":
        content = "seller_name\n" + "\n".join(names)
        return PlainTextResponse(
            content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=sellers.csv"},
        )
    elif format == "text":
        content = "\n".join(names)
        return PlainTextResponse(content, media_type="text/plain")
    else:  # json
        return {"sellers": names, "count": len(names)}
