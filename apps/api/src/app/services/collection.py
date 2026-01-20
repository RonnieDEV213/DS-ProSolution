"""Collection service for managing seller collection runs.

This module handles:
- Cost estimation before runs
- Budget enforcement (soft warning + hard block)
- Run lifecycle (create, start, pause, cancel)
- Checkpointing for crash recovery
- Resume of interrupted runs on startup
"""

import logging
from datetime import datetime, timezone
from supabase import Client

logger = logging.getLogger(__name__)

# Cost constants (Oxylabs pricing)
# These are estimates - actual costs tracked per-item
COST_PER_AMAZON_PRODUCT_CENTS = 5  # ~$0.05 per product fetch
COST_PER_EBAY_SEARCH_CENTS = 5     # ~$0.05 per search
ESTIMATED_EBAY_SEARCHES_PER_PRODUCT = 1


class CollectionService:
    """Orchestrates collection runs with budget enforcement and checkpointing."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def get_settings(self, org_id: str) -> dict:
        """Get or create collection settings for an org."""
        result = (
            self.supabase.table("collection_settings")
            .select("*")
            .eq("org_id", org_id)
            .execute()
        )

        if result.data:
            return result.data[0]

        # Create default settings
        default = {
            "org_id": org_id,
            "budget_cap_cents": 2500,  # $25 default
            "soft_warning_percent": 80,
            "max_concurrent_runs": 3,
        }
        insert_result = (
            self.supabase.table("collection_settings")
            .insert(default)
            .execute()
        )
        return insert_result.data[0] if insert_result.data else default

    async def update_settings(
        self,
        org_id: str,
        budget_cap_cents: int | None = None,
        soft_warning_percent: int | None = None,
        max_concurrent_runs: int | None = None,
    ) -> dict:
        """Update collection settings."""
        settings = await self.get_settings(org_id)

        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if budget_cap_cents is not None:
            update_data["budget_cap_cents"] = budget_cap_cents
        if soft_warning_percent is not None:
            update_data["soft_warning_percent"] = soft_warning_percent
        if max_concurrent_runs is not None:
            update_data["max_concurrent_runs"] = max_concurrent_runs

        result = (
            self.supabase.table("collection_settings")
            .update(update_data)
            .eq("org_id", org_id)
            .execute()
        )
        return result.data[0] if result.data else settings

    async def estimate_cost(
        self,
        org_id: str,
        category_ids: list[str],
    ) -> dict:
        """
        Calculate estimated API cost before starting a run.

        Returns cost estimate with per-category breakdown.
        Phase 6 uses placeholder product counts - Phase 7 will add real estimates.
        """
        settings = await self.get_settings(org_id)
        budget_cap = settings["budget_cap_cents"]
        warning_percent = settings["soft_warning_percent"]

        # Placeholder: estimate 50 products per category
        # Phase 7 will replace with actual category product counts
        PRODUCTS_PER_CATEGORY = 50

        breakdown = {}
        total_cents = 0

        for cat_id in category_ids:
            # Cost per category: Amazon fetch + eBay searches
            amazon_cost = PRODUCTS_PER_CATEGORY * COST_PER_AMAZON_PRODUCT_CENTS
            ebay_cost = PRODUCTS_PER_CATEGORY * ESTIMATED_EBAY_SEARCHES_PER_PRODUCT * COST_PER_EBAY_SEARCH_CENTS
            category_total = amazon_cost + ebay_cost

            breakdown[cat_id] = category_total
            total_cents += category_total

        warning_threshold = int(budget_cap * warning_percent / 100)

        return {
            "total_cents": total_cents,
            "breakdown": breakdown,
            "within_budget": total_cents <= budget_cap,
            "budget_cap_cents": budget_cap,
            "warning_threshold_cents": warning_threshold,
            "exceeds_warning": total_cents > warning_threshold,
        }

    async def create_run(
        self,
        org_id: str,
        user_id: str,
        category_ids: list[str],
        name: str | None = None,
    ) -> dict:
        """
        Create a new collection run in pending state.

        Validates budget before creating. Returns error if would exceed budget.
        """
        # Get cost estimate
        estimate = await self.estimate_cost(org_id, category_ids)

        if not estimate["within_budget"]:
            return {
                "error": "budget_exceeded",
                "message": f"Estimated cost ${estimate['total_cents']/100:.2f} exceeds budget cap ${estimate['budget_cap_cents']/100:.2f}",
                "estimate": estimate,
            }

        # Check concurrent run limit
        settings = await self.get_settings(org_id)
        active_runs = (
            self.supabase.table("collection_runs")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .in_("status", ["pending", "running", "paused"])
            .execute()
        )

        if (active_runs.count or 0) >= settings["max_concurrent_runs"]:
            return {
                "error": "concurrent_limit",
                "message": f"Maximum {settings['max_concurrent_runs']} concurrent runs allowed",
            }

        # Generate name if not provided
        if not name:
            name = f"Collection {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"

        # Create run
        now = datetime.now(timezone.utc).isoformat()
        run_data = {
            "org_id": org_id,
            "name": name,
            "status": "pending",
            "estimated_cost_cents": estimate["total_cents"],
            "actual_cost_cents": 0,
            "budget_cap_cents": estimate["budget_cap_cents"],
            "total_items": 0,
            "processed_items": 0,
            "failed_items": 0,
            "category_ids": category_ids,
            "created_by": user_id,
            "created_at": now,
            "updated_at": now,
        }

        result = self.supabase.table("collection_runs").insert(run_data).execute()

        if not result.data:
            return {"error": "insert_failed", "message": "Failed to create run"}

        run = result.data[0]
        logger.info(f"Created collection run {run['id']} for org {org_id}")

        return {"run": run, "estimate": estimate}

    async def get_run(self, run_id: str, org_id: str) -> dict | None:
        """Get a collection run by ID."""
        result = (
            self.supabase.table("collection_runs")
            .select("*")
            .eq("id", run_id)
            .eq("org_id", org_id)
            .execute()
        )
        return result.data[0] if result.data else None

    async def list_runs(
        self,
        org_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List collection runs for an org."""
        result = (
            self.supabase.table("collection_runs")
            .select("*", count="exact")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or [], result.count or 0

    async def start_run(self, run_id: str, org_id: str) -> dict:
        """Start a pending run."""
        run = await self.get_run(run_id, org_id)
        if not run:
            return {"error": "not_found", "message": "Run not found"}

        if run["status"] != "pending":
            return {"error": "invalid_status", "message": f"Cannot start run in {run['status']} status"}

        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "status": "running",
            "started_at": now,
            "updated_at": now,
        }).eq("id", run_id).execute()

        logger.info(f"Started collection run {run_id}")
        return {"ok": True, "status": "running"}

    async def pause_run(self, run_id: str, org_id: str) -> dict:
        """Pause a running collection."""
        run = await self.get_run(run_id, org_id)
        if not run:
            return {"error": "not_found", "message": "Run not found"}

        if run["status"] != "running":
            return {"error": "invalid_status", "message": f"Cannot pause run in {run['status']} status"}

        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "status": "paused",
            "paused_at": now,
            "updated_at": now,
        }).eq("id", run_id).execute()

        logger.info(f"Paused collection run {run_id}")
        return {"ok": True, "status": "paused"}

    async def resume_run(self, run_id: str, org_id: str) -> dict:
        """Resume a paused collection."""
        run = await self.get_run(run_id, org_id)
        if not run:
            return {"error": "not_found", "message": "Run not found"}

        if run["status"] != "paused":
            return {"error": "invalid_status", "message": f"Cannot resume run in {run['status']} status"}

        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "status": "running",
            "paused_at": None,
            "updated_at": now,
        }).eq("id", run_id).execute()

        logger.info(f"Resumed collection run {run_id}")
        return {"ok": True, "status": "running"}

    async def cancel_run(self, run_id: str, org_id: str) -> dict:
        """Cancel a collection run."""
        run = await self.get_run(run_id, org_id)
        if not run:
            return {"error": "not_found", "message": "Run not found"}

        if run["status"] in ("completed", "failed", "cancelled"):
            return {"error": "invalid_status", "message": f"Cannot cancel run in {run['status']} status"}

        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "status": "cancelled",
            "completed_at": now,
            "updated_at": now,
        }).eq("id", run_id).execute()

        logger.info(f"Cancelled collection run {run_id}")
        return {"ok": True, "status": "cancelled"}

    async def checkpoint(
        self,
        run_id: str,
        checkpoint_data: dict,
        processed_items: int,
        failed_items: int,
        actual_cost_cents: int,
    ) -> None:
        """Save checkpoint for crash recovery."""
        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "checkpoint": checkpoint_data,
            "processed_items": processed_items,
            "failed_items": failed_items,
            "actual_cost_cents": actual_cost_cents,
            "updated_at": now,
        }).eq("id", run_id).execute()

        logger.debug(f"Checkpointed run {run_id}: {processed_items} processed, {failed_items} failed")

    async def get_incomplete_runs(self) -> list[dict]:
        """Get runs that were interrupted (running/paused status)."""
        result = (
            self.supabase.table("collection_runs")
            .select("*")
            .in_("status", ["running", "paused"])
            .execute()
        )
        return result.data or []

    async def resume_incomplete_runs(self) -> int:
        """
        Called on server startup to find and flag interrupted runs.

        Returns count of runs found. Actual resume handled by collection_manager task.
        """
        runs = await self.get_incomplete_runs()

        if runs:
            logger.info(f"Found {len(runs)} interrupted collection run(s) to resume")
            for run in runs:
                logger.info(f"  - Run {run['id']}: {run['name']} (status: {run['status']}, checkpoint: {run.get('checkpoint') is not None})")

        return len(runs)
