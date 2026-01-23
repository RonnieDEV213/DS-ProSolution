# Phase 6: Collection Infrastructure - Research

**Researched:** 2026-01-20
**Domain:** Background job framework, database schema, budget controls
**Confidence:** HIGH

## Summary

This phase establishes the foundation for the collection pipeline: database schema for jobs/state, job framework with checkpointing, and budget controls. The codebase has clear patterns to follow - background tasks in `background.py`, migrations numbered sequentially, routers with permission guards, and admin UI with tabbed interfaces. The critical insight is that the existing background worker pattern is simple (periodic cleanup) while collection requires a more sophisticated job manager with state persistence, progress tracking, and crash recovery.

The recommended approach: extend the existing `background.py` pattern with a dedicated `CollectionService` that manages long-running collection jobs. Store job state in PostgreSQL for crash recovery. Use WebSocket for real-time progress (user preference in CONTEXT.md), with polling fallback. Budget controls are enforced server-side before any API calls.

**Primary recommendation:** Build on existing patterns but add proper job state management with checkpointing - this is the critical difference from the simple cleanup worker.

## Phase Context

### From CONTEXT.md (User Decisions - Locked)

**Budget Controls:**
- Detailed cost breakdown before starting (per-category estimates)
- Tiered enforcement: soft warning at 80%, hard block at 100%
- Global admin setting for budget cap (not per-run)
- Budget cap applies per individual run

**Job Triggering:**
- Add to existing `/admin/automation` page (new tab)
- Full review dialog before starting: modal with categories, estimates, confirm
- Multiple collections can run in parallel
- Optional custom name for runs (auto-generated default)

**Progress Visibility:**
- Real-time via WebSocket (user preference)
- Progressive data availability (items usable immediately)
- Summary + expandable live feed
- Timeline view for history
- Status badge in nav (not toast)

**Failure Handling:**
- Individual item failures: skip immediately (no retry)
- API provider down: pause, wait, auto-resume when recovers
- Failed items: detailed log visible in run details
- Server restart: auto-resume from checkpoint

### From Project Research (SUMMARY.md)

- Oxylabs pricing: $0.40-0.50/1K requests, $49/month Micro plan (98K results/month)
- Recommended components: CollectionService, AmazonApiService, EbayApiService, Collection Router
- Database tables: `sellers`, `collection_runs`, `collection_items`
- Critical pitfalls: unbounded cost explosion, long-running job timeout, checkpointing every 100 products

## Existing Patterns (What to Follow)

### Migration Pattern
**Location:** `apps/api/migrations/NNN_name.sql`
**Current highest:** 036_presence_system.sql
**Next migration:** 037_collection_infrastructure.sql

**Pattern from 035_access_codes.sql:**
```sql
-- Migration: NNN_name.sql
-- Purpose: [description]
-- Phase: [phase reference]

-- ============================================================
-- 1. Table Name
-- ============================================================
-- [Description of what table stores]

CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  -- fields...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_table_field ON table_name(field);

-- RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_table" ON table_name
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**Key observations:**
- UUIDs for all primary keys
- `org_id` foreign key with CASCADE delete
- TIMESTAMPTZ for all timestamps
- RLS enabled with service_role bypass
- Descriptive comments with numbered sections

### Background Worker Pattern
**Location:** `apps/api/src/app/background.py`

**Current pattern (simple periodic task):**
```python
async def cleanup_worker():
    """Background worker that runs cleanup periodically."""
    logger.info("Starting background cleanup worker")
    while True:
        await cleanup_stale_replacing_agents()
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
```

**Started in main.py via lifespan:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _cleanup_task
    _cleanup_task = asyncio.create_task(cleanup_worker())
    yield
    if _cleanup_task:
        _cleanup_task.cancel()
```

**Gap:** Current pattern is for periodic cleanup, not long-running jobs with state. Need to extend for collection jobs that:
- Have persistent state (database-backed)
- Support multiple concurrent runs
- Resume after server restart
- Track per-item progress

### Router Pattern
**Location:** `apps/api/src/app/routers/*.py`

**Pattern from automation.py:**
```python
router = APIRouter(prefix="/automation", tags=["automation"])

@router.get("/endpoint", response_model=ResponseModel)
async def endpoint_name(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """Docstring describing endpoint."""
    supabase = get_supabase()
    # ... implementation
    return ResponseModel(...)
```

