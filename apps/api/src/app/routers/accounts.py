from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import get_supabase_for_user
from app.models import AccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
async def get_accounts(user: dict = Depends(get_current_user)):
    """Get accounts accessible to the current user (filtered by RLS)."""
    try:
        supabase = get_supabase_for_user(user["token"])
        response = supabase.table("accounts").select("id, account_code, name").execute()
        return [AccountResponse(**row) for row in response.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
