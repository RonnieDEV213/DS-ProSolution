---
status: diagnosed
phase: 20-virtualized-rendering
source: 20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md
started: 2026-01-25T00:15:00Z
updated: 2026-01-25T00:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Virtualized List Renders Records
expected: Open the bookkeeping records list. It should display records in a scrollable list. Scrolling through many records should be smooth. Only ~50 row elements should be in the DOM regardless of total count.
result: pass

### 2. Row Density Toggle
expected: There should be a density toggle in the toolbar. Clicking it switches between compact (smaller rows) and comfortable (larger rows) views. The preference should persist across page refreshes.
result: pass

### 3. Skeleton Loading Rows
expected: When records are loading (initial load or infinite scroll), skeleton placeholder rows should appear with animated shimmer effect instead of blank space.
result: pass

### 4. Expandable Row Details
expected: Clicking a row should expand it to show additional details. The expanded content should appear below the row. Clicking again should collapse it.
result: issue
reported: "Clicking a row does not expand it, clicking the row's arrow and pressing enter does expand and close it"
severity: minor

### 5. Keyboard Navigation
expected: When the list is focused, pressing j/ArrowDown moves focus to next row, k/ArrowUp moves to previous row. The focused row should have a visible focus ring. Enter should select/expand the row.
result: pass

### 6. Infinite Scroll Pagination
expected: Scrolling to the bottom of the list should automatically load more records if available. A loading indicator should appear while fetching. New records should seamlessly append to the list.
result: pass

### 7. Result Summary Display
expected: The UI should show a summary like "Showing 1-50 of 2,340" indicating visible range and total count. This should update as you scroll through the list.
result: pass

### 8. Quick Filter Chips
expected: Status filter chips should appear (e.g., Pending, Approved, etc.). Clicking a chip filters records to that status. A clear action should remove the filter. Only one filter should be active at a time.
result: issue
reported: "I think there should be a return close and return label filter chip instead of only a return chip"
severity: minor

### 9. Keyboard Shortcuts Help
expected: There should be a help button/icon in the toolbar that opens a modal showing available keyboard shortcuts (j/k navigation, Enter to select, etc.).
result: pass

### 10. Scroll Position Restoration
expected: After navigating away from the bookkeeping list and returning, the scroll position should be restored to where you left off (within the same session).
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Clicking a row should expand it to show additional details"
  status: failed
  reason: "User reported: Clicking a row does not expand it, clicking the row's arrow and pressing enter does expand and close it"
  severity: minor
  test: 4
  root_cause: "Row container div has no onClick handler - only the arrow button triggers onToggleExpand"
  artifacts:
    - path: "apps/web/src/components/bookkeeping/record-row.tsx"
      issue: "Main row div (line 354-363) lacks onClick to toggle expand"
  missing:
    - "Add onClick to row container that calls onToggleExpand(record.id)"
  debug_session: ""

- truth: "Status filter chips should include granular return statuses"
  status: failed
  reason: "User reported: I think there should be a return close and return label filter chip instead of only a return chip"
  severity: minor
  test: 8
  root_cause: "QUICK_FILTERS array combines RETURN_LABEL_PROVIDED and RETURN_CLOSED into single 'Returns' chip"
  artifacts:
    - path: "apps/web/src/components/bookkeeping/quick-filter-chips.tsx"
      issue: "Lines 9-13 define combined Returns filter instead of separate chips"
  missing:
    - "Split 'Returns' filter into 'Return Label' and 'Return Closed' filters"
  debug_session: ""
