# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Automate the discovery and collection of Amazon-to-eBay dropshippers at scale
**Current focus:** v2 SellerCollection Phase 13 - Worker Status Dashboard & Metrics

## Current Position

Phase: 13 of 13 (Worker Status Dashboard & Metrics)
Plan: 3 of 4 (Metrics Panel Components)
Status: In progress
Last activity: 2026-01-23 - Completed 13-03-PLAN.md

Progress: [█████████████████████████████████░░] 33/34 plans complete
**Next Plan:** 13-04 - Integration into 2-Panel Detail Modal

## Shipped Milestones

- **v1 Extension Auth & RBAC** (2026-01-20) - 7 phases, 12 plans, 27 requirements
  - See: .planning/milestones/v1-ROADMAP.md
  - See: .planning/milestones/v1-REQUIREMENTS.md
  - See: .planning/milestones/v1-MILESTONE-AUDIT.md

## Performance Metrics

**v1 Milestone:**
- Total plans completed: 12
- Total execution time: ~65 min
- Timeline: 3 days (2026-01-17 -> 2026-01-20)
- Files modified: 74
- Lines added: +16,544

**v2 Milestone:**
- Total plans completed: 24
- Average duration: ~4 min
- Total execution time: ~113 min

## Accumulated Context

### Decisions

Key decisions logged in PROJECT.md Key Decisions table.

Recent for v2:
- Use Oxylabs E-Commerce Scraper API for both Amazon and eBay ($49/month Micro plan)
- Budget controls and progress tracking before any API calls (prevent cost overruns)
- Budget cap in cents (INT) for integer arithmetic
- JSONB checkpoint column for flexible crash recovery
- CHECK constraints for status state machine (vs enum for easier migration)
- Normalized name uniqueness for seller deduplication
- Placeholder cost estimation (50 products/category) for Phase 6 - Phase 7 adds real estimates
- Budget hard-block on create (not soft-warning) prevents accidental overspend
- Audit log replay for seller snapshot reconstruction (simple, no snapshot tables needed)
- Static JSON file for Amazon categories (not database) - rarely changes, no DB overhead
- Abstract AmazonScraperService interface for swappable scraper implementations
- Category IDs use namespaced format (e.g., electronics-computers) for uniqueness
- Oxylabs cost tracking at 3 cents per bestsellers page (COST_PER_BESTSELLERS_PAGE_CENTS)
- Rate limit (429) returns error field in ScrapeResult instead of raising exception
- CategoryLoader minimal subclass pattern for accessing get_categories without full credentials
- Preset dropdown separate component from selector for reusability
- Collapsible department hierarchy with expandedDepts Set pattern
- Background task execution for scraping keeps API responsive
- Checkpoint JSONB stores throttle status for UI display
- 5 consecutive failures auto-pauses collection
- eBay scraper uses URL-embedded filters (not post-fetch filtering) for efficiency
- EbayScraperService interface mirrors AmazonScraperService pattern
- Seller info parsing with three-tier regex fallback (full, partial, minimal formats)
- Chained Amazon->eBay pipeline: eBay search only runs if Amazon phase completes successfully
- 3 pages per product for thorough eBay seller coverage (up to 180 sellers per product)
- 200ms inter-page delay for conservative rate limit handling
- Export discovered_at maps to created_at timestamp in seller record
- CSV export uses DictWriter for proper field ordering and escaping
- Export filenames format: sellers_{date}_{full|run-xxx}.{ext}
- Compute duration_seconds in service layer from timestamps for history endpoint
- History endpoint filters only terminal statuses (completed/failed/cancelled)
- Floating indicator shows percentage and click to expand modal
- Re-run passes category_ids to pre-select in RunConfigModal
- Cancel button in both progress bar inline and modal footer
- APScheduler AsyncIOScheduler for non-blocking cron tasks
- One schedule per org constraint for simplicity
- Croniter for cron expression validation
- 1 hour misfire grace time for missed scheduled runs
- Scheduled runs skip if collection already running
- Cron preset dropdown with common schedules (1st of month, 15th, weekly, daily)
- Custom cron input revealed when 'Custom' preset selected
- Client-side merge of audit-log and history data for unified timeline (vs new backend endpoint)
- Discriminated union pattern for mixed activity feeds (CollectionRunEntry vs ManualEditEntry)
- Border accent colors for visual category distinction (blue for runs, gray for edits)
- Two-phase progress display: Amazon (orange) then eBay (blue) with phase-appropriate metrics
- Phase defaults to "amazon" for backwards compatibility with existing backend
- Worker status removed from progress modal (per CONTEXT.md - simplify, remove clutter)
- 200ms click timeout to distinguish single-click (selection) from double-click (edit mode)
- Selection refs map pattern for drag-to-select element registration
- Conditional hover card metadata rendering (handles undefined gracefully)
- Two-panel modal layout with 1fr/320px grid for balanced category selector and controls
- Recurring presets generate cron expressions from selected date (day of week or day of month)
- Calendar highlights next 6 months of scheduled dates based on recurring pattern
- Deprecate components with JSDoc rather than delete (per CLAUDE.md guardrails)
- Modal routing: Collection runs open HierarchicalRunModal, manual edits open LogDetailModal
- Re-run flow: HierarchicalRunModal onRerun populates RunConfigModal initialCategories
- Category breakdown aggregates from collection_items JSONB data field
- Category ID hyphens replaced with spaces for display readability
- 500ms polling interval for responsive progress updates (lightweight single-row read endpoint)
- Audit log replay parses new_value/old_value JSON for bulk operations (handles both adds and removes)
- Selection anchor pattern for Shift+click range selection (track last clicked index)
- Shift preview IDs state for visual feedback before Shift+click action
- Empty space detection via index >= filteredSellers.length for deselect-on-click
- UndoEntry stores DeletedSeller[] with originalIndex for position restoration
- Redo stack clears on new delete (standard undo/redo pattern)
- Toast duration 5 seconds with undo action button
- Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z) respect input focus
- 5 workers (MAX_WORKERS=5) for optimal Oxylabs Micro plan concurrency
- 100-event activity buffer per run with oldest-drop overflow policy
- 15-second keepalive timeout for SSE connection health
- Poison pill pattern for clean worker shutdown
- Singleton pattern for ActivityStreamManager
- Batch insert products after parallel execution for efficiency
- Dedupe sellers across all parallel results in single batch operation
- Emit phase complete activity event with worker_id=0 for system messages
- Store seller count snapshot after run completion
- Flexible auth centralized in auth.py (require_permission_key_flexible for SSE)
- Factory pattern for flexible auth mirrors existing require_permission_key API
- ActivityEvent extended with optional fields (backward compatible via to_dict None filtering)
- Pipeline events use worker_id=0 to distinguish from worker-specific events
- Error classification: error_type (rate_limit, timeout, http_500, api_error) and error_stage (api, product_extraction, seller_extraction, price_parsing)
- api_params dict stores query parameters for debugging (node_id for Amazon, query/price_min/price_max/page for eBay)
- duration_ms tracks request timing using time.time() delta
- Pipeline events filtered by worker_id=0 (system-level operations)
- Error breakdown classifies into 5 categories: rate_limit, timeout, http_error, parse_error, other
- Mini worker icons show only when a worker is expanded for awareness
- Phase-appropriate output stats: products for Amazon, sellers for eBay

