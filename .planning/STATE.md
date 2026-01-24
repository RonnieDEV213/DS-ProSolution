# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Handle millions of records with fast read/write across server storage, transport, client storage, and rendering
**Current focus:** Phase 16 - Transport Layer

## Current Position

Phase: 16 of 21 (Transport Layer)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-01-24 — Completed 16-02-PLAN.md

Progress: [███░░░░░░░] 19% (3/16 plans)

## Shipped Milestones

- **v2 SellerCollection** (2026-01-23) - 9 phases, 37 plans
  - See: .planning/milestones/v2-ROADMAP.md

- **v1 Extension Auth & RBAC** (2026-01-20) - 7 phases, 12 plans
  - See: .planning/milestones/v1-ROADMAP.md

## Performance Metrics

**v3 Velocity:**
- Total plans completed: 3
- Average duration: 2.7 min
- Total execution time: 8 min

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-24
Stopped at: Completed 16-02-PLAN.md (Phase 16 complete)
Resume file: None
Next action: Execute Phase 17 (Client Storage)
