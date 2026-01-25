"""Sync endpoints with cursor-based pagination for client sync."""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import require_permission_key
from app.database import get_supabase_for_user
from app.models import (
    BookkeepingStatus,
    RecordSyncItem,
    RecordSyncResponse,
    AccountSyncItem,
    AccountSyncResponse,
    SellerSyncItem,
    SellerSyncResponse,
)
from app.pagination import encode_cursor, decode_cursor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["sync"])


def _apply_cursor_filter(query, cursor: Optional[str], table_has_account_scope: bool = False):
    """
    Apply cursor filter for DESC ordering pagination.

    For ORDER BY updated_at DESC, id DESC, we want records where:
    (updated_at, id) < (cursor_updated_at, cursor_id)

    Supabase-py doesn't support tuple comparison, so we use OR pattern:
    updated_at < cursor_updated_at OR (updated_at = cursor_updated_at AND id < cursor_id)
    """
    if not cursor:
        return query

    try:
        cursor_updated_at, cursor_id = decode_cursor(cursor)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_CURSOR", "message": "The provided cursor is invalid or malformed"},
        )

    # Compound cursor comparison for DESC ordering
    # Format: updated_at.lt.{value},and(updated_at.eq.{value},id.lt.{id})
    cursor_filter = (
        f"updated_at.lt.{cursor_updated_at.isoformat()},"
        f"and(updated_at.eq.{cursor_updated_at.isoformat()},id.lt.{cursor_id})"
    )
    return query.or_(cursor_filter)


def _build_response(items: list, limit: int, item_class, remarks: tuple[dict, dict] | None = None):
    """Build paginated response with has_more detection.

    Args:
        items: List of database rows
        limit: Page size limit
        item_class: Model class with from_db method
        remarks: Optional tuple of (order_remarks_map, service_remarks_map) for records
    """
    has_more = len(items) > limit
    if has_more:
        items = items[:limit]

    # Build next cursor from last item
    next_cursor = None
    if has_more and items:
        last = items[-1]
        # Handle both dict and model instances
        if isinstance(last, dict):
            updated_at = last["updated_at"]
            if isinstance(updated_at, str):
                updated_at = datetime.fromisoformat(updated_at)
            next_cursor = encode_cursor(updated_at, last["id"])
        else:
            next_cursor = encode_cursor(last.updated_at, last.id)

    # Build items with remarks if provided
    if remarks is not None:
        order_remarks, service_remarks = remarks
        converted_items = [
            item_class.from_db(
                i,
                order_remark=order_remarks.get(i["id"]),
                service_remark=service_remarks.get(i["id"]),
            ) if isinstance(i, dict) else i
            for i in items
        ]
    else:
        converted_items = [item_class.from_db(i) if isinstance(i, dict) else i for i in items]

    return {
        "items": converted_items,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "total_estimate": None,  # Can add pg_class estimate later if needed
    }


# =============================================================================
# Records Sync
# =============================================================================


