"""Presence tracking service for account occupancy.

Records and clears presence when VAs clock in/out of accounts.
Uses UPSERT to atomically replace previous presence on clock-in.
"""

import logging
from datetime import datetime, timezone

from postgrest.exceptions import APIError

logger = logging.getLogger(__name__)


async def record_presence(
    supabase,
    account_id: str,
    user_id: str,
    membership_id: str,
    org_id: str,
) -> bool:
    """Record presence when VA clocks into an account.

    Uses upsert with (user_id, org_id) constraint to:
    1. Clear any existing presence for this user in this org
    2. Set new presence on the target account

    Returns True on success, False on failure.
    """
    try:
        supabase.table("account_presence").upsert(
            {
                "account_id": account_id,
                "user_id": user_id,
                "membership_id": membership_id,
                "org_id": org_id,
                "clocked_in_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="user_id,org_id",
        ).execute()

        logger.info(f"Recorded presence: user={user_id} on account={account_id}")
        return True
    except APIError as e:
        logger.error(f"Failed to record presence: {e}")
        return False


async def clear_presence(supabase, user_id: str, org_id: str) -> bool:
    """Clear presence when VA clocks out or session times out.

    Returns True on success (including if no presence existed), False on error.
    """
    try:
        supabase.table("account_presence").delete().match({
            "user_id": user_id,
            "org_id": org_id,
        }).execute()

        logger.info(f"Cleared presence: user={user_id} in org={org_id}")
        return True
    except APIError as e:
        logger.error(f"Failed to clear presence: {e}")
        return False


async def clear_presence_by_account(supabase, account_id: str, org_id: str) -> bool:
    """Force-clear presence from an account (admin action).

    Used to clear orphaned presence entries.
    Returns True on success, False on error.
    """
    try:
        supabase.table("account_presence").delete().match({
            "account_id": account_id,
            "org_id": org_id,
        }).execute()

        logger.info(f"Admin cleared presence from account={account_id}")
        return True
    except APIError as e:
        logger.error(f"Failed to clear presence by account: {e}")
        return False
