# Roadmap: DS-ProSolution v2 SellerCollection

## Overview

SellerCollection automates dropshipper discovery by cross-referencing Amazon Best Sellers with eBay search results. The pipeline fetches products from Amazon via third-party API, searches each on eBay with dropshipper filters (Brand New, free shipping, 80-120% price markup), extracts seller names, deduplicates against existing database, and exports results. Four phases deliver infrastructure, Amazon integration, eBay integration, and the output layer in sequence.

## Milestones

- **v1 Extension Auth & RBAC** - Phases 1-5 (shipped 2026-01-20)
- **v2 SellerCollection** - Phases 6-13 (complete)

## Phases

- [x] **Phase 6: Collection Infrastructure** - Database schema, job framework, budget controls
- [x] **Phase 7: Amazon Best Sellers** - API integration and category selection UI
- [x] **Phase 8: eBay Seller Search** - API integration with dropshipper filters
- [x] **Phase 9: Storage, Export, and Collection UI** - Deduplication, export, progress tracking
- [x] **Phase 10: Collection UI Cleanup** - Streamline UI, remove clutter, improve data surfacing
- [x] **Phase 11: Collection Bug Fixes & Polish** - Fix progress bar, history section, and concurrency settings
- [x] **Phase 12: Live Activity Feed & Concurrency** - Live visual activity feed, parallel collection (5 workers), seller snapshot counts
- [x] **Phase 13: Worker Status Dashboard & Metrics** - 2-panel detail modal, per-worker status cards, click-to-expand logs/metrics, data pipeline status

## Phase Details

### Phase 6: Collection Infrastructure

**Goal:** Establish foundation for collection pipeline with seller management, cost controls, and progress tracking
**Depends on:** v1 complete (existing auth/RBAC infrastructure)
**Requirements:** COLL-01, COLL-06, COLL-07
**Success Criteria** (what must be TRUE):
  1. Admin can trigger a collection run from the web app
  2. Collection run displays estimated API cost before starting
  3. Collection run aborts if budget cap would be exceeded
  4. Job state persists across API restarts (checkpointing)
  5. Admin can view/edit/add/remove sellers directly
  6. All seller changes are logged with full audit trail
  7. Admin can compare seller list snapshots (diff view)
**Plans:** 4 plans

Plans:
- [x] 06-01-PLAN.md — Database schema (collection_settings, collection_runs, collection_items, sellers)
- [x] 06-02-PLAN.md — CollectionService and API endpoints (cost estimation, budget enforcement, CRUD)
- [x] 06-03-PLAN.md — Backend extensions (audit log, seller CRUD, diff, templates, enhanced progress)
- [x] 06-04-PLAN.md — Collections UI (sellers grid, history/diff modals, progress bar, run config)

### Phase 7: Amazon Best Sellers

**Goal:** Admin can fetch products from Amazon Best Sellers with category selection
**Depends on:** Phase 6
**Requirements:** AMZN-01, AMZN-02, AMZN-03, AMZN-05 (AMZN-04 omitted per user decision - no "Top 10" preset)
**Success Criteria** (what must be TRUE):
  1. Admin can view list of Amazon categories with checkboxes
  2. Admin can use "Select All" preset to check all categories
  3. Admin can save custom category selection as named preset
  4. Collection fetches product titles and prices from selected categories
**Plans:** 5 plans

Plans:
- [x] 07-01-PLAN.md — Foundation (categories JSON, abstract scraper interface, presets schema)
- [x] 07-02-PLAN.md — Oxylabs scraper implementation
- [x] 07-03-PLAN.md — Amazon API endpoints (categories, presets CRUD)
- [x] 07-04-PLAN.md — Category selector UI (department hierarchy, search, presets dropdown)
- [x] 07-05-PLAN.md — Integration (collection execution, UI wiring)

### Phase 8: eBay Seller Search

**Goal:** Admin can search eBay for dropshippers based on Amazon products
**Depends on:** Phase 7
**Requirements:** EBAY-01, EBAY-02, EBAY-03, EBAY-04, EBAY-05, EBAY-06
**Success Criteria** (what must be TRUE):
  1. Each Amazon product triggers eBay search with product title
  2. Results filtered to Brand New condition only
  3. Results filtered to free shipping only
  4. Results filtered to 80-120% of Amazon price
  5. Results filtered to US sellers only
  6. Seller names extracted from search results