@router.get("/records", response_model=RecordSyncResponse)
async def sync_records(
    account_id: str = Query(..., description="Account ID to fetch records for"),
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(50, ge=1, le=100, description="Page size (1-100)"),
    # Filters
    status: Optional[BookkeepingStatus] = Query(None, description="Filter by status"),
    updated_since: Optional[datetime] = Query(None, description="Only records updated after this time (ISO 8601)"),
    include_deleted: bool = Query(False, description="Include soft-deleted records (for full sync)"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Fetch records for sync with cursor-based pagination.

    **Pagination:**
    - First request: omit cursor
    - Subsequent requests: pass next_cursor from previous response
    - Stop when has_more is false

    **Filters:**
    - updated_since: Only return records updated after this timestamp (for incremental sync)
    - status: Filter by booking status
    - include_deleted: Include soft-deleted records (needed for sync to detect deletions)

    **Sort order:** updated_at DESC, id DESC (newest updates first)
    """
    try:
        supabase = get_supabase_for_user(user["token"])

        # Build base query with sync columns
        query = (
            supabase.table("bookkeeping_records")
            .select("*")
            .eq("account_id", account_id)
            .order("updated_at", desc=True)
            .order("id", desc=True)
            .limit(limit + 1)  # Extra for has_more detection
        )

        # Apply soft-delete filter (unless sync needs deletions)
        if not include_deleted:
            query = query.is_("deleted_at", "null")

        # Apply cursor filter
        query = _apply_cursor_filter(query, cursor)

        # Apply filters
        if status:
            query = query.eq("status", status.value)
        if updated_since:
            query = query.gte("updated_at", updated_since.isoformat())

        result = query.execute()
        records = result.data or []

        # Fetch remarks for records (RLS will filter based on user's access)
        record_ids = [r["id"] for r in records]
        order_remarks: dict[str, str] = {}
        service_remarks: dict[str, str] = {}

        if record_ids:
            # Fetch order remarks (silently skip if user lacks permission)
            try:
                order_result = (
                    supabase.table("order_remarks")
                    .select("record_id, content")
                    .in_("record_id", record_ids)
                    .execute()
                )
                logger.info(f"Fetched {len(order_result.data or [])} order remarks for {len(record_ids)} records")
                for row in order_result.data or []:
                    order_remarks[row["record_id"]] = row["content"]
            except Exception as e:
                logger.warning(f"Failed to fetch order remarks: {e}")

            # Fetch service remarks (silently skip if user lacks permission)
            try:
                service_result = (
                    supabase.table("service_remarks")
                    .select("record_id, content")
                    .in_("record_id", record_ids)
                    .execute()
                )
                for row in service_result.data or []:
                    service_remarks[row["record_id"]] = row["content"]
            except Exception as e:
                logger.warning(f"Failed to fetch service remarks: {e}")

        return _build_response(records, limit, RecordSyncItem, remarks=(order_remarks, service_remarks))

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to sync records")
        raise HTTPException(status_code=500, detail="Failed to fetch records")


# =============================================================================
# Accounts Sync
# =============================================================================


@router.get("/accounts", response_model=AccountSyncResponse)
async def sync_accounts(
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(50, ge=1, le=100, description="Page size (1-100)"),
    updated_since: Optional[datetime] = Query(None, description="Only accounts updated after this time"),
    include_deleted: bool = Query(False, description="Include soft-deleted accounts"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Fetch accounts for sync with cursor-based pagination.

    Accounts are organization-scoped via RLS (user sees accounts for their org).
    """
    try:
        supabase = get_supabase_for_user(user["token"])

        query = (
            supabase.table("accounts")
            .select("id, account_code, name, updated_at, deleted_at")
            .order("updated_at", desc=True)
            .order("id", desc=True)
            .limit(limit + 1)
        )

        if not include_deleted:
            query = query.is_("deleted_at", "null")

        query = _apply_cursor_filter(query, cursor)

        if updated_since:
            query = query.gte("updated_at", updated_since.isoformat())

        result = query.execute()
        accounts = result.data or []

        return _build_response(accounts, limit, AccountSyncItem)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to sync accounts")
        raise HTTPException(status_code=500, detail="Failed to fetch accounts")


# =============================================================================
# Sellers Sync
# =============================================================================


@router.get("/sellers", response_model=SellerSyncResponse)
async def sync_sellers(
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(50, ge=1, le=100, description="Page size (1-100)"),
    updated_since: Optional[datetime] = Query(None, description="Only sellers updated after this time"),
    include_deleted: bool = Query(False, description="Include soft-deleted sellers"),
    flagged: Optional[bool] = Query(None, description="Filter by flagged status"),
    user: dict = Depends(require_permission_key("seller_collection.read")),
):
    """
    Fetch sellers for sync with cursor-based pagination.

    Sellers are organization-scoped via RLS.
    """
    try:
        supabase = get_supabase_for_user(user["token"])

        query = (
            supabase.table("sellers")
            .select("id, display_name, normalized_name, platform, platform_id, times_seen, flagged, updated_at, deleted_at")
            .order("updated_at", desc=True)
            .order("id", desc=True)
            .limit(limit + 1)
        )

        if not include_deleted:
            query = query.is_("deleted_at", "null")

        query = _apply_cursor_filter(query, cursor)

        if updated_since:
            query = query.gte("updated_at", updated_since.isoformat())

        if flagged is not None:
            query = query.eq("flagged", flagged)

        result = query.execute()
        sellers = result.data or []

        return _build_response(sellers, limit, SellerSyncItem)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to sync sellers")
        raise HTTPException(status_code=500, detail="Failed to fetch sellers")
