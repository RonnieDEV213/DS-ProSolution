# Phase 14: History & Snapshot Simplification - Research

**Researched:** 2026-01-23
**Domain:** UI simplification, React components, FastAPI backend refactoring
**Confidence:** HIGH

## Summary

This phase is a cleanup/simplification phase that removes unused UI components and enriches the existing audit log endpoint. The existing codebase already has all necessary infrastructure - the changes involve:

1. Extending the existing `GET /sellers/audit-log/{log_id}/sellers` endpoint to return `added` and `removed` arrays computed from the audit log entry's `old_value`/`new_value` JSON fields
2. Refactoring `LogDetailModal` to display a unified Changes panel with inline diff indicators (green/red styling for added/removed sellers)
3. Removing `DiffModal`, `HierarchicalRunModal`, compare mode UI, and the `/sellers/diff` endpoint
4. Potentially removing `/collection/runs/{run_id}/breakdown` if orphaned after modal removal

**Primary recommendation:** Extend the existing audit log endpoint rather than creating a new one. The `old_value`/`new_value` JSON fields already contain all data needed to compute per-entry diffs.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | UI components | Already in project |
| Next.js | 14+ | App Router | Already in project |
| shadcn/ui | latest | Dialog, Badge components | Already in project |
| lucide-react | latest | Icons (Plus, Minus) | Already in project |
| TailwindCSS | 3+ | Styling | Already in project |
| FastAPI | latest | Backend API | Already in project |
| Pydantic | 2+ | Response models | Already in project |

### No New Dependencies Required

This phase requires no new libraries. All styling (green/red backgrounds, borders, alternating tints) can be achieved with existing TailwindCSS utilities. Icons for added (+) and removed (-) indicators already exist in lucide-react.

## Architecture Patterns

### Existing Backend Pattern: Audit Log Entry Structure

The `seller_audit_log` table stores entries with this structure:
```python
# From collection.py _log_seller_change()
log_data = {
    "org_id": org_id,
    "action": action,  # "add", "edit", "remove"
    "seller_id": seller_id,
    "seller_name": seller_name,
    "old_value": json.dumps(old_value) if old_value else None,
    "new_value": json.dumps(new_value) if new_value else None,
    "source": source,  # "manual", "collection_run"
    "source_run_id": run_id,
    "affected_count": affected_count,
    "seller_count_snapshot": seller_count_snapshot,
}
```

**Key insight:** The `old_value` and `new_value` JSON fields ALREADY contain all data needed for per-entry diff:

| Action | old_value | new_value | Added | Removed |
|--------|-----------|-----------|-------|---------|
| add (single) | null | `{"display_name": "X"}` | ["X"] | [] |
| add (bulk) | null | `{"names": ["X","Y",...]}` | ["X","Y",...] | [] |
| remove (single) | `{"display_name": "X"}` | null | [] | ["X"] |
| remove (bulk) | `{"names": ["X","Y",...]}` | null | [] | ["X","Y",...] |
| edit | `{"display_name": "Old"}` | `{"display_name": "New"}` | ["New"] | ["Old"] |

### Recommended Backend Response Extension

Extend `GET /sellers/audit-log/{log_id}/sellers` to return:
```json
{
  "sellers": ["A", "B", "C"],   // Existing: seller list at that point
  "count": 3,                   // Existing
  "added": ["A"],               // NEW: sellers added by THIS entry
  "removed": []                 // NEW: sellers removed by THIS entry
}
```

### Frontend: Unified Modal Pattern

Current structure (LogDetailModal):
```
+----------------------------------+
| Log Details            [Compare] |
+----------------------------------+
| Sellers at this  | Full History  |
| point (X)        |               |
| +--------------+ | Entry 1       |
| | Grid of all  | | Entry 2       |
| | sellers      | | Entry 3       |
| +--------------+ | ...           |
+----------------------------------+
```

Target structure (History Entry modal):
```
+----------------------------------+
| History Entry                    |
+----------------------------------+
| Changes          | Full History  |
| +--------------+ | Entry 1 [sel] |
| | Added (2)    | | Entry 2       |
| | + Seller A   | | Entry 3       |
| | + Seller B   | | ...           |
| +--------------+ |               |
| | Removed (1)  | |               |
| | - Seller C   | |               |
| +--------------+ |               |
+----------------------------------+
```

### Diff Styling Pattern (From Decisions)

```tsx
// Added seller row
<div className={cn(
  "flex items-center gap-2 px-3 py-2",
  "bg-green-500/10 border-l-2 border-green-500",
  index % 2 === 0 ? "bg-green-500/10" : "bg-green-500/5"  // Alternating tints
)}>
  <Plus className="h-4 w-4 text-green-400" />
  <span className="text-green-300">{sellerName}</span>
</div>

// Removed seller row
<div className={cn(
  "flex items-center gap-2 px-3 py-2",
  "bg-red-500/10 border-l-2 border-red-500",
  index % 2 === 0 ? "bg-red-500/10" : "bg-red-500/5"  // Alternating tints
)}>
  <Minus className="h-4 w-4 text-red-400" />
  <span className="text-red-300">{sellerName}</span>
</div>
```

