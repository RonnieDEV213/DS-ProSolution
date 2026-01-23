# Phase 12: Live Activity Feed & Concurrency - Research

**Researched:** 2026-01-22
**Domain:** Real-time streaming, Python asyncio concurrency, FastAPI SSE
**Confidence:** HIGH

## Summary

Phase 12 delivers three capabilities: (1) live activity feed in the progress detail modal showing real-time collection activity with creative visual design, (2) parallel collection execution using asyncio workers with shared work queue, and (3) seller snapshot counts for history entries. Research confirms:

- **Activity Feed:** Server-Sent Events (SSE) is the ideal transport mechanism for this use case - simpler than WebSockets, works over HTTP, and has native browser support via EventSource API.
- **Concurrency:** Python's asyncio.Queue + Semaphore pattern provides work-stealing behavior with controlled concurrency. 5 concurrent workers is the recommended starting point for Oxylabs API.
- **Seller Snapshots:** Store snapshot count with each event record (more reliable than recomputing from logs).

**Primary recommendation:** Implement SSE endpoint streaming activity events from a shared asyncio.Queue, with 5 parallel workers processing items via work-stealing pattern.

## 1. Backend Concurrency Patterns

### Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncio | stdlib | Async coordination | Built-in, no dependencies |
| asyncio.Queue | stdlib | Work-stealing distribution | Thread-safe async queue |
| asyncio.Semaphore | stdlib | Concurrency limiting | Rate limit enforcement |

### Work-Stealing Queue Pattern

The asyncio.Queue provides the foundation for work-stealing behavior:

```python
# Source: Python asyncio documentation
import asyncio

class ParallelCollectionRunner:
    def __init__(self, max_workers: int = 5):
        self.work_queue: asyncio.Queue = asyncio.Queue()
        self.max_workers = max_workers
        self.consecutive_failures = 0
        self.failure_lock = asyncio.Lock()

    async def worker(self, worker_id: int, on_activity: callable):
        """Worker pulls tasks from queue until poison pill received."""
        while True:
            task = await self.work_queue.get()
            if task is None:  # Poison pill
                break
            try:
                result = await self.process_task(task, worker_id)
                await on_activity({
                    "worker_id": worker_id,
                    "type": "task_complete",
                    "task": task,
                    "result": result
                })
            except Exception as e:
                await self.handle_failure(e)
            finally:
                self.work_queue.task_done()

    async def run(self, tasks: list, on_activity: callable):
        # Populate queue
        for task in tasks:
            await self.work_queue.put(task)

        # Add poison pills for shutdown
        for _ in range(self.max_workers):
            await self.work_queue.put(None)

        # Start workers
        workers = [
            asyncio.create_task(self.worker(i, on_activity))
            for i in range(self.max_workers)
        ]

        # Wait for all work to complete
        await asyncio.gather(*workers)
```

### Atomic Task Claiming

The asyncio.Queue handles atomic claiming - `get()` is atomic, so no two workers can claim the same task. No additional database transactions needed for task distribution.

### Shared Failure Counter

```python
async def handle_failure(self, error: Exception):
    async with self.failure_lock:
        self.consecutive_failures += 1
        if self.consecutive_failures >= 5:
            # Trigger pause across all workers
            raise CollectionPausedException("5 consecutive failures")

async def reset_failures(self):
    async with self.failure_lock:
        self.consecutive_failures = 0
```

### Concurrency Limiting with Semaphore

```python
# Source: https://rednafi.com/python/limit_concurrency_with_semaphore/
class RateLimitedWorker:
    def __init__(self, max_concurrent: int = 5):
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def make_request(self, url: str):
        async with self.semaphore:
            # Only max_concurrent requests execute simultaneously
            return await self.http_client.get(url)
```

### Recommended Concurrency: 5 Workers

Based on Oxylabs documentation:
- Web Scraper API limits to 1 req/s per domain if success rate drops below 40%
- Residential proxies have no concurrent session limits
- Conservative starting point: 5 concurrent workers
- Can be increased to 10 if no rate limiting observed

**Confidence:** HIGH - Based on Oxylabs official documentation

## 2. Real-time Activity Feed Options

### Comparison: SSE vs WebSocket vs Enhanced Polling

