# DS-ProSolution

## What This Is

An in-house eBay automation and competitive intelligence platform — the "Bloomberg of eBay" for agency operations. The platform tracks orders, manages bookkeeping, coordinates VAs, provides client dashboards, and discovers dropshippers at scale. It supports three user types (Admin, VA, Client) with role-based access control, a Chrome extension for VA workflows, an automated seller collection pipeline, a scalable storage/rendering infrastructure handling millions of records, and a polished design system with 4 CSS-first themes, command palette, and keyboard shortcuts.

**Vision:** Build the definitive competitive intelligence tool for eBay arbitrage — starting with dropshipper discovery (20K+ sellers), expanding to listing-level analytics (75-100M listings), and eventually surfacing real-time profit opportunities across the marketplace.

## Core Value

Automate repetitive eBay operations — from VA task coordination to dropshipper discovery to competitive research — so the business can scale without proportional headcount growth.

## Current State

**Shipped:** v4 UI/Design System (2026-01-27), v3 Storage & Rendering (2026-01-25), v2 SellerCollection (2026-01-23), v1 Extension Auth & RBAC (2026-01-20)
**Planning:** v5 Collection Polish + App-Wide Cache
**Tech Stack:** Next.js 14+, FastAPI, Supabase (PostgreSQL + RLS), Chrome Extension MV3, Dexie.js (IndexedDB), TanStack Query, next-themes, cmdk, react-hotkeys-hook, react-window v2
**Codebase:** ~130,000+ lines across 530+ files

## Scale Numbers

| Metric | Current | Near-Term Target | Future Target |
|--------|---------|-----------------|---------------|
| Sellers | ~740 | 20,000 | 20,000+ |
| Listings | 0 (not yet scraped) | 100M (5K avg × 20K sellers) | 75-100M |
| Bookkeeping Records | ~2,000 | 50,000 | 500,000+ |
| Accounts | ~50 | 200 | 500+ |
| Daily Collection Runs | Manual | Scheduled (monthly) | Daily incremental |

## Dataset Inventory

### V3 Tier: Full Sync (IndexedDB + Sync Engine + Mutations)

| Dataset | Table | Records | Storage | Pattern |
|---------|-------|---------|---------|---------|
| Bookkeeping Records | bookkeeping_records | ~2,000 | IndexedDB | Cache-first, offline mutations, conflict resolution |
| Sellers | sellers | ~740 | IndexedDB | Cache-first via useSyncSellers (Phase 28) |
| Collection Runs | collection_runs | ~100 | IndexedDB | Cache-first via useSyncRunHistory (Phase 28) |

### Partial V3: Infrastructure Exists, UI Bypasses

| Dataset | Table | Records | Issue |
|---------|-------|---------|-------|
| Accounts | accounts | ~50 | `db.accounts` + `syncAccounts()` exist but UI uses direct TanStack Query. 90% done — V5 Phase 29 completes wiring. |

### Legacy: Direct API Fetch (No Persistent Cache)

| Dataset | Page | Records | UX Impact |
|---------|------|---------|-----------|
| Users | `/admin/users` | ~20 | "Loading..." on every visit |
| Department Roles | `/admin/department-roles` | ~10 | TableSkeleton but re-fetches |
| Invites | `/admin/invites` | ~5 | "Loading..." on every visit |
| Dashboard Counts | `/admin` | Aggregate | DashboardSkeleton but re-fetches |
| Automation Settings | `/admin/automation` | N/A | Collection-specific, not a dataset |
| Amazon Category Presets | In-memory | ~200 | Static JSON, already fast |
| Collection Items | Server-only | Variable | Per-run transient data |
| Seller Audit Log | Server-only | ~5,000 | History queries, not cached |
| Collection Schedules | Server-only | ~5 | Rarely accessed |

### Future: Not Yet Built

| Dataset | Est. Records | Architecture Needed |
|---------|-------------|-------------------|
| Listings | 75-100M | Server-side pagination + virtualized rendering. NOT full IndexedDB sync — cache current view window only |
| Product Analysis | Derived | Materialized views or background aggregation |
| Market Metrics | Derived | Daily/weekly roll-ups, server-side computation |

### Key Insight: Cache-First is the Differentiator

The speed difference between V3 pages and legacy pages isn't about dataset size — it's the **cache-first pattern**:
- V3 pages: IndexedDB read (<5ms) → show data instantly → sync in background
- Legacy pages: Show "Loading..." text → wait for network (100-500ms+) → render