### Anti-Patterns to Avoid
- **Computing diff client-side from full seller lists:** Wasteful - backend already has the data in `old_value`/`new_value`
- **Creating a new endpoint:** Extend existing endpoint instead
- **Keeping compare mode code:** Delete it, don't comment it out (it's being replaced by inline diff)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff display styling | Custom CSS | TailwindCSS utilities | `bg-green-500/10`, `border-l-2 border-green-500` already available |
| Plus/Minus icons | SVG paths | lucide-react `Plus`, `Minus` | Already imported in project |
| Modal dialog | Custom modal | shadcn/ui `Dialog` | Already used by existing modal |
| Section headers | Custom component | Simple divs with TailwindCSS | "Added (X)" / "Removed (X)" are just styled text |

**Key insight:** This is a cleanup phase. The infrastructure exists. Don't add complexity.

## Common Pitfalls

### Pitfall 1: Forgetting Bulk Operations in Diff Computation
**What goes wrong:** Only handling single seller entries, missing bulk add/remove
**Why it happens:** Bulk operations store names in JSON arrays (`{"names": ["A","B"]}`)
**How to avoid:** Parse both formats:
```python
# For add action:
if new_value:
    data = json.loads(new_value)
    if "names" in data:  # Bulk
        added = data["names"]
    elif "display_name" in data:  # Single
        added = [data["display_name"]]
```
**Warning signs:** Tests work for single sellers but fail for bulk imports

### Pitfall 2: Edit Action Has Both Added and Removed
**What goes wrong:** Treating edit as only an "add" or only a "remove"
**Why it happens:** UI decision says rename shows both old (removed) and new (added)
**How to avoid:** For `action == "edit"`:
```python
if action == "edit":
    old_name = json.loads(old_value).get("display_name")
    new_name = seller_name  # The new name is stored directly
    removed = [old_name] if old_name else []
    added = [new_name]
```
**Warning signs:** Rename entries show incomplete information

### Pitfall 3: Empty Sections Still Rendered
**What goes wrong:** Showing "Added (0)" or "Removed (0)" headers
**Why it happens:** Not conditionally rendering based on array length
**How to avoid:** From CONTEXT.md decisions: "Hide empty sections"
```tsx
{added.length > 0 && (
  <div className="mb-4">
    <h4>Added ({added.length})</h4>
    {/* rows */}
  </div>
)}
```
**Warning signs:** UI shows empty "Removed (0)" sections

### Pitfall 4: Leaving Unused Code
**What goes wrong:** Compare mode, DiffModal, HierarchicalRunModal left in codebase
**Why it happens:** Fear of breaking something
**How to avoid:** These components are being removed, not deprecated:
- `diff-modal.tsx` - DELETE
- `hierarchical-run-modal.tsx` - DELETE
- Compare mode in LogDetailModal - DELETE (including all `compareMode`, `compareSelection` state)
- `POST /sellers/diff` endpoint - DELETE
- `GET /collection/runs/{run_id}/breakdown` - CHECK if still used, delete if not
**Warning signs:** Dead code in codebase, unused imports

### Pitfall 5: Not Highlighting Selected Entry in Full History
**What goes wrong:** User can't see which entry they're viewing
**Why it happens:** Forgetting to track `viewingEntry` state and apply styles
**How to avoid:** Keep the existing `viewingEntry` state pattern but apply to new modal:
```tsx
const isViewing = (entry: HistoryEntry) => viewingEntry?.id === entry.id;

// In render:
<button className={cn(
  "w-full text-left px-3 py-2",
  isViewing(entry) && "bg-blue-500/20 ring-1 ring-blue-500"  // Or similar highlight
)}>
```
**Warning signs:** Clicking entries doesn't show which one is selected

## Code Examples

Verified patterns from the existing codebase:

### Backend: Parsing Audit Log Entry Values
```python
# Source: apps/api/src/app/services/collection.py lines 882-954
# Existing pattern for parsing old_value/new_value

import json

def compute_entry_diff(entry: dict) -> tuple[list[str], list[str]]:
    """Compute added/removed lists from audit log entry."""
    action = entry["action"]
    old_value = entry.get("old_value")
    new_value = entry.get("new_value")
    seller_name = entry.get("seller_name")

    added: list[str] = []
    removed: list[str] = []

    if action == "add":
        if new_value:
            try:
                data = json.loads(new_value)
                if "names" in data:  # Bulk add
                    added = data["names"]
                elif "display_name" in data:  # Single add
                    added = [data["display_name"]]
            except (json.JSONDecodeError, TypeError):
                added = [seller_name] if seller_name else []
        else:
            added = [seller_name] if seller_name else []

    elif action == "remove":
        if old_value:
            try:
                data = json.loads(old_value)
                if "names" in data:  # Bulk remove
                    removed = data["names"]
                elif "display_name" in data:  # Single remove
                    removed = [data["display_name"]]
            except (json.JSONDecodeError, TypeError):
                removed = [seller_name] if seller_name else []
        else:
            removed = [seller_name] if seller_name else []

    elif action == "edit":
        # Edit: old name removed, new name added
        if old_value:
            try:
                old_data = json.loads(old_value)
                old_name = old_data.get("display_name")
                if old_name:
                    removed = [old_name]
            except (json.JSONDecodeError, TypeError):
                pass
        # seller_name is the new name
        if seller_name:
            added = [seller_name]

    return sorted(added), sorted(removed)
```

