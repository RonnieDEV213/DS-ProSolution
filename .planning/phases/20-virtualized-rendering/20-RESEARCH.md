# Phase 20: Virtualized Rendering - Research

**Researched:** 2026-01-24
**Domain:** React list virtualization, performance optimization, keyboard accessibility
**Confidence:** HIGH

## Summary

This phase implements virtualized rendering for lists that may contain millions of records. The project already has `react-window` v2.2.5 and `react-window-infinite-loader` v2.0.1 installed, making this a matter of integration rather than library selection.

The key challenge is integrating virtual scrolling with the existing IndexedDB-based data layer (`useSyncRecords` hook that uses `useLiveQuery` for reactive updates). The current `RecordsTable` component renders all records as DOM nodes and supports row expansion with nested details - this must be converted to a virtualized approach while preserving all existing functionality.

**Primary recommendation:** Use `react-window` v2's `List` component with fixed row heights (two densities: 52px comfortable, 36px compact) and handle row expansion by rendering expanded content as separate virtual rows rather than using variable heights.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-window | 2.2.5 | Virtual scrolling | Already installed; v2 has auto-sizing, better TypeScript, smaller bundle |
| react-window-infinite-loader | 2.0.1 | Infinite scroll integration | Already installed; designed specifically for react-window |
| dexie-react-hooks | 4.2.0 | Reactive IndexedDB | Already used via `useLiveQuery` in `useSyncRecords` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-intersection-observer | 10.0.2 | Scroll triggers | Already installed; used in `usePrefetchOnScroll` |
| framer-motion | 12.25.0 | Animations | Already installed; for filter chip transitions |
| lucide-react | 0.562.0 | Icons | Already installed; for keyboard hint icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-window | react-virtuoso | More features but larger bundle, different API |
| react-window | @tanstack/virtual | Headless but requires more setup |
| Fixed row heights | Variable heights | Variable is 30-40% slower, complex with expansion |

**Installation:** No new packages needed - all libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── bookkeeping/
│       ├── virtualized-records-list.tsx    # Main virtualized container
│       ├── record-row.tsx                  # Single row component (rowComponent)
│       ├── record-row-expanded.tsx         # Expanded details row
│       ├── skeleton-row.tsx                # Loading placeholder row
│       ├── records-toolbar.tsx             # Filter chips + density toggle
│       └── quick-filter-chips.tsx          # Filter chip components
├── hooks/
│   ├── use-row-density.ts                  # Density state + localStorage
│   ├── use-keyboard-navigation.ts          # j/k/Enter/Escape handlers
│   └── use-scroll-restoration.ts           # Save/restore scroll position
└── lib/
    └── storage-keys.ts                     # Centralized localStorage keys
```

### Pattern 1: react-window v2 List with rowComponent
**What:** Use the v2 API with explicit `rowComponent` prop instead of render children
**When to use:** All virtualized lists in this project
**Example:**
```typescript
// Source: react-window v2 API
import { List, type RowComponentProps } from 'react-window';

interface RecordRowProps {
  record: BookkeepingRecord;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  density: 'compact' | 'comfortable';
}

// rowComponent receives data via rowProps
function RecordRow({
  index,
  style,
  ariaAttributes,
  // Custom props from rowProps:
  records,
  expandedIds,
  onToggleExpand,
  density
}: RowComponentProps<RecordRowProps>) {
  const record = records[index];
  const isExpanded = expandedIds.has(record.id);

  return (
    <div style={style} {...ariaAttributes} role="row">
      {/* Row content */}
    </div>
  );
}

// Usage with react-window-infinite-loader
function VirtualizedRecordsList({ records, ...props }) {
  const { onRowsRendered } = useInfiniteLoader({
    isRowLoaded: (index) => index < records.length,
    loadMoreRows: async () => { /* trigger sync */ },
    rowCount: records.length + (hasMore ? 1 : 0),
    threshold: 15,
  });

  return (
    <List
      height={600}
      rowCount={records.length}
      rowHeight={density === 'compact' ? 36 : 52}
      rowComponent={RecordRow}
      rowProps={{ records, expandedIds, onToggleExpand, density }}
      onRowsRendered={onRowsRendered}
      overscanCount={5}
    />
  );
}
```

### Pattern 2: Row Expansion via Flattened Data
**What:** Treat expanded content as separate virtual rows rather than dynamic heights
**When to use:** When rows can be expanded to show details (current RecordsTable has this)
**Example:**
```typescript
// Flatten records with expansion state
interface VirtualRow {
  type: 'record' | 'expanded';
  record: BookkeepingRecord;
}

