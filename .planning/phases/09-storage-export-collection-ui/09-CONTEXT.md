# Phase 9: Storage, Export, and Collection UI - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can view, export, and manage collected sellers. Includes export functionality (JSON, CSV, clipboard), collection progress UI with stop/cancel, collection history with past runs, and scheduled monthly collection configuration.

</domain>

<decisions>
## Implementation Decisions

### Export Options
- Include full metadata: seller name, platform, feedback score, discovery date, source product, times seen
- Both export scopes: "Export All Sellers" button + per-run export in history
- Descriptive filenames: `sellers_2026-01-21_full.csv` or `sellers_run-abc123.json`

### Progress & Controls
- Detailed breakdown: departments done, categories done, products searched, sellers found
- Cancel behavior: graceful finish (complete current product) + confirmation dialog
- Polling-based updates (2-3 second interval) — use existing pattern
- Progress location: modal that can minimize to inline indicator in Collections tab

### Collection History
- Full breakdown per run: date, duration, sellers found, new sellers, status, categories searched, cost, error count
- One-click "Run again" button to re-run with same categories
- Retain history forever (no auto-deletion)

### Scheduled Runs
- Full cron expression for schedule configuration
- Use saved category preset for scheduled runs
- Toggle for email notifications on completion (in-app always shows in history)
- Queue scheduled runs if collection already running (wait for current to finish)

### Claude's Discretion
- Export button placement in UI (toolbar vs dropdown)
- Collection history layout (table vs cards)
- Cron input UI design
- Progress modal styling

</decisions>

<specifics>
## Specific Ideas

- Progress modal should be minimizable so user can navigate elsewhere while collection runs
- Re-run button makes it easy to repeat successful collections
- Email notification toggle gives flexibility without forcing external dependencies

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-storage-export-collection-ui*
*Context gathered: 2026-01-21*
