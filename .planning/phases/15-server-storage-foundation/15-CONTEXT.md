# Phase 15: Server Storage Foundation - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Database tables support efficient cursor-based queries with change tracking. Add composite indexes for cursor pagination, updated_at columns with auto-update triggers, and soft deletes (deleted_at) instead of hard deletes. This is infrastructure — no user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Soft Delete Retention
- 30-day retention before permanent purge
- Deleted items invisible to users — admin-only restore capability
- Daily purge job at off-peak hours (automated)
- No archive before purge — 30 days is sufficient recovery window

### Change Tracking Scope
- No audit trail needed (no change history, no last_modified_by)
- Claude's discretion on: whether to track changed columns, created_at vs updated_at separation, new-vs-updated distinction for sync

### Migration Strategy
- Migrations run via Supabase SQL editor (manual execution)
- Index creation: Claude decides per table (CONCURRENTLY for large/critical tables)
- Backfill updated_at to NOW() for all existing rows on migration
- Soft delete scope: Claude identifies which tables need deleted_at (syncable/user-facing)

### Claude's Discretion
- Whether to add separate created_at column (or just use updated_at initialized on create)
- Whether to track which columns changed per update (for partial sync)
- Whether sync should distinguish "new" vs "updated" rows
- Which tables get soft delete (based on sync and user-facing criteria)
- CONCURRENTLY vs standard index creation per table

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for Postgres/Supabase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-server-storage-foundation*
*Context gathered: 2026-01-23*
