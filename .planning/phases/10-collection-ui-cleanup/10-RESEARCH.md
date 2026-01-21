# Phase 10: Collection UI Cleanup - Research

**Researched:** 2026-01-21
**Domain:** React UI Components (Next.js, shadcn/ui, TailwindCSS)
**Confidence:** HIGH

## Summary

This research investigates the technical approach for Phase 10 UI improvements: progress bar rework, history panel merge, run config modal consolidation, and bulk seller selection. The implementation leverages the existing shadcn/ui component library with targeted additions (calendar, hover-card, popover) and one external library for drag selection.

The current collection UI consists of 11 components spread across separate concerns. The CONTEXT.md specifies merging history components, consolidating the run config modal, and adding bulk selection. All changes are UI-only refinements with no backend modifications required.

**Primary recommendation:** Install `@air/react-drag-to-select` for drag selection, add shadcn/ui `calendar`, `hover-card`, and `popover` components, then refactor existing components following the established codebase patterns.

## Standard Stack

The established libraries/tools for this phase:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui | latest | Component primitives | Already used throughout project |
| TailwindCSS | 4.x | Styling | Project standard |
| Framer Motion | 12.25.0 | Animations | Already installed, used sparingly |
| date-fns | 4.1.0 | Date formatting | Already installed for log timestamps |
| lucide-react | 0.562.0 | Icons | Project standard |

### New Components to Add
| Component | Source | Purpose | When to Use |
|-----------|--------|---------|-------------|
| calendar | shadcn/ui | Schedule date picking | Run config modal scheduling |
| hover-card | shadcn/ui | Seller metadata preview | Hover cards on seller grid |
| popover | shadcn/ui | Positioned overlays | Alternative to hover-card if needed |

### New Libraries to Install
| Library | Version | Purpose | Why This Library |
|---------|---------|---------|------------------|
| @air/react-drag-to-select | ^5.0.11 | Drag selection box | HIGH performance, simple API, widely used |
| react-day-picker | (dep of calendar) | Calendar internals | Installed automatically with shadcn calendar |

**Installation Commands:**
```bash
# Add shadcn components
npx shadcn@latest add calendar
npx shadcn@latest add hover-card
npx shadcn@latest add popover

# Add drag selection library
npm install @air/react-drag-to-select
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @air/react-drag-to-select | react-selectable-fast | Less maintained, heavier API |
| @air/react-drag-to-select | Native implementation | 2-3x more code, edge cases to handle |
| shadcn calendar | react-big-calendar | Overkill for date picking, adds complexity |
| hover-card | tooltip | Tooltip is text-only, need rich content |

## Architecture Patterns

### Current Component Structure
```
apps/web/src/components/admin/collection/
├── amazon-category-selector.tsx   # Tree selector for categories
├── category-preset-dropdown.tsx   # Preset management
├── collection-history.tsx         # Table of past runs - TO MERGE
├── diff-modal.tsx                 # Compare seller snapshots
├── log-detail-modal.tsx           # Audit log details
├── progress-bar.tsx               # Inline progress - TO REWORK
├── progress-detail-modal.tsx      # Expanded progress view - TO REWORK
├── recent-logs-sidebar.tsx        # Activity feed - TO MERGE
├── run-config-modal.tsx           # Start collection - TO EXPAND
├── schedule-config.tsx            # Standalone scheduler - TO MERGE INTO MODAL
└── sellers-grid.tsx               # Seller display - TO ENHANCE
```

### Target Component Structure After Phase 10
```
apps/web/src/components/admin/collection/
├── amazon-category-selector.tsx   # Unchanged
├── category-preset-dropdown.tsx   # Unchanged
├── diff-modal.tsx                 # Unchanged
├── history-panel.tsx              # NEW: Merged Recent+History
├── hierarchical-run-modal.tsx     # NEW: Expandable run details
├── log-detail-modal.tsx           # Simplified for manual edits only
├── progress-bar.tsx               # REWORKED: Two-phase display
├── progress-detail-modal.tsx      # SIMPLIFIED: Remove workers, add phases
├── run-config-modal.tsx           # EXPANDED: Two-panel with scheduling
└── sellers-grid.tsx               # ENHANCED: Selection, hover cards
```

### Pattern 1: Two-Phase Progress State Machine
**What:** Progress bar shows distinct Amazon and eBay phases with different metrics
**When to use:** When collection has distinct sequential phases with different data

```typescript
// State types for two-phase progress
type CollectionPhase = "amazon" | "ebay";

