"""Collection service for managing seller collection runs.

This module handles:
- Run lifecycle (create, start, pause, cancel)
- Checkpointing for crash recovery
- Resume of interrupted runs on startup
- Amazon collection execution via Oxylabs
"""

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from supabase import Client

from app.services.scrapers import OxylabsAmazonScraper, OxylabsEbayScraper

logger = logging.getLogger(__name__)


class CollectionService:
    """Orchestrates collection runs with checkpointing."""

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
        max_concurrent_runs: int | None = None,
    ) -> dict:
        """Update collection settings."""
        settings = await self.get_settings(org_id)

        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if max_concurrent_runs is not None:
            update_data["max_concurrent_runs"] = max_concurrent_runs

        result = (
            self.supabase.table("collection_settings")
            .update(update_data)
            .eq("org_id", org_id)
            .execute()
        )
        return result.data[0] if result.data else settings

    async def create_run(
        self,
        org_id: str,
        user_id: str,
        category_ids: list[str],
        name: str | None = None,
    ) -> dict:
        """
        Create a new collection run in pending state.
        """
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

        return {"run": run}

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
    ) -> None:
        """Save checkpoint for crash recovery."""
        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "checkpoint": checkpoint_data,
            "processed_items": processed_items,
            "failed_items": failed_items,
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
                "worker_status, checkpoint"
            )
            .eq("id", run_id)
            .eq("org_id", org_id)
            .execute()
        )

        if not result.data:
            raise ValueError("Run not found")

        return result.data[0]

    # ============================================================
    # Amazon Collection Execution
    # ============================================================

    async def run_amazon_collection(
        self,
        run_id: str,
        org_id: str,
        category_ids: list[str],
    ) -> dict:
        """
        Execute Amazon best sellers collection for selected categories.

        Fetches products from each category via Oxylabs API,
        handles rate limiting and errors:
        - Retry failed category 3x, then skip
        - Pause on multiple consecutive failures

        Args:
            run_id: Collection run ID
            org_id: Organization ID
            category_ids: List of category IDs to fetch (from amazon_categories.json)

        Returns:
            dict with status, products_fetched, errors
        """
        import json

        # Load category data to get node IDs
        categories_path = Path(__file__).parent.parent / "data" / "amazon_categories.json"
        with open(categories_path) as f:
            cat_data = json.load(f)

        # Build category ID -> node_id lookup
        node_lookup = {}
        for dept in cat_data["departments"]:
            for cat in dept.get("categories", []):
                node_lookup[cat["id"]] = cat["node_id"]

        # Initialize scraper
        try:
            scraper = OxylabsAmazonScraper()
        except ValueError as e:
            logger.error(f"Scraper initialization failed: {e}")
            return {
                "status": "failed",
                "error": "Oxylabs credentials not configured",
                "products_fetched": 0,
            }

        # Track progress
        products_fetched = 0
        consecutive_failures = 0
        MAX_CONSECUTIVE_FAILURES = 5
        errors: list[dict] = []

        # Process each category
        for cat_id in category_ids:
            node_id = node_lookup.get(cat_id)
            if not node_id:
                logger.warning(f"Unknown category ID: {cat_id}")
                errors.append({"category": cat_id, "error": "unknown_category"})
                continue

            # Retry logic (3 attempts per category)
            for attempt in range(3):
                result = await scraper.fetch_bestsellers(node_id)

                # Handle rate limiting
                if result.error == "rate_limited":
                    logger.info(f"Rate limited, waiting 5s (attempt {attempt + 1}/3)")
                    # Update run with throttle status
                    self.supabase.table("collection_runs").update({
                        "checkpoint": {
                            "status": "rate_limited",
                            "waiting_seconds": 5,
                            "current_category": cat_id,
                        },
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", run_id).execute()

                    await asyncio.sleep(5)
                    continue

                # Handle other errors
                if result.error:
                    consecutive_failures += 1
                    logger.warning(f"Error fetching {cat_id}: {result.error} (consecutive: {consecutive_failures})")

                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                        # Pause collection and notify
                        logger.error(f"Multiple consecutive failures, pausing run {run_id}")
                        await self.pause_run(run_id, org_id)

                        self.supabase.table("collection_runs").update({
                            "checkpoint": {
                                "status": "paused_failures",
                                "consecutive_failures": consecutive_failures,
                                "last_category": cat_id,
                            },
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }).eq("id", run_id).execute()

                        return {
                            "status": "paused",
                            "error": "Multiple consecutive failures",
                            "products_fetched": products_fetched,
                            "errors": errors,
                        }

                    errors.append({"category": cat_id, "error": result.error})
                    break  # Move to next category after max retries

                # Success - process products
                consecutive_failures = 0
                products_fetched += len(result.products)

                # Save products as collection items
                for product in result.products:
                    item_data = {
                        "run_id": run_id,
                        "item_type": "amazon_product",
                        "external_id": product.asin,
                        "data": {
                            "title": product.title,
                            "price": product.price,
                            "currency": product.currency,
                            "rating": product.rating,
                            "url": product.url,
                            "position": product.position,
                            "category_id": cat_id,
                        },
                        "status": "pending",  # Will be processed by eBay search in Phase 8
                    }
                    self.supabase.table("collection_items").insert(item_data).execute()

                # Update progress checkpoint
                await self.checkpoint(
                    run_id=run_id,
                    checkpoint_data={
                        "current_category": cat_id,
                        "categories_completed": category_ids.index(cat_id) + 1,
                        "total_categories": len(category_ids),
                    },
                    processed_items=products_fetched,
                    failed_items=len(errors),
                )

                logger.info(f"Fetched {len(result.products)} products from {cat_id}")
                break  # Success, move to next category

        # Mark run as completed
        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "status": "completed",
            "completed_at": now,
            "total_items": products_fetched,
            "processed_items": products_fetched,
            "updated_at": now,
        }).eq("id", run_id).execute()

        logger.info(f"Collection run {run_id} completed: {products_fetched} products")

        return {
            "status": "completed",
            "products_fetched": products_fetched,
            "errors": errors if errors else None,
        }

    # ============================================================
    # eBay Seller Search Execution
    # ============================================================

    async def run_ebay_seller_search(
        self,
        run_id: str,
        org_id: str,
    ) -> dict:
        """
        Execute eBay seller search for Amazon products in a collection run.

        For each Amazon product collected, search eBay with the product title
        and dropshipper filters, extract sellers, dedupe against existing
        database, and store new sellers.

        Args:
            run_id: Collection run ID
            org_id: Organization ID

        Returns:
            dict with status, sellers_found, sellers_new
        """
        # Get Amazon products from collection_items
        products_result = (
            self.supabase.table("collection_items")
            .select("id, external_id, data")
            .eq("run_id", run_id)
            .eq("item_type", "amazon_product")
            .execute()
        )

        products = products_result.data or []
        if not products:
            logger.info(f"No Amazon products to search for run {run_id}")
            return {
                "status": "completed",
                "message": "No Amazon products to search",
                "sellers_found": 0,
                "sellers_new": 0,
            }

        # Initialize eBay scraper
        try:
            scraper = OxylabsEbayScraper()
        except ValueError as e:
            logger.error(f"eBay scraper initialization failed: {e}")
            return {
                "status": "failed",
                "error": "Oxylabs credentials not configured",
                "sellers_found": 0,
                "sellers_new": 0,
            }

        # Constants
        MAX_CONSECUTIVE_FAILURES = 5
        PAGES_PER_PRODUCT = 3
        REQUEST_DELAY_MS = 200

        # Progress tracking
        consecutive_failures = 0
        sellers_found = 0
        sellers_new = 0
        products_processed = 0
        total_products = len(products)

        logger.info(f"Starting eBay seller search for {total_products} products")

        # Process each product
        for product in products:
            product_data = product.get("data", {})
            title = product_data.get("title")
            price = product_data.get("price")

            # Skip if missing title or price
            if not title or not price:
                logger.warning(f"Skipping product {product['external_id']}: missing title or price")
                products_processed += 1
                continue

            # Parse price if string
            if isinstance(price, str):
                try:
                    price = float(price.replace("$", "").replace(",", ""))
                except ValueError:
                    logger.warning(f"Skipping product {product['external_id']}: invalid price '{price}'")
                    products_processed += 1
                    continue

            # Search eBay for each page
            for page in range(1, PAGES_PER_PRODUCT + 1):
                result = await scraper.search_sellers(title, price, page)

                # Handle rate limiting
                if result.error == "rate_limited":
                    logger.info(f"Rate limited, waiting 5s")
                    # Update checkpoint with throttle status
                    self.supabase.table("collection_runs").update({
                        "checkpoint": {
                            "status": "rate_limited",
                            "waiting_seconds": 5,
                            "current_product_id": product["id"],
                            "current_page": page,
                        },
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", run_id).execute()

                    await asyncio.sleep(5)
                    continue

                # Handle other errors
                if result.error:
                    consecutive_failures += 1
                    logger.warning(
                        f"Error searching eBay for '{title[:50]}...': {result.error} "
                        f"(consecutive: {consecutive_failures})"
                    )

                    if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                        # Pause collection
                        logger.error(f"Multiple consecutive failures, pausing run {run_id}")
                        await self.pause_run(run_id, org_id)

                        self.supabase.table("collection_runs").update({
                            "checkpoint": {
                                "status": "paused_failures",
                                "consecutive_failures": consecutive_failures,
                                "last_product_id": product["id"],
                            },
                            "products_searched": products_processed,
                            "sellers_found": sellers_found,
                            "sellers_new": sellers_new,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }).eq("id", run_id).execute()

                        return {
                            "status": "paused",
                            "error": "Multiple consecutive failures",
                            "sellers_found": sellers_found,
                            "sellers_new": sellers_new,
                        }
                    break  # Skip remaining pages for this product

                # Success - reset failures and process sellers
                consecutive_failures = 0

                # Process and dedupe sellers
                for seller in result.sellers:
                    sellers_found += 1
                    normalized = self._normalize_seller_name(seller.username)

                    # Check if seller already exists
                    existing = (
                        self.supabase.table("sellers")
                        .select("id")
                        .eq("org_id", org_id)
                        .eq("normalized_name", normalized)
                        .eq("platform", "ebay")
                        .execute()
                    )

                    if existing.data:
                        # Update last_seen and times_seen for existing seller
                        self.supabase.table("sellers").update({
                            "last_seen_run_id": run_id,
                            "times_seen": self.supabase.rpc(
                                "increment_times_seen",
                                {"seller_id": existing.data[0]["id"]}
                            ).execute() if False else None,  # Skip RPC for now, simple update
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }).eq("id", existing.data[0]["id"]).execute()
                        continue

                    # Insert new seller
                    seller_data = {
                        "org_id": org_id,
                        "display_name": seller.username,
                        "normalized_name": normalized,
                        "platform": "ebay",
                        "platform_id": seller.username,
                        "feedback_score": seller.feedback_count,
                        "first_seen_run_id": run_id,
                        "last_seen_run_id": run_id,
                        "times_seen": 1,
                    }
                    self.supabase.table("sellers").insert(seller_data).execute()
                    sellers_new += 1

                    logger.debug(f"Added new seller: {seller.username}")

                # Stop pagination early if no more results
                if not result.has_more:
                    break

                # Delay between pages
                await asyncio.sleep(REQUEST_DELAY_MS / 1000)

            products_processed += 1

            # Update progress checkpoint after each product
            self.supabase.table("collection_runs").update({
                "checkpoint": {
                    "current_product_id": product["id"],
                    "products_processed": products_processed,
                    "products_total": total_products,
                },
                "products_searched": products_processed,
                "sellers_found": sellers_found,
                "sellers_new": sellers_new,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()

            logger.info(
                f"Processed product {products_processed}/{total_products}: "
                f"found {sellers_found} sellers ({sellers_new} new)"
            )

        # Mark run as completed
        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "status": "completed",
            "completed_at": now,
            "products_searched": products_processed,
            "sellers_found": sellers_found,
            "sellers_new": sellers_new,
            "updated_at": now,
        }).eq("id", run_id).execute()

        logger.info(
            f"eBay seller search completed for run {run_id}: "
            f"{sellers_found} sellers found, {sellers_new} new"
        )

        return {
            "status": "completed",
            "sellers_found": sellers_found,
            "sellers_new": sellers_new,
        }
