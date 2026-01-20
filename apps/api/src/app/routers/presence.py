"""Presence management endpoints.

Admin endpoints:
- DELETE /presence/{account_id}: Force-clear presence from account
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user_with_membership
from app.database import get_supabase
from app.services.presence import clear_presence_by_account

router = APIRouter(prefix="/presence", tags=["presence"])
logger = logging.getLogger(__name__)


@router.delete("/{account_id}")
async def admin_clear_presence(
    account_id: str,
    user: dict = Depends(get_current_user_with_membership),
):
    """Force-clear presence from an account (admin only).

    Used to remove orphaned presence entries when a VA's session
    becomes stale or they close the browser without logging out.
    """
    membership = user["membership"]
    if membership.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    supabase = get_supabase()
    org_id = membership["org_id"]

    success = await clear_presence_by_account(supabase, account_id, org_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear presence")

    logger.info(f"Admin cleared presence from account {account_id}")

    return {"status": "cleared"}
