"""Audit logging helper for tracking sensitive changes."""

from typing import Any

from fastapi import Request
from supabase import Client


async def write_audit_log(
    supabase: Client,
    actor_user_id: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """
    Insert an audit log entry using service role client.

    Args:
        supabase: Supabase client (should be service role for bypassing RLS)
        actor_user_id: UUID of the user performing the action
        action: Action type (e.g., 'user.update', 'membership.status_change')
        resource_type: Type of resource (e.g., 'membership', 'profile', 'invite')
        resource_id: ID of the affected resource (optional)
        before: State before the change (optional)
        after: State after the change (optional)
        request: FastAPI request object for extracting IP/user_agent (optional)
    """
    # Extract IP and user agent from request if available
    ip = None
    user_agent = None

    if request:
        # Get client IP (handle proxies)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else None

        user_agent = request.headers.get("user-agent")

    # Insert audit log entry
    supabase.table("audit_logs").insert(
        {
            "actor_user_id": actor_user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "before": before,
            "after": after,
            "ip": ip,
            "user_agent": user_agent,
        }
    ).execute()
