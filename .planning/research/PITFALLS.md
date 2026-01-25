# Domain Pitfalls: Large-Scale Data Infrastructure (v3)

**Domain:** eBay account management platform - cursor pagination, IndexedDB caching, incremental sync, virtualized rendering
**Researched:** 2026-01-23
**Confidence:** HIGH (multiple authoritative sources cross-referenced)

---

## Critical Pitfalls

Mistakes that cause rewrites or major architectural issues. Address these in design, not as bugs.

---

### CP-01: Non-Unique Cursor Columns (Pagination)

**What goes wrong:** Using `updated_at` or `created_at` alone as cursor produces duplicate or missing records when multiple rows share the same timestamp. With 1000 rows at the same `updated_at` and page size of 100, there is no safe way to traverse.

**Why it happens:** Developers assume timestamps are unique enough. Batch inserts, concurrent writes, and clock precision (millisecond) create collisions. PostgreSQL can commit rows out-of-order relative to sequence values.

**Consequences:**
- Users see same records on multiple pages
- Users skip records entirely (never visible)
- Infinite loops when all visible records share the cursor value
- Sync processes miss records during incremental fetch

**Warning signs:**
- QA reports "I saw this item twice"
- Record counts don't match between paginated fetch and COUNT(*)
- Automated tests pass but production shows duplicates

**Prevention:**
1. **Always use compound cursors**: `(updated_at, id)` not just `updated_at`
2. **Use tuple comparison**: `WHERE (updated_at, id) > ($cursor_ts, $cursor_id)`
3. **Index both columns together**: `CREATE INDEX idx_compound ON table(updated_at DESC, id DESC)`
4. **Never use non-unique columns alone** - even UUIDs can collide in edge cases

**Which phase should address:** Phase 1 (Pagination Infrastructure) - must be correct from day one

**Recovery strategy:** Requires API contract change if already shipped. Add `cursor_id` field, deprecate old cursor, migrate clients.

