from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user_with_membership
from app.database import get_supabase
from app.models import AccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
async def get_accounts(user: dict = Depends(get_current_user_with_membership)):
    """
    Get accounts accessible to the current user.

    For VAs: Returns only assigned accounts (via account_assignments).
    For Admins: Returns all accounts (but admins should use /admin/accounts for full data).

    Requires accounts.view permission for VAs, or admin role.
    """
    membership = user["membership"]
    role = membership.get("role")
    user_id = user["user_id"]
    org_id = membership["org_id"]

    # Admins can see all accounts (but typically use /admin/accounts)
    if role == "admin":
        supabase = get_supabase()
        response = (
            supabase.table("accounts")
            .select("id, account_code, name")
            .eq("org_id", org_id)
            .order("account_code")
            .execute()
        )
        return [AccountResponse(**row) for row in response.data or []]

    # VAs need accounts.view permission
    permission_keys = user.get("permission_keys", [])
    if "accounts.view" not in permission_keys:
        raise HTTPException(
            status_code=403,
            detail="accounts.view permission required"
        )

    # VAs see only assigned accounts
    supabase = get_supabase()
    result = (
        supabase.table("account_assignments")
        .select("accounts(id, account_code, name)")
        .eq("user_id", user_id)
        .execute()
    )

    # Flatten the response - extract accounts from joined data
    accounts = []
    for row in result.data or []:
        if row.get("accounts"):
            accounts.append(AccountResponse(**row["accounts"]))

    return accounts