function flattenRecords(
  records: BookkeepingRecord[],
  expandedIds: Set<string>
): VirtualRow[] {
  const rows: VirtualRow[] = [];
  for (const record of records) {
    rows.push({ type: 'record', record });
    if (expandedIds.has(record.id)) {
      rows.push({ type: 'expanded', record });
    }
  }
  return rows;
}

// Different heights based on row type
function getRowHeight(index: number, rows: VirtualRow[], density: string): number {
  const row = rows[index];
  if (row.type === 'expanded') return 180; // Fixed expanded height
  return density === 'compact' ? 36 : 52;
}
```

### Pattern 3: Density Toggle with localStorage
**What:** User-switchable row density persisted to localStorage
**When to use:** Per CONTEXT.md decision - two densities (compact/comfortable)
**Example:**
```typescript
// Source: shadcn/ui table density pattern
const DENSITY_KEY = 'dspro:table_density';

export function useRowDensity() {
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    try {
      const stored = localStorage.getItem(DENSITY_KEY);
      return stored === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  const toggleDensity = useCallback(() => {
    setDensity((prev) => {
      const next = prev === 'compact' ? 'comfortable' : 'compact';
      try {
        localStorage.setItem(DENSITY_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return { density, toggleDensity };
}
```

### Pattern 4: Keyboard Navigation with Focus Management
**What:** j/k for navigation, Enter for action, Escape to deselect
**When to use:** All virtualized lists per CONTEXT.md
**Example:**
```typescript
// Source: use-keyboard-list-navigation pattern
export function useKeyboardNavigation(
  listRef: RefObject<List>,
  rowCount: number,
  onSelect: (index: number) => void
) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when list is focused
      if (!listRef.current) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, rowCount - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (focusedIndex >= 0) {
            onSelect(focusedIndex);
          }
          break;
        case 'Escape':
          setFocusedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [listRef, rowCount, focusedIndex, onSelect]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(focusedIndex, 'smart');
    }
  }, [focusedIndex, listRef]);

  return { focusedIndex, setFocusedIndex };
}
```

### Pattern 5: Quick Filter Chips
**What:** Toggle badges that filter displayed records
**When to use:** Common filters per CONTEXT.md - status filters for bookkeeping records
**Example:**
```typescript
// Source: shadcn/ui button group filter pattern
interface QuickFilter {
  id: string;
  label: string;
  filter: (record: BookkeepingRecord) => boolean;
}

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'all', label: 'All', filter: () => true },
  { id: 'successful', label: 'Successful', filter: (r) => r.status === 'SUCCESSFUL' },
  { id: 'returns', label: 'Returns', filter: (r) =>
    r.status === 'RETURN_LABEL_PROVIDED' || r.status === 'RETURN_CLOSED' },
  { id: 'refunds', label: 'Refunds', filter: (r) => r.status === 'REFUND_NO_RETURN' },
];

function QuickFilterChips({ activeFilters, onToggle, onClearAll }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Quick filters">
      {QUICK_FILTERS.map((filter) => (
        <Badge
          key={filter.id}
          variant={activeFilters.has(filter.id) ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => onToggle(filter.id)}
          role="checkbox"
          aria-checked={activeFilters.has(filter.id)}
        >
          {filter.label}
        </Badge>
      ))}
      {activeFilters.size > 0 && (
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          Clear all
        </Button>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Dynamic row heights for expandable content:** Causes scroll jumping and poor performance; use flattened rows instead
- **Re-rendering on every scroll:** Ensure row components are properly memoized via `rowComponent` prop
- **Measuring row heights at runtime:** Use predetermined heights based on content type and density
- **Global keyboard listeners without focus check:** Only handle keys when list container has focus

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling | Custom scroll handlers | react-window List | Handles overscan, scroll sync, ARIA automatically |
| Infinite loading | Scroll event listeners | react-window-infinite-loader | Batching, threshold, deduplication built-in |
| Reactive IndexedDB | Manual change detection | useLiveQuery (dexie-react-hooks) | Already used; handles subscription cleanup |
| Intersection detection | Scroll position math | useInView (react-intersection-observer) | Already installed and used |
| Scroll restoration | Manual sessionStorage | TanStack Router or custom hook | Save scroll offset, restore on mount |

**Key insight:** The project already has all necessary virtualization libraries installed. The work is integration, not library development.

## Common Pitfalls

### Pitfall 1: Scroll Position Lost on Filter Change
**What goes wrong:** User scrolls down, applies filter, loses position
**Why it happens:** Filtered list has different indices; old scroll offset invalid
**How to avoid:** Reset scroll to top on filter change; this is expected UX
**Warning signs:** Users confused about where they are in filtered results

### Pitfall 2: Expanded Row Content Cut Off
**What goes wrong:** Variable height content gets clipped or overlaps
**Why it happens:** Using FixedSizeList with dynamic content height
**How to avoid:** Use flattened row approach - expanded content is separate row with known height
**Warning signs:** Content overflow, scroll jumping when expanding

### Pitfall 3: Stale Data After IndexedDB Update
**What goes wrong:** Virtual list shows old data after sync
**Why it happens:** useLiveQuery triggers re-render but list not updated
**How to avoid:** Ensure `rowProps` dependency changes when records change; use stable references
**Warning signs:** List shows correct count but wrong content

### Pitfall 4: Keyboard Focus Lost During Scroll
**What goes wrong:** User navigates with j/k, focus indicator disappears
**Why it happens:** Focused row scrolls out of DOM, focus state lost
**How to avoid:** Track focused index in state, apply visual indicator based on state not DOM focus
**Warning signs:** Focus ring disappears when scrolling

### Pitfall 5: Filter Chips Don't Update Row Count Display
**What goes wrong:** "Showing 1-50 of 2,340,567" shows wrong total after filtering
**Why it happens:** Total count not updated when filters applied
**How to avoid:** Derive count from filtered records, not raw records
**Warning signs:** Count doesn't match visible data

### Pitfall 6: Memory Leak from Event Listeners
**What goes wrong:** Page slows down over time
**Why it happens:** Keyboard event listeners not cleaned up on unmount
**How to avoid:** Use useEffect cleanup; return removeEventListener in cleanup
**Warning signs:** Performance degrades on repeated navigation

## Code Examples

Verified patterns from official sources:

### react-window v2 List Setup
```typescript
// Source: react-window v2 documentation
import { List } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';

interface Props {
  records: BookkeepingRecord[];
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function VirtualizedRecordsList({ records, hasMore, loadMore }: Props) {
  const listRef = useRef<List>(null);
  const { density } = useRowDensity();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Flatten records for expansion
  const virtualRows = useMemo(() =>
    flattenRecords(records, expandedIds),
    [records, expandedIds]
  );

  // Infinite loader integration
  const { onRowsRendered } = useInfiniteLoader({
    isRowLoaded: (index) => index < virtualRows.length,
    loadMoreRows: loadMore,
    rowCount: hasMore ? virtualRows.length + 1 : virtualRows.length,
    minimumBatchSize: 50,
    threshold: 15,
  });

  // Row height based on type and density
  const getRowHeight = useCallback((index: number) => {
    const row = virtualRows[index];
    if (!row) return density === 'compact' ? 36 : 52; // Loading row
    if (row.type === 'expanded') return 180;
    return density === 'compact' ? 36 : 52;
  }, [virtualRows, density]);

  return (
    <List
      ref={listRef}
      height={600}
      width="100%"
      rowCount={virtualRows.length}
      rowHeight={getRowHeight}
      rowComponent={RecordRow}
      rowProps={{
        virtualRows,
        expandedIds,
        setExpandedIds,
        density,
      }}
      onRowsRendered={onRowsRendered}
      overscanCount={5}
    />
  );
}
```

### Skeleton Loading Row
```typescript
// Source: react-window isScrolling pattern + shadcn skeleton
function SkeletonRow({ style, density }: { style: CSSProperties; density: string }) {
  const height = density === 'compact' ? 36 : 52;

  return (
    <div style={style} className="flex items-center gap-4 px-4 border-b border-gray-800">
      <div className="h-4 w-24 bg-gray-700 rounded animate-pulse" />
      <div className="h-4 w-32 bg-gray-700 rounded animate-pulse" />
      <div className="h-4 w-48 bg-gray-700 rounded animate-pulse" />
      <div className="flex-1" />
      <div className="h-4 w-20 bg-gray-700 rounded animate-pulse" />
    </div>
  );
}
```

### Result Summary Display
```typescript
// Source: Common pagination pattern
function ResultSummary({
  visibleStart,
  visibleEnd,
  total,
  isFiltered
}: {
  visibleStart: number;
  visibleEnd: number;
  total: number;
  isFiltered: boolean;
}) {
  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className="text-sm text-gray-400">
      Showing {formatNumber(visibleStart + 1)}-{formatNumber(visibleEnd)} of {formatNumber(total)}
      {isFiltered && ' (filtered)'}
    </div>
  );
}
```

### Scroll Position Restoration
```typescript
// Source: TanStack Router scroll restoration pattern
const SCROLL_KEY = 'dspro:records_scroll';

export function useScrollRestoration(listRef: RefObject<List>, accountId: string) {
  // Restore on mount
  useEffect(() => {
    const key = `${SCROLL_KEY}:${accountId}`;
    const saved = sessionStorage.getItem(key);
    if (saved && listRef.current) {
      const offset = parseInt(saved, 10);
      listRef.current.scrollTo(offset);
    }
  }, [accountId, listRef]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (listRef.current) {
        const key = `${SCROLL_KEY}:${accountId}`;
        const offset = listRef.current.state.scrollOffset;
        sessionStorage.setItem(key, String(offset));
      }
    };
  }, [accountId, listRef]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-window v1 children render prop | v2 rowComponent prop | v2.0.0 (2024) | Better memoization, cleaner API |
| AutoSizer wrapper required | Auto-sizing built into List | v2.0.0 (2024) | Less wrapper components |
| Manual itemData prop | rowProps with auto-memoization | v2.0.0 (2024) | Simpler data passing |
| onItemsRendered callback | onRowsRendered with visible/all params | v2.0.0 (2024) | Better overscan awareness |

**Deprecated/outdated:**
- **react-virtualized:** Still maintained but react-window is smaller and faster
- **v1 children render prop:** Works but v2 rowComponent is preferred
- **Manual AutoSizer:** No longer needed in v2

## Open Questions

Things that couldn't be fully resolved:

1. **Expanded row height determination**
   - What we know: Expanded content shows earnings breakdown, COGS breakdown, and remarks
   - What's unclear: Exact pixel height needed to fit all expanded content without overflow
   - Recommendation: Measure current expanded row height in RecordsTable, use that + padding

2. **Quick filter selection**
   - What we know: CONTEXT.md says "Claude's discretion: which quick filters to show"
   - What's unclear: Exact usage patterns of existing filters
   - Recommendation: Start with status filters (All, Successful, Returns, Refunds) - matches current STATUS_OPTIONS in RecordsTable

3. **Enter key action**
   - What we know: CONTEXT.md says "Claude's discretion: Enter action (detail view vs expand vs edit)"
   - What's unclear: What action is most useful for order tracking workflow
   - Recommendation: Toggle expand (current behavior) - matches existing expand chevron UX

## Sources

### Primary (HIGH confidence)
- react-window v2 GitHub changelog - API changes, new props, hooks
- react-window-infinite-loader GitHub README - Integration patterns
- Existing codebase: package.json (confirms installed versions)
- Existing codebase: RecordsTable.tsx (current implementation to migrate)
- Existing codebase: useSyncRecords.ts (data source pattern)

### Secondary (MEDIUM confidence)
- [web.dev virtualization guide](https://web.dev/articles/virtualize-long-lists-react-window) - General patterns
- [Material React Table density guide](https://www.material-react-table.com/docs/guides/density-toggle) - Density toggle pattern
- [shadcn/ui table density block](https://www.shadcn.io/blocks/tables-density) - UI pattern reference

### Tertiary (LOW confidence)
- GitHub issue discussions on expandable rows - Community workarounds
- WebSearch results on scroll restoration - Various approaches

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries already installed and documented
- Architecture: HIGH - v2 API well documented, patterns verified
- Pitfalls: MEDIUM - Based on GitHub issues and documentation warnings
- Quick filters: MEDIUM - Based on existing STATUS_OPTIONS in codebase

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable libraries)

## Implementation Notes

### PAGI-08 Scope Clarification
**IMPORTANT:** PAGI-08 (filter/view presets) is listed in phase requirements but explicitly marked OUT OF SCOPE in CONTEXT.md. The plan should implement quick filter chips only, NOT saved filter presets with backend persistence.

### Existing Code to Preserve
The following functionality from current `RecordsTable` must be preserved:
- Inline editing of cells (click to edit, blur to save)
- Status dropdown with optimistic updates
- Delete confirmation dialog
- Expand/collapse row details
- Computed fields (profit, earnings, COGS)
- SyncRowBadge for pending mutation status
- Permission-based field visibility

### Integration Points
- `useSyncRecords` hook provides reactive data from IndexedDB
- `useUpdateRecord` / `useDeleteRecord` mutations handle edits
- `usePendingMutations` tracks row-level sync status
- `prefetchSentinelRef` from `usePrefetchOnScroll` triggers sync
