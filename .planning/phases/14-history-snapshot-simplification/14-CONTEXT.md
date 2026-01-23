# Phase 14: History & Snapshot Simplification - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Simplify history UI by enriching snapshots with inline diff indicators and removing unused comparison/detail modals. The History Entry modal (renamed from LogDetailModal) shows a unified Changes panel for all entry types. HierarchicalRunModal and compare mode are removed.

</domain>

<decisions>
## Implementation Decisions

### Diff display style
- Green styling for added sellers: background row + plus icon prefix + green left border + alternating green tints
- Red styling for removed sellers: same pattern as added (background + minus icon + red left border + alternating red tints)
- Changes only shown (no unchanged sellers displayed)
- Sort order: added sellers first, then removed sellers
- Both sections alphabetically sorted within their group

### Naming
- "Sellers at this point" panel renamed to "Changes"
- LogDetailModal renamed to "History Entry" modal

### Unified list layout
- Single scrollable list structure
- Section headers with counts: "Added (X)" at top, "Removed (X)" below
- Seller rows show name only (no timestamp, no source metadata)
- Counts appear in section headers only (not in modal header/subtitle)

### Modal behavior
- Clicking any entry in Activity Feed opens History Entry modal
- Modal shows: Changes panel (left) + Full History list (right)
- Both collection runs AND manual edits open the same modal
- Clicking any entry in Full History list updates the Changes panel
- Initially shows changes for the clicked entry (not most recent)
- Selected entry is visually highlighted in Full History list
- Unified behavior: runs and edits behave identically

### Empty states
- Empty Changes panel: illustrative icon + message (Claude's discretion on wording)
- Empty Full History list: "No history yet. Run a collection or edit sellers to see history."
- Hide empty sections (if only adds, don't show "Removed (0)")
- Rename entries show both sections (Added with new name, Removed with old name)

### Claude's Discretion
- Empty state icon selection and exact message wording for Changes panel
- Exact alternating tint values for green/red rows
- Highlight style for selected entry in Full History list

</decisions>

<specifics>
## Specific Ideas

- Each history entry is either add-only OR remove-only, except rename which shows both old (removed) and new (added)
- Entry types: collection run (adds), manual delete (removes), manual add/paste (adds), edit/rename (removes old + adds new)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-history-snapshot-simplification*
*Context gathered: 2026-01-23*