**Key patterns:**
- `APIRouter` with prefix and tags
- Pydantic response models
- Permission checking via `require_permission_key("admin.xxx")`
- Service role Supabase client for database access
- Detailed docstrings

### Service Pattern
**Location:** `apps/api/src/app/services/*.py`

**Pattern from access_code.py:**
```python
"""Service description.

This module handles:
- Thing 1
- Thing 2
"""

# Constants
CONSTANT_VALUE = 123

# Functions
def public_function(arg: str) -> str:
    """Function docstring."""
    return result
```

**Key patterns:**
- Module docstring describing purpose
- Constants at top
- Pure functions (no class needed for stateless operations)
- Type hints throughout

### Admin UI Pattern
**Location:** `apps/web/src/app/admin/*/page.tsx`

**Pattern from automation/page.tsx:**
```tsx
"use client";

import { useState } from "react";

type Tab = "tab1" | "tab2";
const tabs: { id: Tab; label: string }[] = [
  { id: "tab1", label: "Tab 1" },
  { id: "tab2", label: "Tab 2" },
];

export default function PageName() {
  const [activeTab, setActiveTab] = useState<Tab>("tab1");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => setRefreshTrigger((n) => n + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Page Title</h1>
        <p className="text-gray-400 mt-1">Description</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-4">
          {tabs.map((tab) => (/* ... */))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "tab1" && <Tab1Component />}
    </div>
  );
}
```

**Key patterns:**
- "use client" for interactive pages
- Tab-based navigation within admin pages
- `refreshTrigger` pattern for parent-triggered refreshes
- Gray-950 backgrounds, gray-800 borders
- Tailwind utility classes

### Polling Pattern (Frontend)
**Location:** `apps/web/src/hooks/use-automation-polling.ts`

```tsx
export function useAutomationPolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 5000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // ... visibility-aware polling
}
```

**Note:** User requested WebSocket for real-time updates, but this polling hook exists as fallback pattern.

## Standard Stack

### Core Dependencies (Already in Project)
| Library | Purpose | Notes |
|---------|---------|-------|
| FastAPI | API framework | Already used |
| Pydantic | Request/response models | Already used |
| supabase-py | Database client | Already used |
| asyncio | Async background tasks | Already used |

### New Dependencies Needed
| Library | Purpose | Why |
|---------|---------|-----|
| None required for Phase 6 | | Phase 6 is infrastructure only - no external API calls |

**Note:** `httpx` for Oxylabs API will be added in Phase 7 (Amazon integration).

## Architecture Patterns

### Recommended Database Schema

```sql
-- ============================================================
-- 1. collection_settings (Global admin settings)
-- ============================================================
CREATE TABLE collection_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES orgs(id),
  budget_cap_cents INT NOT NULL DEFAULT 2500,  -- $25 default
  soft_warning_percent INT NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- ============================================================
-- 2. collection_runs (Job state)
-- ============================================================
CREATE TABLE collection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL,  -- "Collection 2026-01-20 14:30" or custom
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),

  -- Cost tracking
  estimated_cost_cents INT NOT NULL,
  actual_cost_cents INT NOT NULL DEFAULT 0,
  budget_cap_cents INT NOT NULL,  -- Snapshot at run start

  -- Progress tracking
  total_items INT NOT NULL DEFAULT 0,
  processed_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,

  -- Checkpoint for resume (JSONB for flexibility)
  checkpoint JSONB,  -- {current_category_id, current_item_index, ...}

  -- Categories selected (array of IDs)
  category_ids TEXT[] NOT NULL,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- ============================================================
-- 3. collection_items (Per-item log)
-- ============================================================
CREATE TABLE collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,

  -- Item identity
  item_type TEXT NOT NULL CHECK (item_type IN ('amazon_product', 'ebay_seller')),
  external_id TEXT NOT NULL,  -- ASIN or seller ID

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),

  -- Data (JSONB for flexibility during API integration)
  data JSONB,

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Cost tracking
  cost_cents INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. sellers (Deduplicated master list)
-- ============================================================
CREATE TABLE sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),

  -- Identity
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,  -- lowercase, stripped for dedup
  platform TEXT NOT NULL CHECK (platform IN ('ebay')),
  platform_id TEXT,  -- eBay seller ID if available

  -- Source tracking
  first_seen_run_id UUID REFERENCES collection_runs(id),
  last_seen_run_id UUID REFERENCES collection_runs(id),
  times_seen INT NOT NULL DEFAULT 1,

  -- Metadata (optional, Phase 4)
  feedback_score INT,
  item_count INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT sellers_unique_normalized UNIQUE (org_id, normalized_name, platform)
);
```

