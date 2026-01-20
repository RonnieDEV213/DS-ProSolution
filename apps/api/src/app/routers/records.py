import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

logger = logging.getLogger(__name__)

from app.auth import get_current_user_with_membership, require_permission_key
from app.database import get_supabase_for_user
from app.models import (
    BookkeepingStatus,
    RecordCreate,
    RecordResponse,
    RecordUpdate,
    RemarkUpdate,
)

router = APIRouter(prefix="/records", tags=["records"])

# =============================================================================
# Field Groups for Permission Checks
# These must match exactly what RecordUpdate allows (models.py)
# =============================================================================

BASIC_FIELDS = {
    "item_name",
    "qty",
    "sale_date",
}

ORDER_FIELDS = {
    "ebay_order_id",
    "sale_price_cents",
    "ebay_fees_cents",
    "amazon_price_cents",
    "amazon_tax_cents",
    "amazon_shipping_cents",
    "amazon_order_id",
}

SERVICE_FIELDS = {
    "status",
    "return_label_cost_cents",
}

# Union of all mutable fields - anything outside this is rejected with 400
ALL_MUTABLE_FIELDS = BASIC_FIELDS | ORDER_FIELDS | SERVICE_FIELDS

# Fields allowed in RecordCreate (excluding account_id and order_remark which are handled separately)
# Note: status is allowed in create; return_label_cost_cents is NOT in RecordCreate
CREATE_ALLOWED_FIELDS = BASIC_FIELDS | ORDER_FIELDS | {"status"}


async def fetch_remarks_for_records(
    record_ids: list[str], supabase
) -> tuple[dict, dict]:
    """Fetch order and service remarks for a list of records.
    Returns (order_remarks_map, service_remarks_map) where keys are record_ids.
    RLS will automatically filter based on user's department access.
    """
    order_remarks = {}
    service_remarks = {}

    if not record_ids:
        return order_remarks, service_remarks

    # Fetch order remarks (RLS will filter if user doesn't have access)
    try:
        result = (
            supabase.table("order_remarks")
            .select("record_id, content")
            .in_("record_id", record_ids)
            .execute()
        )
        for row in result.data:
            order_remarks[row["record_id"]] = row["content"]
    except Exception:
        pass  # User doesn't have access to order_remarks

    # Fetch service remarks (RLS will filter if user doesn't have access)
    try:
        result = (
            supabase.table("service_remarks")
            .select("record_id, content")
            .in_("record_id", record_ids)
            .execute()
        )
        for row in result.data:
            service_remarks[row["record_id"]] = row["content"]
    except Exception:
        pass  # User doesn't have access to service_remarks

    return order_remarks, service_remarks


