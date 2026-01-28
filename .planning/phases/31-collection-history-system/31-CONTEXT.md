# Phase 31: Collection History System - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Record all collection actions (exports, flag changes) as history events and enhance the existing History Entry modal to browse, filter, and view event details. Rollback is Phase 32; keyboard shortcuts are Phase 33.

Phase 14 established the History Entry modal (Changes panel + Full History list) for collection runs and manual edits. Phase 31 adds export and flag event types using the same infrastructure, enhances the modal with filtering and browsing capabilities, and converts the seller export flow to a modal matching the order tracking export dialog.

</domain>

<decisions>
## Implementation Decisions

### Event recording scope
- Add two new event types: **export** and **flag change** — alongside existing types (collection runs, manual adds, deletes, renames)
- Use the same event recording infrastructure from Phase 14 — no restructuring
- One **bulk entry** per action (exporting 50 sellers = 1 history entry containing all 50, not 50 entries)
- Scale consideration: 100k+ events expected eventually (v7 plans for million-scale) — researcher should verify storage/query patterns handle this

### Export event metadata
- Capture: which sellers were exported + export format (CSV/JSON/clipboard)
- Changes panel shows list of exported sellers, each marked as "exported"
- Summary header at top of Changes panel: "Exported X sellers as CSV" — format shown here only, not repeated per seller

### Flag event metadata
- Capture: which sellers + new flag state (flagged or unflagged)
- Minimal metadata — just affected sellers and the action

### Export flow change
- Convert seller collection export into a **modal** matching the order tracking export dialog's format and layout
- This affects how export events get generated (modal triggers the export + history recording)

### History viewer layout
- Enhance the **existing History Entry modal** — no new separate panel or page
- Adjust modal layout: Full History list gets **more width** than the Changes panel (not equal width)
- "History" section header on the collection page becomes a **prominent, clickable entry point** that opens the full history viewer modal — consistent with app's design patterns
- Clicking any activity feed entry still opens the modal (existing behavior preserved)

### Browsing & filtering
- **Filter chips** at the top of the Full History list: All, Exports, Flags, Runs, Edits
- **Date range picker** for narrowing to a specific time window
- No seller name search (not needed yet)
- **Infinite scroll** for loading events in batches (consistent with bookkeeping records pattern)
- Events **grouped by day** with date headers: "Today", "Yesterday", "Jan 25", etc.

### Event detail display — exports
- Summary header + seller list in Changes panel
- Summary: "Exported X sellers as CSV" (format in header only)
- Below: scrollable list of sellers marked as "exported"

### Event detail display — flags
- **Colored sections** in Changes panel, matching Phase 14's add/remove style
- "Flagged (X)" section in one color, "Unflagged (X)" section in another, with matching icons
- Hide empty sections (if only flags, don't show "Unflagged (0)")

### Event row in Full History list
- **Type badge + description + time** format
- Colored badge for event type (e.g., [Export], [Flag], [Run], [Edit])
- Description with count (e.g., "50 sellers exported")
- Relative timestamp (e.g., "2h ago", "Yesterday")

### Claude's Discretion
- Badge colors for each event type
- Exact filter chip styling and placement
- Date range picker component choice
- Infinite scroll batch size and loading behavior
- Day grouping header styling
- Export modal internal layout details (within the constraint of matching order tracking export dialog)
- "History" header clickable styling treatment

</decisions>

<specifics>
## Specific Ideas

- Export modal should match the order tracking export dialog's format and layout — same UI patterns
- Changes panel for exports shows sellers as "exported" (parallel to "added"/"removed" for other event types)
- Flag display uses colored sections like Phase 14's add/remove — familiar visual language
- History section header becomes a prominent, clickable entry point — follows app's existing UI/UX patterns for interactive headers

</specifics>

<deferred>
## Deferred Ideas

- Seller grid alternating row tints (similar to Changes panel alternating green/red tints) — visual polish item, separate from history system
- Seller name search in history — not needed yet, could be added when volume warrants it

</deferred>

---

*Phase: 31-collection-history-system*
*Context gathered: 2026-01-27*
