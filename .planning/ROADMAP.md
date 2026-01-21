# Roadmap: DS-ProSolution v2 SellerCollection

## Overview

SellerCollection automates dropshipper discovery by cross-referencing Amazon Best Sellers with eBay search results. The pipeline fetches products from Amazon via third-party API, searches each on eBay with dropshipper filters (Brand New, free shipping, 80-120% price markup), extracts seller names, deduplicates against existing database, and exports results. Four phases deliver infrastructure, Amazon integration, eBay integration, and the output layer in sequence.

## Milestones

- **v1 Extension Auth & RBAC** - Phases 1-5 (shipped 2026-01-20)
- **v2 SellerCollection** - Phases 6-9 (in progress)

## Phases

- [x] **Phase 6: Collection Infrastructure** - Database schema, job framework, budget controls
- [x] **Phase 7: Amazon Best Sellers** - API integration and category selection UI
- [ ] **Phase 8: eBay Seller Search** - API integration with dropshipper filters
- [ ] **Phase 9: Storage, Export, and Collection UI** - Deduplication, export, progress tracking

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
- [ ] 08-01-PLAN.md — eBay scraper service (abstract interface, Oxylabs implementation, dropshipper filters)
- [ ] 08-02-PLAN.md — Collection integration (eBay search method, API endpoint, Amazon->eBay chaining)

### Phase 9: Storage, Export, and Collection UI

**Goal:** Admin can view, export, and manage collected sellers
**Depends on:** Phase 8
**Requirements:** STOR-01, STOR-02, STOR-03, STOR-04, STOR-05, COLL-02, COLL-03, COLL-04, COLL-05
**Success Criteria** (what must be TRUE):
  1. Sellers deduplicated against existing database (normalized comparison)
  2. Each seller stored with collection metadata (discovered_at, from_product)
  3. Admin can export sellers as JSON
  4. Admin can export sellers as CSV
  5. Admin can copy seller list to clipboard
  6. Progress indicator shows current product / total products during collection
  7. Admin can stop/cancel running collection
  8. Collection history shows past runs with timestamps
  9. Admin can configure scheduled monthly collection
**Plans:** TBD

Plans:
- [ ] 09-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Collection Infrastructure | v2 | 4/4 | Complete | 2026-01-20 |
| 7. Amazon Best Sellers | v2 | 5/5 | Complete | 2026-01-20 |
| 8. eBay Seller Search | v2 | 0/2 | Planned | - |
| 9. Storage, Export, and Collection UI | v2 | 0/TBD | Not started | - |

## Requirement Coverage

**v2 SellerCollection:** 22/23 requirements mapped (AMZN-04 omitted per user decision)

| Category | Requirements | Phase |
|----------|--------------|-------|
| Amazon Best Sellers | AMZN-01, AMZN-02, AMZN-03, AMZN-05 | Phase 7 |
| eBay Search | EBAY-01, EBAY-02, EBAY-03, EBAY-04, EBAY-05, EBAY-06 | Phase 8 |
| Collection Management | COLL-01, COLL-06, COLL-07 | Phase 6 |
| Collection Management | COLL-02, COLL-03, COLL-04, COLL-05 | Phase 9 |
| Storage & Export | STOR-01, STOR-02, STOR-03, STOR-04, STOR-05 | Phase 9 |
