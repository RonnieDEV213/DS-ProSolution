---
status: diagnosed
trigger: "UAT gaps #4 and #5: default scrollbars in collection components + quick history text formatting"
created: 2026-01-26T00:00:00Z
updated: 2026-01-26T00:00:00Z
---

## Current Focus

hypothesis: Multiple scrollable containers in collection components are missing the `scrollbar-thin` CSS class, and the history-panel text layout uses vertical stacking with margins that creates excessive visual spacing
test: Cross-reference all `overflow-y-auto` containers with `scrollbar-thin` usage
expecting: Some containers have it, some do not
next_action: Report structured diagnosis

## Symptoms

expected: All scrollable containers should use the themed custom scrollbar (scrollbar-thin class), and history panel text should be compact
actual: Several scrollable containers show default browser scrollbars; history panel entries have excessive vertical spacing
errors: N/A (visual/UX issue)
reproduction: Open any dark theme, navigate to collection area, observe scrollbars in modals and panels
started: Since Phase 25 component-color-migration (scrollbar tokens added but class not applied everywhere)

## Evidence

- timestamp: 2026-01-26T00:01:00Z
  checked: globals.css for custom scrollbar CSS
  found: Custom scrollbar class `.scrollbar-thin` defined at line 331-372, uses CSS variables --scrollbar-thumb, --scrollbar-track, --scrollbar-thumb-hover. All 5 themes define these tokens.
  implication: The CSS infrastructure is complete; components just need to apply the class.

- timestamp: 2026-01-26T00:02:00Z
  checked: All 19 collection components for overflow-y-auto usage
  found: 10 scrollable containers identified across 7 files. Only 4 have `scrollbar-thin`.
  implication: 6 scrollable containers are missing the class -- these show default browser scrollbars.

- timestamp: 2026-01-26T00:03:00Z
  checked: history-panel.tsx text formatting (Issue #5)
  found: Each history entry button uses a vertical layout with a full-width div containing multiple flex rows with `mt-1` spacing. The `renderCollectionRun` function (lines 155-191) stacks: row 1 (icon + name + badge), row 2 (sellers count + categories + total + timestamp) -- all inside `space-y-2` parent. The `renderManualEdit` function (lines 193-217) has similar structure.
  implication: The `space-y-2` on the parent container (line 228) adds 0.5rem gap between entries, and each entry itself has internal `mt-1` spacing on the second row. Combined with `py-2` padding on each entry button, the visual density is low -- likely what user perceives as "two linebreaks" worth of spacing. There is also the data density issue: each collection run entry displays name, status badge, seller count, categories count, total count, AND relative timestamp -- all for a "quick history" sidebar.

## Resolution

root_cause: |
  **Issue #4 (Default scrollbars):** 6 scrollable containers across 5 component files use `overflow-y-auto` but do not include the `scrollbar-thin` CSS class. The class exists in globals.css and works correctly where applied.

  **Issue #5 (Quick history text formatting):** The history-panel.tsx uses `space-y-2` (8px gap) between entries, each entry has `py-2` (8px top+bottom padding), and internal rows use `mt-1` (4px). This creates ~20px of vertical dead space between the content of adjacent entries. Additionally, each entry shows 5-6 data points (name, status, +N sellers, categories, total count, timestamp) which is too much information density for a sidebar "quick history" view.

fix: Not applied (diagnosis only)
verification: N/A
files_changed: []
