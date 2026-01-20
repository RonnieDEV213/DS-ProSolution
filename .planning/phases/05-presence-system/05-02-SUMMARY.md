# Plan 05-02 Summary: Frontend Presence UI

## Status: Complete

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create usePresence hook | 0808f2c | apps/web/src/hooks/use-presence.ts |
| 2 | Create OccupancyBadge component | 6282286 | apps/web/src/components/presence/occupancy-badge.tsx |
| 3 | Integrate presence into AccountsTable | 32b1bd7, b114fd0 | accounts-table.tsx, account-selector.tsx, use-user-role.ts |
| 4 | Human verification checkpoint | - | Approved by user |

## Deliverables

### usePresence Hook
- Real-time subscription to `account_presence` table via Supabase Realtime
- Fetches presence data with separate profiles query (avoids join issues)
- Returns `Map<account_id, PresenceEntry>` for O(1) lookups
- Auto-refetches on INSERT/UPDATE events

### OccupancyBadge Component
- Shows "Available" (green) for unoccupied accounts
- Shows "Occupied" (red) for VA view of others' accounts
- Shows "You" (blue) for user's own account
- Admin view: "Name · Time · Duration" with live timer (updates every minute)
- Supports `inline` prop for table cell display

### AccountsTable Integration
- Added "Status" column showing presence indicators
- Admin sees full details (VA name, clock-in time, live duration)
- VA sees only "Occupied" or "Available" (privacy preserved)
- Real-time updates via usePresence hook

### VA Accounts Page
- Created `/va/accounts` page for VAs with accounts.view permission
- Added "Accounts" nav item to VA sidebar
- Shows assigned accounts with presence status

## Corrections Made During Execution

1. **Moved presence from AccountSelector to AccountsTable** - Per user feedback, presence should display on the Accounts page, not in the bookkeeping dropdown

2. **Fixed usePresence join syntax** - Changed from `profiles:user_id` join (requires FK) to separate queries for account_presence and profiles

3. **Added account_id to pairing flow** - Updated backend and extension to pass account_id on clock-in for presence recording

4. **Added userId to useUserRole hook** - Needed for determining if current user is the occupant

## Deviations from Plan

- Original plan had presence on AccountSelector; moved to AccountsTable per user clarification
- Added VA accounts page (`/va/accounts`) which wasn't in original plan scope

## Duration

~15 minutes (including corrections and user feedback loop)