**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md — eBay scraper service (abstract interface, Oxylabs implementation, dropshipper filters)
- [x] 08-02-PLAN.md — Collection integration (eBay search method, API endpoint, Amazon->eBay chaining)

### Phase 9: Storage, Export, and Collection UI

**Goal:** Admin can view, export, and manage collected sellers with full metadata, history, and scheduled runs
**Depends on:** Phase 8
**Requirements:** STOR-01, STOR-02, STOR-03, STOR-04, STOR-05, COLL-02, COLL-03, COLL-04, COLL-05
**Success Criteria** (what must be TRUE):
  1. Sellers deduplicated against existing database (normalized comparison) - ALREADY COMPLETE
  2. Each seller stored with collection metadata (discovered_at, from_product) - ALREADY COMPLETE
  3. Admin can export sellers as JSON with full metadata
  4. Admin can export sellers as CSV with full metadata
  5. Admin can copy seller list to clipboard
  6. Progress indicator shows current product / total products during collection
  7. Admin can stop/cancel running collection
  8. Collection history shows past runs with timestamps
  9. Admin can configure scheduled monthly collection
**Plans:** 5 plans

Plans:
- [x] 09-01-PLAN.md — Enhanced export API (full metadata JSON/CSV, run_id filtering)
- [x] 09-02-PLAN.md — Collection history API (history endpoint with stats)
- [x] 09-03-PLAN.md — Export & History UI (collection history table, enhanced exports, minimizable progress, cancel, re-run)
- [x] 09-04-PLAN.md — Scheduled collections backend (APScheduler, migration, CRUD endpoints, lifecycle)
- [x] 09-05-PLAN.md — Schedule configuration UI (schedule-config component, automation page integration)

### Phase 10: Collection UI Cleanup

**Goal:** Streamline the collection UI by removing clutter, improving layout, and surfacing only the most useful data
**Depends on:** Phase 9
**Requirements:** UX improvement (no new requirements - refinement phase)
**Success Criteria** (what must be TRUE):
  1. Progress bar shows two-phase display (Amazon collecting, eBay searching)
  2. History panel shows unified timeline of collection runs and manual edits
  3. Run config modal has two-panel layout with integrated scheduling
  4. Sellers grid supports bulk selection (click, drag, Ctrl+A) and hover cards
  5. Deprecated components removed from page (recent-logs-sidebar, collection-history, schedule-config)
**Plans:** 5 plans

Plans:
- [x] 10-01-PLAN.md — Setup & Progress Bar (install shadcn components, two-phase progress display)
- [x] 10-02-PLAN.md — History Panel (merge recent activity + collection history into unified timeline)
- [x] 10-03-PLAN.md — Sellers Grid Enhancement (bulk selection, drag select, hover cards)
- [x] 10-04-PLAN.md — Run Config Modal (two-panel layout with integrated scheduling)
- [x] 10-05-PLAN.md — Page Integration (wire new components, remove deprecated, final cleanup)

### Phase 11: Collection Bug Fixes & Polish

**Goal:** Fix critical bugs in progress tracking, history display, selection behavior, and deletion UX
**Depends on:** Phase 10
**Requirements:** Bug fixes and polish (no new requirements - stabilization phase)
**Success Criteria** (what must be TRUE):
  1. Progress bar updates in real-time without polling delay visible to user
  2. Category/department completion only shown when all products in that category are fully searched
  3. Progress bar persists across page refresh (state restored from backend)
  4. History "sellers at this point" shows accurate count at that moment in time
  5. Run detail modal shows actual run data (not placeholder)
  6. Category breakdown shows real data per category
  7. Concurrency settings evaluated and configured appropriately for scale
**Plans:** 5 plans

Plans:
- [x] 11-01-PLAN.md — Progress polling and audit log replay (reduce polling interval, fix bulk add replay)
- [x] 11-02-PLAN.md — Category breakdown endpoint and modal display (real data instead of placeholder)
- [x] 11-03-PLAN.md — Selection behavior (remove card X, Shift+click range, deselect on empty)
- [x] 11-04-PLAN.md — Undo/redo for deletions (toast with undo, Ctrl+Z, Ctrl+Shift+Z)
- [x] 11-05-PLAN.md — Concurrency slider polish (tick marks 1-5, remove Coming soon)

