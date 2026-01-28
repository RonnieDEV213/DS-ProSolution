---
status: diagnosed
trigger: "SellersGrid shows no sellers despite 4,700 in database"
created: 2026-01-27T00:00:00Z
updated: 2026-01-27T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Missing RLS policy on sellers table blocks sync endpoint
test: Compared RLS policies for sellers vs bookkeeping_records and accounts tables
expecting: sellers table should have authenticated user policy like other tables
next_action: Report root cause

## Symptoms

expected: SellersGrid displays all 4,700 sellers from the database
actual: Grid shows "No sellers yet" / 0 sellers. "(syncing...)" text flashes briefly. Adding existing seller shows "failed to add seller". New sellers don't appear after adding.
errors: No visible errors (silent failure due to RLS returning empty results)
reproduction: Load the Collection page with sellers in the database
started: After Phase 28 migrated SellersGrid from direct fetch+useState to useSyncSellers (IndexedDB-backed via Dexie useLiveQuery)

## Eliminated

- hypothesis: syncSellers() fails with API error
  evidence: The sync endpoint exists (GET /sync/sellers), returns 200, but returns empty items[] due to RLS. No error is thrown.
  timestamp: 2026-01-27

- hypothesis: Dexie schema version bump causes mismatch
  evidence: SCHEMA_VERSION=3 is handled by init.ts which deletes and recreates DB on version change. Schema is correct.
  timestamp: 2026-01-27

- hypothesis: useLiveQuery queries wrong table or index
  evidence: useLiveQuery reads db.sellers.toArray() which is the correct table. The query logic is sound.
  timestamp: 2026-01-27

- hypothesis: sellerApi endpoints don't match backend routes
  evidence: All CRUD endpoints (/sellers, /sellers/bulk, etc.) use service_role via get_supabase() and work correctly. The issue is only with /sync/sellers.
  timestamp: 2026-01-27

- hypothesis: Frontend type mismatch between SellerSyncItem and SellerRecord
  evidence: Both types have identical fields (id, display_name, normalized_name, platform, platform_id, times_seen, flagged, updated_at, deleted_at).
  timestamp: 2026-01-27

## Evidence

- timestamp: 2026-01-27
  checked: Backend sync endpoint (apps/api/src/app/routers/sync.py lines 261-306)
  found: sync_sellers() uses get_supabase_for_user(user["token"]) which creates a Supabase client with the user's JWT, subject to RLS
  implication: The query result depends on RLS policies on the sellers table

- timestamp: 2026-01-27
  checked: RLS policies on sellers table (apps/api/migrations/037_collection_infrastructure.sql lines 145-158)
  found: Only ONE policy exists: "service_role_sellers" which grants access TO service_role ONLY. Comment on line 140 says "Future phases may add user-facing policies for read access."
  implication: Authenticated users get ZERO rows when querying sellers table via RLS

- timestamp: 2026-01-27
  checked: RLS policies on bookkeeping_records table (apps/api/migrations/024_add_suspended_status.sql lines 125+)
  found: Has "Users can view records for assigned accounts" policy granting SELECT to authenticated users (admins see all, VAs see assigned)
  implication: Records sync works because bookkeeping_records has authenticated user RLS policies

- timestamp: 2026-01-27
  checked: RLS policies on accounts table (apps/api/migrations/002_bookkeeping_security.sql lines 66+)
  found: Multiple policies for authenticated users (Admin can view, Client can view, VA can view assigned)
  implication: Accounts sync works because accounts table has authenticated user RLS policies

- timestamp: 2026-01-27
  checked: Seller CRUD endpoints (apps/api/src/app/routers/sellers.py)
  found: ALL CRUD endpoints use get_supabase() (service role) via CollectionService, which bypasses RLS
  implication: Adding/deleting sellers works because CRUD uses service role, not user token

- timestamp: 2026-01-27
  checked: Sync behavior with no RLS match
  found: Supabase with RLS enabled and no matching policy returns 0 rows silently (no error). syncSellers() gets {items: [], has_more: false}, writes nothing to IndexedDB, completes successfully.
  implication: Explains why "(syncing...)" flashes without error but grid stays empty

## Resolution

root_cause: The /sync/sellers endpoint uses get_supabase_for_user() (user JWT, subject to RLS), but the sellers table only has a service_role RLS policy (migration 037). There is NO RLS policy granting authenticated users SELECT access to the sellers table. When syncSellers() queries via user token, Supabase returns 0 rows silently. IndexedDB never gets populated. The old code worked because it used /sellers (CRUD endpoint) which uses get_supabase() (service role, bypasses RLS).

fix: Either (A) add an RLS policy for authenticated users on the sellers table, or (B) change the /sync/sellers endpoint to use get_supabase() (service role) like the CRUD endpoints do, filtering by org_id manually.

verification: N/A (diagnosis only)
files_changed: []