| Approach | Complexity | Bidirectional | Browser Support | Reconnect |
|----------|------------|---------------|-----------------|-----------|
| **SSE** | Low | No (server->client) | Native EventSource | Automatic |
| WebSocket | Medium | Yes | Native WebSocket | Manual |
| Polling | Low | No | Fetch API | Manual |

### Recommendation: Server-Sent Events (SSE)

SSE is ideal for this use case because:
1. **Unidirectional** - We only need server-to-client (activity updates)
2. **Simple** - Works over standard HTTP, no upgrade handshake
3. **Automatic reconnect** - Browser EventSource auto-reconnects on disconnect
4. **Proxy-friendly** - Works through firewalls that block WebSockets

### FastAPI SSE Implementation

```python
# Source: https://mahdijafaridev.medium.com/implementing-server-sent-events-sse-with-fastapi
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

@app.get("/collection/runs/{run_id}/activity")
async def activity_stream(run_id: str):
    async def event_generator():
        queue = get_activity_queue(run_id)
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Send keepalive
                yield ": keepalive\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

### Frontend EventSource Client

```typescript
// Source: https://medium.com/@ammarbinshakir557/implementing-server-sent-events-sse-in-node-js-with-next-js
useEffect(() => {
  const eventSource = new EventSource(
    `${API_BASE}/collection/runs/${runId}/activity`
  );

  eventSource.onmessage = (event) => {
    const activity = JSON.parse(event.data);
    setActivities(prev => [activity, ...prev].slice(0, 100)); // Buffer 100
  };

  eventSource.onerror = (error) => {
    console.error("SSE Error:", error);
    // EventSource auto-reconnects
  };

  return () => eventSource.close();
}, [runId]);
```

### Activity Event Structure

Based on CONTEXT.md requirements (full context per entry):

```typescript
interface ActivityEntry {
  id: string;           // Unique ID for React key
  timestamp: string;    // ISO timestamp
  worker_id: number;    // Worker 1, Worker 2, etc.
  phase: "amazon" | "ebay";
  action: "fetching" | "found" | "error" | "rate_limited" | "complete";

  // Context fields
  category?: string;    // e.g., "Electronics > Laptops"
  product_name?: string;
  seller_found?: string;
  price_range?: { min: number; max: number };
  parameters?: Record<string, any>;  // Search params used

  // Results
  new_sellers_count?: number;
  error_message?: string;
}
```

**Confidence:** HIGH - SSE is well-documented for FastAPI, native browser support

## 3. Seller Snapshot Implementation

### Decision: Store Snapshot Count

Two approaches considered:

1. **Store with record** - Save `seller_count_snapshot` when event completes
2. **Compute from logs** - Replay audit log to reconstruct count

**Recommendation: Store with record**

Rationale:
- More reliable - no risk of audit log corruption/gaps affecting display
- Simpler queries - single column lookup vs replay algorithm
- Minimal storage cost - one integer per event
- Already have pattern - collection_runs stores sellers_new

### Schema Changes

```sql
-- Add snapshot count to collection_runs
ALTER TABLE collection_runs
ADD COLUMN IF NOT EXISTS seller_count_snapshot INTEGER;

-- Add snapshot count to seller_audit_log for manual edits
ALTER TABLE seller_audit_log
ADD COLUMN IF NOT EXISTS seller_count_snapshot INTEGER;
```

### Implementation

```python
async def complete_collection_run(self, run_id: str, org_id: str):
    # Get current seller count
    count_result = (
        self.supabase.table("sellers")
        .select("id", count="exact")
        .eq("org_id", org_id)
        .execute()
    )
    seller_count = count_result.count or 0

    # Update run with snapshot
    self.supabase.table("collection_runs").update({
        "status": "completed",
        "seller_count_snapshot": seller_count,
        "completed_at": now,
    }).eq("id", run_id).execute()
