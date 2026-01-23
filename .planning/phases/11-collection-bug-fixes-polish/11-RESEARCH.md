# Phase 11: Collection Bug Fixes & Polish - Research

**Researched:** 2026-01-22
**Domain:** React polling, Supabase real-time, FastAPI progress tracking, audit log replay
**Confidence:** HIGH

## Summary

This phase focuses on fixing bugs in the collection page's progress tracking, history display, and evaluating concurrency settings. The codebase analysis reveals several specific areas where bugs likely originate, based on the success criteria gaps.

The current implementation uses a polling-based approach (1-second interval) for progress updates. The backend updates progress counters in the database after each API call completes. The frontend polls the `/collection/runs/{run_id}/progress` endpoint which reads these counters.

**Primary issues identified:**
1. Progress bar updates may appear delayed because polling interval (1s) can miss rapid backend updates
2. Category/department completion logic is correctly implemented in backend but may have edge cases
3. History "sellers at this point" uses audit log replay which has bulk operation handling issues
4. Run detail modal fetches from history endpoint instead of dedicated run endpoint (no category_ids returned)
5. Category breakdown shows placeholder text instead of real data
6. Concurrency slider exists but is marked "(Coming soon)" - not wired to backend

## Standard Stack

The project uses established patterns that are working well:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js 14) | 14.x | Frontend framework | App Router with client components |
| FastAPI | Latest | Backend API | Async Python with Pydantic models |
| Supabase | Latest | Database + Auth | PostgreSQL with RLS |
| react-window | v2 | Virtualized grid | Efficient rendering of large seller lists |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | Latest | Date formatting | formatDistanceToNow, format |
| sonner | Latest | Toast notifications | User feedback (toast.success/error) |
| framer-motion | Latest | Animations | Phase badge transitions |

**No new libraries needed.** All bugs are fixable with existing stack.

## Architecture Patterns

### Current Progress Flow (Polling)

```
Frontend (1s poll)                 Backend
    |                                 |
    |-- GET /progress --------------->|
    |                                 | Read collection_runs row
    |<-------- progress data ---------|
    |                                 |
    | Update React state              |
    | Re-render progress bar          |
```

### Progress Data Structure

```typescript
interface EnhancedProgress {
  phase: "amazon" | "ebay";
  departments_total: number;
  departments_completed: number;
  categories_total: number;
  categories_completed: number;
  products_found: number;    // Amazon phase
  products_total: number;    // eBay phase
  products_searched: number; // eBay phase
  sellers_found: number;
  sellers_new: number;
  started_at?: string;
  checkpoint?: {
    status?: "rate_limited" | "paused_failures";
    waiting_seconds?: number;
    current_category?: string;
    phase?: string;
  };
}
```

### Audit Log Replay Pattern (get_sellers_at_log)

```python
# Current implementation in collection.py:823-871
# Replays audit log entries to reconstruct seller state
sellers: set[str] = set()
for entry in entries:
    if entry["action"] == "add":
        sellers.add(entry["seller_name"])
    elif entry["action"] == "remove":
        sellers.discard(entry["seller_name"])
    elif entry["action"] == "edit":
        # Remove old name, add new name
```

**Issue:** Bulk operations store summary names like "seller1 (+49 more)" but full names are in JSON new_value field.

### Progress Calculation (Backend)

