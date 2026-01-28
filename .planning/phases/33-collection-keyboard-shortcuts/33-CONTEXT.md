# Phase 33: Collection Keyboard Shortcuts - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add keyboard shortcuts to the collection page for power-user workflows: selection (click, Shift+Click, Ctrl+Click, Ctrl+A), actions (Delete, F=flag, E=export, S=start run). Shortcuts are page-scoped (collection only) and appear in the page-contextual shortcuts reference (?). Also keep the existing Ctrl+Z shortcut (undoes bulk delete, 1 level only) — do NOT remove it.

Note: The success criteria originally said to remove Ctrl+Z. User explicitly overrode this — Ctrl+Z stays, with documentation that it only undoes bulk delete (1 level).

</domain>

<decisions>
## Implementation Decisions

### Selection model
- No j/k keyboard navigation — not needed for the collection grid
- Click selects a single seller
- Shift+Click selects a range from last selected
- Ctrl+Click toggles individual sellers in/out of selection
- Ctrl+A selects all **visible** sellers (filtered view only, not hidden items)
- Toolbar/header area updates inline to show selection count and available actions when 1+ sellers selected (no floating action bar)

### Action confirmation behavior
- **Delete**: Confirm dialog first ("Delete 12 sellers?") showing count, then undo toast as safety net after deletion. Belt and suspenders.
- **F (Flag)**: Toggle instantly, no confirmation. Non-destructive and reversible.
- **E (Export)**: Opens the export dialog (does not quick-export)
- **S (Start run)**: Shows confirmation/pre-run dialog first. Selection does not affect run scope — S always starts a full collection run.
- **Ctrl+Z**: Keep as-is. Undoes bulk delete only, 1 level deep. Do not remove.

### Flag toggle logic (Google Docs Ctrl+B pattern)
- If any selected seller is NOT flagged → F flags all selected
- If ALL selected sellers are already flagged → F unflags all selected
- Same pattern as bold toggle in Google Docs

### Export with selection
- E opens export dialog pre-scoped to selected sellers when selection exists
- Dialog shows "Exporting N sellers" to make scope clear

### Shortcut discovery
- Command palette (Cmd+K) stays navigation-only — do NOT add collection shortcuts to it
- Shortcuts reference (? key) is page-contextual: shows collection shortcuts only when on collection page
- One-time dismissible hint on first visit: "Tip: Press ? for keyboard shortcuts" (stored in localStorage)

### Claude's Discretion
- Whether to show shortcut key badges on buttons (e.g., "Export [E]") or only in tooltips
- Exact visual styling of selection state on seller cards/rows
- Escape key behavior (clear selection, close dialogs, etc.)
- How the one-time hint is styled and positioned

</decisions>

<specifics>
## Specific Ideas

- Flag toggle should work like Ctrl+B in Google Docs — "will always flag all selected sellers by pressing F unless all selected sellers are already flagged"
- Delete confirmation must show the exact count: "Delete 12 sellers?"
- Toolbar updates inline (no floating bar) when selection is active

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-collection-keyboard-shortcuts*
*Context gathered: 2026-01-27*
