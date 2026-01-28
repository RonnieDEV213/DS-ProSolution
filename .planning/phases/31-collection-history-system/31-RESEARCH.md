# Phase 31: Collection History System - Research

**Researched:** 2026-01-27
**Domain:** Event recording, history viewer UI, export modal, infinite scroll filtering
**Confidence:** HIGH

## Summary

Phase 31 extends the existing seller audit log infrastructure (established in Phase 14) to record two new event types -- export and flag change -- and enhances the existing LogDetailModal with filtering, date range picking, infinite scroll, and day grouping. Additionally, the current seller export popover in the sellers grid is replaced with a modal matching the order tracking export dialog pattern.

The existing infrastructure is solid: `seller_audit_log` table with `_log_seller_change()` in `collection.py`, the `LogDetailModal` with its Changes panel + Full History list layout, and established patterns for filter chips (`QuickFilterChips`), infinite scroll (`react-window-infinite-loader`), calendar (`react-day-picker` via shadcn Calendar), and export dialogs (`ExportDialog`). All required libraries are already installed. The main work involves:

1. **Backend**: Adding two new action types (`export`, `flag`) to the `seller_audit_log` table's check constraint, creating recording functions, and extending the audit log API with filtering + cursor-based pagination.
2. **Frontend**: Converting the export popover to a modal, adding flag change recording calls, enhancing `LogDetailModal` with filter chips + date range + infinite scroll + day grouping, and adding new Changes panel variants for export and flag event detail.

**Primary recommendation:** Extend the existing `seller_audit_log` table and `_log_seller_change()` method. All new UI components follow patterns already established in the codebase. No new dependencies needed.

## Standard Stack

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18+ | 18+ | UI components | Already in project |
| Next.js 14+ | 14+ | App Router | Already in project |
| shadcn/ui | latest | Dialog, Badge, Calendar, Popover | Already in project |
| lucide-react | latest | Icons (Download, Flag, Filter) | Already in project |
| TailwindCSS | 3+ | Styling | Already in project |
| date-fns | ^4.1.0 | Date formatting, grouping, relative times | Already in project |
| react-day-picker | ^9.13.0 | Calendar/date range picker | Already in project, used by shadcn Calendar |
| react-window | latest | Virtualized lists | Already in project (sellers grid, records list) |
| react-window-infinite-loader | latest | Infinite scroll loading | Already in project (bookkeeping records) |
| FastAPI | latest | Backend API | Already in project |
| Pydantic | 2+ | Response models | Already in project |
| @tanstack/react-query | latest | Data fetching, infinite queries | Already in project |

### No New Dependencies Required

Every capability needed is available through existing libraries:
- **Filter chips**: Existing `QuickFilterChips` component pattern (Badge-based, radiogroup)
- **Date range picker**: `react-day-picker` mode="range" with shadcn Calendar component
- **Infinite scroll**: `react-window-infinite-loader` (same as bookkeeping records)
- **Day grouping**: `date-fns` with `isToday`, `isYesterday`, `format`, `startOfDay`
- **Export modal**: shadcn Dialog (same pattern as `ExportDialog` in data-management)
- **Relative timestamps**: `formatDistanceToNow` from date-fns (already used in `HistoryPanel`)

## Architecture Patterns

### Existing Backend Pattern: seller_audit_log Schema

Current table (`038_seller_audit_log.sql`):
```sql
CREATE TABLE seller_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id),
    action TEXT NOT NULL CHECK (action IN ('add', 'edit', 'remove')),
    seller_id UUID REFERENCES sellers(id),
    seller_name TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    source TEXT NOT NULL CHECK (source IN ('manual', 'collection_run', 'auto_remove')),
    source_run_id UUID REFERENCES collection_runs(id),
    source_criteria JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    affected_count INTEGER NOT NULL DEFAULT 1
);
```

**Phase 31 extends this** with:
1. Two new action values: `'export'` and `'flag'` added to the check constraint
2. Export events: `action='export'`, `new_value` stores `{"format": "csv", "sellers": ["A","B",...]}`, `affected_count` = number of exported sellers
3. Flag events: `action='flag'`, `new_value` stores `{"flagged": true, "sellers": ["A","B",...]}`, `affected_count` = number of flagged/unflagged sellers
4. Both use `source='manual'` (user-initiated actions)

### Backend Pattern: _log_seller_change()

