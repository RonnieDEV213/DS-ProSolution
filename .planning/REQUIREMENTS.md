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

- [ ] **HIST-01**: Export events are recorded in the collection history/activity system
- [ ] **HIST-02**: Flag events (flag/unflag sellers) are recorded in the collection history system
- [ ] **HIST-03**: History viewer UI enables browsing and filtering historical collection actions

### History-Based Rollback

- [ ] **ROLL-01**: Users can select a historical state and restore sellers to that point-in-time
- [ ] **ROLL-02**: Rollback from history replaces undo toasts — more robust and scales to any operation

### Collection Keyboard Shortcuts

- [ ] **KEYS-01**: Collection page has keyboard shortcuts mirroring bookkeeping patterns (selection, navigation, actions)
- [ ] **KEYS-02**: Collection keyboard shortcuts integrated with existing command palette (Cmd+K)

## Future Requirements

### Deferred from v4

- **THEME-CUSTOM-01**: User-customizable accent color picker
- **THEME-CUSTOM-02**: Runtime theme generation from user color input
- **LAYOUT-RESPONSIVE-01**: Responsive sidebar collapse for mobile/tablet
- **DENSE-01**: Data-dense dashboard layout option
- **DENSE-02**: Compact table mode with reduced padding/font

### Deferred from v3

- PAGI-08: Filter presets with backend persistence
- PDF export

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full V3 sync for all legacy datasets | V3 Lite (persistent cache) is sufficient — no sync endpoints needed for admin tables |
| Real-time sync indicators for admin pages | These are low-churn datasets; stale-while-revalidate is enough |
| Offline mutation queue for admin pages | Admin pages are read-mostly; mutations are rare and network-dependent |
| Competitor research / listing scraping | Deferred to v6 milestone |
| Scale infrastructure optimization | Deferred to v7 milestone |

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
| HIST-01 | Phase 31 | Pending |
| HIST-02 | Phase 31 | Pending |
| HIST-03 | Phase 31 | Pending |
| ROLL-01 | Phase 32 | Pending |
| ROLL-02 | Phase 32 | Pending |
| KEYS-01 | Phase 33 | Pending |
| KEYS-02 | Phase 33 | Pending |

**Coverage:**
- v5 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-01-27*