### Job State Machine

```
pending -> running -> completed
              |
              +-> paused -> running (resume)
              |
              +-> failed
              |
              +-> cancelled

Transitions:
- pending -> running: User triggers start
- running -> paused: API rate limited / user pause
- paused -> running: API recovers / user resume
- running -> completed: All items processed
- running -> failed: Unrecoverable error
- any -> cancelled: User cancels
```

### Collection Service Architecture

```python
# apps/api/src/app/services/collection.py

class CollectionService:
    """Orchestrates collection runs with checkpointing."""

    def __init__(self, supabase: Client):
        self.supabase = supabase

    async def estimate_cost(
        self,
        category_ids: list[str]
    ) -> CostEstimate:
        """Calculate estimated API cost before starting."""
        # Per-category breakdown
        # Total estimate
        pass

    async def create_run(
        self,
        org_id: str,
        user_id: str,
        name: str | None,
        category_ids: list[str],
        estimated_cost_cents: int,
        budget_cap_cents: int,
    ) -> CollectionRun:
        """Create a new collection run in pending state."""
        pass

    async def start_run(self, run_id: str) -> None:
        """Start or resume a collection run."""
        pass

    async def pause_run(self, run_id: str) -> None:
        """Pause a running collection."""
        pass

    async def cancel_run(self, run_id: str) -> None:
        """Cancel a collection run."""
        pass

    async def checkpoint(
        self,
        run_id: str,
        checkpoint_data: dict
    ) -> None:
        """Save checkpoint for crash recovery."""
        pass

    async def resume_incomplete_runs(self) -> None:
        """Called on server startup to resume interrupted runs."""
        pass
```

### Background Worker Extension

```python
# apps/api/src/app/background.py (extended)

from app.services.collection import CollectionService

# Track active collection tasks
_collection_tasks: dict[str, asyncio.Task] = {}

async def collection_manager():
    """Manager for collection runs."""
    supabase = get_supabase()
    service = CollectionService(supabase)

    # On startup: resume any interrupted runs
    await service.resume_incomplete_runs()

    # Main loop: check for pending runs
    while True:
        # Process any runs that need attention
        await asyncio.sleep(5)  # Check interval

async def run_collection(run_id: str):
    """Execute a single collection run with checkpointing."""
    # This is spawned as a separate task per run
    pass
```

### WebSocket Pattern (For Real-Time Updates)

```python
# apps/api/src/app/routers/collection.py

from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/ws/runs/{run_id}")
async def collection_progress_ws(
    websocket: WebSocket,
    run_id: str,
):
    """WebSocket endpoint for real-time collection progress."""
    await websocket.accept()

    try:
        # Subscribe to progress updates
        while True:
            # Send progress updates
            await websocket.send_json({
                "type": "progress",
                "processed": 150,
                "total": 500,
                "current_category": "Electronics",
                "recent_items": [...]
            })
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job state persistence | In-memory job tracking | PostgreSQL + checkpoint column | Crash recovery |
| Unique job names | Manual string generation | `f"Collection {datetime.now():%Y-%m-%d %H:%M}"` | Consistent format |
| Cost calculation | Hardcoded rates | Config table + rate constants | Future rate changes |
| Seller deduplication | String comparison | Normalized name (lowercase, stripped) | "SELLER ABC" vs "seller abc" |

## Common Pitfalls

### Pitfall 1: In-Memory Job State
**What goes wrong:** Jobs lost on server restart
**Why it happens:** Storing job state only in Python variables
**How to avoid:** Store all job state in `collection_runs` table, checkpoint regularly
**Warning signs:** Jobs disappear after API restart

### Pitfall 2: No Cost Pre-Calculation
**What goes wrong:** Collection runs exceed budget unexpectedly
**Why it happens:** Starting run without calculating total cost first
**How to avoid:** Calculate estimated cost before starting, block if exceeds budget
**Warning signs:** Actual cost >> budget cap

### Pitfall 3: Blocking Job Start
**What goes wrong:** API endpoint hangs during long collection
**Why it happens:** Running collection synchronously in request handler
**How to avoid:** Start collection as background task, return immediately with run_id
**Warning signs:** POST /start times out

### Pitfall 4: No Checkpoint Granularity
**What goes wrong:** Resume starts from beginning
**Why it happens:** Only checkpointing at category boundaries
**How to avoid:** Checkpoint every N items (research suggests 100)
**Warning signs:** Resume after crash repeats significant work

### Pitfall 5: WebSocket Without Fallback
**What goes wrong:** Progress UI broken for some users
**Why it happens:** Corporate firewalls blocking WebSocket
**How to avoid:** Implement polling fallback with the existing `useAutomationPolling` hook
**Warning signs:** Progress stuck for some users while working for others

## Code Examples

### Migration Pattern (from codebase)
```sql
-- From 035_access_codes.sql
CREATE TABLE access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  -- ... fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT access_codes_prefix_unique UNIQUE (prefix)
);

ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_access_codes" ON access_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Router Permission Pattern (from codebase)
```python
# From automation.py
@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """List all agents for the organization."""
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]
    # ... implementation
```

