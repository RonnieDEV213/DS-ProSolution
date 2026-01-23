# Milestone v2: SellerCollection

**Status:** SHIPPED 2026-01-23
**Phases:** 6-14
**Total Plans:** 37

## Overview

SellerCollection automates dropshipper discovery by cross-referencing Amazon Best Sellers with eBay search results. The pipeline fetches products from Amazon via third-party API, searches each on eBay with dropshipper filters (Brand New, free shipping, 80-120% price markup), extracts seller names, deduplicates against existing database, and exports results. Nine phases delivered infrastructure, Amazon integration, eBay integration, collection UI, UI cleanup, bug fixes, live activity feed, worker dashboard, and history simplification.

## Phases

### Phase 6: Collection Infrastructure

**Goal**: Establish foundation for collection pipeline with seller management, cost controls, and progress tracking
**Depends on**: v1 complete (existing auth/RBAC infrastructure)
**Plans**: 4 plans

Plans:
- [x] 06-01-PLAN.md — Database schema (collection_settings, collection_runs, collection_items, sellers)
- [x] 06-02-PLAN.md — CollectionService and API endpoints (cost estimation, budget enforcement, CRUD)
- [x] 06-03-PLAN.md — Backend extensions (audit log, seller CRUD, diff, templates, enhanced progress)
- [x] 06-04-PLAN.md — Collections UI (sellers grid, history/diff modals, progress bar, run config)

**Details:**
- Created 7 database tables for collection infrastructure
- Implemented checkpointing for crash recovery
- Built seller audit log for tracking all changes
- Created initial collection UI with progress tracking

### Phase 7: Amazon Best Sellers

**Goal**: Admin can fetch products from Amazon Best Sellers with category selection
**Depends on**: Phase 6
**Plans**: 5 plans

Plans:
- [x] 07-01-PLAN.md — Foundation (categories JSON, abstract scraper interface, presets schema)
- [x] 07-02-PLAN.md — Oxylabs scraper implementation
- [x] 07-03-PLAN.md — Amazon API endpoints (categories, presets CRUD)
- [x] 07-04-PLAN.md — Category selector UI (department hierarchy, search, presets dropdown)
- [x] 07-05-PLAN.md — Integration (collection execution, UI wiring)

**Details:**
- Static JSON file with 35 Amazon departments and categories
- Oxylabs E-Commerce Scraper API integration ($49/month Micro plan)
- Hierarchical category selector with search and custom presets
- Background task execution for responsive API

### Phase 8: eBay Seller Search

**Goal**: Admin can search eBay for dropshippers based on Amazon products
**Depends on**: Phase 7
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — eBay scraper service (abstract interface, Oxylabs implementation, dropshipper filters)
- [x] 08-02-PLAN.md — Collection integration (eBay search method, API endpoint, Amazon->eBay chaining)

**Details:**
- URL-embedded filters for efficiency (Brand New, free shipping, 80-120% markup, US sellers)
- Three-tier regex fallback for seller name parsing
- Chained Amazon->eBay pipeline
- 3 pages per product for thorough seller coverage

### Phase 9: Storage, Export, and Collection UI

**Goal**: Admin can view, export, and manage collected sellers with full metadata, history, and scheduled runs
**Depends on**: Phase 8
**Plans**: 5 plans

Plans:
- [x] 09-01-PLAN.md — Enhanced export API (full metadata JSON/CSV, run_id filtering)
- [x] 09-02-PLAN.md — Collection history API (history endpoint with stats)
- [x] 09-03-PLAN.md — Export & History UI (collection history table, enhanced exports, minimizable progress, cancel, re-run)
- [x] 09-04-PLAN.md — Scheduled collections backend (APScheduler, migration, CRUD endpoints, lifecycle)
- [x] 09-05-PLAN.md — Schedule configuration UI (schedule-config component, automation page integration)

**Details:**
- JSON/CSV export with full metadata
- APScheduler for monthly scheduled runs
- Collection history with duration and stats
- Cancel/re-run functionality

### Phase 10: Collection UI Cleanup

**Goal**: Streamline the collection UI by removing clutter, improving layout, and surfacing only the most useful data
**Depends on**: Phase 9
**Plans**: 5 plans

Plans:
- [x] 10-01-PLAN.md — Setup & Progress Bar (install shadcn components, two-phase progress display)
- [x] 10-02-PLAN.md — History Panel (merge recent activity + collection history into unified timeline)
- [x] 10-03-PLAN.md — Sellers Grid Enhancement (bulk selection, drag select, hover cards)
- [x] 10-04-PLAN.md — Run Config Modal (two-panel layout with integrated scheduling)
- [x] 10-05-PLAN.md — Page Integration (wire new components, remove deprecated, final cleanup)

**Details:**
- Two-phase progress display (Amazon orange, eBay blue)
- Unified timeline for collection runs and manual edits
- Bulk selection with drag-to-select
- Two-panel modal layout with 1fr/320px grid

