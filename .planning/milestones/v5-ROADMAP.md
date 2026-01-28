# Milestone v5: Collection Polish + App-Wide Cache

**Status:** In Progress
**Phases:** 29-33
**Total Plans:** TBD

## Overview

v5 makes the entire application feel instant-loading by introducing a persistent cache layer for all legacy pages, completes the Accounts V3 migration, and polishes the collection workflow with a full history system, rollback capability, and keyboard shortcuts. The key insight: the speed difference between V3 pages (instant from IndexedDB) and legacy pages (network-dependent) isn't about dataset size — it's the cache-first pattern. V3 Lite brings that pattern to every page without requiring new sync endpoints.

## Critical Constraints

- **No new sync endpoints for legacy datasets** — `useCachedQuery()` wraps TanStack Query with IndexedDB persistence, reusing existing REST APIs
- **TanStack Query still manages freshness** — IndexedDB is a persistent cache layer, not a replacement for stale-while-revalidate
- **Skeleton-first loading** — every page shows skeletons, never "Loading..." text or blank screens
- **Collection history is append-only** — events are recorded, never modified; rollback creates new events
- **Keyboard shortcuts must not conflict** — collection shortcuts integrate with existing command palette and vim-style navigation

## Phases

- [x] **Phase 29: App-Wide Persistent Cache (V3 Lite)** — `useCachedQuery()` hook, wire to 5 legacy pages, complete Accounts V3
- [x] **Phase 30: Consistent Skeletons & Empty States** — Wire skeletons to all legacy pages, standardize empty states
- [ ] **Phase 31: Collection History System** — Record export/flag events, build history viewer UI
- [ ] **Phase 32: History-Based Rollback** — Point-in-time restoration from history, replace undo toasts
- [ ] **Phase 33: Collection Keyboard Shortcuts** — Mirror bookkeeping shortcuts, integrate with command palette

## Phase Details

### Phase 29: App-Wide Persistent Cache (V3 Lite)

**Goal**: Every page in the app loads instantly from persistent cache on revisit, with background refresh ensuring freshness
**Depends on**: Phase 18 (v3 IndexedDB infrastructure — Dexie.js already installed)
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04, CACHE-05, CACHE-06, CACHE-07
**Success Criteria** (what must be TRUE):
  1. A `useCachedQuery()` hook exists that wraps TanStack Query with IndexedDB persistence — any component can opt in by passing a cache key
  2. `/admin/users`, `/admin/department-roles`, `/admin/invites` load from IndexedDB cache on revisit (not from network)
  3. `/va/accounts` reads from `db.accounts` via `useSyncAccounts()` hook (completing the existing 90% V3 wiring)
  4. `/admin` dashboard counts display from cache on revisit, with background refresh
  5. First-ever load shows skeleton, second load shows cached data instantly
**Plans**: 3 plans, 2 waves — COMPLETE

### Phase 30: Consistent Skeletons & Empty States

**Goal**: Every data-loading page uses skeleton placeholders during loading and contextual empty states when no data exists
**Depends on**: Phase 29 (skeletons must work with the new cache layer)
**Requirements**: SKEL-01, SKEL-02, SKEL-03
**Success Criteria** (what must be TRUE):
  1. All 5 legacy admin pages show skeleton loading states (using existing DashboardSkeleton, TableSkeleton, CardGridSkeleton components) instead of "Loading..." text
  2. SVG empty state illustrations (existing from Phase 26) are wired into collection and admin pages consistently
  3. No page in the application shows a "Loading..." text string — all use skeleton placeholders
**Plans**: 4 plans, 2 waves — COMPLETE
Plans:
- [x] 30-01-PLAN.md — Page-level & automation table skeleton loading states
- [x] 30-02-PLAN.md — Collection component skeleton loading states
- [x] 30-03-PLAN.md — Modal/dialog & import history skeleton loading states
- [x] 30-04-PLAN.md — Empty state illustration standardization

### Phase 31: Collection History System

**Goal**: All collection actions (exports, flag changes) are recorded in history, with a viewer UI for browsing
**Depends on**: Phase 14 (existing history/audit log infrastructure)
**Requirements**: HIST-01, HIST-02, HIST-03
**Success Criteria** (what must be TRUE):
  1. Exporting sellers (CSV/JSON/clipboard) creates a history entry with export metadata (format, count, filters)
  2. Flagging/unflagging sellers creates history entries with seller IDs and flag state
  3. History viewer UI allows browsing, filtering by event type, and viewing event details
**Plans**: 5 plans
Plans:
- [ ] 31-01-PLAN.md — Backend foundation: migration, service methods, API endpoints
- [ ] 31-02-PLAN.md — Export modal and export event recording
- [ ] 31-03-PLAN.md — Flag event recording and batch flag API
- [ ] 31-04-PLAN.md — History viewer: filtering, infinite scroll, day grouping
- [ ] 31-05-PLAN.md — Changes panel variants and clickable History header

### Phase 32: History-Based Rollback

**Goal**: Users can restore sellers to a historical point-in-time, replacing the undo toast pattern with a more robust mechanism
**Depends on**: Phase 31 (requires history events to be recorded)
**Requirements**: ROLL-01, ROLL-02
**Success Criteria** (what must be TRUE):
  1. User can select a historical state in the history viewer and restore sellers to that point (re-adding deleted sellers, removing added sellers)
  2. Rollback creates a new history event (append-only), not a mutation of existing history
  3. Undo toasts replaced by "Rollback" action in history, which works for any operation type
**Plans**: TBD

### Phase 33: Collection Keyboard Shortcuts

**Goal**: Collection page has keyboard shortcuts matching bookkeeping patterns for power-user workflows
**Depends on**: Phase 26 (existing keyboard shortcut infrastructure — cmdk, react-hotkeys-hook, SHORTCUTS registry)
**Requirements**: KEYS-01, KEYS-02
**Success Criteria** (what must be TRUE):
  1. Collection page supports keyboard shortcuts: selection (click, shift+click, Ctrl+A), navigation (j/k), actions (Delete, F=flag, E=export, S=start run)
  2. Collection shortcuts appear in the command palette (Cmd+K) and shortcuts reference (?)
  3. Shortcuts work only when on the collection page (no conflict with other pages)
**Plans**: TBD

---

## Coverage

| Requirement | Phase | Category |
|-------------|-------|----------|
| CACHE-01 | Phase 29 | Persistent Cache |
| CACHE-02 | Phase 29 | Persistent Cache |
| CACHE-03 | Phase 29 | Persistent Cache |
| CACHE-04 | Phase 29 | Persistent Cache |
| CACHE-05 | Phase 29 | Persistent Cache |
| CACHE-06 | Phase 29 | Persistent Cache |
| CACHE-07 | Phase 29 | Persistent Cache |
| SKEL-01 | Phase 30 | Skeletons |
| SKEL-02 | Phase 30 | Empty States |
| SKEL-03 | Phase 30 | Skeletons |
| HIST-01 | Phase 31 | History |
| HIST-02 | Phase 31 | History |
| HIST-03 | Phase 31 | History |
| ROLL-01 | Phase 32 | Rollback |
| ROLL-02 | Phase 32 | Rollback |
| KEYS-01 | Phase 33 | Shortcuts |
| KEYS-02 | Phase 33 | Shortcuts |

**Total: 17 requirements mapped to 5 phases. 0 orphaned.**

---
*Roadmap created: 2026-01-27*
*For current project status, see .planning/ROADMAP.md*