interface AmazonPhaseProgress {
  phase: "amazon";
  departments_total: number;
  departments_completed: number;
  categories_total: number;
  categories_completed: number;
  products_found: number; // Live count as discovered
}

interface EbayPhaseProgress {
  phase: "ebay";
  products_total: number;
  products_searched: number;
  categories_completed: number; // Cascading: increments when all products in category done
  departments_completed: number; // Cascading: increments when all categories done
  sellers_new: number;
  started_at: string;
  duration_seconds: number;
}

type ProgressData = AmazonPhaseProgress | EbayPhaseProgress;
```

### Pattern 2: Merged Chronological History
**What:** Single list combining collection runs and manual edits with visual distinction
**When to use:** When multiple activity types need unified timeline view

```typescript
// Discriminated union for history entries
interface CollectionRunEntry {
  type: "collection_run";
  id: string;
  started_at: string;
  status: "completed" | "failed" | "cancelled";
  sellers_new: number;
  // ... collection specific fields
}

interface ManualEditEntry {
  type: "manual_edit";
  id: string;
  action: "add" | "edit" | "remove";
  seller_name: string;
  created_at: string;
}

type HistoryEntry = CollectionRunEntry | ManualEditEntry;

// Render with visual distinction
function HistoryItem({ entry }: { entry: HistoryEntry }) {
  return entry.type === "collection_run" ? (
    <div className="border-l-2 border-blue-500">
      <Bot className="text-blue-400" />
      {/* Collection run content */}
    </div>
  ) : (
    <div className="border-l-2 border-gray-500">
      <User className="text-gray-400" />
      {/* Manual edit content */}
    </div>
  );
}
```

### Pattern 3: Drag Selection with @air/react-drag-to-select
**What:** Click-and-drag multi-select for seller grid
**When to use:** File-explorer-style selection UX

```typescript
import { useSelectionContainer, boxesIntersect } from '@air/react-drag-to-select';

function SellersGridWithSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectableRefs = useRef<Map<string, HTMLElement>>(new Map());

  const handleSelectionChange = useCallback((box: Box) => {
    const selected = new Set<string>();
    selectableRefs.current.forEach((element, id) => {
      const rect = element.getBoundingClientRect();
      if (boxesIntersect(box, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      })) {
        selected.add(id);
      }
    });
    setSelectedIds(selected);
  }, []);

  const { DragSelection } = useSelectionContainer({
    onSelectionChange: handleSelectionChange,
    selectionProps: {
      style: {
        border: '1px solid rgb(59, 130, 246)', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 4,
      },
    },
  });

  return (
    <div className="relative">
      <DragSelection />
      {/* Grid items with refs */}
    </div>
  );
}
```

### Pattern 4: Calendar with Recurring Date Highlighting
**What:** Calendar showing scheduled dates based on recurring pattern
**When to use:** Schedule configuration with visual feedback

```typescript
import { Calendar } from "@/components/ui/calendar";
import { addDays, getDay, isSameDay } from "date-fns";

type RecurringPreset = "weekly" | "biweekly" | "monthly" | "quarterly";

function getHighlightedDates(
  startDate: Date,
  preset: RecurringPreset,
  monthsToShow: number = 3
): Date[] {
  const dates: Date[] = [];
  let current = startDate;
  const endDate = addDays(startDate, monthsToShow * 30);

  while (current <= endDate) {
    dates.push(current);
    switch (preset) {
      case "weekly":
        current = addDays(current, 7);
        break;
      case "biweekly":
        current = addDays(current, 14);
        break;
      case "monthly":
        current = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
        break;
      case "quarterly":
        current = new Date(current.getFullYear(), current.getMonth() + 3, current.getDate());
        break;
    }
  }
  return dates;
}

