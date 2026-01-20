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

    # ============================================================
    # Seller Management
    # ============================================================

    def _normalize_seller_name(self, name: str) -> str:
        """Normalize seller name for deduplication."""
        import re
        # Lowercase, strip, collapse whitespace
        normalized = re.sub(r'\s+', ' ', name.lower().strip())
        return normalized

    async def get_sellers(
        self,
        org_id: str,
        limit: int = 1000,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Get all sellers for the org, newest first."""
        result = (
            self.supabase.table("sellers")
            .select("*", count="exact")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or [], result.count or 0

    async def add_seller(
        self,
        org_id: str,
        user_id: str,
        name: str,
        source: str = "manual",
        run_id: str | None = None,
    ) -> dict:
        """Add a seller manually or from collection run."""
        normalized = self._normalize_seller_name(name)

        # Check if already exists
        existing = (
            self.supabase.table("sellers")
            .select("id")
            .eq("org_id", org_id)
            .eq("normalized_name", normalized)
            .eq("platform", "ebay")
            .execute()
        )
        if existing.data:
            raise ValueError(f"Seller '{name}' already exists")

        # Insert seller
        seller_data = {
            "org_id": org_id,
            "display_name": name,
            "normalized_name": normalized,
            "platform": "ebay",
            "first_seen_run_id": run_id,
            "last_seen_run_id": run_id,
            "times_seen": 1,
        }
        result = self.supabase.table("sellers").insert(seller_data).execute()

        if not result.data:
            raise ValueError("Failed to create seller")

        seller = result.data[0]

        # Log the addition
        await self._log_seller_change(
            org_id=org_id,
            user_id=user_id,
            action="add",
            seller_id=seller["id"],
            seller_name=name,
            old_value=None,
            new_value={"display_name": name},
            source=source,
            run_id=run_id,
        )

        return seller

    async def update_seller(
        self,
        org_id: str,
        user_id: str,
        seller_id: str,
        new_name: str,
    ) -> dict:
        """Update a seller's name."""
        # Get current state
        result = (
            self.supabase.table("sellers")
            .select("*")
            .eq("id", seller_id)
            .eq("org_id", org_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Seller not found")

        current = result.data[0]
        old_name = current["display_name"]
        new_normalized = self._normalize_seller_name(new_name)

        # Check for duplicate
        dup_check = (
            self.supabase.table("sellers")
            .select("id")
            .eq("org_id", org_id)
            .eq("normalized_name", new_normalized)
            .eq("platform", "ebay")
            .neq("id", seller_id)
            .execute()
        )
        if dup_check.data:
            raise ValueError(f"Seller '{new_name}' already exists")

        # Update
        update_result = (
            self.supabase.table("sellers")
            .update({
                "display_name": new_name,
                "normalized_name": new_normalized,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", seller_id)
            .execute()
        )

        if not update_result.data:
            raise ValueError("Failed to update seller")

        seller = update_result.data[0]

        # Log the edit
        await self._log_seller_change(
            org_id=org_id,
            user_id=user_id,
            action="edit",
            seller_id=seller_id,
            seller_name=new_name,
            old_value={"display_name": old_name},
            new_value={"display_name": new_name},
            source="manual",
            run_id=None,
        )

        return seller

    async def remove_seller(
        self,
        org_id: str,
        user_id: str,
        seller_id: str,
        source: str = "manual",
        criteria: dict | None = None,
    ) -> None:
        """Remove a seller."""
        # Get current state
        result = (
            self.supabase.table("sellers")
            .select("display_name")
            .eq("id", seller_id)
            .eq("org_id", org_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Seller not found")

        name = result.data[0]["display_name"]

        # Log the removal BEFORE deleting (to satisfy foreign key constraint)
        await self._log_seller_change(
            org_id=org_id,
            user_id=user_id,
            action="remove",
            seller_id=seller_id,
            seller_name=name,
            old_value={"display_name": name},
            new_value=None,
            source=source,
            run_id=None,
            criteria=criteria,
        )

        # Delete after logging
        self.supabase.table("sellers").delete().eq("id", seller_id).execute()

    # ============================================================
    # Audit Logging
    # ============================================================

    async def _log_seller_change(
        self,
        org_id: str,
        user_id: str,
        action: str,
        seller_id: str,
        seller_name: str,
        old_value: dict | None,
        new_value: dict | None,
        source: str,
        run_id: str | None,
        criteria: dict | None = None,
        affected_count: int = 1,
    ) -> None:
        """Log a seller change to the audit log."""
        import json

        log_data = {
            "org_id": org_id,
            "action": action,
            "seller_id": seller_id,
            "seller_name": seller_name,
            "old_value": json.dumps(old_value) if old_value else None,
            "new_value": json.dumps(new_value) if new_value else None,
            "source": source,
            "source_run_id": run_id,
            "source_criteria": json.dumps(criteria) if criteria else None,
            "user_id": user_id,
            "affected_count": affected_count,
        }
        self.supabase.table("seller_audit_log").insert(log_data).execute()

    async def get_audit_log(
        self,
        org_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Get audit log entries, newest first."""
        result = (
            self.supabase.table("seller_audit_log")
            .select("id, action, seller_name, source, source_run_id, user_id, created_at, affected_count", count="exact")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or [], result.count or 0

    async def get_sellers_at_log(self, org_id: str, log_id: str) -> list[str]:
        """Get the seller list as it was right after a specific log entry."""
        import json

        # Get the log entry timestamp
        log_result = (
            self.supabase.table("seller_audit_log")
            .select("created_at")
            .eq("id", log_id)
            .eq("org_id", org_id)
            .execute()
        )
        if not log_result.data:
            raise ValueError("Log entry not found")

        timestamp = log_result.data[0]["created_at"]

        # Get all log entries up to that timestamp (include old_value for edits)
        entries = (
            self.supabase.table("seller_audit_log")
            .select("action, seller_name, old_value")
            .eq("org_id", org_id)
            .lte("created_at", timestamp)
            .order("created_at", desc=False)
            .execute()
        )

        # Replay to build seller set at that point
        sellers: set[str] = set()
        for entry in entries.data or []:
            if entry["action"] == "add":
                sellers.add(entry["seller_name"])
            elif entry["action"] == "remove":
                sellers.discard(entry["seller_name"])
            elif entry["action"] == "edit":
                # For edits: remove old name, add new name
                # old_value is JSON string like {"display_name": "Old Name"}
                if entry.get("old_value"):
                    try:
                        old_data = json.loads(entry["old_value"])
                        old_name = old_data.get("display_name")
                        if old_name:
                            sellers.discard(old_name)
                    except (json.JSONDecodeError, TypeError):
                        pass
                # seller_name is the new name
                sellers.add(entry["seller_name"])

        return sorted(list(sellers))

    async def calculate_diff(
        self,
        source_sellers: list[str],
        target_sellers: list[str],
    ) -> dict:
        """Calculate diff between two seller lists."""
        source_set = set(source_sellers)
        target_set = set(target_sellers)

        added = sorted(target_set - source_set)
        removed = sorted(source_set - target_set)

        return {
            "added": added,
            "removed": removed,
            "added_count": len(added),
            "removed_count": len(removed),
        }

    # ============================================================
    # Templates
    # ============================================================

    async def get_templates(self, org_id: str) -> list[dict]:
        """Get all run templates for the org."""
        result = (
            self.supabase.table("run_templates")
            .select("*")
            .eq("org_id", org_id)
            .order("is_default", desc=True)
            .order("name", desc=False)
            .execute()
        )
        return result.data or []

    async def create_template(
        self,
        org_id: str,
        user_id: str,
        name: str,
        description: str | None,
        department_ids: list[str],
        concurrency: int,
        is_default: bool,
    ) -> dict:
        """Create a new run template."""
        # If setting as default, unset other defaults
        if is_default:
            self.supabase.table("run_templates").update({
                "is_default": False,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("org_id", org_id).execute()

        template_data = {
            "org_id": org_id,
            "name": name,
            "description": description,
            "department_ids": department_ids,
            "concurrency": concurrency,
            "is_default": is_default,
            "created_by": user_id,
        }
        result = self.supabase.table("run_templates").insert(template_data).execute()

        if not result.data:
            raise ValueError("Failed to create template")

        return result.data[0]

    async def update_template(
        self,
        org_id: str,
        template_id: str,
        updates: dict,
    ) -> dict:
        """Update a run template."""
        # If setting as default, unset other defaults
        if updates.get("is_default"):
            self.supabase.table("run_templates").update({
                "is_default": False,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("org_id", org_id).neq("id", template_id).execute()

        # Filter out None values
        update_data = {k: v for k, v in updates.items() if v is not None}
        if not update_data:
            raise ValueError("No updates provided")

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = (
            self.supabase.table("run_templates")
            .update(update_data)
            .eq("id", template_id)
            .eq("org_id", org_id)
            .execute()
        )

        if not result.data:
            raise ValueError("Template not found")

        return result.data[0]

    async def delete_template(self, org_id: str, template_id: str) -> None:
        """Delete a run template."""
        result = (
            self.supabase.table("run_templates")
            .delete()
            .eq("id", template_id)
            .eq("org_id", org_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Template not found")

    # ============================================================
    # Enhanced Progress
    # ============================================================

    async def get_enhanced_progress(self, org_id: str, run_id: str) -> dict:
        """Get detailed progress for a collection run."""
        result = (
            self.supabase.table("collection_runs")
            .select(
                "departments_total, departments_completed, "
                "categories_total, categories_completed, "
                "products_total, products_searched, "
                "sellers_found, sellers_new, "
                "actual_cost_cents, budget_cap_cents, "
                "worker_status"
            )
            .eq("id", run_id)
            .eq("org_id", org_id)
            .execute()
        )

        if not result.data:
            raise ValueError("Run not found")

        data = result.data[0]

        # Calculate cost status
        actual = data["actual_cost_cents"]
        budget = data["budget_cap_cents"]

        if actual > budget:
            cost_status = "exceeded"
        elif actual > budget * 0.8:
            cost_status = "warning"
        else:
            cost_status = "safe"

        data["cost_status"] = cost_status

        return data
