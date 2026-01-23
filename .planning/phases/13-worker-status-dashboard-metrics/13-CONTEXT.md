# Phase 13: Worker Status Dashboard & Metrics - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Rework the progress detail modal into a 2-panel layout with per-worker status cards and comprehensive metrics tracking. Left panel shows 5 worker cards with real-time status. Right panel shows data pipeline feed and aggregated metrics. Clicking a worker expands to show full log and per-worker metrics.

</domain>

<decisions>
## Implementation Decisions

### Worker Card Design
- **Full transparency**: Each card shows everything — URL being hit, API parameters, price range, title being searched, timestamp, duration, phase (Amazon/eBay)
- **Idle state**: Muted styling with "Idle" or "Waiting for task" text
- **Last activity summary**: Single line below main card state showing most recent activity (e.g., "Returned 15 sellers" or "API Error: rate limit") — provides context for current state
- **All 5 visible**: Layout must show all 5 worker cards without scrolling

### Click-to-Expand Behavior
- **Panel replacement**: Clicking a worker replaces the worker panel content with that worker's full log (back button to return)
- **Worker's full log**: Scrollable list, newest at top, filterable by activity type
- **Per-worker metrics**: Full breakdown — API stats (success/fail/retry/response time), output stats (products, sellers, parse errors), per-category breakdown, error details with messages
- **Hover for log details**: Hovering a log entry shows tooltip with additional details (raw response info, full error message)
- **Other workers summary**: When viewing one worker's expanded view, the metrics panel shows mini-status icons for the other 4 workers (not the focus, just awareness)
- **Dual metrics display**: When expanded, shows both that worker's individual metrics AND overall run totals

### Data Pipeline Status
- **Activity feed style**: Scrolling feed of operations — "Uploading 25 sellers from Worker 4", "Deduped 12 duplicates", etc.
- **All operations shown**: Feed includes successful operations, not just errors
- **Error breakdown**: Both inline in feed ("Parse error: couldn't extract seller...") AND running summary totals
- **Detailed error granularity**: API errors by type (rate limit, timeout, 500), parse errors by stage (product extraction, seller extraction, price parsing)

### 2-Panel Layout
- **Workers left, metrics right**: Worker cards on left panel, pipeline feed + metrics on right
- **Fixed proportions**: No resizing or collapsing — Claude decides optimal split
- **No scrolling for workers**: All 5 worker cards visible at once (Claude decides arrangement)

### Claude's Discretion
- Phase indicator visual treatment (badge color vs icon)
- Exact panel proportions based on content density
- Worker card arrangement (vertical stack, grid, etc.) — optimize for all visible without scroll
- Loading skeleton design
- Exact styling and spacing

</decisions>

<specifics>
## Specific Ideas

- The "last activity" line under each worker card is key for understanding context — if idle after "Returned sellers" = success, if idle after "API Error" = problem
- Mini-status icons for other workers in the expanded view should be subtle — icons representing: searching, returning, error, idle, amazon phase, ebay phase
- Full transparency on worker cards means user can see exactly what API call is being made, useful for debugging

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-worker-status-dashboard-metrics*
*Context gathered: 2026-01-23*