// Usage with react-day-picker modifiers
<Calendar
  mode="single"
  selected={selectedDate}
  onSelect={setSelectedDate}
  modifiers={{
    scheduled: highlightedDates,
  }}
  modifiersStyles={{
    scheduled: {
      backgroundColor: "rgba(59, 130, 246, 0.2)",
      borderRadius: "100%",
    },
  }}
/>
```

### Pattern 5: HoverCard for Seller Metadata
**What:** Popover card on hover showing seller details
**When to use:** Preview metadata without clicking

```typescript
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface SellerHoverCardProps {
  seller: Seller;
  children: React.ReactNode;
}

function SellerHoverCard({ seller, children }: SellerHoverCardProps) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-64 bg-gray-800 border-gray-700">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">
            {seller.display_name}
          </h4>
          <div className="text-xs text-gray-400 space-y-1">
            <div>Feedback: {seller.feedback_percent}%</div>
            <div>Reviews: {seller.feedback_count}</div>
            <div>Times seen: {seller.times_seen}</div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
```

### Anti-Patterns to Avoid
- **Mixed selection state:** Keep selection state in parent component, not distributed across children
- **Multiple history sources:** Merge API calls, don't fetch from two endpoints and combine client-side
- **Modal nesting:** Don't open modals from modals; use single modal with content switching
- **Inline scheduling UI:** Keep scheduling in modal, not as separate standalone card

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag selection | Custom mouse tracking | @air/react-drag-to-select | Scroll handling, performance, edge cases |
| Date picking | Custom calendar | shadcn calendar (react-day-picker) | Accessibility, keyboard nav, localization |
| Hover preview | Custom hover state | shadcn hover-card | Delay timing, positioning, focus management |
| Collapsible sections | Custom collapse state | Existing expandedDepts Set pattern | Already working in category selector |
| Tree view hierarchy | Custom recursive component | Copy pattern from amazon-category-selector | Already has expand/collapse, checkboxes |

**Key insight:** The codebase already has working patterns for collapsible hierarchies (amazon-category-selector.tsx) and selection state management. Copy those patterns rather than inventing new ones.

## Common Pitfalls

### Pitfall 1: Selection State During Drag
**What goes wrong:** Selection flickers or resets during drag operation
**Why it happens:** State updates trigger re-renders that interrupt drag
**How to avoid:** Use refs for element positions, only update state on drag end
**Warning signs:** Visual flickering, selection "jumps" during drag

### Pitfall 2: Calendar Date Highlighting Performance
**What goes wrong:** Calendar becomes slow with many highlighted dates
**Why it happens:** Recalculating highlighted dates on every render
**How to avoid:** Memoize highlighted dates array, only recalculate when preset or start date changes
**Warning signs:** Calendar interaction feels sluggish

### Pitfall 3: Double-Click vs Single Click Conflict
**What goes wrong:** Single click triggers before double-click detection
**Why it happens:** Browser fires click before dblclick
**How to avoid:** Use timeout to debounce single click, cancel if double-click follows
**Warning signs:** Edit mode opens and immediately closes, or selection toggles unexpectedly

```typescript
// Pattern to distinguish single vs double click
const clickTimeout = useRef<NodeJS.Timeout | null>(null);

