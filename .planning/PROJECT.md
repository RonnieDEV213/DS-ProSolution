# DS-ProSolution

## What This Is

An in-house eBay automation account management platform for agency operations — tracking orders, managing bookkeeping, coordinating VAs, and providing client dashboards. Currently in "semi-automation" phase where VAs use a Chrome extension to assist with tasks while monitoring stats. The platform supports three user types (Admin, VA, Client) with role-based access control for VAs.

## Core Value

Automate the discovery and collection of Amazon-to-eBay dropshippers at scale — enabling data-driven product sourcing decisions.

## Current Milestone: v2 SellerCollection

**Goal:** Automatically find eBay sellers who dropship from Amazon by cross-referencing Amazon Best Sellers with eBay search results.

**Target features:**
- Scrape Amazon Best Sellers (all departments/categories) via third-party API
- Search each product on eBay with dropshipper filters (Brand New, free shipping, 80-120% of Amazon price)
- Collect and deduplicate seller names against existing database
- Store sellers in Supabase with collection metadata
- Admin UI: "Collect Sellers" button, progress display, seller list view
- Export functionality: JSON, CSV, copy to clipboard
- Optional scheduled collection (monthly recurring)

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

### Active

<!-- Current scope. Building toward these. -->

**v2 SellerCollection:**
- [ ] Amazon Best Sellers scraping via third-party API (Rainforest or similar)
- [ ] eBay search via third-party API (ScraperAPI or similar)
- [ ] Seller deduplication and persistent storage in Supabase
- [ ] Collection orchestration with progress tracking
- [ ] Admin UI: trigger collection, view sellers, track status
- [ ] Export: JSON, CSV, copy to clipboard

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

**v2 boundaries:**
- Seller filtering/quality pipeline (reverse image search, hero image detection, win rate analysis) — future milestone after collection is working
- Listing automation (copying dropshipper listings to your accounts) — separate project
- Real-time monitoring of Amazon/eBay changes — brute force monthly is sufficient given work/cost ratio
- Amazon price change tracking — not needed for seller discovery
- Authenticated scraping — all data is public, use third-party APIs only
- Building custom scrapers/proxies — buy from Rainforest/ScraperAPI, don't build

**General boundaries (carried from v1):**
- Mobile app or responsive redesign — desktop-first for VA workflow
- New user types or auth methods — existing Admin/VA/Client model is sufficient

## Context

**Technical Environment:**
- Monorepo: `apps/web` (Next.js 14+), `apps/api` (FastAPI), `packages/extension` (Chrome MV3)
- Supabase for auth, database (PostgreSQL + RLS), and real-time
- RBAC already implemented for VAs via department roles/access profiles

**v2 Architecture (from research docs):**
- Third-party APIs handle scraping (Rainforest for Amazon, ScraperAPI for eBay)
- All data is public — no authentication required, no account risk
- FastAPI backend orchestrates collection flow and stores results
- Next.js frontend provides Admin UI for triggering and viewing results
- No proxy management needed — third-party services handle it

**Data Flow:**
```
Amazon Best Sellers (Rainforest API)
    → Product titles + prices
    → eBay search (ScraperAPI) with filters
    → Seller names from results
    → Dedup against Supabase
    → Store new sellers
```

**User Types (source of truth = codebase):**
- Admin: Superuser, bypasses RBAC, full access to web app and extension
- VA: RBAC applies, access controlled by assigned roles/permissions
- Client: Read-only dashboard, no RBAC, no extension access or access codes

**v2 Access:** SellerCollection is Admin-only (data sourcing tool, not VA workflow)

## Constraints

- **Tech stack**: Next.js 14+ / FastAPI / Supabase — no new frameworks
- **Scraping**: Use third-party APIs (Rainforest, ScraperAPI) — don't build scrapers
- **Cost/Work ratio**: Prefer simple brute-force over complex monitoring systems
- **Public data only**: No authenticated scraping, no account risk
- **UI patterns**: Use existing shadcn/ui components
- **Admin-only**: SellerCollection UI is for Admins only (not VAs or Clients)

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

## Current State

**Active:** v2 SellerCollection (started 2026-01-20)
**Shipped:** v1 Extension Auth & RBAC (2026-01-20)
**Tech Stack:** Next.js 14+, FastAPI, Supabase, Chrome Extension MV3
**Codebase:** ~16,500 lines added in v1 milestone across 74 files

---
*Last updated: 2026-01-20 after starting v2 SellerCollection milestone*
