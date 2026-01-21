# Phase 10: Collection UI Cleanup - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Streamline the collection UI by reorganizing components, merging redundant sections, and improving data display. This is a refinement phase — no new backend capabilities, only UI/UX improvements to existing features.

</domain>

<decisions>
## Implementation Decisions

### Progress Bar Rework

**Two-phase progress display:**

1. **Amazon Phase (Collecting Best Sellers)**
   - Shows: Department X/Y, Category X/Y, Products found (live count)
   - Categories and departments come from run configuration
   - Products count updates live as they're discovered per category
   - Phase completes when all configured categories are scraped

2. **eBay Phase (Searching Sellers)**
   - Shows: Product X/N, Category X/N, Department X/N
   - Cascading completion logic: Product must reach N/N before Category increments, Category must reach N/N before Department increments
   - Shows: +N new sellers (only unique additions, not duplicates)
   - Shows: Duration timer, date started, Collection ID
   - Updates after each product search completes

**Fixes current issue:** Progress currently shows invalid ratios like "3/0 products" because totals aren't set until Amazon phase completes.

### History Panel Merge

**Merge Recent Activity sidebar + Collection History table into single "History" panel:**

- Reduce Sellers Grid width by 1-2 columns to accommodate wider History panel
- Rename "Recent Activity" to "History"
- Single chronological list containing both collection runs and manual edits

**Visual distinction:**
- Collection runs: Bot icon + blue accent color
- Manual edits: User/pencil icon + gray/neutral color

**Hierarchical structure for collection runs:**
- Collection ID is parent
- Department → Category → Product hierarchy underneath
- Sellers grouped under their source product

**Interaction flow:**
1. Click collection entry in History → Opens LogDetailModal showing Collection ID + key metadata
2. Click "View More" in LogDetailModal → Opens expanded modal with full hierarchical view
3. Hierarchical modal: Expandable departments → categories → products → seller grid
4. Seller grid width proportional to list, shows only new sellers (not duplicates)

**Manual edits:** Standalone entries, no hierarchy — represent individual actions (add/edit/remove)

### Run Config Modal Consolidation

**Two-panel layout:**
- **Left panel:** Department/category tree (existing category selector)
- **Right panel:** Run controls and scheduling

**Right panel contents:**
- Concurrency setting (placeholder for future feature)
- Presets dropdown (existing)
- Start Collection button
- Schedule toggle switch

**Schedule section (revealed when toggle enabled):**
- Recurring presets: Monthly, Bi-weekly, Weekly, Quarterly
- Calendar component for date selection
- Calendar highlights scheduled dates based on preset
  - Example: Weekly + Saturday selected → all Saturdays highlighted
- Supports both one-time future runs AND recurring patterns

**State persistence:** Modal opens with most recent manual category selections pre-checked

### Bulk Seller Selection

**Selection mechanics:**
- Single click: Select/deselect individual seller
- Drag selection: Click and drag to select multiple sellers
- Double-click: Enter edit mode for seller name
- Header checkbox: Select/deselect all visible sellers
- Ctrl+A: Keyboard shortcut to select all

**Visual feedback:**
- Selected sellers highlighted
- Counter changes from "N sellers" to "X selected / N total" when selection active
- Delete button appears next to Export dropdown when selection > 0

**Hover behavior:**
- Popover card appears on hover showing seller metadata:
  - Feedback percentage
  - Feedback count
  - Other collected metadata

### Claude's Discretion

- Exact animation/transition timing for phase switches
- Specific color shades for distinction (within blue/gray palette)
- Calendar component library choice
- Drag selection implementation approach (native vs library)
- Popover positioning and delay timing
- Exact column count reduction for sellers grid (1 or 2)

</decisions>

<specifics>
## Specific Ideas

- Progress bar phases should feel like a clear "step 1 of 2" then "step 2 of 2" progression
- History panel should feel like a unified activity feed, not two separate concepts
- Calendar should highlight dates clearly when recurring schedule is selected
- Drag selection should feel responsive, similar to file explorer multi-select
- Seller hover cards should appear quickly but not be intrusive

</specifics>

<deferred>
## Deferred Ideas

- Concurrency setting in run config — noted as "future feature" placeholder, not implemented this phase
- Seller filtering/search within grid — potential future enhancement
- Bulk edit (not just bulk delete) — could be separate phase if needed

</deferred>

---

*Phase: 10-collection-ui-cleanup*
*Context gathered: 2026-01-21*
