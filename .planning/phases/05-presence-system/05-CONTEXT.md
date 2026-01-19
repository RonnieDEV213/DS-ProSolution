# Phase 5: Presence System - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Account occupancy visibility with privacy-aware display. Admins see who is working on which account (name + clock-in time); VAs see only "Occupied" status. Presence updates in near real-time (1-3 seconds). VAs can only occupy one account at a time.

</domain>

<decisions>
## Implementation Decisions

### Occupancy Indicators
- Inline badge next to account name showing occupancy status
- Very subtle row background highlight for occupied accounts
- Red badge for occupied accounts, no indicator for available (available is default)
- Available accounts show nothing — occupied is the exception state

### Update Mechanism
- Near-instant updates (1-3 seconds) required
- Show "last seen X minutes ago" if presence data appears stale
- No auto-timeout for stale sessions — manual admin cleanup only
- Admin can force-clear presence entries that become orphaned

### Clock-in/out Integration
- Presence recorded immediately at access code validation (no separate clock-in step)
- One account per VA only — clocking into new account clears presence from previous
- Inactivity timeout (existing 1hr) auto-clears presence from account
- Explicit clock-out also clears presence

### Privacy Boundaries
- **Admin view:** Badge shows VA name + clock-in time (e.g., "John Doe • 2:30 PM")
- **VA view:** Badge shows only "Occupied" with no identity info
- VAs see their own account marked as occupied (self-awareness)

### Claude's Discretion
- Real-time technology choice (Supabase Realtime vs polling — pick simplest)
- Whether to implement heartbeats (evaluate if needed for reliability)
- Exact badge styling/colors matching existing design system
- How to display clock-in time format
- Staleness threshold for "last seen" indicator

</decisions>

<specifics>
## Specific Ideas

- Red/green color scheme for occupied/available states
- Badge in row shows name for admins, "Occupied" for VAs — same position, different content
- Very subtle row background tint so occupied rows are scannable at a glance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-presence-system*
*Context gathered: 2026-01-19*