**Sources:**
- [Keyset Cursors for Postgres Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/)
- [Cursor Pagination PostgreSQL Guide](https://bun.uptrace.dev/guide/cursor-pagination.html)
- [Paginating Large Ordered Datasets](https://brunoscheufler.com/blog/2022-01-01-paginating-large-ordered-datasets-with-cursor-based-pagination)

---

### CP-02: IndexedDB Transaction Auto-Commit (Async/Await Trap)

**What goes wrong:** Transaction commits automatically before async operations complete. Any `await` to external API (fetch, setTimeout) inside a transaction causes `TransactionInactiveError`.

**Why it happens:** IndexedDB transactions have an "active flag" that clears when control returns from the event loop tick. Promise microtasks can keep it alive briefly, but any macrotask (fetch, setTimeout) causes commit. Firefox is stricter than Chrome - even Promise.resolve().then() can trigger premature commit.

**Consequences:**
- `TransactionInactiveError` thrown mid-operation
- Partial writes corrupt data integrity
- Works in Chrome testing, fails in Firefox/Safari production
- Silent data loss when transactions commit before all writes

**Warning signs:**
- "Transaction is not active" errors in console
- Data inconsistency after page refresh
- Works locally, fails in specific browsers
- Operations succeed in sequence but fail in parallel

**Prevention:**
1. **Never await external operations inside transactions**
2. **Fetch all data before starting transaction**
3. **Use explicit `transaction.commit()` when supported**
4. **Structure code**: gather data -> open transaction -> write all -> close
5. **Test in Firefox** (stricter transaction timing than Chrome)

**Code pattern to avoid:**
```typescript
// WRONG - will auto-commit before fetch returns
const tx = db.transaction('store', 'readwrite');
const data = await fetch('/api/data'); // Transaction commits here!
await tx.store.put(data); // TransactionInactiveError
```

**Correct pattern:**
```typescript
// RIGHT - gather first, then transact
const data = await fetch('/api/data');
const tx = db.transaction('store', 'readwrite');
await tx.store.put(data);
await tx.done;
```

**Which phase should address:** Phase 2 (IndexedDB Layer) - foundation of all client-side caching

**Recovery strategy:** Refactor all transaction code. Use wrapper library (Dexie.js, idb) that handles this correctly.

**Sources:**
- [IndexedDB Promises Proposal](https://github.com/inexorabletash/indexeddb-promises)
- [Pain and Anguish of IndexedDB](https://gist.github.com/pesterhazy/4de96193af89a6dd5ce682ce2adff49a)
- [IDB Transaction Commit Explainer](https://andreas-butler.github.io/idb-transaction-commit/EXPLAINER.html)

---

### CP-03: Safari 7-Day Storage Eviction (Data Loss)

**What goes wrong:** Safari deletes ALL browser storage (IndexedDB, localStorage, WebSQL) after 7 days of user inactivity. Users return to find their cached data gone.

**Why it happens:** Safari's Intelligent Tracking Prevention (ITP) treats client-side storage as potential tracking mechanism. Unlike other browsers, Safari aggressively evicts even legitimate app data.

**Consequences:**
- Users lose offline data after vacation/break
- Re-sync required from scratch (bandwidth, time)
- Perceived app unreliability
- Support tickets: "All my data disappeared"

**Warning signs:**
- Safari users report data loss after not using app
- Analytics show Safari users have longer initial load times
- Support tickets cluster around Monday mornings (weekend inactivity)

**Prevention:**
1. **Request persistent storage**: `navigator.storage.persist()` (may not work in Safari)
2. **Design for re-sync**: Assume cache is ephemeral, server is source of truth
3. **Track last sync time**: Warn users if cache is stale
4. **Don't store critical data only in IndexedDB** - always recoverable from server
5. **Document limitation** for users in Safari

**Which phase should address:** Phase 2 (IndexedDB Layer) and Phase 3 (Sync Protocol)

**Recovery strategy:** Graceful degradation - detect empty cache, trigger full sync, show progress indicator.

**Sources:**
- [IndexedDB Max Storage Limits](https://rxdb.info/articles/indexeddb-max-storage-limit.html)
- [MDN Storage Quotas and Eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

---

### CP-04: Optimistic Update Rollback Races (Sync Conflicts)

**What goes wrong:** User makes change A, then change B while A is in-flight. A fails and needs rollback, but B's optimistic state is based on A's optimistic state. Rollback creates inconsistent UI.

**Why it happens:** Each optimistic update snapshots "previous state" for rollback. When updates overlap, rollback targets are stale. Without proper sequencing, later updates don't know earlier ones failed.

**Consequences:**
- UI shows impossible states (rolled back partially)
- User confusion about what actually saved
- Data inconsistency between client and server
- Race conditions create non-reproducible bugs

**Warning signs:**
- Users report "data jumping around"
- Quick double-clicks cause weird states
- Undo/redo behavior is unpredictable
- QA cannot reproduce user-reported bugs

**Prevention:**
1. **Sequence mutations**: Don't allow overlapping optimistic updates to same entity
2. **Use mutation queues**: Process changes FIFO, rollback affects entire queue
3. **Cancel in-flight requests** before applying conflicting optimistic update
4. **Track dependency chains**: B depends on A, if A fails, invalidate B
5. **Consider last-write-wins** for simple cases vs complex CRDT

**Which phase should address:** Phase 3 (Sync Protocol) - must design mutation flow correctly

**Recovery strategy:** Implement proper optimistic update library (TanStack Query's optimistic updates, or custom queue).

**Sources:**
- [Concurrent Optimistic Updates in React Query](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [Optimistic State with Rollbacks](https://github.com/perceived-dev/optimistic-state)

---

### CP-05: IndexedDB Schema Migration Version Conflicts (Multi-Tab)

**What goes wrong:** User has two tabs open. New deployment upgrades IndexedDB schema. New tab tries to upgrade, old tab blocks it because it has connection open. App deadlocks or corrupts.

**Why it happens:** IndexedDB `onupgradeneeded` requires exclusive access. Old tabs with open connections receive `onversionchange` but may not close connection quickly. New tabs wait on `onblocked` indefinitely.

**Consequences:**
- App freezes on load
- Old tab crashes or shows stale data
- Schema migration never completes
- Data corruption if partial migration

**Warning signs:**
- Users report "app won't load" after update
- "Multiple tabs" support tickets
- Migration works in fresh browser, fails for active users
- Postman/GitHub had this exact issue

**Prevention:**
1. **Handle `onversionchange`**: Force-close database or prompt user to refresh all tabs
2. **Handle `onblocked`**: Show UI explaining other tabs must close
3. **Use version-aware connection pooling**: Don't leave connections open
4. **Test multi-tab scenarios** in CI/QA
5. **Consider broadcast channel** to coordinate tab shutdown

**Code pattern:**
```typescript
db.onversionchange = () => {
  db.close();
  alert('Database update required. Please refresh all tabs.');
};

request.onblocked = () => {
  console.warn('Database upgrade blocked by another tab');
  // Show UI to user
};
```

**Which phase should address:** Phase 2 (IndexedDB Layer) - must handle from initial implementation

**Recovery strategy:** Add version change handlers, implement tab coordination, consider service worker for single connection.

**Sources:**
- [Handling IndexedDB Upgrade Version Conflict](https://dev.to/ivandotv/handling-indexeddb-upgrade-version-conflict-368a)
- [MDN Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

---

## Performance Traps

Mistakes that cause slowness, memory issues, or degraded UX. May not break functionality but harm user experience at scale.

---

### PT-01: Missing Compound Index for Cursor Pagination

**What goes wrong:** Query `WHERE (updated_at, id) > ($1, $2) ORDER BY updated_at, id` does sequential scan instead of index scan. Performance degrades from O(log n) to O(n).

**Why it happens:** Developers create separate indexes on `updated_at` and `id`, but tuple comparison needs compound index. PostgreSQL query planner can't efficiently combine single-column indexes for this pattern.

**Consequences:**
- First pages fast, deep pages slow (minutes for page 1000)
- Database CPU spikes during pagination
- Timeouts on large datasets
- Users abandon app waiting for "Load More"

**Warning signs:**
- EXPLAIN shows Seq Scan instead of Index Scan
- Query time increases linearly with page depth
- Database monitoring shows high CPU during list views
- Works fine with 1000 records, crawls at 1M

**Prevention:**
1. **Create compound index matching query**: `CREATE INDEX ON table(updated_at DESC, id DESC)`
2. **Match index direction to ORDER BY** - DESC cursor needs DESC index
3. **Run EXPLAIN ANALYZE** on pagination queries during development
4. **Test with production-scale data** before shipping
5. **Supabase**: Verify RLS doesn't prevent index usage

**Which phase should address:** Phase 1 (Pagination Infrastructure)

**Recovery strategy:** Add index (may take hours on large tables), consider `CREATE INDEX CONCURRENTLY`.

**Sources:**
- [Five Ways to Paginate in Postgres](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/)
- [Optimizing SQL Pagination in Postgres](https://readyset.io/blog/optimizing-sql-pagination-in-postgres)

---

### PT-02: Unbounded Infinite Query Memory Growth

**What goes wrong:** TanStack Query's infinite queries store all fetched pages in memory. After loading 100 pages of 50 items each, 5000 records are in memory. Mobile devices crash.

**Why it happens:** Default infinite query behavior appends pages indefinitely. No automatic pruning. Developers test with few pages, users scroll for hours.

**Consequences:**
- Browser memory grows without bound
- Tab crashes on mobile (especially iOS Safari)
- Entire app becomes sluggish
- Cannot recover without page refresh

**Warning signs:**
- Memory profiler shows constant growth during scrolling
- iOS Safari tab refreshes/crashes
- "Aw, Snap!" errors in Chrome after extended use
- Performance degrades over session duration

**Prevention:**
1. **Use `maxPages` option** in TanStack Query infinite queries
2. **Implement bidirectional scrolling**: Drop pages when scrolling away
3. **Virtual window of pages**: Keep only visible pages + buffer
4. **Monitor memory usage**: `performance.memory` in Chrome
5. **Test extended scroll sessions** in QA

**Code pattern:**
```typescript
useInfiniteQuery({
  // Only keep 5 pages in memory
  maxPages: 5,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  getPreviousPageParam: (firstPage) => firstPage.prevCursor,
});
```

**Which phase should address:** Phase 4 (Virtualization) - must implement from start

**Recovery strategy:** Add maxPages, implement page pruning, may require re-architecture if deeply integrated.

**Sources:**
- [TanStack Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [TanStack Virtual Memory Leak Issue](https://github.com/TanStack/virtual/issues/196)

---

### PT-03: IndexedDB Single-Transaction Write Bottleneck

**What goes wrong:** Inserting 1000 records with one transaction per write takes 2 seconds. Same data in single transaction takes 20ms. 100x performance difference.

**Why it happens:** IndexedDB transaction overhead dominates small writes. Each transaction requires disk sync, journaling, and commit. Batching amortizes this overhead.

**Consequences:**
- Sync operations take minutes instead of seconds
- UI freezes during bulk writes
- Users perceive app as slow
- Battery drain on mobile from constant disk writes

**Warning signs:**
- Sync progress bar moves slowly
- `performance.now()` shows write time >> data size
- Profiler shows many small disk operations
- Users complain about "saving" taking forever

**Prevention:**
1. **Batch writes into single transactions**: Group 100-1000 records
2. **Use `durability: 'relaxed'`** in Chrome for non-critical writes
3. **Shard large datasets** across multiple object stores (28% faster reads)
4. **Avoid mixing reads and writes** in same transaction when possible
5. **Profile with realistic data volumes** during development

**Which phase should address:** Phase 2 (IndexedDB Layer)

**Recovery strategy:** Refactor to batch writes, add write queue that accumulates changes.

**Sources:**
- [Solving IndexedDB Slowness](https://rxdb.info/slow-indexeddb.html)
- [Main Limitations of IndexedDB](https://dexie.org/docs/The-Main-Limitations-of-IndexedDB)

---

### PT-04: Virtualized List Focus/Accessibility Breakage

**What goes wrong:** User tabs through virtualized list. Focus moves to item 50. User scrolls down, item 50 unmounts. Focus is lost, keyboard navigation breaks. Screen readers lose context.

**Why it happens:** Virtualization unmounts DOM elements outside viewport. Browser focus system doesn't know element is "virtually" still there. ARIA live regions don't announce virtualized content changes.

**Consequences:**
- Keyboard-only users cannot navigate
- Screen reader users get lost
- Tab key jumps to unexpected places
- Accessibility audit failures
- Potential legal liability (ADA/WCAG)

**Warning signs:**
- QA reports "focus jumps to top of page"
- Keyboard navigation tests fail
- Screen reader testing shows missing announcements
- `document.activeElement` is `body` after scroll

**Prevention:**
1. **Manage focus state in component**: Track logical focus, restore on re-mount
2. **Use roving tabindex pattern**: Only one item tabbable at a time
3. **Wrap in ARIA landmarks**: `role="feed"` with `aria-busy`
4. **Announce new content**: `aria-live="polite"` region for loaded items
5. **Test with keyboard and screen reader** during development

**Which phase should address:** Phase 4 (Virtualization)

**Recovery strategy:** Implement focus management layer, may require virtualizer wrapper component.

**Sources:**
- [WAI-ARIA Authoring Practices - Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
- [TanStack Virtual Documentation](https://tanstack.com/virtual/v3/docs/framework/react/examples/infinite-scroll)

---

### PT-05: DESC Cursor Performance Cliff

**What goes wrong:** ASC pagination: 0.3ms per page. Same query with DESC: 300ms per page. 1000x slowdown just from direction change.

**Why it happens:** PostgreSQL B-tree indexes are optimized for forward traversal. Backward traversal requires additional operations. Without matching DESC index, query planner may choose inefficient path.

**Consequences:**
- "Recent first" views are slow
- Users prefer natural order (newest first) which is slowest
- Inconsistent performance confuses debugging
- May hit query timeouts

**Warning signs:**
- Same query much slower with `ORDER BY ... DESC`
- EXPLAIN shows different plan for ASC vs DESC
- Performance tests pass (ASC) but production is slow (DESC)

**Prevention:**
1. **Create DESC indexes explicitly**: `CREATE INDEX ON table(updated_at DESC, id DESC)`
2. **Match index direction to query direction**
3. **Test both directions** with production-scale data
4. **Consider covering indexes** to avoid heap lookups

**Which phase should address:** Phase 1 (Pagination Infrastructure)

**Recovery strategy:** Add properly-ordered indexes, may require index rebuild.

**Sources:**
- [Prisma Cursor Pagination DESC Issue](https://github.com/prisma/prisma/issues/12650)
- [Cursor Pagination with Arbitrary Ordering](https://medium.com/@george_16060/cursor-based-pagination-with-arbitrary-ordering-b4af6d5e22db)

---

## Technical Debt Patterns

Shortcuts that seem fine initially but create compounding problems over time.

---

### TD-01: Offset Pagination "Because It's Easier"

**What goes wrong:** Team ships offset pagination (`LIMIT 50 OFFSET 1000`) because it's simpler. Works fine at 10K records. At 1M records, deep pages take 30+ seconds.

**Why it happens:** Offset pagination is familiar, works out of the box, and handles arbitrary page jumps. Cursor pagination requires API design changes and client state management. Deadline pressure favors familiar approach.

**Consequences:**
- Rewrite pagination system later (breaking API change)
- Users cannot reliably browse older data
- Database under constant load from full scans
- Tech debt compounds as more features depend on pagination

**Warning signs:**
- Product roadmap says "millions of records" but pagination uses OFFSET
- Performance tests only use first few pages
- "We'll optimize later" in code comments

**Prevention:**
1. **Start with cursor pagination** even if dataset is small
2. **Design API with cursors from day one**
3. **Educate team on scaling characteristics**
4. **Add pagination performance test to CI** with large synthetic dataset

**Which phase should address:** Phase 1 (Pagination Infrastructure) - non-negotiable

**Recovery strategy:** Full API redesign required. Version API, deprecate offset endpoints, migrate clients.

**Sources:**
- [Understanding Cursor Pagination](https://www.milanjovanovic.tech/blog/understanding-cursor-pagination-and-why-its-so-fast-deep-dive)
- [Offset vs Cursor Pagination](https://embedded.gusto.com/blog/api-pagination/)

---

### TD-02: "Server Is Source of Truth" Without Offline Strategy

**What goes wrong:** Team treats IndexedDB as pure cache. When offline, app shows spinner or error. Users expect to work offline with cached data.

**Why it happens:** Offline-first is complex. Conflict resolution is hard. Team defers offline support "until v2" but never addresses it. Users learn app is "online only" despite having local storage.

**Consequences:**
- Poor UX on flaky connections
- Users lose work during network blips
- Competitive disadvantage vs offline-capable apps
- Massive refactor needed to add offline support later

**Warning signs:**
- No offline testing in QA process
- Network errors show generic "Please try again"
- IndexedDB used only for performance, not resilience
- No conflict resolution strategy documented

**Prevention:**
1. **Design offline strategy upfront** even if initial impl is "read-only offline"
2. **Define conflict resolution policy** (last-write-wins, server-wins, manual)
3. **Queue mutations when offline**: Sync when connection returns
4. **Test with network throttling** in QA

**Which phase should address:** Phase 3 (Sync Protocol)

**Recovery strategy:** Add mutation queue, implement retry logic, may require significant state management changes.

**Sources:**
- [PowerSync Conflict Resolution](https://docs.powersync.com/usage/lifecycle-maintenance/handling-update-conflicts/custom-conflict-resolution)
- [Optimistic Offline Lock Pattern](https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html)

---

### TD-03: Treating Virtualization As "Just Rendering"

**What goes wrong:** Team adds react-window to existing list component. Works initially. Then: search breaks, keyboard navigation fails, scroll position resets on data change, ref forwarding fails.

**Why it happens:** Virtualization fundamentally changes component contract. Unmounted items lose state, refs, and event listeners. Existing features assume DOM element persistence.

**Consequences:**
- Feature-by-feature breakage after virtualization added
- Regressions in search, filter, selection
- Scroll position bugs on data updates
- Eventually revert virtualization or rewrite features

**Warning signs:**
- "Virtualization broke X" tickets after deployment
- Features work without virtualization, fail with it
- Scroll position jumps after re-render
- Selection state lost on scroll

**Prevention:**
1. **Design for virtualization from the start**
2. **Lift all item state to parent component** (selection, expansion, focus)
3. **Use stable keys** (not array indices)
4. **Implement scroll position restoration** explicitly
5. **Test search, filter, select, keyboard nav** with virtualization

**Which phase should address:** Phase 4 (Virtualization)

**Recovery strategy:** Refactor state management to support virtualization assumptions. May require component rewrite.

**Sources:**
- [Optimizing Large Lists in React](https://www.ignek.com/blog/optimizing-large-lists-in-react-virtualization-vs-pagination/)
- [React Native VirtualizedList](https://reactnative.dev/docs/virtualizedlist)

---

### TD-04: Implicit Version Vectors (Sync Conflicts)

**What goes wrong:** Team uses `updated_at` timestamp for conflict detection. Two devices modify same record within same second. Last write silently overwrites first write. Users lose data.

**Why it happens:** Timestamps feel intuitive for "which is newer." Clock skew, same-second updates, and timezone bugs make timestamps unreliable. Team doesn't realize data is being lost until users complain.

**Consequences:**
- Silent data loss
- Users cannot trust app with important data
- Debugging sync issues nearly impossible
- May require explicit versioning retrofit

**Warning signs:**
- Users report "my changes disappeared"
- Changes overwrite unexpectedly
- Audit logs show unexplained overwrites
- QA cannot reproduce "lost data" reports

**Prevention:**
1. **Use explicit version numbers or ETags** not timestamps
2. **Increment version on every write** server-side
3. **Reject writes with stale version** (optimistic locking)
4. **Log conflicts** for debugging
5. **Consider CRDTs** for highly concurrent scenarios

**Which phase should address:** Phase 3 (Sync Protocol)

**Recovery strategy:** Add version column to all synced tables, implement version checking in API, migrate clients.

**Sources:**
- [Optimistic Concurrency Control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
- [EF Core Handling Concurrency Conflicts](https://learn.microsoft.com/en-us/ef/core/saving/concurrency)

---

## Supabase-Specific Pitfalls

Issues specific to the Supabase ecosystem that powers this project.

---

### SP-01: RLS Preventing Index Usage

**What goes wrong:** Query uses index in `psql` but Supabase client queries do sequential scan. RLS policy adds conditions that invalidate index.

**Why it happens:** Supabase enforces Row-Level Security by adding WHERE clauses to queries. Complex RLS policies can prevent query planner from using intended indexes.

**Prevention:**
1. **Test queries with RLS enabled** not just raw SQL
2. **Create indexes that include RLS filter columns**
3. **Use EXPLAIN with `role = 'authenticated'`** to see actual plan
4. **Simplify RLS policies** where possible

**Which phase should address:** Phase 1 (Pagination Infrastructure)

---

### SP-02: Realtime Subscription Overhead at Scale

**What goes wrong:** Subscribe to realtime changes on large table. Every INSERT/UPDATE/DELETE broadcasts to all subscribers. Server CPU spikes, clients flood with events.

**Why it happens:** Supabase Realtime broadcasts all changes matching subscription filter. With millions of records and frequent updates, this creates event storm.

**Prevention:**
1. **Filter subscriptions narrowly**: `filter: 'account_id=eq.${id}'`
2. **Don't subscribe to full tables** - use specific filters
3. **Implement debouncing** on client for rapid updates
4. **Consider polling for high-frequency changes**

**Which phase should address:** Phase 3 (Sync Protocol) if using realtime for sync

---

### SP-03: Multi-Column Cursor with Supabase Client

**What goes wrong:** Supabase JS client doesn't support tuple comparison `(a, b) > (x, y)`. Developer uses `.gt('a', x).gt('b', y)` which is wrong logic.

**Why it happens:** SQL tuple comparison is elegant but Supabase client uses chained filters. Incorrect translation produces wrong results.

**Prevention:**
1. **Use `.or()` with `and()` syntax** for compound conditions
2. **Consider RPC function** for complex cursor queries
3. **Test pagination edge cases** where only second column differs
4. **Document the query pattern** for team

**Code pattern:**
```typescript
// Wrong: AND logic, not tuple comparison
.gt('updated_at', cursor.ts)
.gt('id', cursor.id)

// Right: Tuple comparison via OR
.or(`updated_at.gt.${cursor.ts},and(updated_at.eq.${cursor.ts},id.gt.${cursor.id})`)
```

**Which phase should address:** Phase 1 (Pagination Infrastructure)

**Sources:**
- [Supabase Cursor Pagination Discussion](https://github.com/orgs/supabase/discussions/3938)
- [Multi-Column Cursor Pagination Discussion](https://github.com/orgs/supabase/discussions/21330)

---

## Pitfall-to-Phase Mapping

Summary of which pitfalls should be addressed in which v3 phase.

| Phase | Pitfalls to Address | Priority |
|-------|---------------------|----------|
| **Phase 1: Pagination Infrastructure** | CP-01 (Non-Unique Cursors), PT-01 (Missing Index), PT-05 (DESC Performance), TD-01 (Offset Pagination), SP-01 (RLS Index), SP-03 (Supabase Client) | CRITICAL |
| **Phase 2: IndexedDB Layer** | CP-02 (Transaction Auto-Commit), CP-03 (Safari Eviction), CP-05 (Schema Migration), PT-03 (Write Bottleneck) | CRITICAL |
| **Phase 3: Sync Protocol** | CP-04 (Optimistic Rollback), TD-02 (Offline Strategy), TD-04 (Version Vectors), SP-02 (Realtime Overhead) | HIGH |
| **Phase 4: Virtualization** | PT-02 (Memory Growth), PT-04 (Focus/Accessibility), TD-03 (Virtualization Integration) | HIGH |

---

## Pitfall Prevention Checklist

Use during development to verify pitfalls are addressed.

### Phase 1 Checklist
- [ ] Cursor uses compound columns (updated_at, id)
- [ ] Compound index exists with matching direction
- [ ] Tested with 1M+ synthetic records
- [ ] DESC queries use DESC index
- [ ] RLS doesn't prevent index usage
- [ ] Supabase client correctly implements tuple comparison

### Phase 2 Checklist
- [ ] No await to external services inside transactions
- [ ] onversionchange handler closes database
- [ ] onblocked handler shows user feedback
- [ ] Batch writes (100+ records per transaction)
- [ ] Safari storage eviction handled gracefully
- [ ] Multi-tab scenario tested

### Phase 3 Checklist
- [ ] Explicit version numbers on synced entities
- [ ] Conflict resolution policy documented and implemented
- [ ] Optimistic updates have rollback handling
- [ ] Offline mutation queue implemented
- [ ] Realtime subscriptions are filtered narrowly

### Phase 4 Checklist
- [ ] maxPages set on infinite queries
- [ ] Focus management implemented
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Item state lifted to parent
- [ ] Stable keys used (not indices)

---

## Sources Summary

### Cursor Pagination
- [Keyset Cursors for Postgres](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/)
- [Five Ways to Paginate in Postgres](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/)
- [Cursor Pagination Deep Dive](https://www.milanjovanovic.tech/blog/understanding-cursor-pagination-and-why-its-so-fast-deep-dive)
- [Supabase Cursor Pagination](https://github.com/orgs/supabase/discussions/3938)

### IndexedDB
- [IndexedDB Storage Limits](https://rxdb.info/articles/indexeddb-max-storage-limit.html)
- [IndexedDB Pain Points](https://gist.github.com/pesterhazy/4de96193af89a6dd5ce682ce2adff49a)
- [Solving IndexedDB Slowness](https://rxdb.info/slow-indexeddb.html)
- [Dexie.js Limitations](https://dexie.org/docs/The-Main-Limitations-of-IndexedDB)
- [MDN Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

### Sync Protocols
- [PowerSync Conflict Resolution](https://docs.powersync.com/usage/lifecycle-maintenance/handling-update-conflicts/custom-conflict-resolution)
- [Optimistic Concurrency Control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
- [Cache Invalidation Patterns](https://algomaster.io/learn/system-design/cache-invalidation)
- [TkDodo on Optimistic Updates](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)

### Virtualization
- [TanStack Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [TanStack Virtual Examples](https://tanstack.com/virtual/v3/docs/framework/react/examples/infinite-scroll)
- [TanStack Virtual Memory Issues](https://github.com/TanStack/virtual/issues/196)
- [Optimizing Large Lists in React](https://www.ignek.com/blog/optimizing-large-lists-in-react-virtualization-vs-pagination/)

---

*Researched: 2026-01-23 | Confidence: HIGH*
