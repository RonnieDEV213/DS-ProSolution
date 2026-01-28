# Phase 30: Consistent Skeletons & Empty States - Research

**Researched:** 2026-01-27
**Domain:** React loading states, skeleton placeholders, empty state illustrations
**Confidence:** HIGH

## Summary

This phase eliminates all "Loading..." text strings throughout the application and replaces them with skeleton placeholders and consistent empty state illustrations. The codebase already has a well-built foundation: `DashboardSkeleton`, `TableSkeleton`, `SkeletonRow` components, the `Skeleton` UI primitive with CSS gradient shimmer animation, and a full set of empty state components (`EmptyState`, `FirstTimeEmpty`, `NoResults`, `FilteredEmpty`, `ErrorEmpty`) with SVG illustrations (`SearchIllustration`, `EmptyBoxIllustration`, `ErrorIllustration`, `FilterIllustration`).

The work is primarily wiring -- replacing `"Loading..."` text with existing skeleton components, and ensuring all empty-data paths use the appropriate empty state illustration. Phase 29 introduced `useCachedQuery` which provides an `isLoading` + cached `data` pattern (first load = skeleton, revisit = cached data instantly). Components already using `useCachedQuery` (admin dashboard, users-table, accounts-table, invites-list, department-roles-table) already have the correct skeleton integration. The remaining work targets components that still use `useAutomationPolling` or raw `useState`/`useEffect` patterns for data fetching.

**Primary recommendation:** Replace each "Loading..." occurrence with the appropriate skeleton component (`TableSkeleton` for table contexts, `DashboardSkeleton` for dashboard contexts, `Skeleton` primitives for inline/modal contexts), and add empty state illustrations where missing (collection panels, automation sub-pages, modal dialogs).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `Skeleton` | `components/ui/skeleton.tsx` | Base primitive, `skeleton-shimmer` CSS class | DONE - uses gradient shimmer |
| `DashboardSkeleton` | `components/skeletons/dashboard-skeleton.tsx` | Full-page dashboard skeleton (header + metrics cards + content area) | DONE |
| `TableSkeleton` | `components/skeletons/table-skeleton.tsx` | Full table skeleton (toolbar + header + rows + pagination), configurable `columns` and `rows` | DONE |
| `SkeletonRow` | `components/bookkeeping/skeleton-row.tsx` | Virtualized list skeleton row for bookkeeping | DONE |

### Empty State Components
| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `EmptyState` | `components/empty-states/empty-state.tsx` | Base wrapper: `illustration`, `title`, `description`, `action` props | DONE |
| `FirstTimeEmpty` | `components/empty-states/first-time-empty.tsx` | "No X yet" with `EmptyBoxIllustration`, `entityName`, optional CTA | DONE |
| `NoResults` | `components/empty-states/no-results.tsx` | "No results found" with `SearchIllustration`, optional `searchTerm` | DONE |
| `FilteredEmpty` | `components/empty-states/filtered-empty.tsx` | "No matching results" with `FilterIllustration`, optional `onClearFilters` | DONE |
| `ErrorEmpty` | `components/empty-states/error-empty.tsx` | "Something went wrong" with `ErrorIllustration`, optional `onRetry` | DONE |

### SVG Illustrations
| Illustration | Location | Visual | Used By |
|-------------|----------|--------|---------|
| `SearchIllustration` | `components/empty-states/illustrations.tsx` | Magnifying glass | `NoResults` |
| `EmptyBoxIllustration` | `components/empty-states/illustrations.tsx` | Open box | `FirstTimeEmpty` |
| `ErrorIllustration` | `components/empty-states/illustrations.tsx` | Warning triangle | `ErrorEmpty` |
| `FilterIllustration` | `components/empty-states/illustrations.tsx` | Funnel | `FilteredEmpty` |

### CSS Foundation
```css
/* Already in globals.css */
.skeleton-shimmer {
  background: linear-gradient(90deg, var(--muted) 0%, oklch(...) 50%, var(--muted) 100%);
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
}

.animate-fade-in {
  animation: fade-in 300ms ease-out both;
}
```

**No new libraries needed.** Everything is built. This is pure wiring work.

## Architecture Patterns

