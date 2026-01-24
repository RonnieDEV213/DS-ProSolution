# DS-ProSolution

## What This Is

An in-house eBay automation account management platform for agency operations — tracking orders, managing bookkeeping, coordinating VAs, providing client dashboards, and discovering dropshippers at scale. The platform supports three user types (Admin, VA, Client) with role-based access control, a Chrome extension for VA workflows, and an automated seller collection pipeline that cross-references Amazon Best Sellers with eBay to find dropshippers.

## Core Value

Automate repetitive eBay operations — from VA task coordination to dropshipper discovery — so the business can scale without proportional headcount growth.

## Current State

**Active:** v3 Storage & Rendering Infrastructure
**Shipped:** v2 SellerCollection (2026-01-23), v1 Extension Auth & RBAC (2026-01-20)
**Tech Stack:** Next.js 14+, FastAPI, Supabase, Chrome Extension MV3
**Codebase:** ~55,000 lines across 346 files (v1: +16,544, v2: +38,240)

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

### Active

<!-- Current scope. Building toward these. -->

**v3 Storage & Rendering Infrastructure:**
- [ ] Server storage: Pagination foundation (indexes, cursor support, query optimization)
- [ ] Transport: Cursor-based paginated APIs (convert full-fetch endpoints)
- [ ] Transport: Incremental sync protocol (fetch only changed records)
- [ ] Client storage: IndexedDB cache layer (schema, read/write operations)
- [ ] Client storage: Sync manager (track cached vs stale, background refresh)
- [ ] Rendering: Integration with pagination (virtualization + infinite scroll + cache)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

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

**v2 SellerCollection Architecture:**
- Oxylabs handles scraping for both Amazon Best Sellers and eBay search
- 5-worker parallel collection for optimal throughput
- SSE (Server-Sent Events) for real-time activity streaming
- Audit log replay for seller snapshot reconstruction
- All data is public — no authentication required, no account risk

**Data Flow:**
```
Amazon Best Sellers (Oxylabs)
    → Product titles + prices (5 workers)
    → eBay search (Oxylabs) with dropshipper filters (5 workers)
    → Seller names from results
    → Dedup against Supabase
    → Store new sellers + audit log
```

**User Types (source of truth = codebase):**
- Admin: Superuser, bypasses RBAC, full access to web app and extension
- VA: RBAC applies, access controlled by assigned roles/permissions
- Client: Read-only dashboard, no RBAC, no extension access or access codes

**Access Control:**
- SellerCollection is Admin-only (data sourcing tool, not VA workflow)
- Extension auth via access codes (4-char prefix + 12-char secret)

**v3 Scale Target:**
- Agency scale: hundreds of eBay accounts, each with 2-5 Amazon accounts
- Per account: orders, listings, metrics, messages, feedback, payouts, tracking
- Data volume: thousands of MB (GBs) across the platform
- Current bottlenecks:
  - Transport: Full-fetch pattern won't scale (fetches all records every request)
  - Client storage: Missing entirely (no IndexedDB cache, every navigation re-fetches)
  - Server storage: Basic indexes, no pagination support
  - Rendering: Virtualization exists but not connected to paginated fetch

## Constraints

- **Tech stack**: Next.js 14+ / FastAPI / Supabase — no new frameworks
- **Scraping**: Use Oxylabs E-Commerce API — don't build scrapers
- **Cost/Work ratio**: Prefer simple brute-force over complex monitoring systems
- **Public data only**: No authenticated scraping, no account risk
- **UI patterns**: Use existing shadcn/ui components
- **Admin-only**: SellerCollection UI is for Admins only (not VAs or Clients)
- **Scale**: Architecture must support millions of records with fast read/write
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

---
*Last updated: 2026-01-23 after starting v3 Storage & Rendering Infrastructure milestone*