Existing method signature in `collection.py:786`:
```python
async def _log_seller_change(
    self, org_id, user_id, action, seller_id, seller_name,
    old_value, new_value, source, run_id,
    criteria=None, affected_count=1, seller_count_snapshot=None
) -> None:
```

This method inserts directly into `seller_audit_log`. Phase 31 reuses it for export and flag events.

### Frontend Pattern: LogDetailModal Layout

Current `LogDetailModal` (`log-detail-modal.tsx:453 lines`):
```
+----------------------------------+
| History Entry                    |
+----------------------------------+
| Changes          | Full History  |
| (left, equal)    | (right, equal)|
+----------------------------------+
```
Current: `grid grid-cols-2 gap-4`

Phase 31 target: Wider Full History list, asymmetric split.
Recommendation: Change to `grid grid-cols-[2fr_3fr]` or `grid grid-cols-5` with `col-span-2` / `col-span-3`.

### Frontend Pattern: Export Dialog (order tracking)

The `ExportDialog` component (`data-management/export-dialog.tsx`) provides the target pattern:
```
+----------------------------------+
| Export Records             [X]   |
| Export N records to a file.      |
+----------------------------------+
| Format: [CSV] [JSON] [Excel]    |
| Column Preset: [Essential]...   |
| Columns (N selected):           |
|   [grid of checkboxes]          |
+----------------------------------+
| [Cancel]              [Export]   |
+----------------------------------+
```

The seller export modal should match this layout but with seller-specific options:
- Format selection (CSV/JSON/Clipboard)
- Flag on export toggle
- First N / range inputs (existing from sellers-grid popover)
- Export preview count

### Frontend Pattern: Quick Filter Chips

Existing pattern (`quick-filter-chips.tsx`):
```tsx
<div className="flex flex-wrap items-center gap-2" role="radiogroup">
  {FILTERS.map((filter) => (
    <Badge
      key={filter.id}
      variant={isActive ? "default" : "outline"}
      className="cursor-pointer select-none"
      onClick={() => handleClick(filter.id)}
    >
      {filter.label}
    </Badge>
  ))}
</div>
```

Phase 31 uses this exact pattern for: All, Exports, Flags, Runs, Edits.

### Frontend Pattern: Infinite Scroll

Existing pattern (`virtualized-records-list.tsx`):
```tsx
const onRowsRendered = useInfiniteLoader({
  isRowLoaded: (index) => !hasMore || index < items.length,
  loadMoreRows,
  rowCount: itemCount,
  minimumBatchSize: 50,
  threshold: 15,
});
```

For the Full History list inside the modal, a simpler approach works since the list is within a scrollable div (not a virtualized grid): use `IntersectionObserver` on a sentinel element at the bottom of the list. This is simpler than react-window for a non-virtualized scrollable list within a modal.

### Recommended Project Structure

```
apps/web/src/components/admin/collection/
  log-detail-modal.tsx          # ENHANCE: filter chips, date range, infinite scroll, day groups
  history-panel.tsx             # ENHANCE: clickable "History" header
  sellers-grid.tsx              # MODIFY: replace export popover with modal trigger
  seller-export-modal.tsx       # NEW: export modal matching ExportDialog pattern
  history-filter-chips.tsx      # NEW: filter chips for history types

apps/api/src/app/
  services/collection.py        # ENHANCE: log_export_event, log_flag_event, filtered audit log
  routers/sellers.py            # ENHANCE: audit-log endpoint with filters + pagination
  models.py                     # ENHANCE: new action types, filter params
  migrations/
    054_export_flag_audit.sql   # NEW: ALTER check constraint, add index
```

### Anti-Patterns to Avoid

- **Creating a separate history_events table**: Use the existing `seller_audit_log` -- it already has all needed columns.
- **Client-side filtering of all events**: With 100k+ events expected, filtering MUST happen server-side via API query params.
- **Fetching all history at once**: The current `limit=100` fetch won't scale. Use cursor-based pagination with page size ~30.
- **Building custom date picker**: Use the existing `react-day-picker` + shadcn Calendar component with `mode="range"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range selection | Custom date inputs | shadcn Calendar with `mode="range"` + Popover | Already in project, handles edge cases |
| Filter chip toggle group | Custom toggle buttons | Badge-based pattern from `QuickFilterChips` | Consistent with existing UI |
| Infinite scroll | Custom scroll detection | `IntersectionObserver` on sentinel div | Simple, reliable, no extra deps |
| Relative time formatting | Custom time formatter | `formatDistanceToNow` from date-fns | Already used throughout codebase |
| Day grouping logic | Custom date comparison | `isToday`, `isYesterday`, `format` from date-fns | Handles timezone edge cases |
| Export modal layout | New design | Follow `ExportDialog` pattern exactly | CONTEXT.md decision: match order tracking dialog |

## Common Pitfalls

### Pitfall 1: Audit Log Check Constraint Not Updated
**What goes wrong:** INSERT fails with check constraint violation when logging `export` or `flag` actions
**Why it happens:** The `seller_audit_log.action` column has a CHECK constraint: `action IN ('add', 'edit', 'remove')`. New action types must be added.
**How to avoid:** Migration must ALTER the check constraint:
```sql
ALTER TABLE seller_audit_log
DROP CONSTRAINT seller_audit_log_action_check;

