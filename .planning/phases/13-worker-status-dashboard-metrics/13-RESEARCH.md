# Phase 13: Worker Status Dashboard & Metrics - Research

**Researched:** 2026-01-23
**Domain:** Real-time worker monitoring, SSE streaming, React state management
**Confidence:** HIGH

## Summary

Phase 13 transforms the progress detail modal from a single activity feed into a 2-panel worker status dashboard with per-worker cards, detailed metrics, and a data pipeline feed. The core infrastructure (SSE streaming, activity events, worker identification) already exists in Phase 12. This phase extends the event structure with richer metadata and builds new frontend components to visualize per-worker activity.

The implementation is primarily frontend work with targeted backend enhancements. The ActivityEvent dataclass and SSE streaming are production-ready. The main gaps are:
1. Activity events lack granular worker state (URL, API params, timing, phase)
2. No per-worker metrics aggregation (API stats, output stats, error breakdown)
3. No data pipeline events (upload operations, deduplication)
4. Frontend needs complete redesign of progress-detail-modal.tsx

**Primary recommendation:** Extend ActivityEvent with rich metadata fields, add new action types for pipeline operations, and build a modular React component structure for the 2-panel layout.

## Current State Analysis

### 1. Activity Event Structure (Backend)

**File:** `apps/api/src/app/services/parallel_runner.py`

```python
@dataclass
class ActivityEvent:
    """Activity event for SSE streaming."""
    id: str
    timestamp: str
    worker_id: int
    phase: str  # "amazon" or "ebay"
    action: str  # "fetching", "found", "error", "rate_limited", "complete"
    category: str | None = None
    product_name: str | None = None
    seller_found: str | None = None
    new_sellers_count: int | None = None
    error_message: str | None = None
```

**What exists:**
- Worker identification (worker_id 1-5, 0 for system)
- Phase tracking (amazon/ebay)
- Basic actions (fetching, found, error, rate_limited, complete)
- Category and product context
- Error message capture

**What's missing for Phase 13:**
- URL being hit
- API parameters (price range, search query, node ID)
- Request duration (start time, end time)
- Request attempt number (for retries)
- Error type classification (rate_limit vs timeout vs http_error vs parse_error)
- Seller count breakdown (found vs new vs deduped)

### 2. Activity Stream Manager (Backend)

**File:** `apps/api/src/app/services/activity_stream.py`

```python
class ActivityStreamManager:
    """Singleton manager for activity streams."""
    _streams: dict[str, asyncio.Queue] = {}

    async def push(self, run_id: str, event: dict[str, Any]):
        """Push event to run's queue. Drops oldest if full (100 events)."""
```

**Status:** Production-ready, no changes needed.

### 3. SSE Endpoint (Backend)

**File:** `apps/api/src/app/routers/collection.py`

```python
@router.get("/runs/{run_id}/activity")
async def stream_activity(run_id: str, ...):
    """Stream real-time activity events for a collection run via SSE."""
```

**Status:** Production-ready. Uses 15-second keepalive, handles auth via query param or header.

### 4. Frontend Activity Feed

**File:** `apps/web/src/components/admin/collection/activity-feed.tsx`

```typescript
export interface ActivityEntry {
  id: string;
  timestamp: string;
  worker_id: number;
  phase: "amazon" | "ebay";
  action: "fetching" | "found" | "error" | "rate_limited" | "complete";
  category?: string;
  product_name?: string;
  seller_found?: string;
  new_sellers_count?: number;
  error_message?: string;
}
```

**Status:** Displays activity cards with worker badge, phase indicator, action content.

### 5. Progress Detail Modal (Frontend)

**File:** `apps/web/src/components/admin/collection/progress-detail-modal.tsx`

**Current layout:**
- Single-column modal (max-w-2xl)
- Summary stats (phase indicator, new sellers)
- Duration display
- Hierarchical progress bars (departments, categories, products)
- Activity feed (live updates via SSE)
- Cancel button

**What needs to change for Phase 13:**
- 2-panel layout (workers left, metrics right)
- 5 worker status cards (always visible)
- Click-to-expand worker detail view
- Data pipeline feed
- Per-worker metrics
- Error breakdown

### 6. Error Types in Scrapers

**Amazon (oxylabs.py):**
- `rate_limited` - HTTP 429
- `timeout` - httpx.TimeoutException
- `http_error:{status}` - httpx.HTTPStatusError
- `empty_response` - No results
- Generic exception string

**eBay (oxylabs_ebay.py):**
- `rate_limited` - HTTP 429
- `timeout` - httpx.TimeoutException
- `http_error:{status}` - httpx.HTTPStatusError
- `empty_response` - No results
- `{ExceptionType}: {message}` - Generic

**Parse errors (implicit):**
- Product parsing failure (logged, continues)
- Seller regex extraction failure (returns empty)
- Price parsing failure (skips product)

### 7. Data Pipeline Operations

**Where they happen (collection.py):**

