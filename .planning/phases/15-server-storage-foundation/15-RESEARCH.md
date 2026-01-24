# Phase 15: Server Storage Foundation - Research

**Researched:** 2026-01-23
**Domain:** PostgreSQL/Supabase database infrastructure for cursor-based sync
**Confidence:** HIGH

## Summary

Phase 15 establishes the database foundation for v3's sync infrastructure. This phase adds three capabilities to existing tables: composite indexes for cursor-based pagination, `updated_at` columns with auto-update triggers, and `deleted_at` soft delete columns. These changes enable efficient incremental sync without loading entire datasets.

The codebase already has established patterns for triggers and column additions. Migration 001_auth_schema.sql defines `public.update_updated_at()` trigger function that multiple tables already use. Migration 003_bookkeeping_redesign.sql shows the pattern for per-table trigger functions like `touch_remark_audit_fields()`. Supabase's `moddatetime` extension provides an alternative but the existing custom function approach is consistent with the codebase.

**Primary recommendation:** Use existing `public.update_updated_at()` trigger function for all `updated_at` columns. Add composite indexes `(account_id, updated_at DESC, id DESC)` for cursor pagination. Implement soft deletes via `deleted_at TIMESTAMPTZ` column with partial unique indexes where needed.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 15+ (Supabase) | Database | Already in use, keyset pagination native |
| Supabase SQL Editor | N/A | Migration execution | Per CONTEXT.md decision |
| pg_cron | Supabase built-in | Scheduled purge job | Native Supabase extension for cron jobs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| moddatetime | PostgreSQL extension | Alternative updated_at | Only if abandoning existing trigger function |
| pg_net | Supabase built-in | HTTP from SQL | If purge job needs to call external services |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom trigger function | moddatetime extension | Extension is simpler but codebase already has working custom function |
| Composite index | Separate indexes | Composite required for cursor pagination performance |
| pg_cron purge | External scheduler | pg_cron is native and doesn't require additional infrastructure |

**Installation:**
No npm packages - this is pure PostgreSQL migration work.

## Architecture Patterns

### Recommended Migration Structure
```
apps/api/migrations/
├── 046_sync_infrastructure_columns.sql    # Add updated_at, deleted_at columns
├── 047_sync_infrastructure_indexes.sql    # Add composite indexes (CONCURRENTLY where needed)
├── 048_sync_purge_job.sql                 # pg_cron purge job for soft deletes
```

### Pattern 1: updated_at Trigger (Existing Pattern)
**What:** Auto-update timestamp on every row modification
**When to use:** All syncable tables
**Example:**
```sql
-- Source: Existing codebase pattern from 001_auth_schema.sql
-- Reuse existing function, just add trigger to new tables

-- Function already exists:
-- CREATE OR REPLACE FUNCTION public.update_updated_at()
-- RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
-- AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- Add column with backfill
ALTER TABLE public.bookkeeping_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create trigger
DROP TRIGGER IF EXISTS bookkeeping_records_updated_at ON public.bookkeeping_records;
CREATE TRIGGER bookkeeping_records_updated_at
  BEFORE UPDATE ON public.bookkeeping_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### Pattern 2: Composite Index for Cursor Pagination
**What:** Multi-column index matching cursor query pattern
**When to use:** Tables that need paginated sync
**Example:**
```sql
-- Source: PostgreSQL keyset pagination best practice
-- Index must match ORDER BY clause exactly

-- For account-scoped queries with timestamp ordering
CREATE INDEX CONCURRENTLY idx_bookkeeping_records_cursor
  ON public.bookkeeping_records (account_id, updated_at DESC, id DESC);