### Pattern 1: useCachedQuery Skeleton Pattern (Already Established)
**What:** Components using `useCachedQuery` check `isLoading && !data` to show skeleton on first load, then show cached data instantly on revisits.
**When to use:** Any component fetching data via `useCachedQuery`.
**Example (from admin dashboard page.tsx):**
```typescript
const { data: counts, isLoading, isError } = useCachedQuery<DashboardCounts>({
  queryKey: queryKeys.admin.dashboardCounts(),
  queryFn: async () => { /* ... */ },
  cacheKey: "admin:dashboard-counts",
  staleTime: 60 * 1000,
});

// Show skeleton on first load with no cached data
if (isLoading && !counts) {
  return <DashboardSkeleton />;
}
```

### Pattern 2: Table Component Skeleton Pattern (Already Established)
**What:** Table components render `TableSkeleton` inside a `<TableCell colSpan={N}>` when loading and no data exists.
**When to use:** Any table that loads data asynchronously.
**Example (from users-table.tsx):**
```typescript
<TableBody>
  {loading && users.length === 0 ? (
    <TableRow>
      <TableCell colSpan={4} className="p-0">
        <TableSkeleton columns={4} rows={5} />
      </TableCell>
    </TableRow>
  ) : users.length === 0 ? (
    <TableRow>
      <TableCell colSpan={4} className="py-8">
        {search ? (
          <NoResults searchTerm={search} />
        ) : (
          <FirstTimeEmpty entityName="users" />
        )}
      </TableCell>
    </TableRow>
  ) : (
    /* render rows */
  )}
</TableBody>
```

### Pattern 3: Inline Skeleton for Small Panels/Modals
**What:** For non-table, non-dashboard contexts (history panels, modal content, sidebar panels), use inline `Skeleton` primitives that match the shape of the expected content.
**When to use:** Modals, sidebars, small panels.
**Example:**
```typescript
// For a history panel list
if (loading) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
```

