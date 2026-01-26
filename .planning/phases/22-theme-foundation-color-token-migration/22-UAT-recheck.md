---
status: diagnosed
phase: 22-theme-foundation-color-token-migration
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md]
started: 2026-01-25T22:10:00Z
updated: 2026-01-25T22:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Account selector readability (Gap 1 recheck)
expected: Open the Order Tracker page. Click the account selector dropdown. All dropdown items should have readable text against the background -- no black text on dark background. Background should be a themed dark popover color, borders should be subtle themed borders.
result: issue
reported: "Dropdown renders with white background (#FFFFFF) and dark text (#0A0A0A) — readable but completely mismatches dark-themed page. Root cause: dark theme CSS variables are defined under .dark class selector, but HTML element only has data-theme='dark' attribute — .dark rules never activate. :root light-theme defaults remain in effect. Page appears dark only because layout uses hardcoded bg-gray-950. Component itself is correctly authored (bg-popover, border-border) but dark variable overrides never apply."
severity: major

### 2. Badge/filter chip readability (Gap 1 recheck)
expected: On the Order Tracker page, look at the filter chips (badge outline variants). Unselected chips should have readable text against the dark background -- no dark-on-dark text. The chip border should be visible.
result: issue
reported: "Unselected chips have near-black text (rgb(10,10,10)) on near-black bg-gray-950 background — effectively invisible (~1.02:1 contrast). text-foreground resolves to --foreground light-mode value because .dark class not on HTML element. Borders are visible (border-border = rgb(229,229,229) light gray). Same root cause as Test 1: CSS custom properties stuck in light-mode values because .dark selector never activates — only data-theme='dark' attribute present."
severity: major

### 3. Seller list scrollbar (Gap 3 recheck)
expected: Navigate to the Collection page with the seller list. Scroll through the seller list. The scrollbar should be slim/thin, using muted themed colors (not bright blue/white browser defaults). There should be NO extra-wide scrollbar or hardcoded gray scrollbar styling.
result: pass

### 4. History panel scrollbar (Gap 3 recheck)
expected: On the Collection page, find the History panel. If it has enough content to scroll, the scrollbar should be slim/thin with themed colors, not the wide browser default scrollbar.
result: pass

### 5. Dark theme preserved (smoke test)
expected: App loads with dark theme active. Dark backgrounds, light text across all pages. No flash of light content on load.
result: pass

### 6. data-theme attribute present
expected: In browser DevTools (F12), inspect the `<html>` element. It should have `data-theme="dark"` attribute.
result: pass

## Summary

total: 6
passed: 4
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Account selector dropdown uses themed dark popover background and border in dark mode"
  status: failed
  reason: "User reported: Dark theme CSS variables defined under .dark class selector but HTML has data-theme='dark' attribute only. .dark rules never activate. Dropdown renders white (#FFFFFF) background with dark text — light-theme defaults in effect. Component correctly uses bg-popover/border-border but dark variable overrides never apply due to selector mismatch."
  severity: major
  test: 1
  root_cause: "Turbopack (Next.js dev server) converts [data-theme='dark'] selector in globals.css to .dark class selector in dev CSS output. Production build preserves [data-theme=dark] correctly. HTML has data-theme='dark' attribute (from next-themes) but NOT class='dark', so dev CSS .dark{} block never matches. All CSS custom properties remain at light-mode :root values."
  artifacts:
    - path: "apps/web/.next/dev/static/chunks/src_app_globals_css_bad6b30c._.single.css"
      issue: "Line 4570: .dark { --background:#0a0a0a... } — should be [data-theme=dark]"
    - path: "apps/web/src/app/globals.css"
      issue: "Line 120: [data-theme='dark'] is correct in source but Turbopack rewrites it"
  missing:
    - "Configure next-themes to ALSO add class='dark' alongside data-theme='dark' (dual-selector strategy)"
  debug_session: ""

- truth: "Unselected filter chips have readable text against dark background"
  status: failed
  reason: "User reported: text-foreground resolves to near-black (rgb(10,10,10)) light-mode value on near-black bg-gray-950 background — invisible text. Same .dark class vs data-theme attribute selector mismatch. Borders visible (border-border works as light gray)."
  severity: major
  test: 2
  root_cause: "Same as Test 1 — Turbopack rewrites [data-theme='dark'] to .dark in dev CSS. text-foreground resolves to light-mode --foreground value because .dark{} never activates."
  artifacts:
    - path: "apps/web/src/components/ui/badge.tsx"
      issue: "text-foreground class resolves to light-mode value due to missing .dark activation"
  missing:
    - "Same fix as Test 1 — dual class+attribute strategy in ThemeProvider"
  debug_session: ""
