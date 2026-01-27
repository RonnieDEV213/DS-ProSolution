---
status: diagnosed
phase: 25-component-color-migration
source: 25-01-SUMMARY.md, 25-02-SUMMARY.md, 25-03-SUMMARY.md, 25-04-SUMMARY.md, 25-05-SUMMARY.md, 25-06-SUMMARY.md, 25-07-SUMMARY.md
started: 2026-01-26T12:00:00Z
updated: 2026-01-26T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Bookkeeping table theme consistency
expected: Open Admin > Order Tracking. Switch between all 4 themes (Midnight, Dawn, Slate, Carbon). Table backgrounds, borders, headers, and row hover states should adapt to each theme. No hardcoded dark grays visible.
result: issue
reported: "Slight readability issue with the success checkmark from the order tracking and increase the width of the status column so the status does get cut off, and remove the '(no refund)' text from the refund status"
severity: minor

### 2. Monospace data formatting in bookkeeping
expected: In the bookkeeping records table, order IDs, monetary amounts (Earnings, COGS, Profit), and Amazon Order IDs should display in a monospace font with a subtle pill background (rounded, slightly tinted). Table column headers for data columns should also be monospace.
result: issue
reported: "Monospace is correct but the subtle pill background doesnt exist for the COGs"
severity: cosmetic

### 3. Checkbox and slider follow theme accent
expected: Find any checkbox or slider in the app (e.g., in dialogs or settings). When checked/active, the checkbox should use the theme's accent color (not hardcoded blue). Slider range and thumb should also match the theme accent.
result: issue
reported: "The slider in the ordertracking is still the default wide one"
severity: minor

### 4. Tooltip and dialog backgrounds adapt to theme
expected: Hover over an element with a tooltip (e.g., action buttons in tables). The tooltip should have a background that matches the theme. Open any dialog (e.g., Add Record, Edit User) -- the dialog surface should adapt to the active theme, not be stuck on dark gray.
result: pass

### 5. Admin tables theme adaptation
expected: Visit Admin > Users, Admin > Accounts, and Admin > Department Roles. Tables should have themed backgrounds, borders, and text. Status badges should use semantic colors (primary for active, muted for offline/inactive). Tab navigation (if present) should use the theme accent color for the active tab.
result: pass

### 6. Admin dialogs and forms themed
expected: Open any admin dialog (Account dialog, User Edit, Invite, Department Role). Dialog surface, form inputs, labels, and cancel/action buttons should all adapt to the active theme. Sidebar panels in dialogs should use a subtle muted background, not forced dark.
result: pass

### 7. Automation tables (Agents, Jobs, Pairing Requests) themed
expected: Visit Admin > Automation. Switch between Agents, Jobs, and Pairing tabs. Tables, status badges, dropdown menus, and action buttons should all use theme-appropriate colors. Status badges should use semantic colors (green/primary for active, red/destructive for failed, yellow/chart for pending).
result: pass

### 8. Collection worker cards and seller grid themed
expected: Visit Admin > Collection (seller collection). Worker cards should have themed backgrounds and borders. The seller grid cells should adapt to the theme. Hover states, selection highlights, and export popovers should all use theme colors. Worker-specific colors (blue/green/purple/orange/pink/cyan) should remain distinct per-worker.
result: issue
reported: "Theme works, but theres still a lot of usage of the default scroll bar, in the collection history, more details modal of the collection progress, etc"
severity: minor

### 9. Collection history, metrics, and progress themed
expected: While on the Collection page, check the history timeline, metrics panels, and progress bar. All should use themed backgrounds and borders. Metric values and timestamps should display in monospace. The progress bar track should adapt to the theme (not hardcoded dark gray).
result: issue
reported: "Theme works, but the scrollbar is still default, and also the text under each collection in the quick history (not the history entry modal) is weirdly formated, it looks like there are two linebreaks which is not ideal for such as small area for text, and I think there is just too much text in there"
severity: minor

