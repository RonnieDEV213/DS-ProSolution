# Phase 33: Collection Keyboard Shortcuts - Research

**Researched:** 2026-01-28
**Domain:** Keyboard shortcuts, selection model, page-scoped hotkeys
**Confidence:** HIGH

## Summary

This phase adds keyboard shortcuts to the collection page (sellers grid) for power-user workflows: selection via mouse interactions (Click, Shift+Click, Ctrl+Click, Ctrl+A), action shortcuts (Delete, F=flag, E=export, S=start run), and integration with the page-contextual shortcuts reference (? key). The command palette (Cmd+K) stays navigation-only and is NOT touched.

The codebase already has a robust keyboard shortcut infrastructure from Phase 26: `react-hotkeys-hook` v5.2.3+ for binding, a `SHORTCUTS` registry in `shortcuts.ts`, a global shortcuts hook (`use-global-shortcuts.ts`), and a `ShortcutsReference` dialog. The sellers-grid component already implements a full selection model (Click, Shift+Click, Ctrl+Click, Ctrl+A, drag selection) with `selectedIds` state, a delete confirmation dialog, export modal, and Ctrl+Z undo. Most of the needed UI infrastructure exists -- the primary work is wiring keyboard shortcuts to existing handlers and making the shortcuts reference page-contextual.

