# Phase 9: Storage, Export, and Collection UI - Research

**Researched:** 2026-01-21
**Domain:** Collection management, export functionality, scheduling
**Confidence:** HIGH

## Summary

This phase builds UI and backend features for managing collected sellers: export functionality (JSON, CSV, clipboard), progress display with stop/cancel, collection history, and scheduled monthly runs. The existing codebase already has substantial infrastructure in place from Phases 6-8:

- Seller storage and deduplication via `CollectionService`
- Export endpoints (`/sellers/export?format=json|csv|text`)
- Progress polling hook (`use-collection-polling.ts`)
- Progress detail modal with hierarchical display
- Run lifecycle management (create, start, pause, cancel)

The primary work involves: enhancing export endpoints with full metadata, building collection history UI, adding a minimizable progress modal, implementing cron-based scheduling with APScheduler, and wiring up stop/cancel UI.

**Primary recommendation:** Extend existing patterns rather than introducing new libraries. Use APScheduler for cron scheduling (already used in similar FastAPI projects), enhance existing export endpoint to include full metadata, and build on the established polling-based progress UI.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| APScheduler | 3.10.x | Cron scheduling | De facto standard for Python task scheduling, works with asyncio |
| csv (stdlib) | - | CSV generation | Built-in, no dependencies, handles edge cases |
| io.StringIO (stdlib) | - | In-memory file buffer | Standard pattern for streaming responses |
| FastAPI StreamingResponse | - | File download responses | Built into FastAPI, handles headers properly |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| croniter | 2.0.x | Cron expression validation/parsing | Validate user cron input before storing |
| neocron | latest | React cron input component | If user wants visual cron builder (optional) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| APScheduler | Celery | Celery requires Redis/broker - overkill for single monthly job |
| APScheduler | system cron | Not portable, requires server access |
| neocron | Plain text input | Less user-friendly but simpler, no dependency |
| neocron | react-js-cron | Requires Ant Design, heavier dependency |

**Installation:**
```bash
# Backend
pip install apscheduler croniter

# Frontend (optional, only if visual cron builder needed)
npm install neocron
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/app/
  services/
    collection.py      # Extend with export_run_sellers(), scheduled run logic
    scheduler.py       # NEW: APScheduler integration
  routers/
    collection.py      # Add history endpoints, schedule endpoints
    sellers.py         # Extend export with metadata

apps/web/src/
  components/admin/collection/
    collection-history.tsx    # NEW: Past runs table
    progress-modal.tsx        # Enhance existing progress-detail-modal
    schedule-config.tsx       # NEW: Cron schedule configuration
    export-dropdown.tsx       # NEW: Reusable export button
  hooks/
    use-collection-polling.ts # Already exists, may need minor updates
```

### Pattern 1: Enhanced Export with Full Metadata
**What:** Extend export to include all seller fields, not just names
**When to use:** User wants full seller data with feedback scores, dates, etc.
**Example:**
```python
# Source: Extend existing /sellers/export endpoint
@router.get("/export")
async def export_sellers(
    format: str = "json",
    run_id: str | None = None,  # Optional: filter to specific run
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    org_id = user["membership"]["org_id"]

    if run_id:
        sellers = await service.get_sellers_by_run(org_id, run_id)
    else:
        sellers, _ = await service.get_sellers(org_id, limit=100000)

    if format == "csv":
        # Full metadata CSV
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=[
            "display_name", "platform", "feedback_score",
            "times_seen", "created_at", "first_seen_run_id"
        ])
        writer.writeheader()
        for s in sellers:
            writer.writerow({
                "display_name": s["display_name"],
                "platform": s["platform"],
                "feedback_score": s.get("feedback_score", ""),
                "times_seen": s["times_seen"],
                "created_at": s["created_at"],
                "first_seen_run_id": s.get("first_seen_run_id", ""),
            })

        # Generate descriptive filename
        date_str = datetime.now().strftime("%Y-%m-%d")
        filename = f"sellers_{date_str}{'_run-' + run_id[:8] if run_id else '_full'}.csv"

        return StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
```

