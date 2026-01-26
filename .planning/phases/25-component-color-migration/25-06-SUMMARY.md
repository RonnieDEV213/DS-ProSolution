---
phase: 25-component-color-migration
plan: 06
subsystem: profile-sync-va-pages
tags: [semantic-tokens, color-migration, profile-settings, sync-modal, page-migration, auth-exclusion]
requires: [24-layout-consolidation, 25-01]
provides: [profile-semantic-colors, page-semantic-colors, auth-dark-preservation]
affects: [25-07]
tech-stack:
  added: []
  patterns: [semantic-token-migration, monospace-access-code, bg-primary/10-pill, auth-dark-exclusion]
key-files:
  created: []
  modified:
    - apps/web/src/components/profile/access-code-display.tsx
    - apps/web/src/components/profile/profile-settings-dialog.tsx
    - apps/web/src/components/profile/extension-tab.tsx
    - apps/web/src/components/profile/profile-tab.tsx
    - apps/web/src/components/profile/security-tab.tsx
    - apps/web/src/components/profile/theme-picker.tsx
    - apps/web/src/components/sync/conflict-resolution-modal.tsx
    - apps/web/src/components/va/waiting-for-access.tsx
    - apps/web/src/app/admin/page.tsx
    - apps/web/src/app/admin/accounts/page.tsx
    - apps/web/src/app/admin/automation/page.tsx
    - apps/web/src/app/admin/department-roles/page.tsx
    - apps/web/src/app/admin/invites/page.tsx
    - apps/web/src/app/admin/order-tracking/page.tsx
    - apps/web/src/app/admin/users/page.tsx
    - apps/web/src/app/va/page.tsx
    - apps/web/src/app/va/accounts/page.tsx
    - apps/web/src/app/va/order-tracking/page.tsx
    - apps/web/src/app/client/page.tsx
    - apps/web/src/app/not-found.tsx
    - apps/web/src/app/page.tsx
    - apps/web/src/app/setup/page.tsx
    - apps/web/src/app/suspended/page.tsx
    - apps/web/src/app/login/page.tsx
key-decisions:
  - id: access-code-pill
    decision: "Access codes use font-mono text-lg with bg-primary/10 rounded-md pill and tracking-wider"
    rationale: "Critical data users copy and share - needs maximum readability across themes"
  - id: theme-preview-preservation
    decision: "Theme picker preview cards retain hardcoded hex colors"
    rationale: "Per Phase 23 decision - preview colors must show exact theme appearance regardless of active theme"
  - id: auth-dark-exclusion
    decision: "Login page and login-form retain fixed gray-* classes with exclusion comment"
    rationale: "Auth pages have intentionally dark fixed appearance not subject to theme switching"
  - id: suspended-destructive
    decision: "Suspended page title uses text-destructive for warning emphasis"
    rationale: "Visual severity indicator - account suspension is a critical status"
  - id: conflict-modal-monospace
    decision: "Conflict resolution field names use font-mono for precise comparison"
    rationale: "Field values need exact visual comparison during sync conflict resolution"
metrics:
  duration: ~8 minutes
  completed: 2026-01-26
---

# Phase 25 Plan 06: Profile, Sync, VA & Pages Migration Summary

Migrated profile settings dialog, sync conflict modal, VA waiting-for-access, and all page-level files from hardcoded gray-* to semantic tokens. Access codes use monospace pill styling. Auth pages preserved with fixed dark theme.

## Task Results

### Task 1: Migrate profile, sync, and VA components
**Commit:** 82ebb9e