ALTER TABLE seller_audit_log
ADD CONSTRAINT seller_audit_log_action_check
CHECK (action IN ('add', 'edit', 'remove', 'export', 'flag'));
```
**Warning signs:** 500 errors on export or flag operations

### Pitfall 2: Flag Events Not Recorded (No Audit Log Call)
**What goes wrong:** `toggle_seller_flag()` in `collection.py:758` does NOT call `_log_seller_change()`. Flagging sellers creates no audit trail.
**Why it happens:** The flag toggle was implemented without audit logging. Currently it just updates the `sellers` table directly.
**How to avoid:** Add `_log_seller_change()` call inside `toggle_seller_flag()`, or create a new batch method that logs bulk flag operations as a single entry.
**Warning signs:** Flag events missing from history

### Pitfall 3: Bulk Export = One Entry, Not N Entries
**What goes wrong:** Each exported seller creates a separate audit log row
**Why it happens:** Reusing single-seller logging pattern for bulk operations
**How to avoid:** CONTEXT.md decision: "One bulk entry per action (exporting 50 sellers = 1 history entry)". Store all seller names in `new_value` JSON array:
```python
await self._log_seller_change(
    org_id=org_id,
    user_id=user_id,
    action="export",
    seller_id="",  # Not applicable for bulk
    seller_name=f"Export {len(sellers)} sellers",
    old_value=None,
    new_value={"format": format, "sellers": [s.display_name for s in sellers]},
    source="manual",
    run_id=None,
    affected_count=len(sellers),
)
```
**Warning signs:** History shows 50 export entries instead of 1

### Pitfall 4: Client-Side Filtering Won't Scale
**What goes wrong:** UI freezes when filtering 100k+ events on the client
**Why it happens:** Current `get_audit_log` fetches flat list without filtering capability
**How to avoid:** Add server-side filter params to the API endpoint:
```python
async def get_audit_log(
    self, org_id, limit=30, offset=0,
    action_filter=None,  # "export", "flag", "add", etc.
    date_from=None,
    date_to=None,
):
    query = self.supabase.table("seller_audit_log").select(...)
    if action_filter:
        query = query.in_("action", action_filter)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)
```
**Warning signs:** Slow load times, browser unresponsive

### Pitfall 5: Date Range Picker Timezone Issues
**What goes wrong:** Events near midnight appear in wrong day group, or date filter misses events
**Why it happens:** Server stores UTC timestamps; client displays in local timezone. Day boundaries differ.
**How to avoid:**
- For day grouping: Convert server timestamps to local timezone before grouping with `startOfDay()`
- For date range filtering: Send date range as ISO strings with timezone info, or convert to UTC range on client before sending
**Warning signs:** Events showing up in "Yesterday" that should be "Today"

### Pitfall 6: Modal Width Not Adjusted for New Content
**What goes wrong:** Filter chips + date picker + entries overflow or feel cramped
**Why it happens:** Current modal is `max-w-3xl` which may be too narrow with filter UI
**How to avoid:** Consider upgrading to `max-w-4xl` or `max-w-5xl` to accommodate the filter row and asymmetric layout. The asymmetric grid (Changes narrower, Full History wider) also needs the overall modal to be wider.
**Warning signs:** Cramped UI, horizontal overflow

### Pitfall 7: Export Popover State Leaks Into Modal
**What goes wrong:** Export options (flag on export, first N, range) state management breaks when migrating from popover to modal
**Why it happens:** The current sellers-grid.tsx manages export state inline with 5+ state variables. Moving to a modal requires extracting this state.
**How to avoid:** Extract all export state into the new `SellerExportModal` component. Pass only `sellers` (or a fetch function) and `onExportComplete` callback.
**Warning signs:** State not resetting on modal close, stale seller counts

## Code Examples

### Backend: Migration to Add New Action Types
```sql
-- Migration: 054_export_flag_audit.sql
-- Add export and flag action types to seller_audit_log