### Pattern 2: APScheduler with FastAPI Lifespan
**What:** Integrate cron scheduler into existing lifespan pattern
**When to use:** Scheduled monthly collection runs
**Example:**
```python
# Source: Based on APScheduler documentation and existing background.py pattern
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _cleanup_task

    # Start existing cleanup task
    _cleanup_task = asyncio.create_task(cleanup_worker())

    # Start scheduler
    scheduler.start()

    # Load scheduled jobs from database
    await load_scheduled_collections()

    await collection_startup_recovery()
    yield

    # Shutdown
    scheduler.shutdown()
    if _cleanup_task:
        _cleanup_task.cancel()

async def load_scheduled_collections():
    """Load active schedules from DB and add to scheduler."""
    supabase = get_supabase()
    schedules = supabase.table("collection_schedules").select("*").eq("enabled", True).execute()

    for schedule in schedules.data or []:
        trigger = CronTrigger.from_crontab(schedule["cron_expression"])
        scheduler.add_job(
            run_scheduled_collection,
            trigger,
            args=[schedule["org_id"], schedule["preset_id"]],
            id=f"collection_{schedule['id']}",
            replace_existing=True
        )
```

### Pattern 3: Minimizable Progress Modal
**What:** Progress modal that can collapse to inline indicator
**When to use:** User wants to navigate while collection runs
**Example:**
```typescript
// Source: Pattern based on existing progress-detail-modal.tsx
const [isMinimized, setIsMinimized] = useState(false);

// When minimized, show inline badge in header
{isMinimized && progress && (
  <div
    onClick={() => setIsMinimized(false)}
    className="fixed bottom-4 right-4 bg-gray-800 rounded-lg p-3 cursor-pointer"
  >
    <span className="text-sm">
      Collection: {progress.products_searched}/{progress.products_total}
    </span>
    <Progress value={(progress.products_searched / progress.products_total) * 100} />
  </div>
)}

// Full modal when not minimized
<Dialog open={!isMinimized && !!progress}>
  <DialogContent>
    <Button onClick={() => setIsMinimized(true)}>Minimize</Button>
    {/* ...progress details... */}
  </DialogContent>
</Dialog>
```

### Anti-Patterns to Avoid
- **Blocking exports:** Don't generate large exports synchronously - use StreamingResponse
- **Polling in background:** Don't poll for progress when no collection is running - check activeRun first
- **Hardcoded schedules:** Don't hardcode cron expressions - store in database for flexibility
- **Multiple scheduler instances:** With multi-worker deployments, ensure only one scheduler runs (use Redis job store or single-worker mode for scheduler)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron expression parsing | Custom parser | croniter library | Edge cases (leap years, DST, "last day of month") |
| CSV escaping | Manual escaping | csv.DictWriter | Handles quotes, commas, newlines in data |
| File downloads | Raw Response | StreamingResponse | Proper headers, browser download triggering |
| Cron scheduling | while loop + sleep | APScheduler | Handles missed runs, persistence, timezones |
| Progress state | Manual polling | existing useCollectionPolling | Already implemented, proven pattern |

**Key insight:** The existing codebase already has export functionality - extend it rather than rebuilding. Don't reinvent the scheduling wheel when APScheduler handles all the edge cases.

## Common Pitfalls

### Pitfall 1: Scheduler Duplication in Multi-Worker Deployments
**What goes wrong:** Each uvicorn worker starts its own scheduler, running jobs N times
**Why it happens:** APScheduler runs in-process by default
**How to avoid:** Either run single worker for scheduler process, or use persistent job store (Redis/SQLite) with APScheduler
**Warning signs:** Jobs running multiple times, log entries duplicated

### Pitfall 2: CSV Encoding Issues
**What goes wrong:** Non-ASCII characters in seller names cause encoding errors
**Why it happens:** StringIO defaults may not handle Unicode properly
**How to avoid:** Explicitly set encoding, use csv module's newline handling
**Warning signs:** Garbled characters in exported files, "UnicodeEncodeError"

```python
# Correct pattern
stream = io.StringIO()  # StringIO handles unicode in Python 3
writer = csv.DictWriter(stream, fieldnames=[...])
# For bytes output, use:
stream = io.BytesIO()
wrapper = io.TextIOWrapper(stream, encoding='utf-8-sig', newline='')  # BOM for Excel
```

