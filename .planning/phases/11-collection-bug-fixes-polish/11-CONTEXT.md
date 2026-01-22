# Phase 11: Collection Bug Fixes & Polish - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix critical bugs in progress tracking, history display, selection behavior, and deletion UX on the Seller Collection page. Stabilization phase — no new features, only fixes and polish.

</domain>

<decisions>
## Implementation Decisions

### Tooltip & Hover States
- Remove X delete button from seller cards entirely — delete only via toolbar
- Hover cards show on every seller (current behavior kept)
- Hover card shows what mouse is over, independent of selection state
- Claude's discretion: tooltip cleanup behavior after deletion

### Selection Behavior
- Shift+click selects range between anchor and target (standard behavior)
- Show visual preview of range on Shift+hover before clicking
- Compare modal: nothing pre-selected — user manually picks both snapshots
- Clicking empty space in grid deselects all selected items
- Ctrl+A, drag-to-select with auto-scroll: keep current behavior

### Deletion Safety
- Delete button hidden in toolbar when no selection (appears only with selection)
- No confirmation dialog — immediate delete with undo capability
- Show success toast with Undo option (auto-dismiss 5 seconds)
- Ctrl+Z to undo, Ctrl+Shift+Z to redo
- Unlimited undo within session (cleared on page close)
- Undo actions logged in history
- Restored sellers return to original position in grid

### History Accuracy
- "Sellers at this point" must show complete snapshot — NOT truncated with "+N more"
- Snapshot = cumulative state at that point (replay audit log)
- Example: +50, -25, +10 → snapshots show 50, 25, 35 respectively

### Progress Display
- Each step (Amazon, eBay) starts at 0% independently
- Step 1 (Amazon): 0-100%, then Step 2 (eBay): 0-100% fresh
- Concurrency slider: add tick marks at 1, 2, 3, 4, 5 with labels

### Claude's Discretion
- Tooltip cleanup timing after seller deletion
- Toast positioning and animation
- Undo stack implementation details

</decisions>

<specifics>
## Specific Ideas

- "Ctrl+Z and Ctrl+Shift+Z for undo/redo — standard keyboard shortcuts"
- "Undo success should also show a toast confirmation"
- Standard range selection behavior like Windows/Mac file explorers

</specifics>

<deferred>
## Deferred Ideas

- **Highlight vs Exported status separation** — Rename "flagged" to "highlighted", add separate "exported" status with different color/indicator, export settings to control marking behavior
- **Seller filtering system** — Filter by exported/highlighted status, dynamic counts reflecting filtered view, search within filtered results only
- These are meaningful features that warrant their own phase

</deferred>

---

*Phase: 11-collection-bug-fixes-polish*
*Context gathered: 2026-01-22*