### Frontend: Conditional Section Rendering
```tsx
// Pattern for rendering Added/Removed sections with counts
// Based on CONTEXT.md decisions

interface SellerChanges {
  added: string[];
  removed: string[];
}

function ChangesPanel({ changes }: { changes: SellerChanges }) {
  const hasChanges = changes.added.length > 0 || changes.removed.length > 0;

  if (!hasChanges) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        {/* Empty state icon + message - Claude's discretion */}
        <FileQuestion className="h-12 w-12 mb-2 text-gray-600" />
        <span className="text-sm">No changes in this entry</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Added section - only if items exist */}
      {changes.added.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Added ({changes.added.length})
          </h4>
          <div className="space-y-1">
            {changes.added.map((name, i) => (
              <div
                key={name}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded",
                  "border-l-2 border-green-500",
                  i % 2 === 0 ? "bg-green-500/10" : "bg-green-500/5"
                )}
              >
                <Plus className="h-3.5 w-3.5 text-green-400" />
                <span className="text-sm text-green-300">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Removed section - only if items exist */}
      {changes.removed.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            Removed ({changes.removed.length})
          </h4>
          <div className="space-y-1">
            {changes.removed.map((name, i) => (
              <div
                key={name}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded",
                  "border-l-2 border-red-500",
                  i % 2 === 0 ? "bg-red-500/10" : "bg-red-500/5"
                )}
              >
                <Minus className="h-3.5 w-3.5 text-red-400" />
                <span className="text-sm text-red-300">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Frontend: Updated Fetch for Seller Changes
```tsx
// Updated fetch pattern for new API response shape
const fetchChangesForEntry = useCallback(async (entryId: string) => {
  setChangesLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(
      `${API_BASE}/sellers/audit-log/${entryId}/sellers`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    if (res.ok) {
      const data = await res.json();
      // New response shape: { sellers, count, added, removed }
      setChanges({
        added: data.added || [],
        removed: data.removed || [],
      });
    }
  } catch (e) {
    console.error("Failed to fetch changes:", e);
  } finally {
    setChangesLoading(false);
  }
}, [supabase.auth]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate DiffModal for comparing | Inline diff in single modal | This phase | Simpler UX, fewer components |
| Compare mode selecting 2 logs | Changes shown per-entry | This phase | More intuitive mental model |
| HierarchicalRunModal for run details | Unified modal for all history | This phase | Consistent experience |
| POST /sellers/diff for comparison | Per-entry diff from audit log | This phase | Less API surface area |

**Components to Delete:**
- `diff-modal.tsx` - Entire file, replaced by inline diff in History Entry modal
- `hierarchical-run-modal.tsx` - Entire file, unified into History Entry modal
- Compare mode state/UI in LogDetailModal - Being replaced

**Endpoints to Delete:**
- `POST /sellers/diff` - No longer needed, diff computed from audit log entry
- `GET /collection/runs/{run_id}/breakdown` - Check usage; delete if only used by HierarchicalRunModal

## Open Questions

Things that couldn't be fully resolved:

1. **Breakdown Endpoint Usage**
   - What we know: `/collection/runs/{run_id}/breakdown` is currently only fetched by HierarchicalRunModal
   - What's unclear: Whether any other code or external integrations use it
   - Recommendation: Search codebase for `breakdown` usage before deletion; if only HierarchicalRunModal uses it, safe to delete

2. **Collection Run Entries in Unified Modal**
   - What we know: Collection runs will now open the same History Entry modal as manual edits
   - What's unclear: Whether collection runs have audit log entries (they record `sellers_new` in the run, not individual audit entries)
   - Recommendation: Collection runs may need their diff computed differently - possibly from `sellers_new` count or by comparing snapshots. Need to verify data model during implementation.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - Direct reading of:
  - `apps/api/src/app/services/collection.py` - Audit log structure, diff computation logic
  - `apps/api/src/app/routers/sellers.py` - Current endpoint structure
  - `apps/web/src/components/admin/collection/log-detail-modal.tsx` - Current modal implementation
  - `apps/web/src/components/admin/collection/diff-modal.tsx` - Component to be removed
  - `apps/web/src/components/admin/collection/hierarchical-run-modal.tsx` - Component to be removed
  - `apps/api/src/app/models.py` - Pydantic models

### Secondary (MEDIUM confidence)
- **CONTEXT.md** - User decisions on styling, naming, behavior

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified
- Architecture: HIGH - Following existing patterns, extending existing endpoint
- Pitfalls: HIGH - Based on actual code structure analysis
- Code examples: HIGH - Based on existing codebase patterns

**Research date:** 2026-01-23
**Valid until:** No expiration - cleanup phase using existing stable patterns