Even 2 accounts loaded via API is slower than 740 records loaded from IndexedDB. The fix isn't full V3 for every dataset — it's **persistent caching** for every dataset (V3 Lite in v5).

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

**Pre-existing (inferred from codebase):**
- ✓ User authentication via Supabase (login, session, role-based routing)
- ✓ Admin dashboard with user management, account management, VA assignment
- ✓ VA dashboard with order tracking and bookkeeping records
- ✓ Client dashboard with metrics/summary views
- ✓ Chrome extension with pairing flow (request → admin approval → install token)
- ✓ Automation agents (eBay creates jobs, Amazon claims/completes jobs)
- ✓ Department roles/access profiles with granular permissions for VAs
- ✓ Field-level permissions on bookkeeping records
- ✓ Audit logging for admin mutations

**v1 Extension Auth & RBAC (shipped 2026-01-20):**
- ✓ Access code system: immutable 4-char prefix + rotatable 12-char secret, Argon2id hashing
- ✓ Access code UI: masked display, hold-to-reveal, copy, rotate, custom secret with validation
- ✓ Profile Settings modal with sidebar tabs pattern (Profile, Security, Extension tabs)
- ✓ Security tab with access code UI for Admin/VA only (Clients excluded)
- ✓ Extension auth flow: require access code after pairing approval, JWT storage
- ✓ Extension RBAC: load roles/permissions, render tabs per assigned role
- ✓ Admin extension bypass: see all tabs without RBAC filtering
- ✓ Permission `accounts.view`: view-only account list for VAs, VA-assignment column hidden
- ✓ Permission `auto_order.read`: controls Auto Order tab visibility in extension
- ✓ Account presence/occupancy: real-time indicators, Admin sees VA name, VAs see "Occupied"
- ✓ Extension inactivity timeout: 1-hour with 5-minute warning, session recovery on restart
- ✓ Permission re-check: periodic alarm detects role changes, forces re-auth

**v2 SellerCollection (shipped 2026-01-23):**
- ✓ Amazon Best Sellers scraping via Oxylabs E-Commerce API
- ✓ Category selection UI with department hierarchy, search, and custom presets
- ✓ eBay search with dropshipper filters (Brand New, free shipping, 80-120% markup, US sellers)
- ✓ Seller deduplication and persistent storage in Supabase
- ✓ 5-worker parallel collection with real-time SSE activity streaming
- ✓ Worker status dashboard with per-worker cards and metrics aggregation
- ✓ Seller management UI with bulk selection, drag-to-select, hover cards
- ✓ Undo/redo for deletions with keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
- ✓ Export: JSON, CSV, copy to clipboard with full metadata
- ✓ Scheduled monthly collection with cron configuration
- ✓ Unified history timeline with inline diff (added/removed sellers)

**v3 Storage & Rendering Infrastructure (shipped 2026-01-25):**
- ✓ Server storage: Composite cursor indexes, soft deletes, 30-day pg_cron purge
- ✓ Transport: Cursor-based paginated /sync endpoints with incremental sync
- ✓ Client caching: TanStack Query with stale-while-revalidate and optimistic mutations
- ✓ Client storage: IndexedDB via Dexie.js with sync engine and cache-first loading
- ✓ Sync UX: Status indicator, offline mutation queue, conflict resolution, row-level badges
- ✓ Rendering: Virtual scrolling, infinite scroll, keyboard navigation, quick filter chips
- ✓ Export: Streaming CSV/JSON/Excel with column selection, background jobs for >10K rows
- ✓ Import: Validation preview, column mapping, 24-hour rollback

**v4 UI/Design System (shipped 2026-01-27):**
- ✓ CSS variable token system with 4 themes (Midnight, Dawn, Slate, Carbon) via oklch
- ✓ Zero-rerender theme switching via data-theme attribute + next-themes
- ✓ Unified AppSidebar, BreadcrumbNav, PageHeader layout primitives
- ✓ 75 component files migrated to semantic tokens (836 token usages)
- ✓ CSS shimmer skeletons, 4 contextual empty states with inline SVG
- ✓ Command palette (Cmd+K), vim-style navigation, keyboard shortcuts registry
- ✓ 3 collapsible sidebar section groups with role-based visibility
- ✓ Collection SellersGrid wired to V3 sync (IndexedDB + mutation hooks)

### Active

