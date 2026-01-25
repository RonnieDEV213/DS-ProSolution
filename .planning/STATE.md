# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Handle millions of records with fast read/write across server storage, transport, client storage, and rendering
**Current focus:** Phase 21 - Export/Import

## Current Position

Phase: 21 of 21 (Export/Import)
Plan: 3 of ? in current phase
Status: In progress
Last activity: 2026-01-25 - Completed 21-03-PLAN.md (Backend Import Infrastructure)

Progress: [████████████████████] 100%+ (22/22+ plans)

## Shipped Milestones

- **v2 SellerCollection** (2026-01-23) - 9 phases, 37 plans
  - See: .planning/milestones/v2-ROADMAP.md

- **v1 Extension Auth & RBAC** (2026-01-20) - 7 phases, 12 plans
  - See: .planning/milestones/v1-ROADMAP.md

## Performance Metrics

**v3 Velocity:**
- Total plans completed: 14
- Average duration: 3.4 min
- Total execution time: 50 min

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
| Conflict field-level values not full records | 19-04 | Smaller payload, shows only what differs |
| Deep equality for conflict detection | 19-04 | Avoid false positives from object references |
| Modal cannot be dismissed | 19-04 | Force user to resolve conflict before continuing |
| useOnlineStatus at hook level | 19-05 | Called once per hook instantiation, React re-renders on status change |
| Temp ID in mutationFn for creates | 19-05 | Queue tracking separate from onMutate temp ID |
| Use syncRecords for single record fetch | 19-06 | No GET /records/{id} endpoint, use bulk sync with client filter |
| RecordSyncItem for conflict detection | 19-06 | Enforces server data source with updated_at |
| Expanded rows as fixed-height virtual rows | 20-01 | Avoid variable height measurement while supporting expansion |
| Persist row density in localStorage | 20-01 | Maintain compact/comfortable preference across sessions |
| Use List.scrollToRow with smart alignment | 20-02 | Keep focused rows visible without over-scrolling |
| Row container onClick toggles expand | 20-05 | Better UX - click anywhere on row, not just arrow |
| Separate Return Label/Return Closed filters | 20-05 | More granular filtering than combined Returns chip |
| 70% similarity threshold for column mapping | 21-03 | Balances flexibility with accuracy for import column matching |
| All-or-nothing import transaction | 21-03 | Prevents partial imports, user sees all errors upfront |
| Soft-delete for import rollback | 21-03 | Follows existing pattern, maintains audit trail |
| 24-hour rollback window for imports | 21-03 | Per CONTEXT.md requirement, enforced in code and DB function |
| Modified record detection via timestamp | 21-03 | Warns user if records edited since import before rollback |

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed 21-03-PLAN.md (Backend Import Infrastructure)
Resume file: None
Next action: Continue with Phase 21 remaining plans (frontend import UI)