### Pattern 4: Layout-Level Skeleton
**What:** Layout components that gate on role/auth loading should show a full-page skeleton instead of "Loading..." text.
**When to use:** Layouts that check `useUserRole()` or auth state.
**Example (va/layout.tsx):**
```typescript
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <DashboardSkeleton />
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **"Loading..." text anywhere**: Replace with skeleton that matches the shape of expected content
- **Blank screen then data pop-in**: Always show skeleton during initial load
- **Spinner-only loading**: Spinners are acceptable for action feedback (save, delete), not for page/section data loading
- **Skeleton that doesn't match content shape**: Skeletons should approximate the layout of the real content

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table loading state | Custom loading row | `TableSkeleton` (columns, rows props) | Matches table structure, uses shimmer animation |
| Dashboard loading | Spinner or text | `DashboardSkeleton` | Matches metrics + content layout |
| Empty data (no items) | Plain text "No data" | `FirstTimeEmpty` with `entityName` | Consistent illustration, optional CTA |
| Empty search results | Plain text "No results" | `NoResults` with `searchTerm` | Search-specific illustration and message |
| Empty filtered results | Plain text | `FilteredEmpty` with `onClearFilters` | Filter-specific illustration, clear button |
| Error loading data | Alert or plain text | `ErrorEmpty` with `onRetry` | Consistent error illustration, retry CTA |
| Skeleton shimmer effect | CSS animation from scratch | `skeleton-shimmer` CSS class (already in globals.css) | Gradient shimmer, reduced-motion support |

**Key insight:** Every skeleton/empty state component already exists and is already used in some pages. The work is purely extending coverage to all remaining pages.

## Common Pitfalls

### Pitfall 1: Showing Skeleton When Cached Data Exists
**What goes wrong:** After `useCachedQuery` integration, skeleton flashes briefly even when IndexedDB has cached data.
**Why it happens:** Not checking `isLoading && !data` -- checking `isLoading` alone ignores cached `initialData`.
**How to avoid:** Always use the `isLoading && !data` guard, not just `isLoading`.
**Warning signs:** Skeleton flashes on page revisit despite data being available.

### Pitfall 2: Skeleton Dimensions Mismatching Content
**What goes wrong:** Skeleton doesn't match the shape/size of the actual content, causing layout shift when data loads.
**Why it happens:** Using a generic skeleton that doesn't approximate the real layout.
**How to avoid:** Use `TableSkeleton` with matching column count for tables; create inline skeletons that approximate the real content for panels/modals.
**Warning signs:** Visible layout jump when loading completes.

### Pitfall 3: Missing Empty State After Filter/Search
**What goes wrong:** User searches, gets no results, sees blank space instead of helpful empty state.
**Why it happens:** Only checking for `data.length === 0` without distinguishing between "no data exists" and "no results match".
**How to avoid:** Check whether search/filter is active to choose between `FirstTimeEmpty` and `NoResults`/`FilteredEmpty`.
**Warning signs:** Blank area after searching with no guidance.

### Pitfall 4: Forgetting Modal/Dialog Loading States
**What goes wrong:** Modal opens and shows "Loading..." while fetching detail data.
**Why it happens:** Modals are often overlooked during skeleton audits.
**How to avoid:** Audit all `Dialog`/`AlertDialog` components that fetch data on open.
**Warning signs:** Text "Loading..." appears inside any modal.

### Pitfall 5: Deprecated Components Still Using Loading Text
**What goes wrong:** Deprecated but still-imported components contain "Loading..." text.
**Why it happens:** Components marked `@deprecated` may still be referenced.
**How to avoid:** Check if deprecated components are actually imported anywhere before ignoring them.
**Warning signs:** `recent-logs-sidebar.tsx` is `@deprecated` but may still be imported.

## Comprehensive Audit: All "Loading..." Occurrences

### PRIMARY TARGETS (Page-Level & Component-Level)

| # | File | Line | Context | Current | Replacement | Priority |
|---|------|------|---------|---------|-------------|----------|
| 1 | `app/va/layout.tsx` | 55 | Layout role-check loading | `"Loading..."` text | `DashboardSkeleton` or minimal page skeleton | HIGH |
| 2 | `automation/jobs-table.tsx` | 121 | Table initial load | `"Loading..."` in TableCell | `TableSkeleton columns={5} rows={5}` | HIGH |
| 3 | `automation/agents-table.tsx` | 214 | Agent list initial load | `"Loading..."` in div | `TableSkeleton columns={6} rows={4}` | HIGH |
| 4 | `automation/pairing-requests-table.tsx` | 206 | Pairing requests initial load | `"Loading..."` in TableCell | `TableSkeleton columns={5} rows={3}` | HIGH |
| 5 | `collection/sellers-grid.tsx` | 1117 | Sellers grid initial load | `"Loading sellers..."` text | Grid-shaped skeleton (multiple `Skeleton` blocks in grid) | HIGH |
| 6 | `collection/history-panel.tsx` | 219 | History panel loading | `"Loading..."` text | Inline skeleton list (5 rows approximating history entries) | HIGH |
| 7 | `collection/log-detail-modal.tsx` | 268 | Modal content loading | `"Loading..."` in div | Inline skeleton (header + content area) | MEDIUM |
| 8 | `collection/log-detail-modal.tsx` | 278 | Changes sub-section loading | `"Loading changes..."` text | Inline skeleton (list rows) | MEDIUM |
| 9 | `collection/schedule-config.tsx` | 150 | Schedule loading | `"Loading schedule..."` text | Inline skeleton (card-shaped, form fields) | MEDIUM |

### SECONDARY TARGETS (Dialog/Modal Contexts)

| # | File | Line | Context | Current | Replacement | Priority |
|---|------|------|---------|---------|-------------|----------|
| 10 | `account-dialog.tsx` | 476 | Delete button loading state | `"Loading..."` button text | Keep as-is (action feedback, not data loading) | LOW |
| 11 | `account-dialog.tsx` | 608 | Tab content loading | `"Loading..."` text | Inline skeleton | MEDIUM |
| 12 | `department-role-dialog.tsx` | 623 | Profiles list loading | `"Loading profiles..."` | `TableSkeleton columns={3} rows={3}` | MEDIUM |
| 13 | `department-role-dialog.tsx` | 766 | VAs list loading | `"Loading VAs..."` | Inline skeleton list | MEDIUM |
| 14 | `user-edit-dialog.tsx` | 550 | Profiles loading | `"Loading profiles..."` | Inline skeleton | MEDIUM |

### DEPRECATED (May Not Need Changes)

| # | File | Status | Action |
|---|------|--------|--------|
| 15 | `collection/recent-logs-sidebar.tsx` | `@deprecated` - replaced by HistoryPanel | Verify not imported; if not imported, skip |
| 16 | `collection/collection-history.tsx` | `@deprecated` - replaced by HistoryPanel | Verify not imported; if not imported, skip |

## Empty State Audit

### Components Already Using Empty States Correctly
| Component | Empty State Used | Status |
|-----------|-----------------|--------|
| `users-table.tsx` | `FirstTimeEmpty` + `NoResults` | DONE |
| `accounts-table.tsx` | `FirstTimeEmpty` + `NoResults` | DONE |
| `jobs-table.tsx` | `FirstTimeEmpty` | DONE |
| `agents-table.tsx` | `FirstTimeEmpty` | DONE |
| `invites-list.tsx` | `FirstTimeEmpty` | DONE |
| `department-roles-table.tsx` | `FirstTimeEmpty` | DONE |
| `bookkeeping-content.tsx` | `FirstTimeEmpty` + `FilteredEmpty` | DONE |
| `virtualized-records-list.tsx` | `FirstTimeEmpty` + `FilteredEmpty` | DONE |
| `admin/page.tsx` (dashboard) | `ErrorEmpty` | DONE |

### Components Missing or Needing Empty State Review
| Component | Current Empty State | What's Needed |
|-----------|-------------------|---------------|
| `pairing-requests-table.tsx` | Plain text `"No pending pairing requests"` | `FirstTimeEmpty entityName="pairing requests"` |
| `collection/sellers-grid.tsx` | Needs verification | Check if FirstTimeEmpty/NoResults is used |
| `collection/history-panel.tsx` | Plain text `"No activity yet"` | `FirstTimeEmpty entityName="history entries"` or keep simple text (sidebar context) |
| `collection/schedule-config.tsx` | Plain text `"Unable to load schedule"` | `ErrorEmpty` with retry |

## Code Examples

### Example 1: Replace Table "Loading..." with TableSkeleton
```typescript
// BEFORE (jobs-table.tsx line 118-123)
{loading && !jobs ? (
  <TableRow>
    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
      Loading...
    </TableCell>
  </TableRow>
)

// AFTER
{loading && !jobs ? (
  <TableRow>
    <TableCell colSpan={5} className="p-0">
      <TableSkeleton columns={5} rows={5} />
    </TableCell>
  </TableRow>
)
```

### Example 2: Replace Layout "Loading..." with DashboardSkeleton
```typescript
// BEFORE (va/layout.tsx line 52-57)
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

// AFTER
if (loading) {
  return (
    <SidebarProvider>
      <AppSidebar sections={[]} basePath="/va" roleLabel="VA" role="va" />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Skeleton className="h-4 w-32" />
        </header>
        <div className="flex-1 p-8">
          <DashboardSkeleton />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### Example 3: Inline Skeleton for Panel/Sidebar
```typescript
// BEFORE (history-panel.tsx line 218-219)
{loading ? (
  <div className="text-muted-foreground text-sm">Loading...</div>
)

// AFTER
{loading ? (
  <div className="space-y-2 animate-fade-in">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="px-3 py-1.5 rounded border-l-2 border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 flex-1" />
        </div>
        <Skeleton className="h-2 w-20 mt-1" />
      </div>
    ))}
  </div>
)
```

### Example 4: Grid-Shaped Skeleton for Sellers Grid
```typescript
// BEFORE (sellers-grid.tsx line 1116-1118)
if (loading) {
  return <div className="text-muted-foreground p-4">Loading sellers...</div>;
}

// AFTER
if (loading) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 gap-2">
        <Skeleton className="h-8 flex-1 max-w-xs" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-4 gap-1 flex-1">
        {Array.from({ length: 40 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
```

### Example 5: Replace Plain Text Empty with FirstTimeEmpty
```typescript
// BEFORE (pairing-requests-table.tsx line 211-212)
<TableCell colSpan={5} className="text-center text-muted-foreground py-8">
  No pending pairing requests
</TableCell>

// AFTER
<TableCell colSpan={5} className="py-8">
  <FirstTimeEmpty
    entityName="pairing requests"
    description="No Chrome Extensions are waiting to be paired."
  />
</TableCell>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `"Loading..."` text | Skeleton shimmer components | Phase 26 (components created) | Components exist but not universally applied |
| Plain empty text | SVG illustrated empty states | Phase 26 (components created) | Components exist but not universally applied |
| `useEffect` + `useState` data fetching | `useCachedQuery` with IndexedDB persistence | Phase 29 | Skeletons only show on first-ever load; revisits show cached data |

**Key insight:** The skeleton and empty state components were created in Phase 26 and some pages adopted them, but many pages were not retrofitted. Phase 30 completes the retrofit across the entire application.

## useCachedQuery Interaction

The `useCachedQuery` hook (Phase 29) changes skeleton behavior:

1. **First-ever visit** (no IndexedDB cache): `isLoading=true`, `data=undefined` -- skeleton shows
2. **Subsequent visits** (IndexedDB has data): `isLoading=false` (or brief), `data=cachedValue` from `initialData` -- data shows instantly
3. **Background refresh**: Data updates silently without loading state

**Impact on skeleton logic:** Components using `useCachedQuery` should check `isLoading && !data` (not just `isLoading`) to avoid flashing skeleton when cached data exists. Components already migrated to `useCachedQuery` (users-table, accounts-table, admin dashboard, invites-list, department-roles-table) already follow this pattern.

**Components NOT yet on useCachedQuery:** The automation tables (jobs-table, agents-table, pairing-requests-table) use `useAutomationPolling` which returns `{ data, loading }`. The sellers-grid uses `useSyncSellers`. The history-panel uses `useSyncRunHistory`. These hooks have their own loading patterns but the skeleton replacement approach is the same: check `loading && !data`.

## Categorization of Work

### Batch 1: Page-Level Loading States (SKEL-01, SKEL-03)
Files: `va/layout.tsx`, `automation/jobs-table.tsx`, `automation/agents-table.tsx`, `automation/pairing-requests-table.tsx`
Pattern: Replace `"Loading..."` with `TableSkeleton` or `DashboardSkeleton`

### Batch 2: Collection Page Loading States (SKEL-03)
Files: `sellers-grid.tsx`, `history-panel.tsx`, `schedule-config.tsx`
Pattern: Replace `"Loading..."` with inline skeletons matching content shape

### Batch 3: Modal/Dialog Loading States (SKEL-03)
Files: `log-detail-modal.tsx`, `account-dialog.tsx`, `department-role-dialog.tsx`, `user-edit-dialog.tsx`
Pattern: Replace `"Loading..."` with inline skeletons inside dialog content

### Batch 4: Empty State Standardization (SKEL-02)
Files: `pairing-requests-table.tsx`, `history-panel.tsx`, `schedule-config.tsx`
Pattern: Replace plain text empty states with `FirstTimeEmpty`/`ErrorEmpty`

## Open Questions

1. **VA layout skeleton fidelity**: The VA layout loading state wraps the entire page including sidebar. Should the skeleton include a sidebar shell, or just show the skeleton in the content area? The admin layout does NOT have a loading gate (it renders immediately). Recommendation: render sidebar shell + `DashboardSkeleton` in content area for maximum perceived performance.

2. **Deprecated components**: `recent-logs-sidebar.tsx` and `collection-history.tsx` are marked `@deprecated`. Need to verify they are not imported anywhere active. If not imported, skip them. If still imported somewhere, replace their loading text too.

3. **Button loading text ("Loading..." in delete button)**: The `account-dialog.tsx` line 476 uses `"Loading..."` as button text while counting records for deletion. This is action feedback, not data loading. Recommendation: keep as-is or change to a spinner icon, but it is NOT a SKEL-03 violation since it's not a data-loading page transition.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files in `apps/web/src/`
- Existing component implementations in `components/skeletons/` and `components/empty-states/`
- `useCachedQuery` hook implementation in `hooks/use-cached-query.ts`
- `.planning/REQUIREMENTS.md` for SKEL-01, SKEL-02, SKEL-03 definitions

### Secondary (MEDIUM confidence)
- Phase 26 created the skeleton/empty state components (verified by code comments)
- Phase 29 introduced `useCachedQuery` (verified by hook implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components examined directly in codebase
- Architecture: HIGH - patterns extracted from existing working implementations
- Pitfalls: HIGH - derived from actual code patterns and useCachedQuery behavior
- Audit completeness: HIGH - grep'd entire codebase for all "Loading" occurrences

**Research date:** 2026-01-27
**Valid until:** 2026-03-27 (stable -- internal codebase, no external dependency changes)