| Operation | Location | Current Logging |
|-----------|----------|-----------------|
| Product batch insert | `run_amazon_collection` L1383-1384 | None to SSE |
| Seller existence check | `run_ebay_seller_search` L1712-1719 | None |
| Seller deduplication | `run_ebay_seller_search` L1724-1744 | None |
| Existing seller update | `run_ebay_seller_search` L1746-1757 | None |
| New seller insert | `run_ebay_seller_search` L1760-1768 | Print only |

## Data/Event Gaps (What's Missing)

### Gap 1: Rich Worker State Events

**Required new fields on ActivityEvent:**

```python
@dataclass
class ActivityEvent:
    # ... existing fields ...

    # NEW: Request details (for transparency)
    url: str | None = None                    # Full URL being hit
    api_params: dict | None = None            # {query, price_min, price_max, node_id, page}

    # NEW: Timing
    duration_ms: int | None = None            # Request duration
    started_at: str | None = None             # ISO timestamp when request began

    # NEW: Retry context
    attempt: int | None = None                # 1, 2, 3 for retry attempts

    # NEW: Error classification
    error_type: str | None = None             # "rate_limit", "timeout", "http_500", "parse_error"
    error_stage: str | None = None            # "api", "product_extraction", "seller_extraction", "price_parsing"
```

### Gap 2: Data Pipeline Events

**New action types needed:**

```python
# Pipeline actions (worker_id=0 for system operations)
action: Literal[
    # Existing
    "fetching", "found", "error", "rate_limited", "complete",
    # NEW pipeline actions
    "uploading",        # "Uploading 25 products from category X"
    "deduped",          # "Deduped 12 duplicate sellers"
    "inserted",         # "Inserted 15 new sellers"
    "updated",          # "Updated 8 existing sellers (last_seen_run_id)"
]
```

**New fields for pipeline events:**

```python
# Pipeline context
items_count: int | None = None        # Number of items affected
source_worker_id: int | None = None   # Which worker produced this data
operation_type: str | None = None     # "product_batch", "seller_dedupe", "seller_insert"
```

### Gap 3: Per-Worker Metrics Aggregation

**Required metrics per worker:**

```typescript
interface WorkerMetrics {
  worker_id: number;

  // API stats
  api_requests_total: number;
  api_requests_success: number;
  api_requests_failed: number;
  api_retries: number;
  avg_response_time_ms: number;

  // Output stats
  products_found: number;        // Amazon phase
  sellers_found: number;         // eBay phase
  sellers_new: number;

  // Error breakdown
  errors_by_type: Record<string, number>;  // {rate_limit: 2, timeout: 1, parse_error: 3}
  parse_errors_by_stage: Record<string, number>;  // {product_extraction: 1, seller_extraction: 2}

  // Category breakdown
  categories_processed: string[];
}
```

**Implementation options:**
1. **Client-side aggregation** - Accumulate from SSE events in React state
2. **Server-side aggregation** - Store in memory during run, emit periodic summary events

**Recommendation:** Client-side aggregation. Events already contain worker_id; frontend can maintain a `Map<worker_id, WorkerMetrics>` that updates on each event.

### Gap 4: Worker Status State Machine

**Worker states for UI:**

```typescript
type WorkerState =
  | "idle"                  // No current task, muted styling
  | "searching_products"    // Amazon phase: fetching bestsellers
  | "returning_products"    // Amazon phase: processing results
  | "searching_sellers"     // eBay phase: searching eBay
  | "returning_sellers"     // eBay phase: processing/inserting sellers
  | "rate_limited"          // Waiting due to rate limit
  | "error"                 // Last request failed
  | "complete";             // Finished all work
```

**Derivation:** Infer from most recent event per worker_id.

## Implementation Approach

### Backend Changes

#### 1. Extend ActivityEvent (parallel_runner.py)

Add new optional fields to ActivityEvent dataclass. Backward compatible - existing code continues working.

#### 2. Emit Richer Events (collection.py)

Update `process_category` and `process_product` to include:
- Request URL and parameters
- Timing (capture start time, calculate duration)
- Attempt number for retries
- Error classification

#### 3. Add Pipeline Events (collection.py)

Emit events for:
- Batch product inserts: `action="uploading", items_count=N, category=X`
- Seller deduplication: `action="deduped", items_count=N, source_worker_id=X`
- New seller inserts: `action="inserted", items_count=N, source_worker_id=X`
- Existing seller updates: `action="updated", items_count=N`

### Frontend Changes

#### 1. New Component Structure

```
progress-detail-modal.tsx          # Shell - 2 panel layout, expand/collapse logic
├── worker-status-panel.tsx        # Left panel - 5 worker cards
│   ├── worker-card.tsx            # Single worker card
│   └── worker-detail-view.tsx     # Expanded single worker view
├── metrics-panel.tsx              # Right panel container
│   ├── pipeline-feed.tsx          # Scrolling data pipeline feed
│   ├── metrics-summary.tsx        # Aggregated stats
│   └── error-breakdown.tsx        # Error type breakdown
└── activity-feed.tsx              # Existing, reused in worker-detail-view
```

#### 2. State Management