### 10. Collection config modals themed
expected: Open the Run Config or Schedule Config modal in Collection. Dialog surfaces, form inputs, select dropdowns, labels, and helper text should all use theme-appropriate colors. Calendar picker (if visible) should also be themed.
result: pass

### 11. Profile Settings dialog themed
expected: Open Profile Settings (from sidebar footer). The dialog surface, sidebar navigation, tab content, and loading states should all adapt to the active theme. Tab navigation should show active/inactive states with theme colors.
result: pass

### 12. Access code display styling
expected: Go to Profile Settings > Security tab (as Admin or VA). The access code should display in monospace font with a subtle pill background, larger text, and letter-spacing for readability. The prefix and secret sections should be clearly styled.
result: pass

### 13. Theme picker preview cards preserved
expected: Open Profile Settings > Theme tab. The theme preview cards should show hardcoded hex color previews that represent each theme's actual appearance -- NOT adapting to the active theme. Each card should look distinct.
result: pass

### 14. Sync conflict resolution modal themed
expected: If you can trigger or view the sync conflict resolution modal, field names should display in monospace. Table borders, headers, and merge toggle buttons should all use theme colors.
result: pass

### 15. Login page retains dark appearance
expected: Navigate to the login page (log out if needed). The login page should have a fixed dark appearance with hardcoded dark gray colors. It should NOT change when switching themes -- it's intentionally excluded from the theme system.
result: pass

### 16. Page headers and empty states themed
expected: Visit various pages (Admin dashboard, VA dashboard, Client dashboard, Not Found page). Page titles should use foreground color. Secondary/description text should use muted foreground. The Not Found page CTA and Suspended page should use appropriate semantic colors (destructive for suspended title).
result: pass

### 17. Dawn (light) theme full pass
expected: Switch to Dawn theme. The entire app should feel like a cohesive light theme -- no dark patches or jarring contrast mismatches anywhere. All surfaces, text, borders, and interactive elements should work harmoniously in the light palette.
result: pass

### 18. Carbon (OLED dark) theme full pass
expected: Switch to Carbon theme. The app should have true black backgrounds with high-contrast near-white text. No washed-out elements or insufficient contrast. The theme should feel intentionally designed for OLED displays.
result: pass

## Summary

total: 18
passed: 13
issues: 5
pending: 0
skipped: 0

## Gaps

- truth: "Bookkeeping table adapts fully to all themes with readable status indicators"
  status: failed
  reason: "User reported: Slight readability issue with the success checkmark from the order tracking and increase the width of the status column so the status does get cut off, and remove the '(no refund)' text from the refund status"
  severity: minor
  test: 1
  root_cause: "Three sub-issues: (1) Check icon is w-3 h-3 (12px) inside Badge - too small for readability. (2) Status column is w-40 (160px) which is too narrow for long labels like 'Refund (No Return)'. (3) STATUS_LABELS in api.ts and STATUS_OPTIONS in record-row.tsx and records-table.tsx all contain 'Refund (No Return)' text that user wants simplified."
  artifacts:
    - path: "apps/web/src/components/bookkeeping/record-row.tsx"
      issue: "STATUS_ICONS Check icon w-3 h-3 too small (line 43-44); status column w-40 too narrow (line 459); STATUS_OPTIONS has 'Refund (No Return)' (line 38)"
    - path: "apps/web/src/components/bookkeeping/records-table.tsx"
      issue: "STATUS_OPTIONS has 'Refund (No Return)' (line 59); SelectTrigger min-w-[160px] (line 530)"
    - path: "apps/web/src/lib/api.ts"
      issue: "STATUS_LABELS REFUND_NO_RETURN = 'Refund (No Return)' (line 25-30)"
  missing:
    - "Increase Check icon size to w-4 h-4"
    - "Widen status column to w-48 or w-52"
    - "Rename 'Refund (No Return)' to 'Refund' in all 3 locations"
  debug_session: ".planning/debug/uat-gap1-status-column.md"
