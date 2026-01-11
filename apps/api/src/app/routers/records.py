from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.database import get_supabase_for_user
from app.models import (
    BookkeepingStatus,
    RecordCreate,
    RecordResponse,
    RecordUpdate,
    RemarkUpdate,
)

router = APIRouter(prefix="/records", tags=["records"])

# Fields that only Service VA/Admin can edit
SERVICE_FIELDS = {"status", "return_label_cost_cents"}

# Fields that Order VA can edit (everything except service fields)
ORDER_FIELDS = {
    "ebay_order_id",
    "sale_date",
    "item_name",
    "qty",
    "sale_price_cents",
    "ebay_fees_cents",
    "amazon_price_cents",
    "amazon_tax_cents",
    "amazon_shipping_cents",
    "amazon_order_id",
}


async def get_user_role_info(user_id: str, supabase) -> dict:
    """Get user's role and department from memberships table."""
    try:
        result = (
            supabase.table("memberships")
            .select("role, department")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            membership = result.data[0]
            role = membership.get("role")
            department = membership.get("department")
            return {
                "is_admin": role == "admin",
                "is_order_dept": department == "ordering",
                "is_service_dept": department in ("returns", "cs"),
                "department": department,
                "role": role,
            }
    except Exception:
        pass
    return {
        "is_admin": False,
        "is_order_dept": False,
        "is_service_dept": False,
        "department": None,
        "role": None,
    }


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
    user: dict = Depends(get_current_user),
):
    """Get bookkeeping records for an account with optional filters (filtered by RLS)."""
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=RecordResponse, status_code=201)
async def create_record(record: RecordCreate, user: dict = Depends(get_current_user)):
    """Create a new bookkeeping record (must have write access via RLS)."""
    try:
        supabase = get_supabase_for_user(user["token"])

        # Extract order_remark before inserting record
        order_remark_content = record.order_remark
        record_data = record.model_dump(mode="json", exclude={"order_remark"})

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
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{record_id}", response_model=RecordResponse)
async def update_record(
    record_id: str, record: RecordUpdate, user: dict = Depends(get_current_user)
):
    """Update a bookkeeping record with role-based field restrictions."""
    try:
        supabase = get_supabase_for_user(user["token"])

        # Get user's role info for field restriction
        role_info = await get_user_role_info(user["user_id"], supabase)

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

        # Enforce role-based field restrictions (unless admin)
        if not role_info["is_admin"]:
            requested_fields = set(update_data.keys())

            if role_info["is_order_dept"]:
                # Order VA can only edit order fields
                forbidden = requested_fields & SERVICE_FIELDS
                if forbidden:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Order department cannot edit: {', '.join(forbidden)}",
                    )
            elif role_info["is_service_dept"]:
                # Service VA can only edit service fields
                forbidden = requested_fields - SERVICE_FIELDS
                if forbidden:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Service department can only edit status and return_label_cost",
                    )
            else:
                # Other departments (general, listing) - no edit access to restricted fields
                forbidden = requested_fields & SERVICE_FIELDS
                if forbidden:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Cannot edit: {', '.join(forbidden)}",
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
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{record_id}", status_code=204)
async def delete_record(record_id: str, user: dict = Depends(get_current_user)):
    """Delete a bookkeeping record (admin-only via RLS)."""
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Remark Endpoints
# ============================================================


@router.get("/{record_id}/order-remark")
async def get_order_remark(
    record_id: str, user: dict = Depends(get_current_user)
) -> dict:
    """Get order remark for a record (RLS enforces department access)."""
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
    record_id: str, body: RemarkUpdate, user: dict = Depends(get_current_user)
) -> dict:
    """Update order remark for a record (RLS enforces department access)."""
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
    record_id: str, user: dict = Depends(get_current_user)
) -> dict:
    """Get service remark for a record (RLS enforces department access)."""
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
    record_id: str, body: RemarkUpdate, user: dict = Depends(get_current_user)
) -> dict:
    """Update service remark for a record (RLS enforces department access)."""
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