### Phase 12: Live Activity Feed & Concurrency

**Goal:** Deliver real-time visual activity feed in detail modal, implement 5-worker parallel collection, and fix seller snapshot counts in history
**Depends on:** Phase 11
**Requirements:** UX enhancement + performance (no new requirements - feature completion phase)
**Success Criteria** (what must be TRUE):
  1. "Sellers at this point" works correctly for collection run entries in history
  2. Progress detail modal shows live activity feed (visual cards, not terminal text)
  3. Activity feed displays same info as backend terminal prints (category, product, seller found, etc.)
  4. Activity text removed from main progress bar (moved to detail modal)
  5. Collection runs with 5 parallel workers (optimal concurrency, no user slider)
  6. Concurrency slider removed (system uses optimal concurrency automatically)
**Plans:** 4 plans

Plans:
- [x] 12-01-PLAN.md — Backend parallel infrastructure (migration, ParallelCollectionRunner, ActivityStreamManager, SSE endpoint)
- [x] 12-02-PLAN.md — Refactor collection execution (parallel Amazon, parallel eBay, activity events, seller snapshots)
- [x] 12-03-PLAN.md — Frontend activity feed UI (ActivityFeed component, modal integration, progress bar cleanup, history snapshots)
- [x] 12-04-PLAN.md — Backend auth and API updates (SSE query param auth, history/audit-log snapshot responses)

### Phase 13: Worker Status Dashboard & Metrics

**Goal:** Rework progress detail modal into 2-panel layout with per-worker status cards and comprehensive metrics tracking
**Depends on:** Phase 12
**Requirements:** UX enhancement (no new requirements - observability/monitoring phase)
**Success Criteria** (what must be TRUE):
  1. Progress detail modal has 2-panel layout: worker status (left) + metrics/status (right)
  2. 5 worker status cards show real-time activity (searching products, returning products, searching sellers, returning sellers)
  3. Clicking a worker card opens detailed log and metrics for that worker (successful API hits, failures, cancelled, etc.)
  4. Metrics panel shows data pipeline status ("uploading 25 new sellers from worker 4", etc.)
  5. Failure tracking distinguishes parse errors vs API errors
  6. Total failure counts displayed with breakdown by type
**Plans:** 4 plans

Plans:
- [x] 13-01-PLAN.md — Backend activity event extension (rich metadata, pipeline actions)
- [x] 13-02-PLAN.md — Frontend types and worker status components (WorkerCard, WorkerStatusPanel, WorkerDetailView)
- [x] 13-03-PLAN.md — Metrics panel components (PipelineFeed, MetricsSummary, MetricsPanel)
- [x] 13-04-PLAN.md — Modal integration (2-panel layout, client-side metrics aggregation)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Collection Infrastructure | v2 | 4/4 | Complete | 2026-01-20 |
| 7. Amazon Best Sellers | v2 | 5/5 | Complete | 2026-01-20 |
| 8. eBay Seller Search | v2 | 2/2 | Complete | 2026-01-21 |
| 9. Storage, Export, and Collection UI | v2 | 5/5 | Complete | 2026-01-21 |
| 10. Collection UI Cleanup | v2 | 5/5 | Complete | 2026-01-21 |
| 11. Collection Bug Fixes & Polish | v2 | 5/5 | Complete | 2026-01-22 |
| 12. Live Activity Feed & Concurrency | v2 | 4/4 | Complete | 2026-01-22 |
| 13. Worker Status Dashboard & Metrics | v2 | 4/4 | Complete | 2026-01-23 |

## Requirement Coverage

**v2 SellerCollection:** 22/23 requirements mapped (AMZN-04 omitted per user decision)

| Category | Requirements | Phase |
|----------|--------------|-------|
| Amazon Best Sellers | AMZN-01, AMZN-02, AMZN-03, AMZN-05 | Phase 7 |
| eBay Search | EBAY-01, EBAY-02, EBAY-03, EBAY-04, EBAY-05, EBAY-06 | Phase 8 |
| Collection Management | COLL-01, COLL-06, COLL-07 | Phase 6 |
| Collection Management | COLL-02, COLL-03, COLL-04, COLL-05 | Phase 9 |
| Storage & Export | STOR-01, STOR-02, STOR-03, STOR-04, STOR-05 | Phase 9 |