### Background Task Pattern (from codebase)
```python
# From background.py + main.py
async def cleanup_worker():
    while True:
        await cleanup_stale_replacing_agents()
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)

# In lifespan:
_cleanup_task = asyncio.create_task(cleanup_worker())
```

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Celery for background jobs | asyncio.create_task | Project already uses asyncio pattern |
| Redis for job queue | PostgreSQL for state | Matches existing stack |
| SSE for progress | WebSocket + polling fallback | User preference from CONTEXT.md |

## Open Questions

1. **WebSocket authentication**
   - What we know: Main auth uses Supabase JWT
   - What's unclear: How to authenticate WebSocket connections
   - Recommendation: Pass token as query param, validate on connect

2. **Checkpoint storage format**
   - What we know: JSONB column for flexibility
   - What's unclear: Exact fields needed for each collection type
   - Recommendation: Define minimal schema, extend as needed in later phases

3. **Multiple concurrent runs**
   - What we know: User wants parallel runs allowed
   - What's unclear: Resource limits per org
   - Recommendation: Start with max 3 concurrent, make configurable

4. **Progress feed pagination**
   - What we know: User wants live feed of processed items
   - What's unclear: How to handle very long runs (10K+ items)
   - Recommendation: Keep last 100 in WebSocket, full history via REST endpoint

## Technical Decisions for Planner

### Decision 1: Job Execution Model
**Options:**
- A) Single background task managing all runs (queue-based)
- B) One asyncio.Task per run (parallel execution)

**Recommendation:** B - One task per run
- Matches user requirement for parallel runs
- Simpler isolation between runs
- Easier to pause/cancel individual runs

### Decision 2: Real-Time Updates
**Options:**
- A) WebSocket only
- B) Polling only
- C) WebSocket with polling fallback

**Recommendation:** C - WebSocket with fallback
- User specifically requested WebSocket for real-time
- Polling hook already exists in codebase
- Fallback handles edge cases (corporate firewalls)

### Decision 3: Cost Tracking
**Options:**
- A) Track per-run only
- B) Track per-run and per-item

**Recommendation:** B - Both
- Per-run for budget enforcement
- Per-item for detailed cost analysis
- Enables future reporting features

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/api/migrations/*.sql`, `apps/api/src/app/background.py`, `apps/api/src/app/routers/automation.py`
- Phase context: `.planning/phases/06-collection-infrastructure/06-CONTEXT.md`
- Project research: `.planning/research/SUMMARY.md`

### Secondary (MEDIUM confidence)
- FastAPI documentation for WebSocket support
- PostgreSQL JSONB patterns for flexible checkpoint storage

## Metadata

**Confidence breakdown:**
- Database schema: HIGH - Follows established migration patterns
- Background jobs: HIGH - Extends existing asyncio pattern
- WebSocket: MEDIUM - New pattern for codebase, but standard FastAPI
- Budget controls: HIGH - Straightforward server-side validation

**Research date:** 2026-01-20
**Valid until:** 30 days (stable infrastructure patterns)