```

**Confidence:** HIGH - Simple, reliable approach with minimal schema changes

## 4. Existing Code Analysis

### Files to Modify

| File | Changes Needed |
|------|----------------|
| `apps/api/src/app/services/collection.py` | Add parallel worker logic, activity queue, snapshot storage |
| `apps/api/src/app/routers/collection.py` | Add SSE endpoint `/runs/{run_id}/activity` |
| `apps/api/src/app/models.py` | Add ActivityEntry model |
| `apps/web/src/components/admin/collection/progress-detail-modal.tsx` | Add activity feed UI |
| `apps/web/src/components/admin/collection/progress-bar.tsx` | Remove activity text, add click handler |
| `apps/web/src/components/admin/collection/history-panel.tsx` | Display seller snapshot counts |

### Current Patterns to Leverage

1. **Background task execution** - Already uses `BackgroundTasks.add_task()` for async scraping
2. **Checkpoint JSONB** - Already stores phase, activity text, and throttle status
3. **Progress polling** - Frontend polls `/runs/{run_id}/progress` every 500ms
4. **Discriminated union pattern** - `history-panel.tsx` already merges collection runs and manual edits

### Key Observations from Codebase

1. **Current execution is sequential** - `run_amazon_collection` and `run_ebay_seller_search` process items one at a time
2. **Checkpoint already tracks activity** - `checkpoint.current_activity` exists but only updated per-product
3. **Worker status column exists** - `worker_status JSONB` in collection_runs is unused
4. **Activity prints to terminal** - Backend already prints rich activity info to console

### Migration from Current to Parallel

Current flow:
```
for product in products:
    result = await scraper.search_sellers(...)
    # Update checkpoint with current_activity
```

New flow:
```
queue = asyncio.Queue()
for product in products:
    await queue.put(product)

workers = [Worker(i, queue, activity_queue) for i in range(5)]
await asyncio.gather(*[w.run() for w in workers])
```

## 5. Recommended Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                        │
├─────────────────────────────────────────────────────────────┤
│  CollectionService                                           │
│  ├── ParallelRunner                                          │
│  │   ├── work_queue: asyncio.Queue[Task]                    │
│  │   ├── activity_queue: asyncio.Queue[ActivityEntry]       │
│  │   └── workers: list[Worker]                               │
│  │       └── Each worker pulls from work_queue,              │
│  │           pushes to activity_queue                        │
│  │                                                           │
│  └── SSE Endpoint                                            │
│      └── Streams from activity_queue to client               │
├─────────────────────────────────────────────────────────────┤
│                     Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  ProgressDetailModal                                         │
│  ├── EventSource connection to /activity                     │
│  ├── ActivityFeed component (creative visual cards)          │
│  └── activities[] state with 50-100 entry buffer            │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phases

1. **Backend Concurrency**
   - Create `ParallelCollectionRunner` class with work queue and workers
   - Implement shared failure counter with async lock
   - Modify `run_amazon_collection` and `run_ebay_seller_search` to use parallel runner
   - Store worker_id in activity events

2. **Activity Streaming**
   - Add per-run activity queue (in-memory dict keyed by run_id)
   - Create SSE endpoint `/collection/runs/{run_id}/activity`
   - Push activity events from workers to queue
   - Include keepalive pings every 15s

3. **Seller Snapshots**
   - Add `seller_count_snapshot` column to both tables
   - Capture snapshot on run completion
   - Capture snapshot on manual add/edit/remove
   - Update history panel to display snapshots

4. **Frontend Activity Feed**
   - Remove activity text from progress-bar.tsx
   - Add click handler to open detail modal
   - Create ActivityFeed component with creative card design
   - Implement EventSource subscription in modal
   - Add worker ID badges, timestamps, and rich entry content

### Activity Entry Types

```typescript
// Discriminated union for activity types
type ActivityEntry =
  | { type: "category_start"; worker_id: number; category: string; timestamp: string }
  | { type: "product_fetch"; worker_id: number; category: string; product: string; timestamp: string }
  | { type: "sellers_found"; worker_id: number; product: string; count: number; new_count: number; timestamp: string }
  | { type: "rate_limited"; worker_id: number; wait_seconds: number; timestamp: string }
  | { type: "error"; worker_id: number; message: string; timestamp: string }
  | { type: "phase_complete"; phase: "amazon" | "ebay"; timestamp: string };
