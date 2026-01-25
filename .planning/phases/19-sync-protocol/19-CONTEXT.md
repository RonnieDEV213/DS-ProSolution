# Phase 19: Sync Protocol - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide users clear visibility into sync status — when data is syncing, synced, or failed — with reliable error handling and offline resilience. Includes global sync indicator, row-level status badges, conflict resolution UI, and offline queue management.

</domain>

<decisions>
## Implementation Decisions

### Status Indicator Placement
- Lives in header bar (right side), persistent location
- Hidden when synced — only appears during active sync or errors
- During sync: spinner + progress count ("Syncing 45/120 records")
- On error: red icon + "Sync failed" text, persistent until manually retried or dismissed

### Row-Level Sync Badges
- Position: inline with row selector (checkbox column area)
- Only show pending and error states — no badge when synced (clean look)
- Pending state: small spinning dot (subtle animated indicator)
- Error state: hover tooltip shows error message + includes retry button

### Conflict Resolution UX
- Conflicts surface via modal dialog (blocks until resolved)
- Display: field-by-field list showing only differing fields (compact)
- Actions: "Keep mine" / "Keep theirs" / "Merge" (three buttons)
- Flow: one conflict at a time, with "apply to all" option for remaining conflicts

### Offline Behavior
- Offline state shown via header indicator change (sync icon becomes offline icon)
- Mutations allowed with warning ("You're offline, changes will sync later")
- Queue invisible to user — trust the system, just row-level pending badges
- On reconnect: auto-sync immediately (no prompt, no notification)

### Claude's Discretion
- Retry backoff timing and max attempts (requirements say max 3)
- Exact spinner/animation implementation
- Merge conflict logic (how to combine when "Merge" is selected)
- Error message wording and formatting
- Tooltip and modal styling details

</decisions>

<specifics>
## Specific Ideas

- Header indicator should feel similar to cloud sync indicators (Dropbox, Google Drive) — unobtrusive until needed
- Field-by-field conflict view keeps it compact — no need to see entire record side-by-side
- "Apply to all" option is important for bulk imports that might create many conflicts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-sync-protocol*
*Context gathered: 2026-01-24*
