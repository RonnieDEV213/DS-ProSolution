# DS-ProSolution

## What This Is

An in-house eBay automation account management platform for agency operations — tracking orders, managing bookkeeping, coordinating VAs, providing client dashboards, and discovering dropshippers at scale. The platform supports three user types (Admin, VA, Client) with role-based access control, a Chrome extension for VA workflows, an automated seller collection pipeline, and a scalable storage/rendering infrastructure handling millions of records.

## Core Value

Automate repetitive eBay operations — from VA task coordination to dropshipper discovery — so the business can scale without proportional headcount growth.

## Current State

**Shipped:** v3 Storage & Rendering (2026-01-25), v2 SellerCollection (2026-01-23), v1 Extension Auth & RBAC (2026-01-20)
**Tech Stack:** Next.js 14+, FastAPI, Supabase, Chrome Extension MV3, Dexie.js (IndexedDB), TanStack Query
**Codebase:** ~80,000 lines across 484 files (v1: +16,544, v2: +38,240, v3: +25,371)

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
- ✓ Amazon Best Sellers scraping via Oxylabs E-Commerce API — v2
- ✓ Category selection UI with department hierarchy, search, and custom presets — v2
- ✓ eBay search with dropshipper filters (Brand New, free shipping, 80-120% markup, US sellers) — v2
- ✓ Seller deduplication and persistent storage in Supabase — v2
- ✓ 5-worker parallel collection with real-time SSE activity streaming — v2
- ✓ Worker status dashboard with per-worker cards and metrics aggregation — v2
- ✓ Seller management UI with bulk selection, drag-to-select, hover cards — v2
- ✓ Undo/redo for deletions with keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z) — v2
- ✓ Export: JSON, CSV, copy to clipboard with full metadata — v2
- ✓ Scheduled monthly collection with cron configuration — v2
- ✓ Unified history timeline with inline diff (added/removed sellers) — v2

**v3 Storage & Rendering Infrastructure (shipped 2026-01-25):**
- ✓ Server storage: Composite cursor indexes, soft deletes, 30-day pg_cron purge — v3
- ✓ Transport: Cursor-based paginated /sync/records, /sync/accounts, /sync/sellers APIs — v3
- ✓ Transport: Incremental sync via updated_since parameter — v3
- ✓ Client caching: TanStack Query with stale-while-revalidate and optimistic mutations — v3
- ✓ Client storage: IndexedDB via Dexie.js with sync engine and cache-first loading — v3
- ✓ Sync UX: Status indicator, "last synced X ago", exponential retry, error display — v3
- ✓ Sync UX: Optimistic updates with rollback, conflict resolution modal — v3
- ✓ Sync UX: Offline mutation queue, row-level sync badges — v3
- ✓ Rendering: Virtual scrolling with constant DOM elements (~50 rows) — v3
- ✓ Rendering: Infinite scroll integration, keyboard navigation (j/k/Enter) — v3
- ✓ Rendering: Quick filter chips, row count summary, loading skeleton rows — v3
- ✓ Export: Streaming CSV/JSON/Excel with column selection and progress indicator — v3
- ✓ Export: Background jobs for large exports (>10K rows) with notifications — v3
- ✓ Import: Validation preview, column mapping, 24-hour rollback capability — v3

### Active

<!-- Current scope. Building toward these. -->

None — ready for next milestone definition.

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

**Deferred from v3:**
- PAGI-08: Filter presets with backend persistence — future quality-of-life feature
- PDF export — future addition to export formats

**Future milestone candidates (deferred from v2):**
- Seller filtering/quality pipeline (reverse image search, hero image detection, win rate analysis) — candidate for v2.1
- Multi-marketplace support (UK, DE, etc.) — candidate for v2.1
- Pause/resume for long-running collections — candidate for v2.1
- Seller metadata capture (feedback score, item count) — candidate for v2.1

**Permanent boundaries:**
- Listing automation (copying dropshipper listings to your accounts) — separate project
- Real-time monitoring of Amazon/eBay changes — brute force monthly is sufficient given work/cost ratio
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

**v3 Storage Architecture:**
- Cursor-based pagination with composite indexes (scope_id, updated_at DESC, id DESC)
- Soft deletes (deleted_at) with 30-day retention and pg_cron purge job
- IndexedDB mirrors server schema with sync checkpoints for incremental sync
- Cache-first pattern: load from IndexedDB instantly, background sync from server

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
- **UI patterns**: Use existing shadcn/ui components
- **Admin-only**: SellerCollection UI is for Admins only (not VAs or Clients)
- **Scale**: Architecture supports millions of records with fast read/write
- **Browser limits**: ~1-2GB max per tab, IndexedDB ~50% of storage quota
- **Supabase limits**: Connection pooling, row limits on tiers to consider

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Access code = 4-char prefix + 12-char secret | Prefix enables O(1) lookup, secret hashed with Argon2id for security | ✓ Good — v1 |
| One extension tab per role | Simplifies RBAC mapping; role name = tab name; VAs see tabs for their assigned roles | ✓ Good — v1 |
| Presence shows "Occupied" for VAs | Privacy/simplicity; VAs don't need to know who, just that account is in use | ✓ Good — v1 |
| Clients see extension download but no access code | Allows clients to install extension (future use?) but blocks auth today | ✓ Good — v1 |
| 15-minute JWT expiry for extension | Balance between security (short-lived tokens) and UX (not too frequent re-auth) | ✓ Good — v1 |
| 1-hour inactivity timeout with 5-min warning | Protects account access while allowing reasonable work sessions | ✓ Good — v1 |
| Service layer pattern for API | Business logic in services/, routes in routers/ — clean separation | ✓ Good — v1 |
| Upsert for presence with user/org constraint | Atomic presence swap ensures VA can only be on one account at a time | ✓ Good — v1 |
| Oxylabs for both Amazon and eBay | Single vendor simplifies billing, $49/month Micro plan is cost-effective | ✓ Good — v2 |
| 5 parallel workers (MAX_WORKERS=5) | Optimal concurrency for Oxylabs Micro plan rate limits | ✓ Good — v2 |
| SSE for activity streaming | Simpler than WebSockets, works with existing auth, browser-native EventSource | ✓ Good — v2 |
| Audit log replay for snapshots | No separate snapshot tables needed, simple and accurate | ✓ Good — v2 |
| Static JSON for Amazon categories | Rarely changes, no DB overhead, easier to update | ✓ Good — v2 |
| Client-side metrics aggregation | Reduces backend complexity, real-time updates via SSE | ✓ Good — v2 |
| Unified History Entry modal | Single modal for runs and edits, simpler UX | ✓ Good — v2 |
| Delete vs deprecate for unused code | Cleaner codebase, no confusion from deprecated stubs | ✓ Good — v2 |
| URL-safe base64 cursors with short JSON keys | Short cursors for query parameters, URL-safe characters | ✓ Good — v3 |
| 30s staleTime for records, 5min for accounts | Records change frequently, accounts rarely | ✓ Good — v3 |
| SCHEMA_VERSION triggers full resync | Simpler than migration handlers | ✓ Good — v3 |
| useSyncExternalStore for online/offline | Proper cleanup, SSR-safe browser event subscription | ✓ Good — v3 |
| Temp ID format temp-{uuid} for optimistic creates | Easy identification of uncommitted records | ✓ Good — v3 |
| 10K row threshold for background exports | Streaming for smaller exports, background jobs for larger | ✓ Good — v3 |
| 24-hour rollback window for imports | Per requirements, enforced in code and DB function | ✓ Good — v3 |

---
*Last updated: 2026-01-25 after v3 Storage & Rendering Infrastructure milestone*
