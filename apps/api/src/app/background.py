"""
Background tasks for the DS-Pro API.

Handles periodic cleanup and maintenance tasks.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.database import get_supabase

logger = logging.getLogger(__name__)

# Cleanup configuration
CLEANUP_INTERVAL_SECONDS = 120  # Run every 2 minutes
REPLACING_AGENT_TTL_MINUTES = 10  # Delete 'replacing' agents older than 10 min


async def cleanup_stale_replacing_agents():
    """
    Delete agents stuck in 'replacing' status past the TTL.

    When auto-approve creates a 'replacing' agent, the extension must call
    /agents/me/checkin within 5 minutes. If the extension fails (crash,
    network issue, browser closed), the 'replacing' agent remains in the
    database. This cleanup removes those stale agents.
    """
    try:
        supabase = get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=REPLACING_AGENT_TTL_MINUTES)).isoformat()

        result = supabase.table("automation_agents").delete().eq(
            "approval_status", "replacing"
        ).lt("created_at", cutoff).execute()

        deleted_count = len(result.data) if result.data else 0
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} stale 'replacing' agent(s)")
    except Exception as e:
        logger.error(f"Cleanup job failed: {e}")


async def cleanup_worker():
    """Background worker that runs cleanup periodically."""
    logger.info("Starting background cleanup worker")
    while True:
        await cleanup_stale_replacing_agents()
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
