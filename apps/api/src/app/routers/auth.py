"""Authentication endpoints including bootstrap for invite-only access."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user, DEFAULT_ORG_ID
from app.database import get_supabase
from app.models import BootstrapResponse, MembershipResponse, ProfileResponse

router = APIRouter(tags=["auth"])


@router.post("/auth/bootstrap", response_model=BootstrapResponse)
async def bootstrap_profile(user: dict = Depends(get_current_user)):
    """
    Bootstrap user profile and membership after login.

    This endpoint ensures the user has a profile and membership.
    For new users, it creates a membership from their invite (with status='pending').
    For existing users, it returns their current profile and membership.

    This is idempotent - safe to call multiple times.

    Flow:
    1. Check if profile exists; if not, create from auth metadata
    2. Check if membership exists for (user_id, org_id)
    3. If no membership: look for active invite by email
       - If invite found: create membership with status='pending', mark invite used
       - If no invite: return 403 "No valid invite"
    4. Return profile + membership data

    Returns:
        BootstrapResponse with profile, membership, and is_new flag
    """
    supabase = get_supabase()
    user_id = user["user_id"]
    is_new = False

    # Step 1: Check/create profile
    profile_result = (
        supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    )

    if not profile_result.data:
        # Profile should have been created by trigger, but handle edge case
        # We need to get user email from auth.users (service role can access)
        auth_user_result = (
            supabase.table("auth.users")
            .select("email, raw_user_meta_data")
            .eq("id", user_id)
            .execute()
        )

        if not auth_user_result.data:
            raise HTTPException(status_code=500, detail="User not found in auth.users")

        auth_user = auth_user_result.data[0]
        email = auth_user["email"]
        display_name = None
        if auth_user.get("raw_user_meta_data"):
            meta = auth_user["raw_user_meta_data"]
            display_name = meta.get("full_name") or meta.get("name")

        # Create profile
        profile_insert = (
            supabase.table("profiles")
            .insert(
                {
                    "user_id": user_id,
                    "email": email,
                    "display_name": display_name,
                }
            )
            .execute()
        )

        if not profile_insert.data:
            raise HTTPException(status_code=500, detail="Failed to create profile")

        profile = profile_insert.data[0]
    else:
        profile = profile_result.data[0]

    # Step 2: Check for existing membership
    membership_result = (
        supabase.table("memberships")
        .select("*")
        .eq("user_id", user_id)
        .eq("org_id", DEFAULT_ORG_ID)
        .execute()
    )

    if membership_result.data:
        # Membership exists - return existing data
        membership = membership_result.data[0]
    else:
        # Step 3: No membership - look for active invite
        invite_result = (
            supabase.table("invites")
            .select("*")
            .eq("email", profile["email"])
            .eq("status", "active")
            .execute()
        )

        # Filter for unexpired invites
        valid_invite = None
        now = datetime.now(timezone.utc)
        for invite in invite_result.data or []:
            expires_at = invite.get("expires_at")
            if expires_at is None or datetime.fromisoformat(
                expires_at.replace("Z", "+00:00")
            ) > now:
                valid_invite = invite
                break

        if not valid_invite:
            raise HTTPException(
                status_code=403,
                detail="No valid invite found. Please contact an administrator.",
            )

        # Create membership - VAs start pending, others start active
        account_type = valid_invite["account_type"]
        initial_status = "pending" if account_type == "va" else "active"

        membership_insert = (
            supabase.table("memberships")
            .insert(
                {
                    "user_id": user_id,
                    "org_id": valid_invite.get("org_id", DEFAULT_ORG_ID),
                    "role": account_type,
                    "status": initial_status,
                }
            )
            .execute()
        )

        if not membership_insert.data:
            raise HTTPException(status_code=500, detail="Failed to create membership")

        membership = membership_insert.data[0]
        is_new = True

        # Mark invite as used
        supabase.table("invites").update(
            {"status": "used", "used_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", valid_invite["id"]).execute()

    return BootstrapResponse(
        profile=ProfileResponse(
            user_id=profile["user_id"],
            email=profile["email"],
            display_name=profile.get("display_name"),
            created_at=profile.get("created_at"),
        ),
        membership=MembershipResponse(
            id=membership["id"],
            user_id=membership["user_id"],
            org_id=membership["org_id"],
            role=membership["role"],
            status=membership["status"],
            last_seen_at=membership.get("last_seen_at"),
            created_at=membership.get("created_at"),
            updated_at=membership.get("updated_at"),
        ),
        is_new=is_new,
    )