ALTER TABLE seller_audit_log
DROP CONSTRAINT seller_audit_log_action_check;

ALTER TABLE seller_audit_log
ADD CONSTRAINT seller_audit_log_action_check
CHECK (action IN ('add', 'edit', 'remove', 'export', 'flag'));

-- Index for action-based filtering (improves filter chip queries)
CREATE INDEX idx_seller_audit_log_action
ON seller_audit_log(org_id, action, created_at DESC);
```

### Backend: Logging Export Event
```python
# In collection.py, new method:
async def log_export_event(
    self, org_id: str, user_id: str,
    seller_names: list[str], export_format: str,
) -> None:
    """Log a seller export as a single history entry."""
    import json
    seller_count = await self._get_seller_count_snapshot(org_id)

    log_data = {
        "org_id": org_id,
        "action": "export",
        "seller_id": None,
        "seller_name": f"Exported {len(seller_names)} sellers as {export_format}",
        "old_value": None,
        "new_value": json.dumps({
            "format": export_format,
            "sellers": seller_names,
        }),
        "source": "manual",
        "source_run_id": None,
        "user_id": user_id,
        "affected_count": len(seller_names),
        "seller_count_snapshot": seller_count,
    }
    self.supabase.table("seller_audit_log").insert(log_data).execute()
```

### Backend: Logging Flag Event
```python
async def log_flag_event(
    self, org_id: str, user_id: str,
    seller_names: list[str], flagged: bool,
) -> None:
    """Log a flag/unflag operation as a single history entry."""
    import json
    seller_count = await self._get_seller_count_snapshot(org_id)
    action_word = "Flagged" if flagged else "Unflagged"

    log_data = {
        "org_id": org_id,
        "action": "flag",
        "seller_id": None,
        "seller_name": f"{action_word} {len(seller_names)} sellers",
        "old_value": None,
        "new_value": json.dumps({
            "flagged": flagged,
            "sellers": seller_names,
        }),
        "source": "manual",
        "source_run_id": None,
        "user_id": user_id,
        "affected_count": len(seller_names),
        "seller_count_snapshot": seller_count,
    }
    self.supabase.table("seller_audit_log").insert(log_data).execute()
```

### Backend: Filtered + Paginated Audit Log
```python
async def get_audit_log(
    self, org_id: str,
    limit: int = 30,
    offset: int = 0,
    action_types: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[list[dict], int]:
    """Get filtered audit log entries, newest first."""
    query = (
        self.supabase.table("seller_audit_log")
        .select("id, action, seller_name, source, source_run_id, user_id, "
                "created_at, affected_count, seller_count_snapshot, new_value",
                count="exact")
        .eq("org_id", org_id)
    )

    if action_types:
        query = query.in_("action", action_types)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or [], result.count or 0
```

### Frontend: Filter Chips for History Types
```tsx
// Follows existing QuickFilterChips pattern
const HISTORY_FILTERS = [
  { id: "all", label: "All", actionTypes: null },
  { id: "exports", label: "Exports", actionTypes: ["export"] },
  { id: "flags", label: "Flags", actionTypes: ["flag"] },
  { id: "runs", label: "Runs", actionTypes: ["add"] },  // collection_run source
  { id: "edits", label: "Edits", actionTypes: ["edit", "remove"] },
];
```

### Frontend: Day Grouping
```tsx
import { isToday, isYesterday, format, startOfDay } from "date-fns";

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

// Group entries by day
function groupByDay(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const time = entry.type === "collection_run"
      ? (entry.completed_at || entry.started_at)
      : entry.created_at;
    const label = getDayLabel(time);
    const group = groups.get(label) || [];
    group.push(entry);
    groups.set(label, group);
  }
  return groups;
}
```

### Frontend: Event Row with Type Badge
```tsx
// Type badge colors (Claude's discretion per CONTEXT.md)
const eventBadgeStyles: Record<string, string> = {
  export: "bg-purple-500/20 text-purple-400",
  flag: "bg-yellow-500/20 text-yellow-400",
  add: "bg-green-500/20 text-green-400",
  edit: "bg-blue-500/20 text-blue-400",
  remove: "bg-red-500/20 text-red-400",
};

const eventLabels: Record<string, string> = {
  export: "Export",
  flag: "Flag",
  add: "Add",
  edit: "Edit",
  remove: "Remove",
};