```python
# Amazon phase: categories drive progress
progress_percent = categories_completed / categories_total * 100

# eBay phase: products drive progress
progress_percent = products_searched / products_total * 100

# Department completion: only when ALL categories in that dept complete
departments_completed = count(depts where all cats complete)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time updates | WebSocket | Existing polling | 1s is acceptable for this use case |
| Progress persistence | localStorage | Backend checkpoint | Already stored in collection_runs.checkpoint |
| Undo/redo stack | Custom state | React state + API | Need audit log for history anyway |

## Bug Analysis - Root Causes

### Bug 1: Progress bar polling delay visible to user

**What goes wrong:** User perceives delay between backend completion and UI update
**Root cause:**
- Polling at 1s intervals means up to 1s delay
- Backend updates database synchronously after each category/product
- No issue with data freshness, purely perception

**Evidence in code:**
```typescript
// use-collection-polling.ts:42
export function useCollectionPolling(pollingInterval = 1000) {
```

**Fix approach:**
- Reduce polling to 500ms during active collection
- Use optimistic updates for predicted progress
- Or accept 1s as reasonable (most users won't notice)

### Bug 2: Category/department completion shown prematurely

**What goes wrong:** Category shows complete before all products searched
**Root cause:** Current logic correctly tracks per-category completion:
```python
# collection.py:1604-1609
for cid, product_ids in products_by_category.items():
    if len(searched_by_category.get(cid, set())) >= len(product_ids):
        categories_completed += 1
```
**But** the frontend doesn't re-fetch totals after Amazon phase. During eBay phase, `categories_total` should reflect categories being searched, not original Amazon categories.

**Fix approach:** Backend should set distinct totals for each phase, or frontend should use phase-appropriate totals.

### Bug 3: Progress bar doesn't persist across refresh

**What goes wrong:** User refreshes page, progress bar shows 0%
**Root cause:** Not a bug - the `useCollectionPolling` hook correctly fetches active run and progress on mount:
```typescript
// use-collection-polling.ts:126-127
// Initial check
poll();
```

**Actually working correctly.** Progress IS restored from backend. If user sees 0%, it's because:
1. Run completed/cancelled while refreshing
2. Network error on initial fetch (silently ignored)

**Verify:** Add error state display for failed initial fetch.

### Bug 4: History "sellers at this point" shows inaccurate count

**What goes wrong:** Count doesn't match actual sellers at that moment
**Root cause:** Bulk operations store summary in `seller_name` field:
```python
# collection.py:655-656
summary = f"{added_names[0]}" if success_count == 1 else f"{added_names[0]} (+{success_count - 1} more)"
```

The replay logic in `get_sellers_at_log` only reads `seller_name`, not the full list from `new_value` JSON:
```python
# collection.py:851-856
if entry["action"] == "add":
    sellers.add(entry["seller_name"])  # Only adds summary, not all names!
```

**Fix approach:** Parse `new_value` JSON for bulk adds to get full names list.

### Bug 5: Run detail modal shows placeholder data

**What goes wrong:** Modal says "Detailed category breakdown coming soon"
**Root cause:** Intentional placeholder in code:
```tsx
// hierarchical-run-modal.tsx:285-289
<div className="mt-3 p-3 bg-gray-800/30 rounded border border-gray-700/50 text-center flex-shrink-0">
  <p className="text-xs text-gray-500">
    Detailed category breakdown coming soon
  </p>
</div>
```

**Fix approach:**
- Fetch category breakdown data from backend
- Need new endpoint or add to history response: per-category sellers_found counts
- Store category_id on sellers table or track in collection_items

### Bug 6: Category breakdown shows no real data

**What goes wrong:** No per-category statistics displayed
**Root cause:** Data exists in `collection_items` table (category_id in data JSONB) but no endpoint aggregates it.

**Fix approach:**
1. Add endpoint: `/collection/runs/{run_id}/breakdown`
2. Query collection_items, group by category_id
3. Return counts per category

### Bug 7: Concurrency not configurable

**What goes wrong:** Slider exists but doesn't affect collection
**Root cause:** UI shows slider but it's not wired:
```tsx
// run-config-modal.tsx:306-309
<Slider ... />
<p className="text-xs text-gray-500">(Coming soon)</p>
```

Backend has `max_concurrent_runs` in `collection_settings` but this controls number of parallel RUNS, not concurrent API requests within a run.

**Current concurrency settings (db_utils.py):**
```python
QUERY_BATCH_SIZE = 150    # URL length limit
INSERT_BATCH_SIZE = 500   # Supabase optimal
MAX_CONCURRENT = 15       # Parallel requests
```

**Fix approach:**
- Keep slider as UI for future feature
- Or remove slider to avoid confusion
- Current hardcoded values are reasonable for Oxylabs rate limits

## Common Pitfalls

### Pitfall 1: Audit Log Bulk Operation Names
**What goes wrong:** Replay produces wrong seller count
**Why it happens:** Bulk ops store summary not full list
**How to avoid:** Always parse new_value JSON for adds
**Warning signs:** Seller count doesn't match expected after bulk add

### Pitfall 2: Phase-Specific Progress
**What goes wrong:** Progress percentage jumps unexpectedly
**Why it happens:** Amazon and eBay phases have different denominators
**How to avoid:** Track phase in state, use phase-appropriate calculation
**Warning signs:** Progress goes from 100% to 0% on phase change (intended behavior per CONTEXT.md)

### Pitfall 3: Race Condition on Rapid Polling
**What goes wrong:** UI flickers between states
**Why it happens:** Multiple poll responses arrive out of order
**How to avoid:** Ignore responses older than current state timestamp
**Warning signs:** Progress bar jumps backward briefly

### Pitfall 4: History Modal Data Source
**What goes wrong:** HierarchicalRunModal can't find run details
**Why it happens:** Fetches from `/history` endpoint which only returns terminal runs
**How to avoid:** Use dedicated `/runs/{run_id}` endpoint for details
**Warning signs:** "Run not found" for valid run IDs

## Code Examples

### Current Progress Bar Calculation

```typescript
// progress-bar.tsx:118-130
const getProgressPercent = () => {
  if (phase === "amazon") {
    return progress.categories_total > 0
      ? (progress.categories_completed / progress.categories_total) * 100
      : 0;
  } else {
    return progress.products_total > 0
      ? (progress.products_searched / progress.products_total) * 100
      : 0;
  }
};
```

### Backend Progress Update (eBay Phase)

```python
# collection.py:1627-1641
self.supabase.table("collection_runs").update({
    "checkpoint": {...},
    "processed_items": products_processed,
    "products_searched": products_processed,
    "categories_completed": categories_completed,
    "departments_completed": departments_completed,
    "sellers_found": sellers_found,
    "sellers_new": sellers_new,
    "updated_at": datetime.now(timezone.utc).isoformat(),
}).eq("id", run_id).execute()
```

### Audit Log Entry Structure

```python
# Bulk add entry in seller_audit_log table
{
    "action": "add",
    "seller_name": "seller1 (+49 more)",  # Summary
    "new_value": '{"names": ["seller1", "seller2", ...]}',  # Full list
    "affected_count": 50
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single run | Two-phase (Amazon then eBay) | Phase-specific progress metrics |
| products_total only | products_found (Amazon) + products_searched (eBay) | Clearer progress per phase |
| Flat progress | Hierarchical (dept/cat/product) | More granular tracking |

**Current approach is correct.** Issues are implementation bugs, not architectural.

## Open Questions

1. **Should polling interval be configurable?**
   - Current: Fixed 1000ms
   - Could allow user preference or adaptive polling
   - Recommendation: Keep fixed, 500ms during active run is fine

2. **Category breakdown data storage**
   - Option A: Add to collection_runs as JSONB (denormalized)
   - Option B: Query collection_items on demand (normalized)
   - Recommendation: Option B - data already exists in collection_items.data.category_id

3. **Undo/redo implementation scope**
   - CONTEXT.md specifies: "Unlimited undo within session"
   - Need to decide: client-side undo stack vs server-side soft delete
   - Recommendation: Client-side stack of seller IDs + re-add on undo

## Sources

### Primary (HIGH confidence)
- `apps/web/src/hooks/use-collection-polling.ts` - Polling implementation
- `apps/api/src/app/services/collection.py` - Progress tracking and audit log
- `apps/web/src/components/admin/collection/progress-bar.tsx` - Progress display
- `apps/web/src/components/admin/collection/log-detail-modal.tsx` - History display
- `apps/api/migrations/040_enhanced_progress.sql` - Database schema

### Secondary (MEDIUM confidence)
- Success criteria from phase description (requirements)
- CONTEXT.md decisions from discuss phase

## Metadata

**Confidence breakdown:**
- Progress bar mechanics: HIGH - direct code analysis
- History accuracy: HIGH - identified specific bug in audit log replay
- Run detail modal: HIGH - placeholder text confirmed in code
- Concurrency settings: HIGH - "(Coming soon)" comment in code
- Undo/redo: MEDIUM - specified in CONTEXT.md but not yet implemented

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (stable codebase, bug fixes phase)
