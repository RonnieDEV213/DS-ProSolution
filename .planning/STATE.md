# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Automate the discovery and collection of Amazon-to-eBay dropshippers at scale
**Current focus:** v2 SellerCollection complete - ready for milestone audit

## Current Position

Phase: 10 of 10 (Collection UI Cleanup)
Plan: 5 of 5 complete (Setup & Progress Bar, Unified History Panel, Sellers Grid Enhancement, Run Config Modal, Automation Page Integration)
Status: Phase 10 COMPLETE
Last activity: 2026-01-21 - Completed 10-05-PLAN.md (Automation Page Integration)

Progress: [██████████] 21/21 v2 plans - PHASE 10 COMPLETE

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
- Total plans completed: 21
- Average duration: ~4 min
- Total execution time: ~92 min

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

### Pending Todos

- Run migration 036_presence_system.sql in Supabase SQL editor (if not already done)
- Run migration 037_collection_infrastructure.sql in Supabase SQL editor
- Run migration 038_seller_audit_log.sql in Supabase SQL editor
- Run migration 039_run_templates.sql in Supabase SQL editor
- Run migration 040_enhanced_progress.sql in Supabase SQL editor
- Run migration 041_amazon_category_presets.sql in Supabase SQL editor
- Run migration 042_remove_cost_tracking.sql in Supabase SQL editor
- Run migration 043_collection_schedules.sql in Supabase SQL editor

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-21
Stopped at: Completed 10-05-PLAN.md (Automation Page Integration)
Resume file: None
Next action: Run /gsd:audit-milestone to verify v2 requirements and cross-phase integration

## Roadmap Evolution

- Phase 10 added: Collection UI Cleanup - streamline UI, remove clutter, improve data surfacing