Migrated 8 component files:
- **access-code-display.tsx** - Access code uses `font-mono text-lg bg-primary/10 px-3 py-1.5 rounded-md tracking-wider`. Labels use `text-muted-foreground`. Custom secret section uses `bg-muted/50 border-border`. Buttons use `border-input`.
- **profile-settings-dialog.tsx** - Dialog surface `bg-card border-border text-foreground`. Sidebar `bg-background`. Tab navigation inactive state `text-muted-foreground hover:bg-accent`. Loading skeleton `bg-muted`. Borders all `border-border`.
- **extension-tab.tsx** - Installation steps container `bg-muted/50 border-border`. Step number badges `bg-muted text-muted-foreground`. Heading `text-foreground`.
- **profile-tab.tsx** - Labels `text-muted-foreground`. Values `text-foreground`.
- **security-tab.tsx** - Heading `text-foreground`. Description `text-muted-foreground`.
- **theme-picker.tsx** - Title `text-foreground`, description `text-muted-foreground`. Theme label `text-foreground`, description `text-muted-foreground`. Compact picker inactive `text-muted-foreground`. Preview hex colors preserved.
- **conflict-resolution-modal.tsx** - Table border `border-border`. Header `bg-muted`, column labels `text-muted-foreground`. Row borders `border-border`. Field names `font-mono text-foreground`. Merge toggle buttons `bg-muted text-muted-foreground hover:bg-accent`.
- **waiting-for-access.tsx** - Card `bg-card border-border`. Title `text-foreground`. Message `text-muted-foreground`. Info box `bg-muted text-muted-foreground`.

### Task 2: Migrate all page.tsx files to semantic tokens
**Commit:** Already migrated in ef743d5 (25-04)

All 15 non-auth page files were found to be already migrated in a prior plan (25-04). Verification confirmed zero gray-* classes in all target files. Login page exclusion comment was also already present. No additional changes needed.

Pages verified clean:
- admin/page.tsx - Cards `bg-card`, numbers `font-mono`, labels `text-muted-foreground`
- admin/accounts/page.tsx - Search input `bg-muted border-input`
- admin/automation/page.tsx - Tabs use `border-primary`, `text-muted-foreground`
- admin/department-roles/page.tsx - Header `text-foreground`, desc `text-muted-foreground`
- admin/invites/page.tsx - Header migrated
- admin/order-tracking/page.tsx - Suspense fallback `text-muted-foreground`
- admin/users/page.tsx - Search input `bg-muted border-input`
- va/page.tsx - Cards `bg-card border-border`
- va/accounts/page.tsx - Search input `bg-muted border-input`
- va/order-tracking/page.tsx - Suspense fallback migrated
- client/page.tsx - Card `bg-card`, coming soon `text-muted-foreground`
- not-found.tsx - Background `bg-background`, CTA `bg-primary`, secondary `bg-muted`
- page.tsx - Root redirect `bg-background`, spinner `border-foreground`
- setup/page.tsx - Card `bg-card border-border`, descriptions `text-muted-foreground`
- suspended/page.tsx - Title `text-destructive`, button `border-border`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Access codes use font-mono bg-primary/10 pill | Maximum readability for critical copyable data |
| Theme preview hex colors preserved | Per Phase 23 - show exact theme appearance |
| Login page retains fixed dark grays | Intentional dark entry page, not themed |
| Suspended title uses text-destructive | Visual severity for account suspension status |
| Conflict fields use font-mono | Precise comparison needed during sync resolution |

## Deviations from Plan

### Task 2 Already Complete
**Found during:** Task 2 verification
**Issue:** All 15 non-auth page files and the login page exclusion comment were already migrated in commit ef743d5 (plan 25-04), which included page files alongside its primary collection component work.
**Resolution:** Verified all files are correctly migrated. No duplicate changes needed. Edits were idempotent.
**Impact:** None - work was already done correctly.

## Verification Results

1. `grep -rn "gray-" apps/web/src/components/profile/` - 0 results
2. `grep -rn "gray-" apps/web/src/components/sync/conflict-resolution-modal.tsx` - 0 results
3. `grep -rn "gray-" apps/web/src/components/va/waiting-for-access.tsx` - 0 results
4. All 15 non-auth page files - 0 gray-* matches each
5. `login/page.tsx` - 4 gray-* classes preserved (intentional)
6. `login-form.tsx` - 1 gray-* class preserved (intentional)
7. `npx tsc --noEmit` - passes

## Next Phase Readiness

Plan 25-06 complete. Remaining plan 25-07 should cover final verification sweep and any remaining files. The auth exclusion pattern (login page + login-form with fixed dark grays) is established and documented.