```

## 6. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent request limiting | Custom thread pool | asyncio.Semaphore | Built-in, async-native |
| Work distribution | Custom scheduler | asyncio.Queue | Atomic get(), no locks needed |
| SSE streaming | Custom HTTP streaming | FastAPI StreamingResponse | Handles headers, encoding |
| Event parsing | Custom protocol | EventSource API | Native browser support |
| Reconnection logic | Manual retry loop | EventSource auto-reconnect | Built into browser |

## 7. Common Pitfalls

### Pitfall 1: Queue Exhaustion Without Poison Pills

**What goes wrong:** Workers hang forever waiting for queue items after work is done
**Why it happens:** `queue.get()` blocks until item available
**How to avoid:** Send `None` poison pills equal to worker count after all tasks queued
**Warning signs:** Process hangs after last item processed

### Pitfall 2: SSE Connection Timeout

**What goes wrong:** Client disconnects thinking server died
**Why it happens:** No data sent for extended period, proxy/browser times out
**How to avoid:** Send keepalive comments every 15 seconds: `": keepalive\n\n"`
**Warning signs:** Sporadic disconnects, reconnection loops

### Pitfall 3: Memory Leak from Activity Buffer

**What goes wrong:** Frontend memory grows unbounded during long runs
**Why it happens:** Activities accumulate without limit
**How to avoid:** Cap activities array at 50-100 entries, drop oldest
**Warning signs:** Browser tab slows down during extended runs

### Pitfall 4: Race Condition on Failure Counter

**What goes wrong:** Multiple workers increment counter simultaneously, miss threshold
**Why it happens:** No synchronization around shared counter
**How to avoid:** Use asyncio.Lock around counter access
**Warning signs:** Collection continues past 5 failures

### Pitfall 5: SSE Memory on Backend

**What goes wrong:** Activity queues accumulate for completed runs
**Why it happens:** No cleanup when run completes or client disconnects
**How to avoid:** Delete queue on run completion, use weak references
**Warning signs:** Server memory grows over time

## 8. State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential iteration | Parallel workers + Queue | Phase 12 | 5x throughput improvement |
| Polling for activity | SSE streaming | Phase 12 | Real-time updates, less load |
| Terminal text dump | Creative visual cards | Phase 12 | Better UX per CONTEXT.md |
| Compute seller count | Store snapshot | Phase 12 | Reliable history display |

## Open Questions

1. **Activity queue persistence:** If server restarts mid-run, activity history is lost. Acceptable since progress checkpoint preserves state for resume?

2. **SSE authentication:** Current polling uses Bearer token. SSE connections need auth too - pass token as query param since EventSource doesn't support headers?

3. **Multiple browser tabs:** If user opens detail modal in multiple tabs, each gets separate SSE connection. Should backend dedupe or let each tab have own stream?

**Recommendation:** Accept these as known limitations for Phase 12. Activity history loss on restart is acceptable (rare), SSE auth via query param is standard practice, multiple tabs can share data via localStorage broadcast if needed later.

## Sources

### Primary (HIGH confidence)
- [Python asyncio.Queue documentation](https://docs.python.org/3/library/asyncio-queue.html)
- [Python asyncio.Semaphore documentation](https://docs.python.org/3/library/asyncio-sync.html)
- [Oxylabs Rate Limits documentation](https://developers.oxylabs.io/scraping-solutions/web-scraper-api/usage-and-billing/rate-limits)

### Secondary (MEDIUM confidence)
- [Limit concurrency with semaphore in Python asyncio](https://rednafi.com/python/limit_concurrency_with_semaphore/)
- [Implementing SSE with FastAPI](https://mahdijafaridev.medium.com/implementing-server-sent-events-sse-with-fastapi-real-time-updates-made-simple-6492f8bfc154)
- [SSE in Next.js](https://medium.com/@ammarbinshakir557/implementing-server-sent-events-sse-in-node-js-with-next-js-a-complete-guide-1adcdcb814fd)
- [Streaming in Next.js 15: WebSockets vs SSE](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events)

### Existing Codebase (HIGH confidence)
- `apps/api/src/app/services/collection.py` - Current sequential execution
- `apps/api/src/app/services/db_utils.py` - Batched operations pattern
- `apps/api/migrations/040_enhanced_progress.sql` - worker_status JSONB exists
- `apps/web/src/components/admin/collection/progress-detail-modal.tsx` - Modal structure

## Metadata

**Confidence breakdown:**
- Backend concurrency patterns: HIGH - Python stdlib, well-documented
- SSE implementation: HIGH - FastAPI native support, browser standard
- Seller snapshots: HIGH - Simple schema addition, clear tradeoffs
- Oxylabs limits: MEDIUM - Documentation found, but "micro plan" specifics unclear

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (stable patterns, unlikely to change)