// Event row format: [Type Badge] description  time
<div className="flex items-center gap-2">
  <Badge className={cn("text-xs", eventBadgeStyles[action])}>
    {eventLabels[action]}
  </Badge>
  <span className="text-foreground text-sm truncate flex-1">
    {entry.seller_name}
  </span>
  <span className="text-muted-foreground text-xs font-mono">
    {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
  </span>
</div>
```

### Frontend: Export Changes Panel
```tsx
// For export events: Summary header + scrollable seller list
function ExportChangesPanel({ newValue }: { newValue: { format: string; sellers: string[] } }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">
        Exported {newValue.sellers.length} sellers as {newValue.format.toUpperCase()}
      </div>
      <div className="space-y-1">
        {newValue.sellers.map((name, i) => (
          <div
            key={`exported-${name}-${i}`}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded",
              "border-l-2 border-purple-500",
              i % 2 === 0 ? "bg-purple-500/10" : "bg-purple-500/5"
            )}
          >
            <Download className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-sm text-purple-300">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Frontend: Flag Changes Panel
```tsx
// For flag events: colored sections matching Phase 14 add/remove style
function FlagChangesPanel({ newValue }: { newValue: { flagged: boolean; sellers: string[] } }) {
  const isFlagging = newValue.flagged;
  const sectionLabel = isFlagging
    ? `Flagged (${newValue.sellers.length})`
    : `Unflagged (${newValue.sellers.length})`;
  const borderColor = isFlagging ? "border-yellow-500" : "border-gray-500";
  const bgColors = isFlagging
    ? ["bg-yellow-500/10", "bg-yellow-500/5"]
    : ["bg-gray-500/10", "bg-gray-500/5"];
  const textColor = isFlagging ? "text-yellow-300" : "text-gray-300";
  const IconComponent = isFlagging ? Flag : FlagOff;
  const iconColor = isFlagging ? "text-yellow-400" : "text-gray-400";

  return (
    <div>
      <h4 className="text-sm font-medium text-foreground mb-2">{sectionLabel}</h4>
      <div className="space-y-1">
        {newValue.sellers.map((name, i) => (
          <div
            key={`flag-${name}-${i}`}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded",
              `border-l-2 ${borderColor}`,
              bgColors[i % 2]
            )}
          >
            <IconComponent className={cn("h-3.5 w-3.5", iconColor)} />
            <span className={cn("text-sm", textColor)}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Frontend: Infinite Scroll with IntersectionObserver
```tsx
// Simple sentinel-based infinite scroll for modal list
function useInfiniteScroll(callback: () => void, hasMore: boolean) {
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !hasMore) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            callback();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(node);
      return () => observer.disconnect();
    },
    [callback, hasMore]
  );

  return sentinelRef;
}

// Usage in Full History list:
<div className="flex-1 overflow-y-auto">
  {groupedEntries.map(([dayLabel, entries]) => (
    <div key={dayLabel}>
      <div className="sticky top-0 bg-muted/80 px-3 py-1 text-xs text-muted-foreground font-medium">
        {dayLabel}
      </div>
      {entries.map(entry => <EventRow key={entry.id} entry={entry} />)}
    </div>
  ))}
  {hasMore && <div ref={sentinelRef} className="h-8" />}
</div>
```

### Frontend: Date Range Picker with shadcn Calendar
```tsx
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

const [dateRange, setDateRange] = useState<DateRange | undefined>();

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm">
      <CalendarIcon className="h-3.5 w-3.5 mr-1" />
      {dateRange?.from ? (
        dateRange.to
          ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
          : format(dateRange.from, "MMM d")
      ) : "Date range"}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar
      mode="range"
      selected={dateRange}
      onSelect={setDateRange}
      numberOfMonths={2}
    />
  </PopoverContent>
</Popover>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No export recording | Export events in audit log | Phase 31 | Full export history |
| No flag recording | Flag events in audit log | Phase 31 | Full flag change history |
| Export via popover dropdown | Export via modal dialog | Phase 31 | Consistent with order tracking export |
| Flat history list (limit 100) | Filtered + paginated + grouped list | Phase 31 | Scales to 100k+ events |
| Equal-width modal panels | Asymmetric layout (Changes < Full History) | Phase 31 | Better use of space for event list |

**Key observation:** The `toggle_seller_flag()` method in `collection.py:758` currently does NOT log to the audit log. It simply toggles the `flagged` column. This is the primary gap that Phase 31 fills.

