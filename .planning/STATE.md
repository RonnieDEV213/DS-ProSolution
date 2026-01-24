# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Handle millions of records with fast read/write across server storage, transport, client storage, and rendering
**Current focus:** Phase 19 - Sync Protocol

## Current Position

Phase: 19 of 21 (Sync Protocol)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-01-24 — Completed 19-03-PLAN.md (Row-level Sync Badges)

Progress: [███████████] 69% (11/16 plans)

## Shipped Milestones

- **v2 SellerCollection** (2026-01-23) - 9 phases, 37 plans
  - See: .planning/milestones/v2-ROADMAP.md

- **v1 Extension Auth & RBAC** (2026-01-20) - 7 phases, 12 plans
  - See: .planning/milestones/v1-ROADMAP.md

## Performance Metrics

**v3 Velocity:**
- Total plans completed: 11
- Average duration: 3.5 min
- Total execution time: 39 min

**Historical:**
- v2: 37 plans in 4 days
- v1: 12 plans in 3 days

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Reuse public.update_updated_at() | 15-01 | Existing function from 001_auth_schema.sql, consistent with profiles/memberships |
| Removed CONCURRENTLY from index migration | 15-01 | Supabase SQL Editor runs in transaction block |
| 30-day soft delete retention | 15-01 | Per CONTEXT.md, daily purge at 3 AM UTC |
| URL-safe base64 cursors with stripped padding | 16-01 | Short cursors for query parameters, URL-safe characters |
| Short JSON keys (u, i) in cursor payload | 16-01 | Minimize cursor length in URLs |
| OR pattern for compound cursor filter | 16-02 | Supabase-py lacks tuple comparison support |
| include_deleted parameter for sync | 16-02 | Sync clients need to detect deletions |
| Lightweight sync items without computed fields | 16-02 | Client computes if needed, minimizes payload |
| 30s default staleTime, 5min for accounts | 17-01 | Records change frequently, accounts rarely |
| useState pattern for SSR-safe QueryClient | 17-01 | Avoid sharing state between server requests |
| Optimistic delete with rollback | 17-02 | Instant UI feedback, rollback on API failure |
| Remarks use direct API calls | 17-02 | Separate endpoints, still trigger UI updates |
| DEFAULT_ORG_ID placeholder | 17-02 | Until multi-org support added |
| SCHEMA_VERSION increment triggers full resync | 18-01 | Simpler than migration handlers |
| Compound index [account_id+sale_date] | 18-01 | Primary query pattern for records |
| _sync_meta table for checkpoints | 18-01 | Per-table cursor tracking |
| Incremental sync via updated_since | 18-02 | Delta sync using _sync_meta timestamps |
| Client-side computed fields | 18-02 | Server sends raw data, client computes profit/earnings/COGS |
| useLiveQuery for reactive IndexedDB | 18-02 | Auto-updates UI when IndexedDB changes |
| Cast IndexedDB status to BookkeepingStatus | 18-03 | IndexedDB stores string, API type expects enum |
| Client-side computed fields in UI | 18-03 | Reuse pattern from 18-02 in bookkeeping component |
| useSyncExternalStore for online/offline | 19-01 | Proper cleanup, SSR-safe browser event subscription |
| Status priority: offline > syncing > error > idle | 19-01 | Most important state always shown |
| Temp ID format temp-{uuid} for optimistic creates | 19-02 | Easy identification of uncommitted records |
| Skip retry for 4xx errors | 19-02 | Validation errors shouldn't retry, only network/5xx |
| IndexedDB rollback deferred for updates | 19-02 | Server sync will correct, avoids complex rollback logic |
| Schema version 2 for pending mutations table | 19-03 | Per 18-01 decision, triggers full resync |
| Conflict detection uses IndexedDB record | 19-03 | API BookkeepingRecord lacks updated_at for timestamp comparison |
| SyncRowBadge in expand column | 19-03 | Compact placement, no new column needed |

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-24
Stopped at: Completed 19-03-PLAN.md
Resume file: None
Next action: Execute 19-04-PLAN.md (Conflict Resolution Modal)
