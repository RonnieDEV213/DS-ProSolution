# Requirements Archive: v5 Collection Polish + App-Wide Cache

**Archived:** 2026-01-28
**Status:** ✅ SHIPPED

This is the archived requirements specification for v5.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: DS-ProSolution v5 Collection Polish + App-Wide Cache

**Defined:** 2026-01-27
**Core Value:** Make the entire app feel instant-loading with persistent caching, polish the collection workflow with history and keyboard shortcuts, and complete the Accounts V3 migration.

## v5 Requirements

### App-Wide Persistent Cache (V3 Lite)

- [x] **CACHE-01**: `useCachedQuery()` hook wraps TanStack Query with IndexedDB persistence — any dataset can opt in with zero backend changes
- [x] **CACHE-02**: `/admin/users` page loads instantly from persistent cache on revisit (skeleton on first load)
- [x] **CACHE-03**: `/admin/department-roles` page loads instantly from persistent cache on revisit
- [x] **CACHE-04**: `/admin/invites` page loads instantly from persistent cache on revisit (skeleton on first load)
- [x] **CACHE-05**: `/va/accounts` page reads from `db.accounts` + `syncAccounts()` (complete existing 90% V3 wiring)
- [x] **CACHE-06**: `/admin` dashboard counts load from persistent cache for faster display
- [x] **CACHE-07**: First-ever page load shows skeleton placeholder, subsequent loads show cached data instantly with background refresh

### Consistent Skeletons & Empty States

- [x] **SKEL-01**: All 5 legacy admin pages (`/admin`, `/admin/users`, `/admin/department-roles`, `/admin/invites`, `/va/accounts`) use skeleton loading states instead of "Loading..." text
- [x] **SKEL-02**: SVG empty state illustrations standardized across collection, bookkeeping, and admin pages
- [x] **SKEL-03**: Every data-loading page shows skeleton -> data transition (never blank -> data or "Loading..." -> data)

### Collection History System

- [x] **HIST-01**: Export events are recorded in the collection history/activity system
- [x] **HIST-02**: Flag events (flag/unflag sellers) are recorded in the collection history system
- [x] **HIST-03**: History viewer UI enables browsing and filtering historical collection actions

### History-Based Rollback — DROPPED

- [~] **ROLL-01**: ~~Users can select a historical state and restore sellers to that point-in-time~~ — Phase 32 dropped; undo toast sufficient
- [~] **ROLL-02**: ~~Rollback from history replaces undo toasts — more robust and scales to any operation~~ — Phase 32 dropped

### Collection Keyboard Shortcuts

- [x] **KEYS-01**: Collection page has keyboard shortcuts mirroring bookkeeping patterns (selection, navigation, actions)
- [x] **KEYS-02**: Collection keyboard shortcuts integrated with existing command palette (Cmd+K)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CACHE-01 | Phase 29 | Complete |
| CACHE-02 | Phase 29 | Complete |
| CACHE-03 | Phase 29 | Complete |
| CACHE-04 | Phase 29 | Complete |
| CACHE-05 | Phase 29 | Complete |
| CACHE-06 | Phase 29 | Complete |
| CACHE-07 | Phase 29 | Complete |
| SKEL-01 | Phase 30 | Complete |
| SKEL-02 | Phase 30 | Complete |
| SKEL-03 | Phase 30 | Complete |
| HIST-01 | Phase 31 | Complete |
| HIST-02 | Phase 31 | Complete |
| HIST-03 | Phase 31 | Complete |
| ROLL-01 | Phase 32 | Dropped |
| ROLL-02 | Phase 32 | Dropped |
| KEYS-01 | Phase 33 | Complete |
| KEYS-02 | Phase 33 | Complete |

**Coverage:**
- v5 requirements: 17 total
- Shipped: 15
- Dropped: 2 (ROLL-01, ROLL-02 — Phase 32 removed from milestone)

---

## Milestone Summary

**Shipped:** 15 of 17 v5 requirements
**Adjusted:** None — all shipped requirements matched original specification
**Dropped:** ROLL-01, ROLL-02 (History-Based Rollback) — Phase 32 removed from milestone scope; existing undo toast for seller delete is sufficient

---
*Archived: 2026-01-28 as part of v5 milestone completion*