-- Cursor query pattern this enables:
-- SELECT * FROM bookkeeping_records
-- WHERE account_id = $1
--   AND (updated_at, id) < ($cursor_updated_at, $cursor_id)
-- ORDER BY updated_at DESC, id DESC
-- LIMIT 50;
```

### Pattern 3: Soft Delete with deleted_at
**What:** Mark rows as deleted instead of removing
**When to use:** User-facing syncable tables
**Example:**
```sql
-- Source: PostgreSQL soft delete pattern
ALTER TABLE public.bookkeeping_records
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active rows (most queries)
CREATE INDEX idx_bookkeeping_records_active
  ON public.bookkeeping_records (account_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Update trigger must also fire on soft delete
-- (existing updated_at trigger handles this automatically)
```

### Pattern 4: Purge Job with pg_cron
**What:** Scheduled permanent deletion of old soft-deleted records
**When to use:** 30-day retention per CONTEXT.md decision
**Example:**
```sql
-- Source: Supabase pg_cron documentation
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Create purge function
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_records()
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Permanently delete records soft-deleted > 30 days ago
  DELETE FROM public.bookkeeping_records
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  -- Add more tables as needed
END;
$$;

-- Schedule daily at 3 AM UTC (off-peak)
SELECT cron.schedule(
  'purge-soft-deleted-records',
  '0 3 * * *',  -- 3:00 AM daily
  $$ SELECT public.purge_soft_deleted_records(); $$
);
```

### Anti-Patterns to Avoid
- **Single-column cursor index:** Using only `updated_at` causes duplicates when rows share timestamps. Always include `id` as tiebreaker.
- **Standard CREATE INDEX on large tables:** Blocks writes during creation. Use CONCURRENTLY for tables with existing data.
- **Hard deletes on syncable tables:** Breaks sync because clients can't detect deletions. Soft delete is required.
- **Nullable updated_at:** Makes cursor comparison complex. Use NOT NULL with DEFAULT NOW().

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-update timestamp | Custom per-table logic | `public.update_updated_at()` trigger | Already exists, tested, consistent |
| Scheduled purge | External cron service | pg_cron extension | Native to Supabase, no infrastructure |
| Cursor encoding | Base64 JSON | Opaque string with (updated_at, id) | Simple tuple comparison is sufficient |

**Key insight:** The codebase already has the `update_updated_at()` function used by profiles and memberships tables. Reuse it rather than creating per-table variants.

## Common Pitfalls

### Pitfall 1: Non-Unique Cursor Columns
**What goes wrong:** Using `updated_at` alone as cursor causes duplicate or missing records when multiple rows share the same timestamp.
**Why it happens:** Bulk updates or rapid inserts create rows with identical `updated_at` values.
**How to avoid:** Always use compound cursor `(updated_at, id)` with matching compound index.
**Warning signs:** Tests pass with small datasets but pagination breaks in production with concurrent writes.

### Pitfall 2: Index Creation Blocking Writes
**What goes wrong:** Standard `CREATE INDEX` acquires SHARE lock, blocking all writes until complete.
**Why it happens:** PostgreSQL needs consistent snapshot during index build.
**How to avoid:** Use `CREATE INDEX CONCURRENTLY` for tables with existing data. Standard creation is fine for new tables.
**Warning signs:** Migration causes downtime or timeout on large tables.

### Pitfall 3: Soft Delete Breaks Unique Constraints
**What goes wrong:** Unique constraint on `(account_id, ebay_order_id)` prevents re-adding a soft-deleted record.
**Why it happens:** Soft-deleted row still exists, constraint includes it.
**How to avoid:** Use partial unique index: `WHERE deleted_at IS NULL`
**Warning signs:** "duplicate key" errors when adding records with previously-deleted identifiers.

### Pitfall 4: Missing updated_at on Soft Delete
**What goes wrong:** Clients don't detect deletions during sync because `updated_at` wasn't bumped.
**Why it happens:** Soft delete is UPDATE, but developer manually sets `deleted_at` without triggering `updated_at`.
**How to avoid:** The `BEFORE UPDATE` trigger fires on any UPDATE, including soft delete. Just set `deleted_at = NOW()` and trigger handles `updated_at`.
**Warning signs:** Deleted records don't appear in incremental sync results.

### Pitfall 5: pg_cron Timezone Confusion
**What goes wrong:** Purge job runs at unexpected time due to timezone mismatch.
**Why it happens:** pg_cron uses server timezone, not UTC by default.
**How to avoid:** Document timezone in cron schedule comments. Supabase typically uses UTC.
**Warning signs:** Purge running during peak hours instead of off-peak.

## Code Examples

Verified patterns from official sources and existing codebase:

### Complete Column Addition Pattern
```sql
-- Source: Existing codebase pattern, verified against PostgreSQL docs
-- Add updated_at and deleted_at to bookkeeping_records

-- 1. Add columns with sensible defaults
ALTER TABLE public.bookkeeping_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Add trigger using existing function
DROP TRIGGER IF EXISTS bookkeeping_records_updated_at ON public.bookkeeping_records;
CREATE TRIGGER bookkeeping_records_updated_at
  BEFORE UPDATE ON public.bookkeeping_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### Composite Index for Cursor Queries
```sql
-- Source: PostgreSQL keyset pagination, verified via multiple sources
-- CONCURRENTLY prevents write locks during creation

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookkeeping_records_cursor
  ON public.bookkeeping_records (account_id, updated_at DESC, id DESC);

-- Verify index is valid after CONCURRENTLY (can fail silently)
-- Check: SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE indexrelid = 'idx_bookkeeping_records_cursor'::regclass;
```

### Partial Index for Active Records
```sql
-- Source: PostgreSQL soft delete pattern
-- Most queries filter out deleted records - partial index is more efficient

CREATE INDEX IF NOT EXISTS idx_bookkeeping_records_active
  ON public.bookkeeping_records (account_id, sale_date DESC, id DESC)
  WHERE deleted_at IS NULL;
```

### Verify Cursor Query Performance
```sql
-- Use EXPLAIN ANALYZE to verify constant-time cursor pagination
EXPLAIN ANALYZE
SELECT * FROM bookkeeping_records
WHERE account_id = 'some-uuid'
  AND deleted_at IS NULL
  AND (updated_at, id) < ('2026-01-01 00:00:00+00', 'some-uuid')
ORDER BY updated_at DESC, id DESC
LIMIT 50;

-- Expected: Index Scan on idx_bookkeeping_records_cursor
-- Actual rows should match Limit, execution time should be consistent regardless of offset
```

## Tables Analysis

Based on codebase review, tables categorized by sync requirement:

### Tables Needing Full Sync Infrastructure (updated_at + deleted_at + cursor index)

These are user-facing, syncable tables:

| Table | Has updated_at | Has Cursor Index | Notes |
|-------|----------------|------------------|-------|
| `bookkeeping_records` | NO | NO | Core data, needs all three |
| `accounts` | NO | NO | User-visible accounts |
| `sellers` | YES (has column) | NO | Seller list, needs cursor index |

### Tables Needing updated_at Only (no soft delete)

Internal/system tables where hard delete is acceptable:

| Table | Has updated_at | Notes |
|-------|----------------|-------|
| `profiles` | YES + trigger | Already has trigger |
| `memberships` | YES + trigger | Already has trigger |
| `department_roles` | NO | Add updated_at |
| `collection_runs` | YES (column only) | Add trigger |
| `collection_settings` | YES (column only) | Add trigger |

### Tables NOT Needing Sync Infrastructure

Log/audit tables, internal system tables:

| Table | Reason |
|-------|--------|
| `audit_logs` | Append-only log |
| `seller_audit_log` | Append-only log |
| `collection_items` | Per-run items, not synced |
| `automation_events` | Event log |
| `access_code_attempts` | Security log |
| `automation_pairing_requests` | Temporary, expires |

### Recommendation

**Phase 15 Scope (CONTEXT.md "Claude decides which tables"):**
1. `bookkeeping_records` - Full infrastructure (updated_at, deleted_at, cursor index)
2. `accounts` - Full infrastructure
3. `sellers` - Add cursor index only (already has updated_at)

**Defer to later phases:**
- Other tables can add sync infrastructure when their sync endpoints are built

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Offset pagination | Keyset/Cursor pagination | Long-standing | Offset degrades 17x at scale; cursor is O(log n) |
| Hard deletes | Soft deletes for sync | Sync requirements | Hard delete breaks client sync detection |
| moddatetime extension | Custom trigger function | N/A | Codebase uses custom; either works |

**Deprecated/outdated:**
- OFFSET pagination: Still works but performance degrades linearly with page depth
- Boolean `is_deleted` flag: Less flexible than `deleted_at` timestamp (can't query "deleted this week")

## Open Questions

Things that couldn't be fully resolved:

1. **Table `bookkeeping_records` original schema**
   - What we know: Table exists, referenced in migrations, has account_id, sale_date, etc.
   - What's unclear: Whether it has created_at or any existing timestamp columns
   - Recommendation: Run `\d bookkeeping_records` in production before migration to verify current columns

2. **Existing data volume**
   - What we know: CONCURRENTLY needed for large tables to avoid blocking
   - What's unclear: Current row counts for bookkeeping_records, accounts, sellers
   - Recommendation: Always use CONCURRENTLY; it's slower but safe regardless of size

3. **RLS policy updates for soft delete**
   - What we know: RLS policies exist on most tables
   - What's unclear: Whether to add `deleted_at IS NULL` to every RLS policy
   - Recommendation: Add to RLS policies to prevent deleted rows from being visible via API

## CONCURRENTLY Decision Matrix

Per CONTEXT.md, Claude decides CONCURRENTLY vs standard per table:

| Table | Use CONCURRENTLY? | Rationale |
|-------|-------------------|-----------|
| `bookkeeping_records` | YES | Core data table, likely large, blocking writes unacceptable |
| `accounts` | YES | Active table, blocking affects all account operations |
| `sellers` | YES | Can grow large from collection runs |
| `department_roles` | NO | Small config table, admin-only, standard is fine |
| `collection_settings` | NO | One row per org, trivial |

## Sources

### Primary (HIGH confidence)
- Existing codebase migrations (001_auth_schema.sql, 003_bookkeeping_redesign.sql, 037_collection_infrastructure.sql)
- [PostgreSQL CREATE INDEX Documentation](https://www.postgresql.org/docs/current/sql-createindex.html)
- [Supabase pg_cron Documentation](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Supabase Triggers Documentation](https://supabase.com/docs/guides/database/postgres/triggers)

### Secondary (MEDIUM confidence)
- [Keyset Cursors for Postgres Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/) - Sequin Stream
- [Cursor Pagination Guide](https://bun.uptrace.dev/guide/cursor-pagination.html) - Uptrace
- [Soft Deletion with PostgreSQL](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database) - Evil Martians
- [Gunnar Morling - Last Updated Columns](https://www.morling.dev/blog/last-updated-columns-with-postgres/)

### Tertiary (LOW confidence)
- WebSearch results on index performance claims (not independently verified)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing codebase patterns, verified against official docs
- Architecture: HIGH - Well-documented PostgreSQL patterns, existing codebase examples
- Pitfalls: HIGH - Multiple authoritative sources, documented in PostgreSQL docs
- Table analysis: MEDIUM - Based on migration review, actual schema should be verified

**Research date:** 2026-01-23
**Valid until:** 60 days (PostgreSQL patterns are stable, Supabase may update pg_cron behavior)
