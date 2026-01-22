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
from app.services.db_utils import (
    batched_query,
    batched_delete,
    batched_insert,
    batched_update,
    paginated_fetch,
    QUERY_BATCH_SIZE,
    INSERT_BATCH_SIZE,
    MAX_CONCURRENT,
)
from app.services.parallel_runner import (
    ParallelCollectionRunner,
    create_activity_event,
    CollectionPausedException,
)
from app.services.activity_stream import get_activity_stream

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

    async def get_history(
        self,
        org_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """
        Get collection history (completed/failed/cancelled runs) with statistics.

        Returns runs sorted by completed_at descending.
        """
        result = (
            self.supabase.table("collection_runs")
            .select(
                "id, name, status, category_ids, "
                "started_at, completed_at, "
                "products_total, products_searched, "
                "sellers_found, sellers_new, "
                "failed_items, created_by, seller_count_snapshot",
                count="exact"
            )
            .eq("org_id", org_id)
            .in_("status", ["completed", "failed", "cancelled"])
            .order("completed_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        # Compute duration for each run
        runs = []
        for r in result.data or []:
            duration = None
            if r.get("started_at") and r.get("completed_at"):
                started = datetime.fromisoformat(r["started_at"].replace("Z", "+00:00"))
                completed = datetime.fromisoformat(r["completed_at"].replace("Z", "+00:00"))
                duration = int((completed - started).total_seconds())

            runs.append({
                "id": r["id"],
                "name": r["name"],
                "status": r["status"],
                "started_at": r.get("started_at"),
                "completed_at": r.get("completed_at"),
                "duration_seconds": duration,
                "categories_count": len(r.get("category_ids") or []),
                "products_total": r.get("products_total") or 0,
                "products_searched": r.get("products_searched") or 0,
                "sellers_found": r.get("sellers_found") or 0,
                "sellers_new": r.get("sellers_new") or 0,
                "failed_items": r.get("failed_items") or 0,
                "created_by": r["created_by"],
                "seller_count_snapshot": r.get("seller_count_snapshot"),
            })

        return runs, result.count or 0

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

    async def _get_seller_count_snapshot(self, org_id: str) -> int:
        """Get current seller count for snapshot storage."""
        result = (
            self.supabase.table("sellers")
            .select("id", count="exact")
            .eq("org_id", org_id)
            .execute()
        )
        return result.count or 0

    async def _store_run_snapshot(self, run_id: str, org_id: str):
        """Store seller count snapshot on run completion."""
        count = await self._get_seller_count_snapshot(org_id)
        self.supabase.table("collection_runs").update({
            "seller_count_snapshot": count,
        }).eq("id", run_id).execute()
        logger.info(f"Stored seller snapshot {count} for run {run_id}")

    async def get_sellers(
        self,
        org_id: str,
        limit: int = 1000,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Get all sellers for the org, newest first.

        Handles Supabase's 1000 row limit by paginating internally when needed.
        """
        # If requesting more than 1000, we need to paginate
        if limit > 1000:
            all_sellers = []
            current_offset = offset
            remaining = limit
            total_count = 0

            while remaining > 0:
                batch_size = min(1000, remaining)
                result = (
                    self.supabase.table("sellers")
                    .select("*", count="exact")
                    .eq("org_id", org_id)
                    .order("created_at", desc=True)
                    .range(current_offset, current_offset + batch_size - 1)
                    .execute()
                )

                batch = result.data or []
                total_count = result.count or 0
                all_sellers.extend(batch)

                # If we got fewer than requested, we've reached the end
                if len(batch) < batch_size:
                    break

                current_offset += batch_size
                remaining -= batch_size

            return all_sellers, total_count

        # Standard single query for <= 1000
        result = (
            self.supabase.table("sellers")
            .select("*", count="exact")
            .eq("org_id", org_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or [], result.count or 0

    async def get_sellers_by_run(
        self,
        org_id: str,
        run_id: str,
    ) -> list[dict]:
        """Get all sellers discovered in a specific collection run."""
        result = (
            self.supabase.table("sellers")
            .select("*")
            .eq("org_id", org_id)
            .eq("first_seen_run_id", run_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

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

        # Get current seller count for snapshot
        seller_count = await self._get_seller_count_snapshot(org_id)

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
            seller_count_snapshot=seller_count,
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

        # Get current seller count for snapshot
        seller_count = await self._get_seller_count_snapshot(org_id)

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
            seller_count_snapshot=seller_count,
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

        # Delete first
        self.supabase.table("sellers").delete().eq("id", seller_id).execute()

        # Get current seller count for snapshot (after delete)
        seller_count = await self._get_seller_count_snapshot(org_id)

        # Log the removal after deleting (snapshot reflects final state)
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
            seller_count_snapshot=seller_count,
        )

    async def bulk_add_sellers(
        self,
        org_id: str,
        user_id: str,
        names: list[str],
        source: str = "manual",
    ) -> tuple[int, int, list[str]]:
        """
        Bulk add sellers.
        Returns (success_count, failed_count, errors).
        Logs as a single audit entry.

        Optimized for large imports (millions of sellers):
        - Concurrent batched lookups
        - Concurrent batched inserts
        """
        import json

        errors: list[str] = []
        added_names: list[str] = []

        # Prepare all sellers with normalized names
        sellers_to_check: list[tuple[str, str]] = []  # (display_name, normalized_name)
        for name in names:
            name = name.strip()
            if not name:
                continue
            normalized = self._normalize_seller_name(name)
            sellers_to_check.append((name, normalized))

        if not sellers_to_check:
            return 0, 0, []

        # Batch check for existing sellers (concurrent)
        all_normalized = [n for _, n in sellers_to_check]
        existing_results = batched_query(
            self.supabase,
            table="sellers",
            select="normalized_name",
            filter_column="normalized_name",
            filter_values=all_normalized,
            extra_filters={"org_id": org_id},
        )
        existing_normalized = set(r["normalized_name"] for r in existing_results)

        # Filter out duplicates
        sellers_to_insert = []
        duplicate_count = 0
        for display_name, normalized in sellers_to_check:
            if normalized in existing_normalized:
                duplicate_count += 1
                if len(errors) < 10:  # Limit error messages
                    errors.append(f"{display_name}: already exists")
            else:
                sellers_to_insert.append({
                    "org_id": org_id,
                    "display_name": display_name,
                    "normalized_name": normalized,
                    "platform": "ebay",
                    "times_seen": 1,
                })
                added_names.append(display_name)
                # Add to existing set to catch duplicates within the import
                existing_normalized.add(normalized)

        # Batch insert (concurrent)
        success_count, insert_errors = batched_insert(
            self.supabase,
            table="sellers",
            rows=sellers_to_insert,
        )
        errors.extend(insert_errors[:10 - len(errors)] if len(errors) < 10 else [])
        failed_count = duplicate_count + len(insert_errors)

        # Log as single audit entry if any were added
        if success_count > 0:
            # Get current seller count for snapshot (after bulk add)
            seller_count = await self._get_seller_count_snapshot(org_id)

            summary = f"{added_names[0]}" if success_count == 1 else f"{added_names[0]} (+{success_count - 1} more)"
            log_data = {
                "org_id": org_id,
                "action": "add",
                "seller_id": None,
                "seller_name": summary,
                "old_value": None,
                "new_value": json.dumps({"names": added_names}),
                "source": source,
                "source_run_id": None,
                "source_criteria": None,
                "user_id": user_id,
                "affected_count": success_count,
                "seller_count_snapshot": seller_count,
            }
            self.supabase.table("seller_audit_log").insert(log_data).execute()

        return success_count, failed_count, errors

    async def bulk_remove_sellers(
        self,
        org_id: str,
        user_id: str,
        seller_ids: list[str],
        source: str = "manual",
    ) -> tuple[int, int, list[str]]:
        """
        Bulk remove sellers.
        Returns (success_count, failed_count, errors).
        Logs as a single audit entry.

        Optimized for large operations (millions of sellers):
        - Concurrent batched lookups
        - Concurrent batched deletes
        """
        import json

        errors: list[str] = []
        removed_names: list[str] = []

        # Get all seller names (concurrent batched lookup)
        lookup_results = batched_query(
            self.supabase,
            table="sellers",
            select="id, display_name",
            filter_column="id",
            filter_values=seller_ids,
            extra_filters={"org_id": org_id},
        )
        seller_map = {s["id"]: s["display_name"] for s in lookup_results}

        # Separate valid and invalid IDs
        valid_ids = []
        not_found_count = 0
        for seller_id in seller_ids:
            if seller_id not in seller_map:
                not_found_count += 1
                errors.append(f"{seller_id}: not found")
            else:
                valid_ids.append(seller_id)
                removed_names.append(seller_map[seller_id])

        # Delete valid sellers (concurrent batched delete)
        success_count, delete_errors = batched_delete(
            self.supabase,
            table="sellers",
            filter_column="id",
            filter_values=valid_ids,
        )
        errors.extend(delete_errors)
        failed_count = not_found_count + len(delete_errors)

        # Log as single audit entry if any were removed
        if success_count > 0:
            # Get current seller count for snapshot (after bulk delete)
            seller_count = await self._get_seller_count_snapshot(org_id)

            summary = f"{removed_names[0]}" if success_count == 1 else f"{removed_names[0]} (+{success_count - 1} more)"
            log_data = {
                "org_id": org_id,
                "action": "remove",
                "seller_id": None,
                "seller_name": summary,
                "old_value": json.dumps({"names": removed_names}),
                "new_value": None,
                "source": source,
                "source_run_id": None,
                "source_criteria": None,
                "user_id": user_id,
                "affected_count": success_count,
                "seller_count_snapshot": seller_count,
            }
            self.supabase.table("seller_audit_log").insert(log_data).execute()

        return success_count, failed_count, errors

    async def toggle_seller_flag(self, org_id: str, seller_id: str) -> bool:
        """Toggle the flagged status of a seller. Returns the new flagged state."""
        # Get current state
        result = (
            self.supabase.table("sellers")
            .select("flagged")
            .eq("id", seller_id)
            .eq("org_id", org_id)
            .execute()
        )
        if not result.data:
            raise ValueError("Seller not found")

        current_flagged = result.data[0].get("flagged", False)
        new_flagged = not current_flagged

        # Update
        self.supabase.table("sellers").update({
            "flagged": new_flagged,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", seller_id).execute()

        return new_flagged

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
        seller_count_snapshot: int | None = None,
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
            "seller_count_snapshot": seller_count_snapshot,
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
            .select("id, action, seller_name, source, source_run_id, user_id, created_at, affected_count, seller_count_snapshot", count="exact")
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

        # Get all log entries up to that timestamp (include old_value for edits, new_value for bulk adds)
        entries = (
            self.supabase.table("seller_audit_log")
            .select("action, seller_name, old_value, new_value, affected_count")
            .eq("org_id", org_id)
            .lte("created_at", timestamp)
            .order("created_at", desc=False)
            .execute()
        )

        # Replay to build seller set at that point
        sellers: set[str] = set()
        for entry in entries.data or []:
            if entry["action"] == "add":
                affected = entry.get("affected_count", 1) or 1
                if affected > 1 and entry.get("new_value"):
                    # Bulk add - parse full names from new_value
                    try:
                        data = json.loads(entry["new_value"])
                        names = data.get("names", [])
                        for name in names:
                            sellers.add(name)
                    except (json.JSONDecodeError, TypeError):
                        # Fallback to summary name
                        sellers.add(entry["seller_name"])
                else:
                    sellers.add(entry["seller_name"])
            elif entry["action"] == "remove":
                affected = entry.get("affected_count", 1) or 1
                if affected > 1 and entry.get("old_value"):
                    # Bulk remove - parse full names from old_value
                    try:
                        data = json.loads(entry["old_value"])
                        names = data.get("names", [])
                        for name in names:
                            sellers.discard(name)
                    except (json.JSONDecodeError, TypeError):
                        # Fallback to summary name
                        sellers.discard(entry["seller_name"])
                else:
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
                "worker_status, checkpoint, started_at"
            )
            .eq("id", run_id)
            .eq("org_id", org_id)
            .execute()
        )

        if not result.data:
            raise ValueError("Run not found")

        data = result.data[0]

        # Determine phase from checkpoint
        checkpoint = data.get("checkpoint") or {}
        checkpoint_phase = checkpoint.get("phase", "")
        if checkpoint_phase == "ebay_search" or checkpoint_phase == "amazon_complete":
            phase = "ebay"
        else:
            phase = "amazon"

        # products_found is products_total during Amazon phase
        products_found = data.get("products_total") or 0

        return {
            **data,
            "phase": phase,
            "products_found": products_found,
        }

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

        Uses ParallelCollectionRunner with 5 workers for concurrent execution.
        Emits activity events for SSE streaming.

        Args:
            run_id: Collection run ID
            org_id: Organization ID
            category_ids: List of category IDs to fetch (from amazon_categories.json)

        Returns:
            dict with status, products_fetched, errors
        """
        import json
        import uuid

        # Load category data to get node IDs
        categories_path = Path(__file__).parent.parent / "data" / "amazon_categories.json"
        with open(categories_path) as f:
            cat_data = json.load(f)

        # Build category ID -> node_id and name lookup
        node_lookup = {}
        name_lookup = {}
        dept_lookup = {}  # category_id -> department_id
        for dept in cat_data["departments"]:
            for cat in dept.get("categories", []):
                node_lookup[cat["id"]] = cat["node_id"]
                name_lookup[cat["id"]] = f"{dept['name']} > {cat['name']}"
                dept_lookup[cat["id"]] = dept["id"]

        # Calculate department and category totals
        selected_dept_ids = set(dept_lookup.get(cid) for cid in category_ids if cid in dept_lookup)
        departments_total = len(selected_dept_ids)
        categories_total = len(category_ids)

        # Check for existing checkpoint (resuming)
        run_data = await self.get_run(run_id, org_id)
        checkpoint = run_data.get("checkpoint") or {}
        resume_from_idx = 0
        products_fetched = 0

        if checkpoint.get("phase") == "amazon" and checkpoint.get("categories_completed"):
            # Resuming - skip already completed categories
            resume_from_idx = checkpoint["categories_completed"]
            products_fetched = checkpoint.get("products_fetched", 0)
            logger.info(f"Resuming Amazon collection from category {resume_from_idx + 1}/{categories_total}")
            print(f"\n[COLLECTION] Resuming from category {resume_from_idx + 1}/{categories_total}")
        else:
            # Fresh start - reset counters
            self.supabase.table("collection_runs").update({
                "departments_total": departments_total,
                "categories_total": categories_total,
                "departments_completed": 0,
                "categories_completed": 0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()

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

        # Track errors
        errors: list[dict] = []

        # Log collection start
        print(f"\n{'#'*60}")
        print(f"[COLLECTION] {'Resuming' if resume_from_idx > 0 else 'Starting'} Amazon Best Sellers Collection (PARALLEL)")
        print(f"[COLLECTION] Run ID: {run_id}")
        print(f"[COLLECTION] Departments: {departments_total}")
        print(f"[COLLECTION] Categories: {categories_total} ({resume_from_idx} already done)")
        print(f"[COLLECTION] Workers: 5")
        print(f"{'#'*60}")

        # Set up activity streaming
        activity_manager = get_activity_stream()

        def emit_activity(event):
            """Push activity event to SSE stream."""
            asyncio.create_task(activity_manager.push(run_id, event.to_dict()))

        # Create parallel runner
        runner = ParallelCollectionRunner(
            max_workers=5,
            on_activity=emit_activity,
        )

        # Define the task processing function
        async def process_category(task: dict, worker_id: int) -> dict:
            """Process a single category - called by parallel worker."""
            cat_id = task["cat_id"]
            node_id = task["node_id"]
            category_name = task["category_name"]

            # Emit fetching activity
            await runner.emit_activity(create_activity_event(
                worker_id=worker_id,
                phase="amazon",
                action="fetching",
                category=category_name,
            ))
            print(f"[W{worker_id}] Fetching: {category_name}")

            # Check if run was cancelled
            run_check = await self.get_run(run_id, org_id)
            if run_check and run_check["status"] in ("cancelled", "paused"):
                raise CollectionPausedException(f"Run {run_check['status']}")

            # Retry logic (3 attempts)
            for attempt in range(3):
                result = await scraper.fetch_bestsellers(node_id, category_name=category_name)

                if result.error == "rate_limited":
                    await runner.emit_activity(create_activity_event(
                        worker_id=worker_id,
                        phase="amazon",
                        action="rate_limited",
                        category=category_name,
                    ))
                    print(f"[W{worker_id}] Rate limited, waiting 5s...")
                    await asyncio.sleep(5)
                    continue

                if result.error:
                    await runner.emit_activity(create_activity_event(
                        worker_id=worker_id,
                        phase="amazon",
                        action="error",
                        category=category_name,
                        error_message=result.error,
                    ))
                    print(f"[W{worker_id}] Error: {result.error}")
                    raise Exception(result.error)

                # Success - emit found event
                await runner.emit_activity(create_activity_event(
                    worker_id=worker_id,
                    phase="amazon",
                    action="found",
                    category=category_name,
                    new_sellers_count=len(result.products),  # Reusing field for product count
                ))
                print(f"[W{worker_id}] Found {len(result.products)} products in {category_name}")

                return {
                    "cat_id": cat_id,
                    "products": result.products,
                    "category_name": category_name,
                }

            # Max retries reached
            return {"cat_id": cat_id, "products": [], "error": "max_retries"}

        # Prepare tasks list (skip already-processed when resuming)
        tasks = []
        for idx, cat_id in enumerate(category_ids):
            if idx < resume_from_idx:
                continue
            node_id = node_lookup.get(cat_id)
            if not node_id:
                logger.warning(f"Unknown category ID: {cat_id}")
                errors.append({"category": cat_id, "error": "unknown_category"})
                continue
            tasks.append({
                "cat_id": cat_id,
                "node_id": node_id,
                "category_name": name_lookup.get(cat_id, cat_id),
            })

        # Execute parallel
        try:
            results = await runner.run(tasks, process_category, phase="amazon")
        except CollectionPausedException:
            print(f"\n[COLLECTION] Run paused/cancelled - stopping Amazon collection")
            return {"status": "paused", "products_fetched": products_fetched}

        # Process results and save to database
        for result in results:
            if "error" in result:
                errors.append({"category": result["cat_id"], "error": result["error"]})
                continue

            cat_id = result["cat_id"]
            products_fetched += len(result["products"])

            # Save products as collection items (batch for efficiency)
            items_to_insert = []
            for product in result["products"]:
                items_to_insert.append({
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
                    "status": "pending",
                })

            if items_to_insert:
                batched_insert(self.supabase, table="collection_items", rows=items_to_insert)

        # Update progress - set to 100% complete for Amazon phase
        now = datetime.now(timezone.utc).isoformat()
        self.supabase.table("collection_runs").update({
            "total_items": products_fetched,
            "products_total": products_fetched,
            "departments_completed": departments_total,
            "categories_completed": categories_total,
            "checkpoint": {
                "phase": "amazon_complete",
                "products_fetched": products_fetched,
                "departments_completed": departments_total,
                "categories_completed": categories_total,
            },
            "processed_items": products_fetched,
            "failed_items": len(errors),
            "updated_at": now,
        }).eq("id", run_id).execute()

        # Emit phase complete activity
        await activity_manager.push(run_id, {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "worker_id": 0,  # 0 = system message
            "phase": "amazon",
            "action": "complete",
        })

        logger.info(f"Amazon collection complete: {products_fetched} products fetched")

        print(f"\n{'#'*60}")
        print(f"[COLLECTION] Amazon Phase Complete!")
        print(f"[COLLECTION] Departments: {departments_total}/{departments_total}")
        print(f"[COLLECTION] Categories: {categories_total}/{categories_total}")
        print(f"[COLLECTION] Total Products Fetched: {products_fetched}")
        print(f"[COLLECTION] Errors: {len(errors)}")
        print(f"{'#'*60}")

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

        # Load category data for progress tracking
        import json
        categories_path = Path(__file__).parent.parent / "data" / "amazon_categories.json"
        with open(categories_path) as f:
            cat_data = json.load(f)

        # Build category -> department mapping and category name lookup
        cat_to_dept = {}
        cat_name_lookup = {}
        for dept in cat_data["departments"]:
            for cat in dept.get("categories", []):
                cat_to_dept[cat["id"]] = dept["id"]
                cat_name_lookup[cat["id"]] = cat.get("name", cat["id"])

        # Group products by category and count totals
        products_by_category: dict[str, list] = {}
        for p in products:
            cat_id = p.get("data", {}).get("category_id", "unknown")
            if cat_id not in products_by_category:
                products_by_category[cat_id] = []
            products_by_category[cat_id].append(p["id"])

        # Track searched products per category
        searched_by_category: dict[str, set] = {cat_id: set() for cat_id in products_by_category}

        # Calculate totals
        categories_total = len(products_by_category)
        dept_ids = set(cat_to_dept.get(cat_id) for cat_id in products_by_category if cat_id in cat_to_dept)
        departments_total = len(dept_ids)

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

        # Check for existing checkpoint (resuming)
        run_data = await self.get_run(run_id, org_id)
        checkpoint = run_data.get("checkpoint") or {}
        resume_from_idx = 0
        sellers_found = 0
        sellers_new = 0

        total_products = len(products)

        if checkpoint.get("phase") == "ebay_search" and checkpoint.get("products_processed"):
            # Resuming - skip already searched products
            resume_from_idx = checkpoint["products_processed"]
            # Get current seller counts from the run
            sellers_found = run_data.get("sellers_found", 0)
            sellers_new = run_data.get("sellers_new", 0)
            logger.info(f"Resuming eBay search from product {resume_from_idx + 1}/{total_products}")
            print(f"\n[COLLECTION] Resuming from product {resume_from_idx + 1}/{total_products}")
        else:
            # Fresh start - reset progress for eBay phase
            self.supabase.table("collection_runs").update({
                "departments_total": departments_total,
                "departments_completed": 0,
                "categories_total": categories_total,
                "categories_completed": 0,
                "products_searched": 0,
                "checkpoint": {
                    "phase": "ebay_search",
                    "products_processed": 0,
                    "products_total": total_products,
                },
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()

        # Progress tracking
        consecutive_failures = 0
        products_processed = resume_from_idx

        logger.info(f"{'Resuming' if resume_from_idx > 0 else 'Starting'} eBay seller search for {total_products} products")

        print(f"\n{'#'*60}")
        print(f"[COLLECTION] {'Resuming' if resume_from_idx > 0 else 'Starting'} eBay Seller Search Phase")
        print(f"[COLLECTION] Run ID: {run_id}")
        print(f"[COLLECTION] Products to Search: {total_products} ({resume_from_idx} already done)")
        print(f"[COLLECTION] Categories: {categories_total}")
        print(f"[COLLECTION] Departments: {departments_total}")
        print(f"{'#'*60}")

        # Process each product
        for product_idx, product in enumerate(products):
            # Skip already-processed products when resuming
            if product_idx < resume_from_idx:
                continue

            # Check if run was cancelled/paused
            run_check = await self.get_run(run_id, org_id)
            if run_check and run_check["status"] in ("cancelled", "paused"):
                print(f"\n[COLLECTION] ⚠ Run {run_check['status']} - stopping eBay search")
                return {
                    "status": run_check["status"],
                    "sellers_found": sellers_found,
                    "sellers_new": sellers_new,
                }

            print(f"\n[COLLECTION] Progress: Product {products_processed + 1}/{total_products}")
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
                # Check if run was cancelled/paused before each API call
                run_check = await self.get_run(run_id, org_id)
                if run_check and run_check["status"] in ("cancelled", "paused"):
                    print(f"\n[COLLECTION] ⚠ Run {run_check['status']} - stopping eBay search")
                    return {
                        "status": run_check["status"],
                        "sellers_found": sellers_found,
                        "sellers_new": sellers_new,
                    }

                result = await scraper.search_sellers(title, price, page)

                # Check again after API call (user may have cancelled during the request)
                run_check = await self.get_run(run_id, org_id)
                if run_check and run_check["status"] in ("cancelled", "paused"):
                    print(f"\n[COLLECTION] ⚠ Run {run_check['status']} - stopping eBay search")
                    return {
                        "status": run_check["status"],
                        "sellers_found": sellers_found,
                        "sellers_new": sellers_new,
                    }

                # Handle rate limiting
                if result.error == "rate_limited":
                    logger.info(f"Rate limited, waiting 5s")
                    # Build current_activity for rate limit display
                    cat_id = product_data.get("category_id", "unknown")
                    cat_name = cat_name_lookup.get(cat_id, cat_id.replace("-", " ").title())
                    short_title = title[:40] + "..." if len(title) > 40 else title
                    current_activity = f"{cat_name} > {short_title}"
                    # Update checkpoint with throttle status
                    self.supabase.table("collection_runs").update({
                        "checkpoint": {
                            "status": "rate_limited",
                            "waiting_seconds": 5,
                            "current_product_id": product["id"],
                            "current_activity": current_activity,
                            "current_page": page,
                        },
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", run_id).execute()

                    await asyncio.sleep(5)

                    # Check if cancelled during wait
                    run_check = await self.get_run(run_id, org_id)
                    if run_check and run_check["status"] in ("cancelled", "paused"):
                        print(f"\n[COLLECTION] ⚠ Run {run_check['status']} - stopping eBay search")
                        return {
                            "status": run_check["status"],
                            "sellers_found": sellers_found,
                            "sellers_new": sellers_new,
                        }
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
                sellers_found += len(result.sellers)

                # Batch process sellers for efficiency
                if result.sellers:
                    # Prepare seller data
                    seller_info = []
                    for seller in result.sellers:
                        normalized = self._normalize_seller_name(seller.username)
                        seller_info.append({
                            "username": seller.username,
                            "normalized": normalized,
                            "feedback_count": seller.feedback_count,
                        })

                    # Batch lookup existing sellers
                    normalized_names = [s["normalized"] for s in seller_info]
                    existing_results = batched_query(
                        self.supabase,
                        table="sellers",
                        select="id, normalized_name",
                        filter_column="normalized_name",
                        filter_values=normalized_names,
                        extra_filters={"org_id": org_id, "platform": "ebay"},
                    )
                    existing_map = {r["normalized_name"]: r["id"] for r in existing_results}

                    # Separate new vs existing
                    new_sellers = []
                    existing_ids = []
                    for info in seller_info:
                        if info["normalized"] in existing_map:
                            existing_ids.append(existing_map[info["normalized"]])
                        else:
                            new_sellers.append({
                                "org_id": org_id,
                                "display_name": info["username"],
                                "normalized_name": info["normalized"],
                                "platform": "ebay",
                                "platform_id": info["username"],
                                "feedback_score": info["feedback_count"],
                                "first_seen_run_id": run_id,
                                "last_seen_run_id": run_id,
                                "times_seen": 1,
                            })

                    # Batch update existing sellers
                    if existing_ids:
                        batched_update(
                            self.supabase,
                            table="sellers",
                            filter_column="id",
                            filter_values=existing_ids,
                            update_data={
                                "last_seen_run_id": run_id,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            },
                        )

                    # Batch insert new sellers
                    if new_sellers:
                        inserted, _ = batched_insert(
                            self.supabase,
                            table="sellers",
                            rows=new_sellers,
                        )
                        sellers_new += inserted
                        if inserted > 0:
                            print(f"[EBAY] ★ {inserted} NEW SELLERS")
                            for s in new_sellers[:3]:
                                print(f"         {s['display_name']}")
                            if len(new_sellers) > 3:
                                print(f"         (+{len(new_sellers) - 3} more)")

                # Stop pagination early if no more results
                if not result.has_more:
                    break

                # Delay between pages
                await asyncio.sleep(REQUEST_DELAY_MS / 1000)

            products_processed += 1

            # Track this product as searched in its category
            cat_id = product.get("data", {}).get("category_id", "unknown")
            if cat_id in searched_by_category:
                searched_by_category[cat_id].add(product["id"])

            # Calculate categories completed (all products in category searched)
            categories_completed = 0
            completed_cat_ids = set()
            for cid, product_ids in products_by_category.items():
                if len(searched_by_category.get(cid, set())) >= len(product_ids):
                    categories_completed += 1
                    completed_cat_ids.add(cid)

            # Calculate departments completed (all categories in dept are complete)
            departments_completed = 0
            dept_category_count: dict[str, int] = {}
            dept_completed_count: dict[str, int] = {}
            for cid in products_by_category:
                dept_id = cat_to_dept.get(cid)
                if dept_id:
                    dept_category_count[dept_id] = dept_category_count.get(dept_id, 0) + 1
                    if cid in completed_cat_ids:
                        dept_completed_count[dept_id] = dept_completed_count.get(dept_id, 0) + 1

            for dept_id, total_cats in dept_category_count.items():
                if dept_completed_count.get(dept_id, 0) >= total_cats:
                    departments_completed += 1

            # Update progress checkpoint after each product
            # Build current_activity string: "Category > Product Title"
            cat_name = cat_name_lookup.get(cat_id, cat_id.replace("-", " ").title())
            # Truncate title to 40 chars for display
            short_title = title[:40] + "..." if len(title) > 40 else title
            current_activity = f"{cat_name} > {short_title}"

            self.supabase.table("collection_runs").update({
                "checkpoint": {
                    "phase": "ebay_search",
                    "current_product_id": product["id"],
                    "current_activity": current_activity,
                    "products_processed": products_processed,
                    "products_total": total_products,
                },
                "processed_items": products_processed,
                "products_searched": products_processed,
                "categories_completed": categories_completed,
                "departments_completed": departments_completed,
                "sellers_found": sellers_found,
                "sellers_new": sellers_new,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()

            print(f"[EBAY] Progress: {products_processed}/{total_products} products, {categories_completed}/{categories_total} cats, {departments_completed}/{departments_total} depts")


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

        print(f"\n{'#'*60}")
        print(f"[COLLECTION] eBay Phase Complete!")
        print(f"[COLLECTION] Products Searched: {products_processed}")
        print(f"[COLLECTION] Total Sellers Found: {sellers_found}")
        print(f"[COLLECTION] New Sellers Added: {sellers_new}")
        print(f"{'#'*60}")
        print(f"\n[COLLECTION] ✓ COLLECTION RUN COMPLETED")

        return {
            "status": "completed",
            "sellers_found": sellers_found,
            "sellers_new": sellers_new,
        }