### Pending Todos

- Run migration 036_presence_system.sql in Supabase SQL editor (if not already done)
- Run migration 037_collection_infrastructure.sql in Supabase SQL editor
- Run migration 038_seller_audit_log.sql in Supabase SQL editor
- Run migration 039_run_templates.sql in Supabase SQL editor
- Run migration 040_enhanced_progress.sql in Supabase SQL editor
- Run migration 041_amazon_category_presets.sql in Supabase SQL editor
- Run migration 042_remove_cost_tracking.sql in Supabase SQL editor
- Run migration 043_collection_schedules.sql in Supabase SQL editor
- Run migration 045_seller_snapshots.sql in Supabase SQL editor

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-23
Stopped at: Completed 13-03-PLAN.md
Resume file: None
Next action: Continue with 13-04-PLAN.md (Integration into 2-Panel Detail Modal)

## Roadmap Evolution

- Phase 10 added: Collection UI Cleanup - streamline UI, remove clutter, improve data surfacing
- Phase 11 added: Collection Bug Fixes & Polish - fix progress bar, history section, concurrency settings
- Phase 12 added: Live Activity Feed & Concurrency - live feed in modal, fix history seller counts, implement parallel collection
- Phase 13 added: Worker Status Dashboard & Metrics - 2-panel detail modal, per-worker status cards, click-to-expand logs/metrics, data pipeline status
