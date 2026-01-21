"""
Scheduler service for cron-based collection runs.

Uses APScheduler with AsyncIOScheduler for non-blocking scheduled tasks.
Schedules persist in database and are loaded on startup.
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from croniter import croniter

from app.database import get_supabase

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler(timezone="UTC")


def validate_cron(expression: str) -> bool:
    """Validate a cron expression."""
    try:
        croniter(expression)
        return True
    except (KeyError, ValueError):
        return False


async def run_scheduled_collection(org_id: str, preset_id: str, schedule_id: str):
    """
    Execute a scheduled collection run.

    Checks for active runs first and queues if one is running.
    """
    from app.services.collection import CollectionService

    supabase = get_supabase()
    service = CollectionService(supabase)

    logger.info(f"Starting scheduled collection for org {org_id}, preset {preset_id}")

    # Check for active runs
    active_runs = (
        supabase.table("collection_runs")
        .select("id", count="exact")
        .eq("org_id", org_id)
        .in_("status", ["pending", "running", "paused"])
        .execute()
    )

    if (active_runs.count or 0) > 0:
        logger.info(f"Collection already running for org {org_id}, skipping scheduled run")
        # Could queue for later, but for now just skip
        return

    # Get preset category IDs
    preset_result = (
        supabase.table("amazon_category_presets")
        .select("category_ids")
        .eq("id", preset_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not preset_result.data:
        logger.error(f"Preset {preset_id} not found for org {org_id}")
        return

    category_ids = preset_result.data[0]["category_ids"]
    if not category_ids:
        logger.warning(f"Preset {preset_id} has no categories, skipping")
        return

    # Create and start the run
    result = await service.create_run(
        org_id=org_id,
        user_id="system",  # System-initiated run
        category_ids=category_ids,
        name=f"Scheduled Run {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
    )

    if "error" in result:
        logger.error(f"Failed to create scheduled run: {result['message']}")
        return

    run = result["run"]
    run_id = run["id"]

    # Start the run
    await service.start_run(run_id, org_id)

    # Execute the collection pipeline
    # Phase 1: Amazon
    amazon_result = await service.run_amazon_collection(
        run_id=run_id,
        org_id=org_id,
        category_ids=category_ids,
    )

    if amazon_result.get("status") in ("failed", "paused"):
        return

    # Phase 2: eBay
    await service.run_ebay_seller_search(run_id=run_id, org_id=org_id)

    logger.info(f"Scheduled collection completed for org {org_id}")


async def load_schedules():
    """Load all enabled schedules from database and add to scheduler."""
    supabase = get_supabase()

    result = (
        supabase.table("collection_schedules")
        .select("id, org_id, preset_id, cron_expression")
        .eq("enabled", True)
        .execute()
    )

    for schedule in result.data or []:
        try:
            trigger = CronTrigger.from_crontab(schedule["cron_expression"])
            scheduler.add_job(
                run_scheduled_collection,
                trigger,
                args=[schedule["org_id"], schedule["preset_id"], schedule["id"]],
                id=f"collection_{schedule['id']}",
                replace_existing=True,
                misfire_grace_time=3600,  # 1 hour grace for missed runs
            )
            logger.info(f"Loaded schedule {schedule['id']} for org {schedule['org_id']}")
        except Exception as e:
            logger.error(f"Failed to load schedule {schedule['id']}: {e}")


def add_schedule(schedule_id: str, org_id: str, preset_id: str, cron_expression: str):
    """Add a schedule to the scheduler."""
    try:
        trigger = CronTrigger.from_crontab(cron_expression)
        scheduler.add_job(
            run_scheduled_collection,
            trigger,
            args=[org_id, preset_id, schedule_id],
            id=f"collection_{schedule_id}",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        logger.info(f"Added schedule {schedule_id}")
    except Exception as e:
        logger.error(f"Failed to add schedule {schedule_id}: {e}")
        raise


def remove_schedule(schedule_id: str):
    """Remove a schedule from the scheduler."""
    job_id = f"collection_{schedule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Removed schedule {schedule_id}")


def get_next_run_time(schedule_id: str) -> datetime | None:
    """Get the next scheduled run time for a schedule."""
    job_id = f"collection_{schedule_id}"
    job = scheduler.get_job(job_id)
    return job.next_run_time if job else None