const handleClick = (seller: Seller) => {
  if (clickTimeout.current) {
    clearTimeout(clickTimeout.current);
    clickTimeout.current = null;
    // This is a double-click
    startEdit(seller);
  } else {
    clickTimeout.current = setTimeout(() => {
      clickTimeout.current = null;
      // This is a single-click
      toggleSelection(seller.id);
    }, 200);
  }
};
```

### Pitfall 4: History Merge API Complexity
**What goes wrong:** Two separate API calls create race conditions and inconsistent ordering
**Why it happens:** Fetching audit log and collection history separately
**How to avoid:** Create single backend endpoint that returns merged, sorted history
**Warning signs:** Items appear out of order, duplicate entries, loading states out of sync

### Pitfall 5: Modal State Bleeding
**What goes wrong:** Modal state persists when it should reset
**Why it happens:** State initialized once, not reset on close
**How to avoid:** Reset state in onOpenChange callback when closing, or key the component
**Warning signs:** Previous selections visible when reopening modal

## Code Examples

Verified patterns from official sources and existing codebase:

### Installing New shadcn Components
```bash
# From apps/web directory
npx shadcn@latest add calendar
npx shadcn@latest add hover-card
npx shadcn@latest add popover
```

### Framer Motion Fade/Slide (Existing Pattern)
```typescript
// Source: apps/web/src/components/va/waiting-for-access.tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
>
  {/* Content */}
</motion.div>
```

### Expandable Section (Existing Pattern)
```typescript
// Source: apps/web/src/components/admin/collection/amazon-category-selector.tsx
const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

const toggleExpanded = (deptId: string) => {
  setExpandedDepts((prev) => {
    const next = new Set(prev);
    if (next.has(deptId)) {
      next.delete(deptId);
    } else {
      next.add(deptId);
    }
    return next;
  });
};
```

### Selection State Management
```typescript
// Pattern for bulk selection with header checkbox
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const allSelected = items.length > 0 && items.every(item => selectedIds.has(item.id));
const someSelected = selectedIds.size > 0 && !allSelected;

const toggleSelectAll = () => {
  if (allSelected) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(items.map(item => item.id)));
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Recent + History | Unified chronological feed | This phase | Single source of truth |
| Modal per feature | Two-panel modal | This phase | Fewer modal transitions |
| Click-only selection | Drag + click selection | This phase | Power user efficiency |
| Cron-only scheduling | Calendar + presets | This phase | Better UX for non-technical |

**Deprecated/outdated:**
- `schedule-config.tsx` as standalone component: Will be merged into run-config-modal
- `collection-history.tsx` as separate table: Will be merged into history-panel
- `recent-logs-sidebar.tsx` as separate panel: Will be merged into history-panel

## Open Questions

Things that couldn't be fully resolved:

1. **Backend merged history endpoint**
   - What we know: Frontend needs unified chronological list
   - What's unclear: Whether backend should provide single endpoint or frontend merges
   - Recommendation: Create single `/collection/history/unified` endpoint for simplicity

2. **Two-phase progress data source**
   - What we know: Need to distinguish Amazon vs eBay phase
   - What's unclear: Whether backend already provides phase indicator in checkpoint
   - Recommendation: Check existing checkpoint JSONB structure, add phase field if missing

3. **Seller metadata for hover cards**
   - What we know: Need feedback_percent, feedback_count for hover
   - What's unclear: Whether this data is already in sellers endpoint
   - Recommendation: Check seller response schema, extend if needed

## Sources

### Primary (HIGH confidence)
- shadcn/ui official docs - [Calendar](https://ui.shadcn.com/docs/components/calendar), [Hover Card](https://ui.shadcn.com/docs/components/hover-card), [Popover](https://ui.shadcn.com/docs/components/popover)
- Existing codebase patterns - amazon-category-selector.tsx, waiting-for-access.tsx
- [@air/react-drag-to-select GitHub](https://github.com/AirLabsTeam/react-drag-to-select)

### Secondary (MEDIUM confidence)
- [React DayPicker docs](https://daypicker.dev/) - Calendar internals, selection modes
- [MrLightful/shadcn-tree-view](https://github.com/MrLightful/shadcn-tree-view) - Tree view pattern reference

### Tertiary (LOW confidence)
- Community patterns for drag selection - Need validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project libraries plus well-documented additions
- Architecture: HIGH - Patterns derived from existing codebase, clear transformation path
- Pitfalls: MEDIUM - Based on common React patterns, some edge cases may emerge

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable libraries, UI refinement phase)