@router.get("", response_model=list[RecordResponse])
async def get_records(
    account_id: str = Query(..., description="Account ID to filter by"),
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    status: Optional[BookkeepingStatus] = Query(None, description="Filter by status"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """Get order tracking records (requires order_tracking.read)."""
    try:
        supabase = get_supabase_for_user(user["token"])
        query = supabase.table("bookkeeping_records").select("*").eq(
            "account_id", account_id
        )

        if date_from:
            query = query.gte("sale_date", date_from.isoformat())
        if date_to:
            query = query.lte("sale_date", date_to.isoformat())
        if status:
            query = query.eq("status", status.value)

        query = query.order("sale_date", desc=True)
        response = query.execute()

        if not response.data:
            return []

        # Fetch remarks for all records (RLS enforces department access)
        record_ids = [row["id"] for row in response.data]
        order_remarks, service_remarks = await fetch_remarks_for_records(
            record_ids, supabase
        )

        return [
            RecordResponse.from_db(
                row,
                order_remark=order_remarks.get(row["id"]),
                service_remark=service_remarks.get(row["id"]),
            )
            for row in response.data
        ]
    except Exception:
        logger.exception("Failed to list records")
        raise HTTPException(status_code=500, detail="Failed to fetch records")


@router.post("", response_model=RecordResponse, status_code=201)
async def create_record(
    record: RecordCreate,
    user: dict = Depends(get_current_user_with_membership),
):
    """Create a new order tracking record (requires field-level permissions)."""
    try:
        supabase = get_supabase_for_user(user["token"])

        # Extract order_remark before inserting record
        order_remark_content = record.order_remark
        record_data = record.model_dump(mode="json", exclude={"order_remark"})

        # Determine which fields are being set (non-None values, excluding account_id)
        provided_fields = {
            k for k, v in record_data.items() if v is not None and k != "account_id"
        }

        # 1. Reject unknown/forbidden fields (400)
        unknown_fields = provided_fields - CREATE_ALLOWED_FIELDS
        if unknown_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown or forbidden fields: {', '.join(sorted(unknown_fields))}",
            )

        # 2. Check field-level permissions (admin bypass)
        is_admin = user["membership"]["role"] == "admin"
        if not is_admin:
            permission_keys = set(user.get("permission_keys", []))

            # Check field-level permissions for each group
            if provided_fields & BASIC_FIELDS:
                if "order_tracking.write.basic_fields" not in permission_keys:
                    raise HTTPException(
                        status_code=403,
                        detail="Permission denied: cannot set basic fields (item_name, qty, sale_date)",
                    )

            if provided_fields & ORDER_FIELDS:
                if "order_tracking.write.order_fields" not in permission_keys:
                    raise HTTPException(
                        status_code=403,
                        detail="Permission denied: cannot set order fields (ebay_*, amazon_*, sale_price)",
                    )

            if provided_fields & SERVICE_FIELDS:
                if "order_tracking.write.service_fields" not in permission_keys:
                    raise HTTPException(
                        status_code=403,
                        detail="Permission denied: cannot set service fields (status)",
                    )

            # Must have at least one write permission to create
            has_any_write = (
                "order_tracking.write.basic_fields" in permission_keys
                or "order_tracking.write.order_fields" in permission_keys
                or "order_tracking.write.service_fields" in permission_keys
            )
            if not has_any_write:
                raise HTTPException(
                    status_code=403, detail="Permission denied: no write permissions"
                )

        # Insert record
        response = supabase.table("bookkeeping_records").insert(record_data).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create record")

        record_row = response.data[0]
        record_id = record_row["id"]

        # Insert order_remark if provided (RLS will check access)
        order_remark = None
        if order_remark_content:
            try:
                remark_result = (
                    supabase.table("order_remarks")
                    .upsert(
                        {
                            "record_id": record_id,
                            "content": order_remark_content,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "updated_by": user["user_id"],
                        },
                        on_conflict="record_id",
                    )
                    .execute()
                )
                if remark_result.data:
                    order_remark = order_remark_content
            except Exception:
                pass  # User doesn't have order_remark access, ignore

        return RecordResponse.from_db(record_row, order_remark=order_remark)
    except HTTPException:
        raise
    except Exception as e:
        if "unique_account_ebay_order" in str(e):
            raise HTTPException(
                status_code=409,
                detail="Record with this eBay order ID already exists for this account",
            )
        logger.exception("Failed to create record")
        raise HTTPException(status_code=500, detail="Failed to create record")


@router.patch("/{record_id}", response_model=RecordResponse)
async def update_record(
    record_id: str,
    record: RecordUpdate,
    user: dict = Depends(get_current_user_with_membership),
):
    """Update an order tracking record with strict field-level permissions."""
    try:
        supabase = get_supabase_for_user(user["token"])

        # Only include explicitly provided fields (exclude_unset=True)
        update_data = record.model_dump(mode="json", exclude_unset=True)

        # Normalize empty strings to None for all string fields
        for k, v in list(update_data.items()):
            if isinstance(v, str):
                stripped = v.strip()
                update_data[k] = stripped if stripped else None

        # Handle empty payload as no-op: return existing record without updating
        if not update_data:
            response = (
                supabase.table("bookkeeping_records")
                .select("*")
                .eq("id", record_id)
                .execute()
            )
            if not response.data:
                raise HTTPException(status_code=404, detail="Record not found")
            order_remarks, service_remarks = await fetch_remarks_for_records(
                [record_id], supabase
            )
            return RecordResponse.from_db(
                response.data[0],
                order_remark=order_remarks.get(record_id),
                service_remark=service_remarks.get(record_id),
            )

        requested_fields = set(update_data.keys())

        # 1. Reject unknown/forbidden fields (400)
        unknown_fields = requested_fields - ALL_MUTABLE_FIELDS
        if unknown_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown or forbidden fields: {', '.join(sorted(unknown_fields))}",
            )

        # 2. Check field-level permissions (admin bypass)
        is_admin = user["membership"]["role"] == "admin"
        if not is_admin:
            permission_keys = set(user.get("permission_keys", []))

            # Check each field group
            if requested_fields & BASIC_FIELDS:
                if "order_tracking.write.basic_fields" not in permission_keys:
                    raise HTTPException(
                        status_code=403,
                        detail="Permission denied: cannot edit basic fields (item_name, qty, sale_date)",
                    )

            if requested_fields & ORDER_FIELDS:
                if "order_tracking.write.order_fields" not in permission_keys:
                    raise HTTPException(
                        status_code=403,
                        detail="Permission denied: cannot edit order fields (ebay_*, amazon_*, sale_price)",
                    )

            if requested_fields & SERVICE_FIELDS:
                if "order_tracking.write.service_fields" not in permission_keys:
                    raise HTTPException(
                        status_code=403,
                        detail="Permission denied: cannot edit service fields (status, return_label_cost)",
                    )

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = (
            supabase.table("bookkeeping_records")
            .update(update_data)
            .eq("id", record_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Record not found")

        # Fetch remarks for the updated record
        order_remarks, service_remarks = await fetch_remarks_for_records(
            [record_id], supabase
        )

        return RecordResponse.from_db(
            response.data[0],
            order_remark=order_remarks.get(record_id),
            service_remark=service_remarks.get(record_id),
        )
    except HTTPException:
        raise
    except Exception as e:
        if "unique_account_ebay_order" in str(e):
            raise HTTPException(
                status_code=409,
                detail="eBay order ID already exists for this account",
            )
        logger.exception("Failed to update record %s", record_id)
        raise HTTPException(status_code=500, detail="Failed to update record")


@router.delete("/{record_id}", status_code=204)
async def delete_record(
    record_id: str,
    user: dict = Depends(require_permission_key("order_tracking.delete")),
):
    """Delete an order tracking record (requires order_tracking.delete permission)."""
    try:
        supabase = get_supabase_for_user(user["token"])
        response = (
            supabase.table("bookkeeping_records")
            .delete()
            .eq("id", record_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Record not found")

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to delete record %s", record_id)
        raise HTTPException(status_code=500, detail="Failed to delete record")


# ============================================================
# Remark Endpoints
# ============================================================


@router.get("/{record_id}/order-remark")
async def get_order_remark(
    record_id: str,
    user: dict = Depends(require_permission_key("order_tracking.read.order_remark")),
) -> dict:
    """Get order remark for a record (requires order_tracking.read.order_remark)."""
    try:
        supabase = get_supabase_for_user(user["token"])
        result = (
            supabase.table("order_remarks")
            .select("content, updated_at, updated_by")
            .eq("record_id", record_id)
            .execute()
        )

        if not result.data:
            return {"content": None, "updated_at": None, "updated_by": None}

        return result.data[0]
    except Exception as e:
        # RLS denial or other error
        raise HTTPException(status_code=403, detail="Access denied")


@router.patch("/{record_id}/order-remark")
async def update_order_remark(
    record_id: str,
    body: RemarkUpdate,
    user: dict = Depends(require_permission_key("order_tracking.write.order_remark")),
) -> dict:
    """Update order remark for a record (requires order_tracking.write.order_remark)."""
    try:
        supabase = get_supabase_for_user(user["token"])

        result = (
            supabase.table("order_remarks")
            .upsert(
                {
                    "record_id": record_id,
                    "content": body.content,
                },
                on_conflict="record_id",
            )
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=403, detail="Access denied")

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/{record_id}/service-remark")
async def get_service_remark(
    record_id: str,
    user: dict = Depends(require_permission_key("order_tracking.read.service_remark")),
) -> dict:
    """Get service remark for a record (requires order_tracking.read.service_remark)."""
    try:
        supabase = get_supabase_for_user(user["token"])
        result = (
            supabase.table("service_remarks")
            .select("content, updated_at, updated_by")
            .eq("record_id", record_id)
            .execute()
        )

        if not result.data:
            return {"content": None, "updated_at": None, "updated_by": None}

        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=403, detail="Access denied")


@router.patch("/{record_id}/service-remark")
async def update_service_remark(
    record_id: str,
    body: RemarkUpdate,
    user: dict = Depends(require_permission_key("order_tracking.write.service_remark")),
) -> dict:
    """Update service remark for a record (requires order_tracking.write.service_remark)."""
    try:
        supabase = get_supabase_for_user(user["token"])

        result = (
            supabase.table("service_remarks")
            .upsert(
                {
                    "record_id": record_id,
                    "content": body.content,
                },
                on_conflict="record_id",
            )
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=403, detail="Access denied")

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=403, detail="Access denied")
