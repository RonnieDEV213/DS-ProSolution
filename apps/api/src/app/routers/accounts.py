from fastapi import APIRouter, HTTPException

from app.database import get_supabase
from app.models import AccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
async def get_accounts():
    """Get all accounts for dropdown selection."""
    try:
        supabase = get_supabase()
        response = supabase.table("accounts").select("id, account_code, name").execute()
        return [AccountResponse(**row) for row in response.data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