### Pitfall 3: Progress Modal State Persistence
**What goes wrong:** User navigates away, progress state lost, can't see minimized indicator
**Why it happens:** Component unmounts when navigating between routes
**How to avoid:** Lift progress state to layout level or use context/zustand
**Warning signs:** Progress indicator disappears when clicking sidebar links

### Pitfall 4: Scheduled Run Collision
**What goes wrong:** Scheduled run starts while manual run is in progress
**Why it happens:** No check for active runs before starting scheduled collection
**How to avoid:** Queue scheduled runs if collection already running (per context decision)
**Warning signs:** Multiple "running" status runs for same org

```python
async def run_scheduled_collection(org_id: str, preset_id: str):
    # Check for active runs first
    active = await service.get_active_runs(org_id)
    if active:
        # Queue for later (store in scheduled_queue table or retry after delay)
        await service.queue_scheduled_run(org_id, preset_id)
        return

    # Proceed with collection
    await service.execute_collection(org_id, preset_id)
```

### Pitfall 5: Missing Content-Disposition for Downloads
**What goes wrong:** Browser displays file content instead of downloading
**Why it happens:** Missing or incorrect Content-Disposition header
**How to avoid:** Always include `attachment; filename=...` header
**Warning signs:** JSON/CSV appearing in browser tab instead of download dialog

## Code Examples

Verified patterns from official sources and existing codebase:

### CSV Export with Full Metadata
```python
# Source: Python csv module + FastAPI StreamingResponse pattern
import csv
import io
from datetime import datetime
from fastapi.responses import StreamingResponse

async def export_sellers_csv(sellers: list[dict], run_id: str | None = None) -> StreamingResponse:
    stream = io.StringIO()
    fieldnames = [
        "display_name", "platform", "feedback_score",
        "times_seen", "created_at", "source_product"
    ]
    writer = csv.DictWriter(stream, fieldnames=fieldnames)
    writer.writeheader()

    for seller in sellers:
        writer.writerow({
            "display_name": seller["display_name"],
            "platform": seller["platform"],
            "feedback_score": seller.get("feedback_score", ""),
            "times_seen": seller["times_seen"],
            "created_at": seller["created_at"],
            "source_product": seller.get("source_product", ""),
        })

    # Generate filename
    date_str = datetime.now().strftime("%Y-%m-%d")
    suffix = f"_run-{run_id[:8]}" if run_id else "_full"
    filename = f"sellers_{date_str}{suffix}.csv"

    stream.seek(0)  # Reset to beginning
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

### JSON Export with Full Metadata
```python
# Source: FastAPI response pattern
from fastapi.responses import JSONResponse

async def export_sellers_json(sellers: list[dict], run_id: str | None = None) -> JSONResponse:
    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "count": len(sellers),
        "sellers": [
            {
                "name": s["display_name"],
                "platform": s["platform"],
                "feedback_score": s.get("feedback_score"),
                "times_seen": s["times_seen"],
                "discovered_at": s["created_at"],
                "source_product": s.get("source_product"),
            }
            for s in sellers
        ]
    }

    # Generate filename for Content-Disposition
    date_str = datetime.now().strftime("%Y-%m-%d")
    suffix = f"_run-{run_id[:8]}" if run_id else "_full"
    filename = f"sellers_{date_str}{suffix}.json"

    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

### Collection History Endpoint
```python
# Source: Extend existing list_runs pattern in collection.py router
@router.get("/runs/history", response_model=CollectionHistoryResponse)
async def get_collection_history(
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(require_permission_key("admin.automation")),
    service: CollectionService = Depends(get_collection_service),
):
    """Get completed collection runs with full statistics."""
    org_id = user["membership"]["org_id"]

    # Get runs with computed duration and stats
    result = (
        service.supabase.table("collection_runs")
        .select(
            "id, name, status, category_ids, "
            "started_at, completed_at, "
            "departments_total, categories_total, "
            "products_searched, sellers_found, sellers_new, "
            "actual_cost_cents, failed_items, created_by"
        )
        .eq("org_id", org_id)
        .in_("status", ["completed", "failed", "cancelled"])
        .order("completed_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return CollectionHistoryResponse(
        runs=[
            CollectionHistoryEntry(
                id=r["id"],
                name=r["name"],
                status=r["status"],
                started_at=r["started_at"],
                completed_at=r["completed_at"],
                duration_seconds=compute_duration(r["started_at"], r["completed_at"]),
                categories_searched=len(r["category_ids"]),
                sellers_found=r["sellers_found"],
                sellers_new=r["sellers_new"],
                cost_cents=r["actual_cost_cents"],
                error_count=r["failed_items"],
            )
            for r in result.data or []
        ],
        total=result.count or 0,
    )
```