- truth: "COGS values display with monospace pill background like other monetary amounts"
  status: failed
  reason: "User reported: Monospace is correct but the subtle pill background doesnt exist for the COGs"
  severity: cosmetic
  test: 2
  root_cause: "COGS span in both records-table.tsx (line 488) and record-row.tsx (line 435) has className 'font-mono text-sm' but is missing 'px-1.5 py-0.5 rounded bg-primary/10' that Earnings and Profit spans have."
  artifacts:
    - path: "apps/web/src/components/bookkeeping/records-table.tsx"
      issue: "COGS span at line 488 missing pill classes"
    - path: "apps/web/src/components/bookkeeping/record-row.tsx"
      issue: "COGS span at line 435 missing pill classes"
  missing:
    - "Add 'px-1.5 py-0.5 rounded bg-primary/10' to COGS span in both files"
  debug_session: ".planning/debug/cogs-missing-pill-bg.md"
- truth: "Slider in order tracking uses themed styling with accent color, not browser default"
  status: failed
  reason: "User reported: The slider in the ordertracking is still the default wide one"
  severity: minor
  test: 3
  root_cause: "The reported 'slider' is actually the scrollbar. virtualized-records-list.tsx (line 397) uses overflow-x-auto without scrollbar-thin class. The react-window List component also generates a vertical scrollbar without the class. records-table.tsx (line 365) has the same issue."
  artifacts:
    - path: "apps/web/src/components/bookkeeping/virtualized-records-list.tsx"
      issue: "overflow-x-auto container at line 397 missing scrollbar-thin class; react-window List at line 457 also missing it"
    - path: "apps/web/src/components/bookkeeping/records-table.tsx"
      issue: "overflow-x-auto at line 365 missing scrollbar-thin class"
  missing:
    - "Add scrollbar-thin class to virtualized-records-list.tsx container and records-table.tsx container"
  debug_session: ".planning/debug/order-tracking-wide-slider.md"
- truth: "Collection area scrollable containers use custom themed scrollbars, not browser defaults"
  status: failed
  reason: "User reported: Theme works, but theres still a lot of usage of the default scroll bar, in the collection history, more details modal of the collection progress, etc"
  severity: minor
  test: 8
  root_cause: "6 scrollable containers across 5 collection component files use overflow-y-auto but do not include the scrollbar-thin CSS class. The class exists in globals.css and works correctly where applied."
  artifacts:
    - path: "apps/web/src/components/admin/collection/"
      issue: "6 containers missing scrollbar-thin across collection-history.tsx, history-panel.tsx, log-detail-modal.tsx, progress-detail-modal.tsx, recent-logs-sidebar.tsx"
  missing:
    - "Add scrollbar-thin class to all overflow-y-auto containers in collection components"
  debug_session: ".planning/debug/uat-gaps-4-5-scrollbar-text.md"
- truth: "Collection history quick view has compact, well-formatted text with themed scrollbars"
  status: failed
  reason: "User reported: Theme works, but the scrollbar is still default, and also the text under each collection in the quick history (not the history entry modal) is weirdly formated, it looks like there are two linebreaks which is not ideal for such as small area for text, and I think there is just too much text in there"
  severity: minor
  test: 9
  root_cause: "history-panel.tsx uses space-y-2 (8px gap) between entries, each entry has py-2 (8px padding), and internal rows use mt-1 (4px). This creates ~20px dead space between entries. Each entry shows 5-6 data points (name, status, sellers, categories, total, timestamp) which is too dense for a sidebar quick view."
  artifacts:
    - path: "apps/web/src/components/admin/collection/history-panel.tsx"
      issue: "space-y-2 on parent (line 228), py-2 on entry buttons, mt-1 on second row; 5-6 data fields per entry"
  missing:
    - "Reduce spacing: space-y-1, py-1.5, remove mt-1"
    - "Reduce data density: show only name, status badge, and timestamp in quick view"
  debug_session: ".planning/debug/uat-gaps-4-5-scrollbar-text.md"
