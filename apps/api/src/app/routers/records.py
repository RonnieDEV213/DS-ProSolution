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
)

router = APIRouter(prefix="/records", tags=["records"])


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

        return [RecordResponse.from_db(row) for row in response.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=RecordResponse, status_code=201)
async def create_record(record: RecordCreate, user: dict = Depends(get_current_user)):
    """Create a new bookkeeping record (must have write access via RLS)."""
    try:
        supabase = get_supabase_for_user(user["token"])
        data = record.model_dump(mode="json")
        response = supabase.table("bookkeeping_records").insert(data).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create record")

        return RecordResponse.from_db(response.data[0])
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
    """Update a bookkeeping record (must have write access via RLS)."""
    try:
        supabase = get_supabase_for_user(user["token"])

        # Only include non-None fields in update
        update_data = {k: v for k, v in record.model_dump(mode="json").items() if v is not None}

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        response = (
            supabase.table("bookkeeping_records")
            .update(update_data)
            .eq("id", record_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Record not found")

        return RecordResponse.from_db(response.data[0])
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
