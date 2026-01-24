# Phase 20: Virtualized Rendering - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Render millions of records in scrollable lists with smooth performance and full interaction support. This includes virtual scrolling with constant DOM elements, infinite scroll integration, row count display, loading states, quick filter chips, and keyboard navigation. Filter presets and custom saved views are NOT in scope.

</domain>

<decisions>
## Implementation Decisions

### Row density & sizing
- User-switchable density: toggle between compact and comfortable
- Default to comfortable on first visit
- Persist density preference in localStorage across sessions
- Claude's discretion: fixed vs variable row heights based on data patterns

### Scroll behavior
- Restore scroll position when navigating away and back
- No jump-to-top button (keyboard shortcuts sufficient)
- Show skeleton rows while loading more data
- Claude's discretion: infinite scroll trigger threshold

### Filter chip UX
- Place quick filter chips in the existing toolbar (integrated with action buttons)
- No saved filter presets — quick filters only
- Claude's discretion: which quick filters to show (analyze common query patterns)
- Claude's discretion: how to indicate active filters
- Claude's discretion: clear all filters behavior

### Keyboard navigation
- Show shortcut hints via tooltips AND a ? help modal
- Claude's discretion: j/k focus vs selection behavior
- Claude's discretion: Enter action (detail view vs expand vs edit)
- Claude's discretion: Escape key behavior

### Claude's Discretion
- Row height strategy (fixed vs variable)
- Infinite scroll trigger threshold (near bottom vs at bottom)
- Quick filter selection based on common query patterns
- Active filter indication style
- Clear filters UI treatment
- j/k navigation behavior (focus-only vs move-and-select)
- Enter key action based on current UI patterns
- Escape key behavior

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-virtualized-rendering*
*Context gathered: 2026-01-24*
