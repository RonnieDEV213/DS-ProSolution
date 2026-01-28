---
status: resolved
trigger: "white-flash-no-records-on-refresh"
created: 2026-01-27T00:00:00Z
updated: 2026-01-27T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - three compounding root causes identified and fixed
test: TypeScript compiles cleanly, logic trace confirms correct loading sequence
expecting: skeleton -> data (no white flash, no false empty state)
next_action: archive session

## Symptoms

expected: Page refresh shows skeleton loading state immediately, then transitions to actual data. No white flash, no false "no records" state.
actual: White flash -> brief "no records available" empty state -> skeletons -> actual orders. Three incorrect intermediate states before data appears.
errors: No error messages - visual/UX issue only
reproduction: Refresh the order tracking / bookkeeping page in the browser. Page has existing records loaded.
started: Likely introduced or worsened by recent Phase 30 skeleton/empty state changes, but may have existed before with the white flash.

## Eliminated

## Evidence

- timestamp: 2026-01-27T00:00:30Z
  checked: DatabaseProvider component
  found: Returns null (renders nothing) while IndexedDB initializes. This is the white flash - the entire app tree is unmounted, showing just the bare body background.
  implication: White flash is caused by DatabaseProvider blocking render with `return null` before DB ready.

- timestamp: 2026-01-27T00:00:40Z
  checked: BookkeepingContent loading flow
  found: selectedAccountId starts as null. Account restoration from localStorage happens in a useEffect that only fires AFTER accounts load from server (useAccounts). Until accounts load, selectedAccountId=null, so the component shows FirstTimeEmpty ("Select an account").
  implication: False "no records" state occurs because account ID restoration is async and depends on server accounts fetch.

- timestamp: 2026-01-27T00:00:50Z
  checked: useSyncRecords hook + VirtualizedRecordsList isLoading prop
  found: BookkeepingContent passes `isLoading={recordsFetching}` (line 284 original) to VirtualizedRecordsList. But `recordsFetching` maps to `syncResult.isSyncing` (background server sync), NOT `syncResult.isLoading` (initial IndexedDB query pending). So when the component first mounts, `isLoading` is false even though records haven't loaded yet from IndexedDB. VirtualizedRecordsList sees `isLoading=false` and `records=[]`, showing the empty state instead of skeletons.
  implication: CRITICAL BUG - wrong loading state variable passed as prop. Should be `recordsLoading` (initial load), not `recordsFetching` (background sync).

- timestamp: 2026-01-27T00:01:00Z
  checked: Full loading chain trace
  found: Complete broken sequence: (1) DatabaseProvider renders null -> WHITE FLASH -> (2) DB ready, BookkeepingContent mounts with selectedAccountId=null -> (3) Shows FirstTimeEmpty (false "no records") -> (4) Accounts load, useEffect restores selectedAccountId -> (5) useSyncRecords starts, recordsLoading=true but recordsFetching=false -> (6) VirtualizedRecordsList receives isLoading=false (wrong!) with records=[] -> shows empty state AGAIN -> (7) Server sync begins, recordsFetching=true -> shows skeletons finally -> (8) Data arrives
  implication: Three independent bugs compound into the sequence of white flash -> false empty -> skeletons -> data

## Resolution

root_cause: Three compounding issues:
  (1) DatabaseProvider returns null during DB init, causing white flash (entire app tree unmounted)
  (2) BookkeepingContent initializes selectedAccountId as null, not eagerly restored from localStorage/URL. Account restoration delayed until after server accounts fetch completes, causing false FirstTimeEmpty display.
  (3) BookkeepingContent passes `isLoading={recordsFetching}` (isSyncing - background sync) instead of `isLoading={recordsLoading}` (isLoading - initial IndexedDB query pending). VirtualizedRecordsList sees isLoading=false with empty records array and shows empty state instead of skeletons.

fix: Three targeted changes:
  (A) DatabaseProvider: Render children immediately instead of blocking with `return null`. DB init fires in useEffect background. Dexie's useLiveQuery handles pending DB gracefully (returns undefined -> isLoading=true downstream).
  (B) BookkeepingContent: Eagerly restore selectedAccountId from localStorage/URL synchronously in useState initializer. After accounts load, validate the eagerly-restored ID and clear if invalid.
  (C) BookkeepingContent: Change `isLoading={recordsFetching}` to `isLoading={recordsLoading}` so VirtualizedRecordsList shows skeletons during initial load.

verification: TypeScript compiles cleanly. Traced loading sequence post-fix: (1) React renders, DatabaseProvider renders children immediately (no white flash) -> (2) BookkeepingContent mounts with selectedAccountId already set from localStorage -> (3) useSyncRecords starts, records=undefined, isLoading=true -> (4) VirtualizedRecordsList receives isLoading=true -> shows skeletons -> (5) IndexedDB query resolves with cached records -> data appears. Result: skeleton -> data.

files_changed:
  - apps/web/src/components/providers/database-provider.tsx
  - apps/web/src/components/bookkeeping/bookkeeping-content.tsx