<!-- Current scope. Building toward these. -->

**v5 Collection Polish + App-Wide Cache (in progress):**
- [ ] `useCachedQuery()` — persistent IndexedDB cache for any TanStack Query dataset
- [ ] All legacy pages load instantly from cache on revisit
- [ ] Accounts V3 completion (wire existing db.accounts + syncAccounts to UI)
- [ ] Collection history system (export/flag events recorded, history viewer)
- [ ] History-based rollback (point-in-time restoration, replaces undo toasts)
- [ ] Collection keyboard shortcuts (mirror bookkeeping patterns)

### Planned

<!-- Rough-scoped for future milestones. Not yet detailed. -->

**v6 Competitor Research:**
- [ ] Listing scraping pipeline (5K avg listings/seller × 20K sellers)
- [ ] Listings storage schema with proper indexes
- [ ] Analytics engine (seller ranking, product profitability, margin analysis, trend detection)
- [ ] Competitor research UI (browse listings, compare sellers, view analytics)
- [ ] Server-side pagination for listings (NOT full IndexedDB sync — cache current view only)

**v7 Scale Infrastructure (when real data exists):**
- [ ] Materialized views for common analytics queries
- [ ] Background aggregation jobs (daily seller rankings, category trends)
- [ ] Dedicated analytics DB if Supabase can't handle load
- [ ] V3.5 hybrid caching (hot data in IndexedDB, cold data server-side)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

**Deferred from v3:**
- PAGI-08: Filter presets with backend persistence — future quality-of-life feature
- PDF export — future addition to export formats

**Deferred from v4:**
- THEME-CUSTOM-01/02: User-customizable accent colors
- DENSE-01/02: Data-dense dashboard layout option

**Future milestone candidates (deferred from v2):**
- Seller filtering/quality pipeline (reverse image search, hero image detection, win rate analysis)
- Multi-marketplace support (UK, DE, etc.)
- Pause/resume for long-running collections
- Seller metadata capture (feedback score, item count)

**Permanent boundaries:**
- Listing automation (copying dropshipper listings to your accounts) — separate project
- Real-time monitoring of Amazon/eBay changes — brute force monthly is sufficient
- Building custom scrapers/proxies — buy from Oxylabs, don't build
- Authenticated scraping — all data is public, no account risk
- Mobile app or responsive redesign — desktop-first for VA workflow
- New user types or auth methods — existing Admin/VA/Client model is sufficient

## Context

**Technical Environment:**
- Monorepo: `apps/web` (Next.js 14+), `apps/api` (FastAPI), `packages/extension` (Chrome MV3)
- Supabase for auth, database (PostgreSQL + RLS), and real-time
- Oxylabs E-Commerce Scraper API ($49/month Micro plan) for Amazon and eBay
- TanStack Query for server state management with cache invalidation
- Dexie.js for IndexedDB client-side persistence
- react-window v2 for virtualized rendering
- next-themes for zero-rerender theme switching (4 themes + system)
- cmdk + react-hotkeys-hook for command palette and keyboard shortcuts
- CSS-first theming via oklch color space and data-theme attribute

**Storage Architecture:**
- Cursor-based pagination with composite indexes (scope_id, updated_at DESC, id DESC)
- Soft deletes (deleted_at) with 30-day retention and pg_cron purge job
- IndexedDB mirrors server schema with sync checkpoints for incremental sync
- Cache-first pattern: load from IndexedDB instantly, background sync from server
- V3 Lite (v5): Persistent IndexedDB cache wrapping TanStack Query for legacy datasets

**User Types (source of truth = codebase):**
- Admin: Superuser, bypasses RBAC, full access to web app and extension
- VA: RBAC applies, access controlled by assigned roles/permissions
- Client: Read-only dashboard, no RBAC, no extension access or access codes

**Access Control:**
- SellerCollection is Admin-only (data sourcing tool, not VA workflow)
- Extension auth via access codes (4-char prefix + 12-char secret)

## Constraints