**Primary recommendation:** Add a custom `useCollectionShortcuts` hook using `react-hotkeys-hook`'s `useHotkeys` with `enabled` callbacks that check for active page context (e.g., `usePathname`) and input focus. Wire each shortcut to the existing handlers in `sellers-grid.tsx`. Extend the `SHORTCUTS` registry with a `scope` field to make `ShortcutsReference` page-contextual.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hotkeys-hook | ^5.2.3 | Declarative keyboard shortcuts | Already used in `use-global-shortcuts.ts` |
| next/navigation (usePathname) | 14+ | Page detection for scoping | Already available in Next.js App Router |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner (toast) | already installed | Undo toast after delete | Already used in sellers-grid.tsx |
| lucide-react | already installed | Icons for toolbar | Already used |
| @/components/ui/* | shadcn/ui | AlertDialog, Dialog, Kbd | Already used |

### No New Libraries Needed
This phase requires zero new dependencies. Everything needed is already in place.

## Architecture Patterns

### Recommended Approach: Hook-per-Page + Registry Extension

The cleanest architecture is:

1. **`useCollectionShortcuts` hook** -- Page-specific hook that lives in `hooks/` and binds all collection shortcuts via `useHotkeys`. Takes callback props for each action.
2. **Extended `SHORTCUTS` registry** -- Add a `scope?: string` field to `ShortcutDefinition`. Global shortcuts have no scope. Collection shortcuts have `scope: "collection"`.
3. **Page-contextual `ShortcutsReference`** -- Filter displayed shortcuts by current page scope.
4. **First-visit hint** -- localStorage key + dismissible toast/banner.

### Pattern 1: useCollectionShortcuts Hook
**What:** A custom hook that encapsulates all collection-page keyboard bindings.
**When to use:** Called from `sellers-grid.tsx` (or collection page) with callback refs for each action.
**Why:** Keeps shortcut logic separate from component rendering. Mirrors how `useGlobalShortcuts` works.

```typescript
// Source: Derived from existing use-global-shortcuts.ts pattern
export function useCollectionShortcuts({
  enabled,
  selectedIds,
  filteredSellers,
  onDelete,
  onFlag,
  onExport,
  onStartRun,
  onSelectAll,
  onEscape,
}: CollectionShortcutOptions) {
  // Delete key -- only when selection exists
  useHotkeys("Delete,Backspace", () => {
    if (selectedIds.size > 0) onDelete();
  }, { enabled: () => enabled && selectedIds.size > 0, enableOnFormTags: false });

  // F -- flag toggle (Google Docs Ctrl+B pattern)
  useHotkeys("f", () => {
    if (selectedIds.size > 0) onFlag();
  }, { enabled: () => enabled && selectedIds.size > 0, enableOnFormTags: false });

  // E -- export
  useHotkeys("e", () => {
    onExport();
  }, { enabled: () => enabled, enableOnFormTags: false });

  // S -- start run
  useHotkeys("s", () => {
    onStartRun();
  }, { enabled: () => enabled, enableOnFormTags: false });

  // Escape -- clear selection
  useHotkeys("Escape", () => {
    onEscape();
  }, { enabled: () => enabled && selectedIds.size > 0, enableOnFormTags: false });
}
```

### Pattern 2: Scoped Shortcuts Registry
**What:** Extend the existing `ShortcutDefinition` type with an optional `scope` field to support page-contextual filtering.
**When to use:** For the ShortcutsReference dialog to show only relevant shortcuts.

```typescript
// Source: Extend existing shortcuts.ts
export interface ShortcutDefinition {
  key: string;
  label: string;
  description: string;
  display: string[];
  group: string;
  scope?: string;  // "collection" | undefined (global)
}

export const SHORTCUT_GROUPS = [
  "Navigation",
  "Actions",
  "Command Palette",
  "Collection",  // NEW group
] as const;
```

### Pattern 3: Page-Contextual ShortcutsReference
**What:** The ShortcutsReference dialog filters shortcuts based on the current route.
**When to use:** When the ? key is pressed, show global shortcuts + page-specific shortcuts.

```typescript
// Source: Derived from existing shortcuts-reference.tsx + usePathname
import { usePathname } from "next/navigation";

// Inside ShortcutsReference component:
const pathname = usePathname();
const activeScope = pathname?.includes("/automation") ? "collection" : undefined;

const visibleShortcuts = SHORTCUTS.filter(s =>
  !s.scope || s.scope === activeScope
);
```

### Pattern 4: Global Shortcut Conflict Resolution
**What:** The global `f` (filter/focus search) and `e` (export) shortcuts in `use-global-shortcuts.ts` conflict with the new collection-specific `f` (flag) and `e` (export selected) shortcuts.
**Resolution strategy:** The global shortcuts already use `CustomEvent` dispatch (`dspro:shortcut:export`, `dspro:shortcut:new`) but NO components currently listen for them. On the collection page, the collection-specific hooks should take precedence. Two approaches:

**Option A (Recommended): Override at hook level.** In `useCollectionShortcuts`, bind `f` and `e` with `preventDefault: true`. Since react-hotkeys-hook processes hooks in component tree order and the collection hook is deeper in the tree, its handler fires first. The global handler's `CustomEvent` dispatch is harmless (nothing listens). But there's a subtlety: both handlers may fire. To prevent this, use `event.stopPropagation()` in the collection hook callbacks, OR...

**Option B (Simpler): Disable global shortcuts on collection page.** Pass an `enabled` check to the global `f` and `e` bindings that returns `false` when on the collection page. This requires either:
- A context/state that the collection page sets
- A pathname check inside the `enabled` callback

**Option C (Simplest, Pragmatic): Do nothing special.** The global `f` focuses search input (which exists on collection page -- the add seller textarea). The global `e` dispatches a `CustomEvent` that nothing listens to. So:
- Global `f` on collection page: focuses the seller search/add textarea -- this is actually useful! Collection `F` (flag) only fires when there's a selection. Since `f` and `F` are the same key, the conflict is real.
- Global `e` on collection page: dispatches event to void. Collection `e` (export): opens export dialog. Both would fire.

**Recommended approach: Check input focus + selection state.** The collection `f` shortcut should only activate when sellers are selected. When no selection, let the global `f` handle it (focus search). For `e`, the collection hook should call `event.stopPropagation()` or use `event.preventDefault()` to avoid the global also firing. Since both use `useHotkeys` from the same library, the simplest approach is to make the collection hook's `e` handler stop the event, and the global `e` handler can be a no-op on collection page (or just let both fire -- the CustomEvent goes nowhere).

**IMPORTANT FINDING:** The global `f` shortcut focuses the search input. On the collection page, `f` should flag selected sellers. These conflict. The cleanest resolution: in `useCollectionShortcuts`, bind `f` with `enabled: () => selectedIds.size > 0`. When nothing is selected, the global `f` (focus search) naturally takes over. When something is selected, the collection `f` fires. Since both are `useHotkeys` calls, both will fire. Need to prevent global `f` from also focusing search when collection `f` flags. Solution: add `event.preventDefault()` + `event.stopImmediatePropagation()` in the collection `f` handler. Or: modify global `f` to check if event was already handled.

### Anti-Patterns to Avoid
- **Adding collection shortcuts to the command palette:** CONTEXT.md explicitly says Cmd+K stays navigation-only.
- **Using HotkeysProvider with scopes:** Overkill for this use case. The `enabled` option on individual `useHotkeys` calls is simpler and doesn't require wrapping the app in a provider.
- **Adding j/k navigation:** CONTEXT.md explicitly says no j/k navigation for the collection grid.
- **Removing Ctrl+Z:** CONTEXT.md explicitly says keep Ctrl+Z as-is.

## Existing Infrastructure Map

### What Already Exists in sellers-grid.tsx (NO changes needed for these)

| Feature | Implementation | Location |
|---------|---------------|----------|
| Selection state | `useState<Set<string>>` for `selectedIds` | Line 246 |
| Selection anchor | `useState<number \| null>` for `selectionAnchor` | Line 247 |
| Click selection (single) | `handleSellerClick` callback | Line 372-410 |
| Shift+Click range selection | Inside `handleSellerClick` with `event.shiftKey` | Line 389-395 |
| Ctrl+Click toggle | Inside `handleSellerClick` with `event.ctrlKey` | Line 397-400 |
| Ctrl+A select all | `useEffect` keydown listener | Line 773-790 |
| Ctrl+C copy | `useEffect` keydown listener | Line 792-814 |
| Ctrl+Z undo | `useEffect` keydown listener | Line 816-832 |
| Drag selection (left-click) | Mouse event handlers | Line 506-554 |
| Right-click drag flag painting | Mouse event handlers | Line 597-640 |
| Delete confirmation dialog | `AlertDialog` component | Line 1072-1092 |
| Bulk delete handler | `handleBulkDeleteClick` / `handleBulkDeleteConfirm` | Line 440-490 |
| Flag mutation | `useFlagSeller` + `useBatchFlagSellers` hooks | Line 232-233 |
| Export modal | `SellerExportModal` component | Line 1063-1069 |
| Selection toolbar | Inline header with checkbox + count + delete button | Line 1024-1059 |
| Undo stack | `undoStack` state, single-level | Line 254 |

### What Exists in Shortcut Infrastructure

| Component | File | What It Does |
|-----------|------|-------------|
| `SHORTCUTS` registry | `src/lib/shortcuts.ts` | Array of `ShortcutDefinition` objects with key, label, description, display, group, scope? |
| `SHORTCUT_GROUPS` | `src/lib/shortcuts.ts` | `["Navigation", "Actions", "Command Palette"]` |
| `ShortcutsReference` dialog | `src/components/command-palette/shortcuts-reference.tsx` | Modal showing all shortcuts grouped by `SHORTCUT_GROUPS` |
| `useGlobalShortcuts` hook | `src/hooks/use-global-shortcuts.ts` | Binds Cmd+K, ?, g+d, g+b, g+u, g+a, Cmd+B, n, f, e |
| `Kbd` component | `src/components/ui/kbd.tsx` | Styled keyboard key badge |
| `CommandPalette` | `src/components/command-palette/command-palette.tsx` | cmdk-based palette, navigation-only |
| `command-items.ts` | `src/lib/command-items.ts` | Navigation + action items for palette |
| `storage-keys.ts` | `src/lib/storage-keys.ts` | Central localStorage key registry |

### What Exists on Collection Page

| Component | File | What It Does |
|-----------|------|-------------|
| `CollectionPage` | `src/app/admin/automation/page.tsx` | Page layout: PageHeader + ProgressBar + SellersGrid + HistoryPanel + modals |
| `SellersGrid` | `src/components/admin/collection/sellers-grid.tsx` | Full grid with selection, delete, export, flag painting |
| `HistoryPanel` | `src/components/admin/collection/history-panel.tsx` | Right sidebar with history + "Start Collection" button |
| `RunConfigModal` | `src/components/admin/collection/run-config-modal.tsx` | Category selector + run/schedule config |
| `SellerExportModal` | `src/components/admin/collection/seller-export-modal.tsx` | Export dialog with format, flag-on-export, range options |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard binding | Raw `addEventListener('keydown')` | `useHotkeys` from `react-hotkeys-hook` | Handles modifier keys, form tag exclusion, cleanup automatically |
| Input focus detection | Manual `document.activeElement` checks | `enableOnFormTags: false` option in `useHotkeys` | Built-in, tested, handles edge cases |
| Page detection | Custom route state | `usePathname()` from `next/navigation` | Standard Next.js approach |
| First-visit hint dismissal | Custom state management | `localStorage.getItem/setItem` with key from `STORAGE_KEYS` | Simple, persistent, already patterned |

**Key insight:** The sellers-grid already has ALL the action handlers (delete, flag, export). The keyboard shortcuts just need to call existing functions. No new business logic is needed -- only wiring.

## Common Pitfalls

### Pitfall 1: Global vs. Page-Specific Shortcut Collision
**What goes wrong:** Both global `f` (focus search) and collection `f` (flag selected) fire simultaneously.
**Why it happens:** Multiple `useHotkeys` calls for the same key in different hooks both fire because there's no built-in conflict resolution.
**How to avoid:** Use the `enabled` callback on collection shortcuts to only activate when conditions are met (e.g., `selectedIds.size > 0`). For the `e` key (export), call `event.stopImmediatePropagation()` in the collection handler. For `f`, it naturally resolves: when nothing is selected, `enabled` returns false so global `f` (focus search) wins. When something is selected, collection `f` fires -- but global `f` also fires and focuses search, which is bad. Solution: in collection `f` handler, call `event.stopImmediatePropagation()` to prevent global handler.
**Warning signs:** Pressing F with selection both flags AND moves focus to search input.

### Pitfall 2: Shortcuts Firing Inside Text Inputs
**What goes wrong:** Pressing `f`, `e`, `s` while typing in the seller name textarea triggers shortcuts.
**Why it happens:** If `enableOnFormTags` is not properly set to `false`.
**How to avoid:** All collection `useHotkeys` calls must have `enableOnFormTags: false` (this is actually the default in v5, but be explicit).
**Warning signs:** Typing "sellers" in add input triggers flag or start run.

### Pitfall 3: Delete Key Without Selection
**What goes wrong:** Delete key pressed with no selection opens empty confirm dialog or throws.
**Why it happens:** Handler doesn't check selection state before opening dialog.
**How to avoid:** Gate `Delete` shortcut with `enabled: () => selectedIds.size > 0`.
**Warning signs:** Empty "Delete 0 sellers?" dialog.

### Pitfall 4: Escape Key Conflict with Dialogs
**What goes wrong:** Pressing Escape to close a dialog also clears selection.
**Why it happens:** Both the dialog's built-in Escape handler and the collection Escape handler fire.
**How to avoid:** Check if any dialog is open before clearing selection. Gate the Escape shortcut with `enabled: () => !deleteDialogOpen && !exportModalOpen`.
**Warning signs:** Selection disappears when closing delete confirmation dialog.

### Pitfall 5: Flag Toggle Logic Error
**What goes wrong:** F key flags all sellers even when all are already flagged.
**Why it happens:** Not implementing the Google Docs Ctrl+B pattern correctly.
**How to avoid:** Check: if ALL selected sellers are flagged, unflag all. If ANY are not flagged, flag all.
```typescript
const allFlagged = selectedSellers.every(s => s.flagged);
const newFlagState = !allFlagged; // true if any unflagged, false if all flagged
batchFlagMutation.mutate({ ids: selectedIds, flagged: newFlagState });
```
**Warning signs:** Cannot unflag sellers using F key.

### Pitfall 6: Export Not Scoped to Selection
**What goes wrong:** E key opens export dialog but exports ALL sellers, ignoring selection.
**Why it happens:** `SellerExportModal` receives `sellers={filteredSellers}` without filtering by selection.
**How to avoid:** When `selectedIds.size > 0`, pass only selected sellers to `SellerExportModal`. Update the modal's description to show "Exporting N sellers" per CONTEXT.md.
**Warning signs:** Exporting with 5 selected shows "Export 10,000 sellers" instead of "Export 5 sellers".

### Pitfall 7: S Key Ambiguity
**What goes wrong:** User expects S to start a run scoped to selected sellers.
**Why it happens:** Natural assumption that selection affects run scope.
**How to avoid:** CONTEXT.md explicitly says "Selection does not affect run scope -- S always starts a full collection run." The S shortcut should open the RunConfigModal regardless of selection. Clear documentation in the shortcuts reference.
**Warning signs:** Users confused that S ignores selection.

## Code Examples

### Example 1: Flag Toggle with Google Docs Pattern
```typescript
// Source: Derived from existing batchFlagMutation pattern in sellers-grid.tsx
const handleFlagToggle = useCallback(() => {
  if (selectedIds.size === 0) return;

  const selectedSellers = filteredSellers.filter(s => selectedIds.has(s.id));
  const allFlagged = selectedSellers.every(s => s.flagged);
  const newFlagState = !allFlagged;

  const idsToChange = selectedSellers
    .filter(s => s.flagged !== newFlagState)
    .map(s => s.id);

  if (idsToChange.length > 0) {
    batchFlagMutation.mutate(
      { ids: idsToChange, flagged: newFlagState },
      { onSuccess: () => onSellerChange() }
    );
  }
}, [selectedIds, filteredSellers, batchFlagMutation, onSellerChange]);
```

### Example 2: Selection-Scoped Export
```typescript
// Source: Derived from existing SellerExportModal usage in sellers-grid.tsx
// When opening export, scope to selected sellers if any
const exportSellers = selectedIds.size > 0
  ? filteredSellers.filter(s => selectedIds.has(s.id))
  : filteredSellers;

<SellerExportModal
  open={exportModalOpen}
  onOpenChange={setExportModalOpen}
  sellers={exportSellers}
  totalCount={selectedIds.size > 0 ? selectedIds.size : totalCount}
  onExportComplete={() => onSellerChange?.()}
/>
```

### Example 3: Page-Contextual Shortcuts Reference
```typescript
// Source: Derived from existing shortcuts-reference.tsx
import { usePathname } from "next/navigation";

export function ShortcutsReference({ open, onOpenChange }: ShortcutsReferenceProps) {
  const pathname = usePathname();
  const activeScope = pathname?.includes("/automation") ? "collection" : undefined;

  const visibleGroups = SHORTCUT_GROUPS.filter(group => {
    const groupShortcuts = SHORTCUTS.filter(
      s => s.group === group && (!s.scope || s.scope === activeScope)
    );
    return groupShortcuts.length > 0;
  });

  // ... render only visible groups and their shortcuts
}
```

### Example 4: First-Visit Hint
```typescript
// Source: Pattern from storage-keys.ts + localStorage usage
const HINT_KEY = "dspro:collection_shortcuts_hint_dismissed";

function CollectionShortcutsHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(HINT_KEY);
    if (!dismissed) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(HINT_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="bg-muted border border-border rounded px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
      <span>Tip: Press <Kbd>?</Kbd> for keyboard shortcuts</span>
      <Button variant="ghost" size="sm" onClick={dismiss}>Dismiss</Button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `addEventListener` for Ctrl+A, Ctrl+C, Ctrl+Z | Should use `useHotkeys` | This phase | Consistent with global shortcuts pattern |
| No page-scoped shortcuts | `scope` field on ShortcutDefinition + pathname check | This phase | ShortcutsReference becomes page-contextual |
| Hardcoded bookkeeping shortcuts in modal | Unified registry-driven shortcuts reference | Phase 26 | All shortcuts in one place |

**Deprecated/outdated:**
- The sellers-grid currently uses raw `useEffect` + `addEventListener` for Ctrl+A, Ctrl+C, Ctrl+Z (lines 773-832). Consider migrating these to `useHotkeys` for consistency, but this is optional and could be deferred.

## Key Conflict Analysis

| Key | Global Binding | Collection Binding | Conflict Resolution |
|-----|---------------|-------------------|---------------------|
| `f` | Focus search input | Flag selected sellers | Collection: `enabled` when `selectedIds.size > 0` + `stopImmediatePropagation`. Global `f` works when nothing selected. |
| `e` | Dispatch `dspro:shortcut:export` (no listeners) | Open export dialog | Collection `e` handler calls `stopImmediatePropagation`. No real conflict since global dispatches to void. |
| `s` | (not bound globally) | Open run config | No conflict. |
| `Delete` | (not bound globally) | Delete selected sellers | No conflict. |
| `Escape` | Close modal/dialog (global) | Clear selection | Collection: only clear selection when no dialog open. Dialog Escape is handled by shadcn/ui Dialog internally. |
| `Ctrl+A` | (not bound globally, but in sellers-grid useEffect) | Already implemented | Already works -- refactor to `useHotkeys` for consistency. |
| `Ctrl+Z` | (in sellers-grid useEffect) | Keep as-is per CONTEXT.md | No change needed. |
| `Ctrl+C` | (in sellers-grid useEffect) | Copy selected sellers | Already works -- keep as-is. |
| `?` | Open ShortcutsReference (global) | Shows collection-specific shortcuts | No shortcut conflict -- just need ShortcutsReference to be page-contextual. |

## Implementation Surface Area

### Files to Create
1. `src/hooks/use-collection-shortcuts.ts` -- New hook for collection-specific keyboard bindings

### Files to Modify
1. `src/lib/shortcuts.ts` -- Add collection shortcuts to registry, add "Collection" group to `SHORTCUT_GROUPS`, ensure `scope` field is supported
2. `src/lib/storage-keys.ts` -- Add `COLLECTION_SHORTCUTS_HINT_DISMISSED` key
3. `src/components/command-palette/shortcuts-reference.tsx` -- Make page-contextual (filter by scope using `usePathname`)
4. `src/components/admin/collection/sellers-grid.tsx` -- Wire `useCollectionShortcuts` hook, add flag toggle handler, pass selection-scoped sellers to export modal, add first-visit hint
5. `src/app/admin/automation/page.tsx` -- Pass `onStartRun` callback down to SellersGrid (or lift run config modal trigger)

### Files NOT to Modify
- `src/lib/command-items.ts` -- Command palette stays navigation-only
- `src/components/command-palette/command-palette.tsx` -- No changes
- `src/hooks/use-global-shortcuts.ts` -- No changes needed (conflicts resolved via `stopImmediatePropagation` in collection hook)

## Open Questions

1. **Toolbar update when selection active:**
   - What we know: CONTEXT.md says "Toolbar/header area updates inline to show selection count and available actions when 1+ sellers selected". The header already shows selection count and a delete button (line 1024-1059).
   - What's unclear: Should we also show Flag, Export, and Start Run buttons in the toolbar when selection is active? Currently only Delete button appears.
   - Recommendation: Add visible action buttons with keyboard shortcut badges (e.g., "Flag [F]", "Export [E]") in the selection toolbar. This improves discoverability. Falls under Claude's discretion per CONTEXT.md.

2. **Shortcut key badges on buttons:**
   - What we know: CONTEXT.md lists this under Claude's Discretion.
   - Recommendation: Show subtle `Kbd` badges on toolbar buttons when selection is active: `Delete [Del]`, `Flag [F]`, `Export [E]`. The Start Run button in the HistoryPanel could show `[S]`. This is standard in power-user tools.

3. **stopImmediatePropagation reliability:**
   - What we know: Using `stopImmediatePropagation()` in `useHotkeys` callbacks should prevent other `useHotkeys` listeners on the same key from firing.
   - What's unclear: Whether react-hotkeys-hook v5.2.3 guarantees handler ordering across different component depths.
   - Recommendation: Test this explicitly. Fallback: add an `enabled` check on the global `f` handler that checks if collection page is active, using a lightweight context or pathname check.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `sellers-grid.tsx`, `shortcuts.ts`, `use-global-shortcuts.ts`, `shortcuts-reference.tsx`, `command-palette.tsx`, `command-items.ts`, `admin/layout.tsx`, `automation/page.tsx`, `seller-export-modal.tsx`, `run-config-modal.tsx`, `use-flag-seller.ts`, `use-delete-seller.ts`, `storage-keys.ts`, `kbd.tsx`, `bookkeeping-content.tsx`, `keyboard-shortcuts-modal.tsx`, `records-toolbar.tsx`
- react-hotkeys-hook official docs: [useHotkeys API](https://react-hotkeys-hook.vercel.app/docs/api/use-hotkeys), [Scoping Hotkeys](https://react-hotkeys-hook.vercel.app/docs/documentation/useHotkeys/scoping-hotkeys), [Disable/Enable](https://react-hotkeys-hook.vercel.app/docs/documentation/useHotkeys/disable-hotkeys)

### Secondary (MEDIUM confidence)
- react-hotkeys-hook GitHub: [Repository](https://github.com/JohannesKlauss/react-hotkeys-hook)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new libraries, all already installed and used
- Architecture: HIGH -- patterns derived directly from existing codebase (`use-global-shortcuts.ts`, `shortcuts.ts`)
- Pitfalls: HIGH -- identified through direct code analysis of existing handlers and conflict points
- Conflict resolution: MEDIUM -- `stopImmediatePropagation` ordering across hooks needs runtime verification

**Research date:** 2026-01-28
**Valid until:** 2026-03-28 (stable -- no external dependencies changing)
