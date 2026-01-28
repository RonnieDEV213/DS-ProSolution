# Phase 26: Polish & Micro-interactions - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Transitions, loading skeletons, empty states, command palette, and keyboard shortcuts. This is the finishing layer for the v4 UI/Design System milestone — adding feel and power-user affordances to the existing functional UI. No new features or data capabilities.

</domain>

<decisions>
## Implementation Decisions

### Transition style
- Smooth & fluid feel: medium durations (200-400ms), eased slides and fades
- All three interaction types get transitions: page navigations, component state changes, data loading states
- Page navigations use the View Transitions API already set up in Phase 23
- Component state changes: expanding/collapsing panels, tab switches, modal open/close, sidebar toggle
- Data loading: staggered fade-in for list items (e.g., ~50ms stagger between items)
- Content appearing after load gets fade-in treatment

### Loading skeletons
- High fidelity: skeleton shapes match exact component structure per page (card outlines, avatar circles, text line widths)
- Every data page gets a skeleton — comprehensive coverage across tables, cards, metrics, sidebars
- Skeleton-to-content transition is animated: skeleton fades out while real content fades in

### Empty states
- Custom SVG illustrations per context (not just Lucide icons)
- Professional & helpful tone: straightforward messaging, business-appropriate
- Example: "No orders found. Create your first order to get started."

### Command palette
- Full-featured: navigation + actions + data search (orders, sellers)
- Navigation: quick jump to any page/section
- Actions: toggle theme, open settings, create order, etc.
- Search: search across application data from the palette

### Keyboard shortcuts
- Both navigation sequences and action triggers
- Navigation: vim-style go-to sequences (G then D for dashboard, G then B for bookkeeping, etc.)
- Actions: N for new, / for search focus, Escape to close modals, etc.
- Existing: Cmd+B / Ctrl+B for sidebar toggle (Phase 24)

### Shortcut discoverability
- Inline shortcut hints: keyboard shortcut badges next to menu items, buttons, and in tooltips
- Dedicated shortcuts panel: ? opens a full shortcuts reference sheet (like GitHub's)
- Both approaches for maximum discoverability

### Claude's Discretion
- Reduced-motion accessibility handling (follow best practices)
- Shimmer animation style for skeletons (pulse vs sweep — pick what fits the theme system)
- Command palette trigger shortcut (Cmd+K vs Cmd+/ — consider browser conflicts)
- Which empty states get CTA buttons vs message-only (based on whether user can directly resolve the state)
- No-results behavior for filtered/search states (suggest clearing filters vs simple message, per context)
- Exact animation durations and easing curves within the smooth & fluid range
- Specific keyboard shortcut assignments beyond the described patterns

</decisions>

<specifics>
## Specific Ideas

- Transition feel reference: Apple/Stripe — polished and deliberate, not snappy
- Command palette reference: Linear/Raycast — navigation + actions + search combined
- Shortcut discovery reference: GitHub's ? shortcut sheet for the full reference panel
- Staggered list item fade-in for data loading (premium feel)
- Skeleton-to-content animated handoff (fade out skeleton, fade in content)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-polish-micro-interactions*
*Context gathered: 2026-01-26*
