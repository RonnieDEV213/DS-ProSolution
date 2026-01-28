---
status: verifying
trigger: "Multiple related UI flash/jank issues on page load and navigation"
created: 2026-01-27T00:00:00Z
updated: 2026-01-27T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED - four independent root causes identified and fixed
test: TypeScript compiles cleanly, logic trace confirms correct behavior
expecting: All four issues resolved
next_action: Mark as resolved after user verification

## Symptoms

expected:
1. On refresh, theme should apply immediately without flashing a different theme (dawn)
2. When navigating away from order tracker and back, records should load without flashing "No records yet" empty state
3. Page header should animate smoothly into position, not be instantly pushed up by fast-loading records
4. No hydration mismatch errors

actual:
1. On refresh, theme briefly shows "dawn" theme before switching to the correct selected theme
2. ~40% of the time when navigating back to order tracker, "No records yet" empty state flashes, then skeleton, then records
3. The page header starts below its resting height and gets pushed up instantly because ~740 records load very fast
4. Hydration mismatch error on Radix collapsible IDs in sidebar (aria-controls/id differ between server/client)

errors:
- React hydration mismatch on sidebar CollapsibleSection components
- Radix UI IDs differ between server render and client render
- Error occurs in SidebarMenuButton at sidebar.tsx:575

reproduction:
1. Theme flash: Hard refresh any page
2. Empty state flash: Navigate away then back, ~4/10 times
3. Header jank: Refresh order tracker page
4. Hydration error: Rapidly refresh page

started: After recent changes (user unsure exactly which)

## Eliminated

## Evidence

- timestamp: 2026-01-27T00:01:00Z
  checked: layout.tsx ThemeProvider configuration
  found: ThemeProvider uses attribute={["class", "data-theme"]}, defaultTheme="system", value map includes light->dawn and dark->carbon. next-themes inline script reads localStorage and resolves system theme. The value map is applied to class attributes but NOT to data-* attributes in the inline script. This means data-theme="light" is set instead of data-theme="dawn" for system light preference.
  implication: CSS selectors [data-theme="dawn"] don't match data-theme="light", causing neutral :root styles to show briefly

- timestamp: 2026-01-27T00:02:00Z
  checked: next-themes source code (index.mjs) - inline script function M
  found: For class attribute: d.classList.add(a[n]||n) applies the value map. For data-* attributes: d.setAttribute(y,n) does NOT apply the value map. Additionally, disableTransitionOnChange=false means CSS transitions animate the theme change visibly.
  implication: Two-pronged issue: (1) data-theme gets unmapped value "light"/"dark", (2) CSS transitions make any subsequent correction visible

- timestamp: 2026-01-27T00:03:00Z
  checked: useSyncRecords isLoading logic
  found: isLoading = records === undefined. Dexie useLiveQuery can return [] momentarily before real IndexedDB data on component remount. When records=[] and isLoading=false, VirtualizedRecordsList shows FirstTimeEmpty instead of skeleton.
  implication: Race condition in useLiveQuery causes false empty state on ~40% of navigations back

- timestamp: 2026-01-27T00:03:30Z
  checked: BookkeepingContent entrance animation
  found: motion.div wraps entire page with initial={{ opacity: 0, y: 20 }}. When records load instantly from IndexedDB cache, the 20px vertical animation creates visible header jank.
  implication: Animation designed for slow loading conflicts with fast cache-first architecture

- timestamp: 2026-01-27T00:04:00Z
  checked: app-sidebar.tsx Radix Collapsible hydration
  found: Radix Collapsible.Root generates IDs via React.useId(). Server/client component tree differences (dynamic imports with ssr:false, SidebarProvider cookie-based state) cause useId() to generate different IDs on server vs client.
  implication: Hydration mismatch is structural - Radix Collapsible needs client-only rendering

## Resolution

root_cause: Four independent issues:
  (1) THEME FLASH: next-themes' inline script does NOT apply the value map to data-* attributes. For system theme, data-theme="light" is set instead of "dawn", causing neutral :root styles. Additionally, disableTransitionOnChange=false allows CSS transitions to animate the correction visibly.
  (2) EMPTY STATE FLASH: useSyncRecords' isLoading logic (records === undefined) is too narrow. When useLiveQuery returns [] before real IndexedDB data, the component shows "No records yet" instead of skeleton.
  (3) HEADER JANK: framer-motion entrance animation (y:20->0) on BookkeepingContent conflicts with fast cache-first data loading. The 20px vertical slide creates visible header jank.
  (4) HYDRATION MISMATCH: Radix Collapsible uses React.useId() which generates different IDs when server/client trees differ (due to dynamic imports with ssr:false in sibling components).

fix: Four targeted changes:
  (A) THEME: Set disableTransitionOnChange=true to suppress CSS transitions during hydration (View Transitions API still works for manual switching). Added head MutationObserver script to correct data-theme="light"->"dawn" and "dark"->"carbon" before first paint. Added CSS :is() aliases so [data-theme="light"] matches [data-theme="dawn"] rules and [data-theme="dark"] matches [data-theme="carbon"] rules. Added "dark" to @custom-variant dark selector.
  (B) EMPTY STATE: Added hasSyncedOnceRef to useSyncRecords. isLoading is now true when records is empty AND first sync hasn't completed. After sync completes (success or error), hasSyncedOnceRef=true and isLoading properly reflects empty state.
  (C) HEADER: Replaced framer-motion entrance animation (20px translateY) with CSS animate-fade-in class (4px translateY, 300ms). Removed unused motion/toast imports.
  (D) HYDRATION: Defer Radix Collapsible rendering until after hydration via mounted state. SSR renders plain SidebarMenuButton + SectionItems. After useEffect fires, upgrades to Collapsible.Root + Trigger + Content. Extracted SectionItems component to avoid duplication.

verification: TypeScript compiles cleanly. Logic trace:
  (A) Theme: inline script -> data-theme="light" -> MutationObserver corrects to "dawn" (microtask, before paint) -> CSS matches [data-theme="dawn"] via :is() alias. disableTransitionOnChange=true suppresses any CSS transition animation.
  (B) Empty state: Mount -> records=undefined -> isLoading=true (skeleton) -> records=[] -> isLoading=true (hasSyncedOnceRef=false, still skeleton) -> sync completes -> hasSyncedOnceRef=true, setIsSyncing(false) triggers re-render -> isLoading=false -> if records still [], shows "No records yet" (correct for truly empty account). If IndexedDB had cached data, records would already have real data before sync completes.
  (C) Header: CSS animation is 4px translateY vs 20px, much less visible. No framer-motion re-mount animation jank.
  (D) Hydration: Server renders non-Collapsible tree. Client first render (hydration) also renders non-Collapsible (mounted=false). After hydration, useEffect fires, mounted=true, Collapsible renders (normal client update, no hydration mismatch).

files_changed:
  - apps/web/src/app/layout.tsx (disableTransitionOnChange, head MutationObserver script)
  - apps/web/src/app/globals.css (CSS :is() aliases for light/dark data-theme, dark variant selector)
  - apps/web/src/hooks/sync/use-sync-records.ts (hasSyncedOnceRef, isLoading logic)
  - apps/web/src/components/bookkeeping/bookkeeping-content.tsx (animate-fade-in, removed unused imports)
  - apps/web/src/components/layout/app-sidebar.tsx (mounted state, deferred Collapsible, SectionItems extraction)