### APScheduler Cron Job Setup
```python
# Source: APScheduler docs + existing lifespan pattern
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="UTC")

async def add_collection_schedule(
    org_id: str,
    preset_id: str,
    cron_expression: str,
    schedule_id: str,
):
    """Add a scheduled collection job."""
    # Validate cron expression
    try:
        trigger = CronTrigger.from_crontab(cron_expression)
    except ValueError as e:
        raise ValueError(f"Invalid cron expression: {e}")

    scheduler.add_job(
        run_scheduled_collection,
        trigger,
        args=[org_id, preset_id],
        id=f"collection_{schedule_id}",
        replace_existing=True,
        misfire_grace_time=3600,  # 1 hour grace for missed runs
    )

async def remove_collection_schedule(schedule_id: str):
    """Remove a scheduled collection job."""
    job_id = f"collection_{schedule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
```

### Clipboard Copy (Frontend)
```typescript
// Source: Navigator Clipboard API (standard browser API)
const copyToClipboard = async (sellers: Seller[]) => {
  const text = sellers.map(s => s.display_name).join("\n");

  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    toast.success("Copied to clipboard");
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Celery for all tasks | APScheduler for simple cron | 2023 | Simpler setup, no Redis needed for single jobs |
| csv.writer | csv.DictWriter | - | Better field handling, explicit column names |
| Polling every second | 2-3 second interval | Current | Balance between responsiveness and server load |
| Full modal only | Minimizable progress indicator | Pattern trend | Better UX for long-running operations |

**Deprecated/outdated:**
- `@app.on_event("startup")`: Replaced by lifespan context manager (FastAPI 0.95+)
- Direct file writing for export: Use in-memory buffers for FastAPI

## Open Questions

Things that couldn't be fully resolved:

1. **Multi-worker scheduler handling**
   - What we know: APScheduler can use persistent job stores (Redis, SQLite) to coordinate multiple workers
   - What's unclear: Current deployment model (single worker vs multi-worker)
   - Recommendation: Start with single worker; if scaling to multiple workers, add Redis job store

2. **Email notification implementation**
   - What we know: Context mentions "toggle for email notifications on completion"
   - What's unclear: Email service integration (SendGrid, SES, SMTP?)
   - Recommendation: Make notification toggle a database flag; implement actual sending in future phase

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/api/src/app/services/collection.py` - seller management patterns
- Existing codebase: `apps/api/src/app/routers/sellers.py` - export endpoint exists
- Existing codebase: `apps/api/src/app/background.py` - lifespan pattern
- FastAPI documentation: StreamingResponse for file downloads
- APScheduler documentation: CronTrigger parameters and syntax

### Secondary (MEDIUM confidence)
- [Sentry APScheduler guide](https://sentry.io/answers/schedule-tasks-with-fastapi/) - FastAPI integration pattern
- [Sling Academy CSV export](https://www.slingacademy.com/article/how-to-return-a-csv-file-in-fastapi/) - StreamingResponse pattern
- [Neocron GitHub](https://github.com/nucleuscloud/neocron) - React cron input component

### Tertiary (LOW confidence)
- Multiple Medium articles on APScheduler - verified patterns against official docs
- npm search results for cron components - neocron selected for shadcn/tailwind compatibility

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - APScheduler is established, csv/io are stdlib
- Architecture: HIGH - Building on existing codebase patterns
- Pitfalls: HIGH - Based on documented issues and common patterns

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable libraries, no major changes expected)