```typescript
// In progress-detail-modal.tsx
const [expandedWorkerId, setExpandedWorkerId] = useState<number | null>(null);
const [workerMetrics, setWorkerMetrics] = useState<Map<number, WorkerMetrics>>(new Map());
const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);

// On SSE event:
// 1. If worker_id > 0: Update workerMetrics[worker_id]
// 2. If action is pipeline: Add to pipelineEvents
// 3. Always: Add to activities (existing)
```

#### 3. Extended ActivityEntry Type

```typescript
export interface ActivityEntry {
  // Existing fields
  id: string;
  timestamp: string;
  worker_id: number;
  phase: "amazon" | "ebay";
  action: string;  // Extended with new actions
  category?: string;
  product_name?: string;
  seller_found?: string;
  new_sellers_count?: number;
  error_message?: string;

  // NEW fields
  url?: string;
  api_params?: {
    query?: string;
    price_min?: number;
    price_max?: number;
    node_id?: string;
    page?: number;
  };
  duration_ms?: number;
  started_at?: string;
  attempt?: number;
  error_type?: string;
  error_stage?: string;
  items_count?: number;
  source_worker_id?: number;
  operation_type?: string;
}
```

## Critical Files to Modify

### Backend (apps/api/src/app)

| File | Changes |
|------|---------|
| `services/parallel_runner.py` | Extend ActivityEvent with new fields |
| `services/collection.py` | Emit richer events, add pipeline events |
| `services/scrapers/oxylabs.py` | Return URL and params in ScrapeResult (optional) |
| `services/scrapers/oxylabs_ebay.py` | Return URL and params in EbaySearchResult (optional) |

### Frontend (apps/web/src)

| File | Changes |
|------|---------|
| `components/admin/collection/progress-detail-modal.tsx` | Complete rewrite - 2-panel layout |
| `components/admin/collection/activity-feed.tsx` | Extend ActivityEntry type |
| NEW: `components/admin/collection/worker-status-panel.tsx` | Left panel with worker cards |
| NEW: `components/admin/collection/worker-card.tsx` | Individual worker card |
| NEW: `components/admin/collection/worker-detail-view.tsx` | Expanded worker view |
| NEW: `components/admin/collection/metrics-panel.tsx` | Right panel container |
| NEW: `components/admin/collection/pipeline-feed.tsx` | Data pipeline scroll feed |
| NEW: `components/admin/collection/metrics-summary.tsx` | Aggregate metrics display |

## Risk Areas / Complexity Assessment

### Low Risk

1. **ActivityEvent extension** - Additive change, backward compatible
2. **Pipeline events** - New event types, no existing code affected
3. **Type extensions** - TypeScript interfaces are additive
4. **Component structure** - New files, modular architecture

### Medium Risk

1. **Progress detail modal rewrite** - Major UI change, but isolated to one component
2. **Client-side metrics aggregation** - Need to handle edge cases (late events, reconnection)
3. **Worker state derivation** - State machine logic complexity

### Potential Issues

1. **Event volume** - With 5 workers + pipeline events, event rate increases. Mitigation: 100-event buffer already handles this.

2. **SSE reconnection** - If connection drops, client loses events. Mitigation:
   - Show "Reconnecting..." state
   - Metrics reset on reconnect (acceptable for real-time dashboard)

3. **Modal performance** - Many updating elements. Mitigation:
   - Use React.memo for worker cards
   - Debounce metrics recalculation
   - Virtualize pipeline feed if needed

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single activity feed | 2-panel worker + metrics | Better visibility into parallel execution |
| Aggregate progress only | Per-worker status cards | Debugging individual worker issues |
| No error breakdown | Categorized error types | Better diagnosis of API vs parse issues |
| No pipeline visibility | Live pipeline feed | Understanding data flow |

## Open Questions

1. **Metrics persistence** - Should per-worker metrics survive modal close/reopen during a run?
   - Recommendation: Reset on modal open, accumulate from SSE stream
   - Alternative: Store in useCollectionPolling hook

2. **Historical worker metrics** - After run completes, can we see per-worker breakdown?
   - Current: No, events are ephemeral
   - If needed: Add worker_metrics JSONB to collection_runs table
   - Recommendation: Defer to future phase

3. **Error message truncation** - Some error messages are very long
   - Recommendation: Truncate to 100 chars with tooltip for full message

## Sources

### Primary (HIGH confidence)
- Direct code analysis of:
  - `apps/api/src/app/services/parallel_runner.py`
  - `apps/api/src/app/services/collection.py`
  - `apps/api/src/app/services/activity_stream.py`
  - `apps/api/src/app/routers/collection.py`
  - `apps/web/src/components/admin/collection/progress-detail-modal.tsx`
  - `apps/web/src/components/admin/collection/activity-feed.tsx`

### Secondary (HIGH confidence)
- `13-CONTEXT.md` - User decisions from discussion phase
- `STATE.md` - Prior decisions from v2 milestone

## Metadata

**Confidence breakdown:**
- Current state analysis: HIGH - Direct code review
- Data gaps: HIGH - Systematic comparison of required vs existing
- Implementation approach: HIGH - Extends proven patterns from Phase 12
- Risk assessment: MEDIUM - Some unknowns in client-side aggregation performance

**Research date:** 2026-01-23
**Valid until:** 2026-02-23 (30 days - stable domain, no external dependencies)