## Open Questions

1. **Batch Flag Recording Granularity**
   - What we know: Right-click drag painting flags multiple sellers. Individual `flagMutation.mutate()` calls happen per seller. The `toggle_seller_flag()` API endpoint handles one seller at a time.
   - What's unclear: Should we create a batch flag API endpoint, or aggregate individual flag calls into a single audit entry on the backend?
   - Recommendation: Create a batch flag endpoint (`POST /sellers/flag-batch`) that accepts an array of seller IDs and a target flag state. This creates one audit entry. The frontend can call this instead of N individual mutations for drag-paint and similar bulk operations.

2. **Export Recording Trigger Point**
   - What we know: Exports currently happen client-side (small datasets) or server-side (large datasets). Client-side exports never hit the backend.
   - What's unclear: For client-side exports, should we call a "record export event" API endpoint after download, or route all exports through the server?
   - Recommendation: Add a `POST /sellers/log-export` endpoint that the frontend calls after any export completes (regardless of client/server export path). This keeps the audit trail centralized in the database. The modal can call this endpoint after successful CSV/JSON/clipboard export.

3. **History Panel "History" Header Click Target**
   - What we know: CONTEXT.md says "'History' section header becomes a prominent, clickable entry point."
   - What's unclear: Does clicking this open the modal with no specific entry selected (showing most recent), or does it open showing the full list only?
   - Recommendation: Open modal with no specific entry selected. Show the most recent entry's changes by default. This matches the pattern of clicking any entry in the feed.

4. **HistoryEntry Union Type Expansion**
   - What we know: Current `HistoryEntry = ManualLogEntry | CollectionRunEntry`. Both types have different shapes.
   - What's unclear: Should export and flag events be new discriminated union members, or extend `ManualLogEntry` with new action values?
   - Recommendation: Extend the action type on `ManualLogEntry` to include `'export' | 'flag'`. They share the same shape (id, action, seller_name, affected_count, created_at). The `new_value` JSON blob differentiates them for the Changes panel.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** (direct reading):
  - `apps/api/migrations/038_seller_audit_log.sql` -- Table schema, check constraints
  - `apps/api/src/app/services/collection.py:786-835` -- `_log_seller_change()`, `get_audit_log()`, `get_sellers_at_log()`
  - `apps/api/src/app/services/collection.py:758-780` -- `toggle_seller_flag()` (NO audit logging)
  - `apps/api/src/app/routers/sellers.py:252-316` -- Audit log endpoints
  - `apps/api/src/app/models.py:962-980` -- `AuditLogEntry`, `AuditLogResponse`
  - `apps/web/src/components/admin/collection/log-detail-modal.tsx` -- Full modal implementation
  - `apps/web/src/components/admin/collection/history-panel.tsx` -- History sidebar panel
  - `apps/web/src/components/admin/collection/sellers-grid.tsx` -- Export popover, flag mutation calls
  - `apps/web/src/components/data-management/export-dialog.tsx` -- Target export modal pattern
  - `apps/web/src/components/bookkeeping/quick-filter-chips.tsx` -- Filter chip pattern
  - `apps/web/src/components/bookkeeping/virtualized-records-list.tsx` -- Infinite scroll pattern
  - `apps/web/src/components/ui/calendar.tsx` -- shadcn Calendar (react-day-picker wrapper)
  - `apps/web/src/hooks/mutations/use-flag-seller.ts` -- Flag mutation hook
  - `apps/web/src/app/admin/automation/page.tsx` -- Collection page composition
  - `.planning/phases/14-history-snapshot-simplification/14-RESEARCH.md` -- Phase 14 research
  - `.planning/phases/14-history-snapshot-simplification/14-VERIFICATION.md` -- Phase 14 verification
  - `.planning/phases/31-collection-history-system/31-CONTEXT.md` -- Phase 31 decisions

### Secondary (MEDIUM confidence)
- `apps/web/package.json` -- Confirmed library versions: date-fns ^4.1.0, react-day-picker ^9.13.0

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified in package.json, all components verified in codebase
- Architecture: HIGH -- Following existing patterns (audit log, modal, filter chips), extending proven infrastructure
- Pitfalls: HIGH -- Based on actual code inspection (check constraint, missing audit log in flag toggle)
- Code examples: HIGH -- Based on existing codebase patterns with verified API shapes

**Research date:** 2026-01-27
**Valid until:** No expiration -- extending stable existing patterns, no external dependency version concerns
