---
status: diagnosed
phase: 22-theme-foundation-color-token-migration
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md]
started: 2026-01-25T22:00:00Z
updated: 2026-01-25T22:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dark theme preserved (no visual regression)
expected: App loads with dark theme active. All pages look the same as before -- dark backgrounds, light text, no color changes or missing styles.
result: issue
reported: "The page looks the same but there are minor changes to it, such as the successful status background is now black instead of white, the scrollbar is now dark instead of light, however there are some minor readability issues, and I am not sure if this is apart of the plan and this will be changes but the text that are in the account selection in the order tracker is black, with the same dark blue background, and the filter chips that are in the order tracker are also facing the same issues, when a chip is not selected, their text are dark with the same dark background as before, upon selecting the text becomes readable."
severity: major

### 2. data-theme attribute on HTML element
expected: In browser DevTools (F12), inspect the `<html>` element. It should have `data-theme="dark"` attribute. There should be NO `class="dark"` on it.
result: pass

### 3. No FOUC on page load
expected: Hard-refresh the page (Ctrl+Shift+R). The page should load directly into dark theme with no flash of white/light content before dark appears.
result: pass

### 4. CSS variable theme switching works
expected: In DevTools Console, run: `document.documentElement.setAttribute('data-theme', 'light')` — app switches to light theme (lighter backgrounds). Run: `document.documentElement.setAttribute('data-theme', 'dark')` — app returns to dark theme. No page reload needed.
result: issue
reported: "No I dont think it changed, scrollbar is still dark"
severity: major

### 5. Scrollbar theming
expected: Find a scrollable area (table, sidebar, or any overflow content). Scrollbar should use muted gray theme colors, not bright blue/white browser defaults. Scrollbar should be slim (thin).
result: issue
reported: "Two different scrollbar UIs. Scrollbar 1 (Seller List): scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent classes, 9px width, hardcoded rgb(75,85,99) thumb with rgb(107,114,128) hover, rgb(31,41,55) track, 4px border-radius -- uses old Tailwind scrollbar plugin classes NOT the new CSS variable classes. Scrollbar 2 (History Panel): overflow-y-auto only, no custom scrollbar classes at all, 14px browser default width."
severity: major

### 6. No hydration errors in console
expected: Open browser DevTools Console (F12 → Console tab). There should be no red errors about "hydration mismatch" or "content did not match". Warnings about other things are fine -- just no hydration-related errors.
result: pass

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "App loads with dark theme active, all pages look the same as before with no visual regression"
  status: failed
  reason: "User reported: Account selection dropdown in order tracker has black text on dark blue background (unreadable). Filter chips in order tracker have dark text on dark background when unselected, only readable when selected. Success status badge background changed from white to black."
  severity: major
  test: 1
  root_cause: "account-selector.tsx uses hardcoded bg-gray-800/border-gray-700/text-white classes instead of shadcn design tokens. Filter chips (badge.tsx outline variant) use text-foreground which gets light-mode value when dark CSS variables don't cascade properly. These components bypass the token system entirely."
  artifacts:
    - path: "apps/web/src/components/bookkeeping/account-selector.tsx"
      issue: "Hardcoded bg-gray-800 border-gray-700 text-white classes bypass design tokens"
    - path: "apps/web/src/components/ui/badge.tsx"
      issue: "outline variant uses text-foreground which may not resolve correctly under new selector"
  missing:
    - "Replace hardcoded gray classes in account-selector.tsx with shadcn design tokens"
    - "Verify badge.tsx outline variant text color resolves correctly under data-theme selector"
  debug_session: ".planning/debug/unreadable-dark-theme-text.md"

- truth: "Switching data-theme attribute from dark to light changes all app colors via CSS variable cascade"
  status: failed
  reason: "User reported: No visible change when running document.documentElement.setAttribute('data-theme', 'light') -- scrollbar still dark, app did not switch to light theme"
  severity: major
  test: 4
  root_cause: "Components use hardcoded Tailwind color classes (bg-gray-950) instead of theme-aware CSS tokens. The token system IS correctly defined in globals.css but NEVER REFERENCED by any component. All 3 layout files and 9 page files hardcode bg-gray-950. Zero usage of bg-app-bg or other new semantic token classes found in TSX files. Phase 25 (Component Color Migration) is specifically scoped to migrate these 30+ files."
  artifacts:
    - path: "apps/web/src/app/admin/layout.tsx"
      issue: "Hardcoded bg-gray-950 on line 12"
    - path: "apps/web/src/app/va/layout.tsx"
      issue: "Hardcoded bg-gray-950"
    - path: "apps/web/src/app/client/layout.tsx"
      issue: "Hardcoded bg-gray-950"
  missing:
    - "Replace bg-gray-950 with bg-app-bg across all layout and page files (Phase 25 scope)"
  debug_session: ".planning/debug/theme-switching-not-working.md"
  note: "This is EXPECTED for Phase 22 -- token system was established, component migration is Phase 25"

- truth: "Scrollbars use theme-aware CSS variable colors with slim styling across all scrollable areas"
  status: failed
  reason: "User reported: Seller List still uses old Tailwind scrollbar plugin classes (scrollbar-thumb-gray-700) with hardcoded rgb values, not CSS variable classes. History Panel has no custom scrollbar classes at all (overflow-y-auto only, browser default 14px scrollbar)."
  severity: major
  test: 5
  root_cause: "No Tailwind scrollbar plugin installed -- old plugin classes (scrollbar-thumb-gray-700, scrollbar-track-transparent) are undefined and have no effect. sellers-grid.tsx mixes old plugin classes with new .scrollbar-thin. 3 panels (history-panel, recent-logs-sidebar, activity-feed) have overflow-y-auto but no scrollbar styling. 14 more files may need review."
  artifacts:
    - path: "apps/web/src/components/admin/collection/sellers-grid.tsx"
      issue: "Line 1512: mixes scrollbar-thin with old plugin classes scrollbar-thumb-gray-700 scrollbar-track-transparent"
    - path: "apps/web/src/components/admin/collection/history-panel.tsx"
      issue: "Line 228: overflow-y-auto with no scrollbar styling"
    - path: "apps/web/src/components/admin/collection/recent-logs-sidebar.tsx"
      issue: "Line 91: overflow-y-auto with no scrollbar styling"
    - path: "apps/web/src/components/admin/collection/activity-feed.tsx"
      issue: "Line 330: overflow-y-auto with no scrollbar styling"
  missing:
    - "Remove old plugin classes from sellers-grid.tsx, keep only scrollbar-thin"
    - "Add scrollbar-thin to history-panel, recent-logs-sidebar, activity-feed"
    - "Review 14 more files with overflow for scrollbar styling needs"
  debug_session: ".planning/debug/scrollbar-class-migration.md"