### Phase 11: Collection Bug Fixes & Polish

**Goal**: Fix critical bugs in progress tracking, history display, selection behavior, and deletion UX
**Depends on**: Phase 10
**Plans**: 5 plans

Plans:
- [x] 11-01-PLAN.md — Progress polling and audit log replay (reduce polling interval, fix bulk add replay)
- [x] 11-02-PLAN.md — Category breakdown endpoint and modal display (real data instead of placeholder)
- [x] 11-03-PLAN.md — Selection behavior (remove card X, Shift+click range, deselect on empty)
- [x] 11-04-PLAN.md — Undo/redo for deletions (toast with undo, Ctrl+Z, Ctrl+Shift+Z)
- [x] 11-05-PLAN.md — Concurrency slider polish (tick marks 1-5, remove Coming soon)

**Details:**
- 500ms polling interval for responsive progress
- Shift+click range selection with visual preview
- Undo/redo stack with keyboard shortcuts
- Category breakdown from collection_items JSONB

### Phase 12: Live Activity Feed & Concurrency

**Goal**: Deliver real-time visual activity feed in detail modal, implement 5-worker parallel collection, and fix seller snapshot counts in history
**Depends on**: Phase 11
**Plans**: 4 plans

Plans:
- [x] 12-01-PLAN.md — Backend parallel infrastructure (migration, ParallelCollectionRunner, ActivityStreamManager, SSE endpoint)
- [x] 12-02-PLAN.md — Refactor collection execution (parallel Amazon, parallel eBay, activity events, seller snapshots)
- [x] 12-03-PLAN.md — Frontend activity feed UI (ActivityFeed component, modal integration, progress bar cleanup, history snapshots)
- [x] 12-04-PLAN.md — Backend auth and API updates (SSE query param auth, history/audit-log snapshot responses)

**Details:**
- 5 parallel workers (MAX_WORKERS=5) for optimal Oxylabs Micro plan concurrency
- 100-event activity buffer with oldest-drop overflow
- Poison pill pattern for clean worker shutdown
- Seller count snapshots after run completion

### Phase 13: Worker Status Dashboard & Metrics

**Goal**: Rework progress detail modal into 2-panel layout with per-worker status cards and comprehensive metrics tracking
**Depends on**: Phase 12
**Plans**: 4 plans

Plans:
- [x] 13-01-PLAN.md — Backend activity event extension (rich metadata, pipeline actions)
- [x] 13-02-PLAN.md — Frontend types and worker status components (WorkerCard, WorkerStatusPanel, WorkerDetailView)
- [x] 13-03-PLAN.md — Metrics panel components (PipelineFeed, MetricsSummary, MetricsPanel)
- [x] 13-04-PLAN.md — Modal integration (2-panel layout, client-side metrics aggregation)

**Details:**
- Rich activity events with error classification (rate_limit, timeout, http_error, parse_error)
- Per-worker status cards with click-to-expand detail view
- Client-side metrics aggregation from SSE events
- 2-panel modal: workers (1fr) + metrics (320px)

### Phase 14: History & Snapshot Simplification

**Goal**: Simplify history UI by showing inline diff in snapshots and removing unused comparison/detail modals
**Depends on**: Phase 13
**Plans**: 3 plans

Plans:
- [x] 14-01-PLAN.md — Backend diff computation (extend audit-log/{log_id}/sellers to return added/removed)
- [x] 14-02-PLAN.md — History Entry modal (refactor LogDetailModal with Changes panel and inline diff)
- [x] 14-03-PLAN.md — Cleanup (delete DiffModal, HierarchicalRunModal, /diff endpoint, /breakdown endpoint)

**Details:**
- Unified History Entry modal for all entry types
- Inline diff with green (+) for added, red (-) for removed
- Deleted DiffModal, HierarchicalRunModal, /diff endpoint, /breakdown endpoint

---

## Milestone Summary

**Key Decisions:**
- Use Oxylabs E-Commerce Scraper API for both Amazon and eBay ($49/month Micro plan)
- 5 workers (MAX_WORKERS=5) for optimal concurrency
- SSE for real-time activity streaming
- Client-side metrics aggregation (no additional backend endpoints)
- Audit log replay for seller snapshot reconstruction
- Static JSON file for Amazon categories (not database)
- Unified History Entry modal for all entry types

**Issues Resolved:**
- Progress bar polling delay (reduced to 500ms)
- Seller snapshot counts in history (now stored after run completion)
- Selection UX issues (Shift+click, drag-to-select, deselect on empty)
- Clutter in progress modal (simplified to 2-panel layout)
- Compare mode complexity (removed in favor of inline diff)

**Issues Deferred:**
- None

**Technical Debt Incurred:**
- None

---

*For current project status, see .planning/ROADMAP.md*