- **Tech stack**: Next.js 14+ / FastAPI / Supabase — no new frameworks
- **Scraping**: Use Oxylabs E-Commerce API — don't build scrapers
- **Cost/Work ratio**: Prefer simple brute-force over complex monitoring systems
- **Public data only**: No authenticated scraping, no account risk
- **UI patterns**: Build on shadcn/ui with custom theming layer
- **Performance-neutral minimum**: UI changes must not add compute cost
- **CSS-first theming**: Use CSS variables, avoid runtime JS for theme application
- **Admin-only**: SellerCollection UI is for Admins only (not VAs or Clients)
- **Scale**: Architecture supports millions of records with fast read/write
- **Browser limits**: ~1-2GB max per tab, IndexedDB ~50% of storage quota
- **Supabase limits**: Connection pooling, row limits on tiers to consider
- **Feature-first, infrastructure-when-needed**: Don't build for 100GB until you have it

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Access code = 4-char prefix + 12-char secret | Prefix enables O(1) lookup, secret hashed with Argon2id for security | ✓ Good — v1 |
| One extension tab per role | Simplifies RBAC mapping; role name = tab name | ✓ Good — v1 |
| Presence shows "Occupied" for VAs | Privacy/simplicity; VAs don't need to know who | ✓ Good — v1 |
| 15-minute JWT expiry for extension | Balance between security and UX | ✓ Good — v1 |
| 1-hour inactivity timeout with 5-min warning | Protects account access while allowing reasonable work sessions | ✓ Good — v1 |
| Oxylabs for both Amazon and eBay | Single vendor, $49/month Micro plan | ✓ Good — v2 |
| 5 parallel workers (MAX_WORKERS=5) | Optimal concurrency for Oxylabs rate limits | ✓ Good — v2 |
| SSE for activity streaming | Simpler than WebSockets, browser-native EventSource | ✓ Good — v2 |
| Audit log replay for snapshots | No separate snapshot tables, simple and accurate | ✓ Good — v2 |
| URL-safe base64 cursors | Short cursors for query parameters, URL-safe characters | ✓ Good — v3 |
| 30s staleTime for records, 5min for accounts | Records change frequently, accounts rarely | ✓ Good — v3 |
| SCHEMA_VERSION triggers full resync | Simpler than migration handlers | ✓ Good — v3 |
| 10K row threshold for background exports | Streaming for smaller, background jobs for larger | ✓ Good — v3 |
| CSS variables + data-theme attribute | Zero-rerender theme switching | ✓ Good — v4 |
| oklch color space for theme tokens | Modern, perceptually uniform, wide gamut | ✓ Good — v4 |
| next-themes (~2KB) for ThemeProvider | Handles SSR + flash prevention + localStorage | ✓ Good — v4 |
| cmdk + react-hotkeys-hook for shortcuts | Lightweight, well-maintained, lazy-loadable | ✓ Good — v4 |
| V3 Lite over full V3 for legacy datasets | Persistent cache is sufficient; no sync endpoints needed for low-churn admin data | Planned — v5 |
| Listings stay server-side (not IndexedDB) | 75-100M records can't fit in browser storage | Planned — v6 |

## Milestone Roadmap

| Milestone | Goal | Status | Phases |
|-----------|------|--------|--------|
| v1 | Extension Auth & RBAC | SHIPPED 2026-01-20 | 1-5 |
| v2 | SellerCollection | SHIPPED 2026-01-23 | 6-14 |
| v3 | Storage & Rendering Infrastructure | SHIPPED 2026-01-25 | 15-21 |
| v4 | UI/Design System | SHIPPED 2026-01-27 | 22-28.1 |
| **v5** | **Collection Polish + App-Wide Cache** | **Planning** | 29-33 |
| v6 | Competitor Research | Planned | TBD |
| v7 | Scale Infrastructure | Planned (when real data exists) | TBD |

## Current Milestone: v5 Collection Polish + App-Wide Cache

**Goal:** Make the entire app feel instant-loading with persistent caching, polish the collection workflow with history and keyboard shortcuts.

**Key Phases:**
- Phase 29: App-Wide Persistent Cache (V3 Lite) — `useCachedQuery()` for all legacy pages
- Phase 30: Consistent Skeletons & Empty States — wire existing components to all pages
- Phase 31: Collection History System — record export/flag events, history viewer
- Phase 32: History-Based Rollback — point-in-time restoration from history
- Phase 33: Collection Keyboard Shortcuts — mirror bookkeeping patterns

**Success criteria:**
- Every page loads instantly on revisit (from IndexedDB cache)
- No "Loading..." text anywhere in the app — all skeleton placeholders
- Collection history records all actions with browsable UI
- Users can rollback any collection operation from history
- Collection page has full keyboard shortcut support

---
*Last updated: 2026-01-27 after v4 UI/Design System milestone archived*
