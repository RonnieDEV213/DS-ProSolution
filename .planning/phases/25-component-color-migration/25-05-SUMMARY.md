---
phase: 25-component-color-migration
plan: 05
subsystem: admin-collection-components
tags: [semantic-tokens, color-migration, monospace-formatting, theme-aware, progress-bar, metrics, feeds]
requires: [24-layout-consolidation, 25-04]
provides: [collection-history-semantic-colors, collection-metrics-semantic-colors, collection-config-semantic-colors, progress-bar-theme-aware]
affects: [25-06, 25-07]
tech-stack:
  added: []
  patterns: [semantic-token-migration, monospace-data-pill, terminal-style-log-output, theme-aware-progress-bar]
key-files:
  created: []
  modified:
    - apps/web/src/components/admin/collection/activity-feed.tsx
    - apps/web/src/components/admin/collection/collection-history.tsx
    - apps/web/src/components/admin/collection/history-panel.tsx
    - apps/web/src/components/admin/collection/log-detail-modal.tsx
    - apps/web/src/components/admin/collection/recent-logs-sidebar.tsx
    - apps/web/src/components/admin/collection/pipeline-feed.tsx
    - apps/web/src/components/admin/collection/run-config-modal.tsx
    - apps/web/src/components/admin/collection/schedule-config.tsx
    - apps/web/src/components/admin/collection/metrics-panel.tsx
    - apps/web/src/components/admin/collection/metrics-summary.tsx
    - apps/web/src/components/admin/collection/progress-bar.tsx
    - apps/web/src/components/admin/collection/progress-detail-modal.tsx
    - apps/web/src/components/admin/collection/amazon-category-selector.tsx
    - apps/web/src/components/admin/collection/category-preset-dropdown.tsx
key-decisions:
  - id: progress-bar-semantic-track
    decision: "Progress bar track uses bg-muted, container uses bg-background with border-border"
    rationale: "Adapts to all 4 themes while preserving existing animation and shimmer effects"
  - id: stat-card-monospace-values
    decision: "All metric values in StatCard component use font-mono for numeric data"
    rationale: "Consistent tabular alignment for metrics and numeric readouts"
  - id: category-selector-accent-state
    decision: "Selected categories use bg-accent/50, hover uses bg-accent for tree items"
    rationale: "Accent token provides clear selected state that adapts per theme"
metrics:
  duration: 22m
  completed: 2026-01-26
---

# Phase 25 Plan 05: Admin Collection Components Migration Summary

Migrated 14 admin collection component files (history, metrics, config, progress) from hardcoded gray-* classes to semantic tokens, with monospace data formatting for metrics and timestamps.

## What Was Done

### Task 1: Collection History, Feed, and Log Components (6 files)

**activity-feed.tsx:**
- Card backgrounds: `bg-gray-800/50` -> `bg-card/50`
- Gradient end: `to-gray-800/50` -> `to-card/50`
- Timestamp: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Default icon color: `text-gray-400` -> `text-muted-foreground`
- Feed text: `text-gray-300`/`text-gray-400` -> `text-foreground`/`text-muted-foreground`
- Worker 0 color: `bg-gray-500/20 text-gray-400` -> `bg-muted text-muted-foreground border-border`
- Action border styles: `border-l-gray-400` -> `border-l-muted-foreground`
- Empty state: `text-gray-500` -> `text-muted-foreground`

**collection-history.tsx:**
- Table container: `border-gray-800` -> `border-border`
- Table header: `bg-gray-800/50` -> `bg-muted/50`
- All 9 TableHead: `text-gray-400` -> `text-muted-foreground`
- Row hover: `hover:bg-gray-800/30` -> `hover:bg-accent/30`
- Run name: `text-gray-200` -> `text-foreground`
- Date cells: `text-gray-400` -> `text-muted-foreground`, added `font-mono`
- Numeric cells (duration, categories, products, sellers): `text-gray-300` -> `text-foreground`, added `font-mono`
- Loading/empty state: `text-gray-400`/`text-gray-500` -> `text-muted-foreground`
- Title: `text-white` -> `text-foreground`

**history-panel.tsx:**
- Collection run items: `bg-gray-800 hover:bg-gray-700` -> `bg-card hover:bg-accent`
- Manual edit items: `bg-gray-800 hover:bg-gray-700` -> `bg-card hover:bg-accent`
- Border colors: `border-gray-600` -> `border-border`
- Entry text: `text-gray-300` -> `text-foreground`
- Metadata: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Header icon: `text-gray-400` -> `text-muted-foreground`
- Loading/empty: `text-gray-500` -> `text-muted-foreground`
- Bottom border: `border-gray-800` -> `border-border`

**log-detail-modal.tsx:**
- Dialog: `bg-gray-900 border-gray-800` -> `bg-background border-border`
- Title: `text-white` -> `text-foreground`
- Panels: `bg-gray-800 border-gray-700` -> `bg-muted border-border`
- Section headers (4): `text-gray-300` -> `text-foreground`
- Entry borders: `border-gray-700` -> `border-border`
- Entry hover: `hover:bg-gray-700` -> `hover:bg-accent`
- Entry text: `text-gray-300` -> `text-foreground`
- Timestamps: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Loading/empty: `text-gray-400`/`text-gray-500`/`text-gray-600` -> `text-muted-foreground`

**recent-logs-sidebar.tsx:**
- Header: `text-gray-400`/`text-gray-300` -> `text-muted-foreground`/`text-foreground`
- Log entries: `bg-gray-800 hover:bg-gray-700` -> `bg-card hover:bg-accent`
- Text: `text-gray-300` -> `text-foreground`
- Timestamps: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Loading/empty: `text-gray-500` -> `text-muted-foreground`
- Bottom border: `border-gray-800` -> `border-border`

**pipeline-feed.tsx:**
- Deduped color: `border-l-gray-400 bg-gray-800/50` -> `border-l-muted-foreground bg-card/50`
- Default fallback: `border-l-gray-400 bg-gray-800/50` -> `border-l-muted-foreground bg-card/50`
- Icon: `text-gray-400` -> `text-muted-foreground`
- Message text: `text-gray-200` -> `text-foreground`
- Worker badge: `bg-gray-700/50 text-gray-400` -> `bg-muted text-muted-foreground`
- Timestamp: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Empty state: `text-gray-500` -> `text-muted-foreground`

### Task 2: Collection Config, Metrics, and Progress Components (8 files)

**run-config-modal.tsx:**
- Dialog: `bg-gray-900 border-gray-800` -> `bg-background border-border`
- Title: `text-white` -> `text-foreground`
- Description: `text-gray-400` -> `text-muted-foreground`
- Labels (4): `text-gray-200`/`text-gray-300` -> `text-foreground`
- Helper text: `text-gray-500` -> `text-muted-foreground`
- SelectTrigger: `bg-gray-800 border-gray-700 text-white` -> `bg-muted border-input text-foreground`
- SelectContent: `bg-gray-800 border-gray-700` -> `bg-card border-border`
- SelectItems: `text-gray-200` -> `text-foreground`
- Calendar: `border-gray-700 bg-gray-800` -> `border-border bg-muted`
- Borders: `border-gray-800`/`border-gray-700` -> `border-border`

**schedule-config.tsx:**
- Card: `bg-gray-900 border-gray-800` -> `bg-card border-border`
- Title: `text-white` -> `text-foreground`
- Description: `text-gray-400` -> `text-muted-foreground`
- All Labels (5): `text-gray-200` -> `text-foreground`
- Helper text (2): `text-gray-500` -> `text-muted-foreground`
- All SelectTriggers (3): `bg-gray-800 border-gray-700 text-white` -> `bg-muted border-input text-foreground`
- All SelectContents (3): `bg-gray-800 border-gray-700` -> `bg-card border-border`
- All SelectItems: `text-gray-200` -> `text-foreground`
- Custom cron input: `bg-gray-800 border-gray-700 text-white` -> `bg-muted border-input text-foreground`
- Next run time: `text-gray-400` -> `text-muted-foreground`, added `font-mono`
- Loading/error: `text-gray-400`/`text-gray-500` -> `text-muted-foreground`

**metrics-panel.tsx:**
- Idle worker button: `bg-gray-700` -> `bg-muted`
- Hover ring: `hover:ring-gray-500` -> `hover:ring-muted-foreground`
- State indicator bg: `bg-gray-900` -> `bg-background`
- Tooltip state text: `text-gray-400` -> `text-muted-foreground`
- Section border: `border-gray-800` -> `border-border`
- Section labels (3): `text-gray-500`/`text-gray-300` -> `text-muted-foreground`/`text-foreground`

**metrics-summary.tsx:**
- StatCard bg: `bg-gray-800/50` -> `bg-muted/50`
- StatCard label: `text-gray-400` -> `text-muted-foreground`
- StatCard default color: `text-white` -> `text-foreground`
- StatCard value: Added `font-mono` for all numeric values
- Failed zero color: `text-gray-400` -> `text-muted-foreground`
- Error breakdown labels (5): `text-gray-400` -> `text-muted-foreground`
- Other error badge: `text-gray-400 border-gray-700` -> `text-muted-foreground border-border`

**progress-bar.tsx:**
- Container: `bg-gray-900 border-gray-800` -> `bg-background border-border`
- Track: `bg-gray-800` -> `bg-muted`
- Activity text: `text-gray-500` -> `text-muted-foreground`
- All stat labels (7): `text-gray-500` -> `text-muted-foreground`
- All stat values: `text-gray-300` -> `text-foreground`, added `font-mono`
- Separator pipes (5): `text-gray-700` -> `text-border`
- Duration: `text-gray-400` -> `text-muted-foreground`, added `font-mono`
- Details button: `text-gray-400 hover:text-gray-200` -> `text-muted-foreground hover:text-foreground`

**progress-detail-modal.tsx:**
- Floating indicator: `bg-gray-800 border-gray-700` -> `bg-card border-border`
- Indicator hover: `hover:bg-gray-750` -> `hover:bg-accent`
- Indicator track: `bg-gray-700` -> `bg-muted`
- Indicator text: `text-gray-400` -> `text-muted-foreground`, added `font-mono`
- Dialog: `bg-gray-900 border-gray-800` -> `bg-background border-border`
- Duration: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Panel border: `border-gray-800` -> `border-border`
- Footer border: `border-gray-800` -> `border-border`

**amazon-category-selector.tsx:**
- Loading text: `text-gray-400` -> `text-muted-foreground`
- Selection badge: `bg-gray-700 text-gray-200` -> `bg-muted text-foreground`
- Search icon: `text-gray-500` -> `text-muted-foreground`
- Search input: `bg-gray-800 border-gray-700` -> `bg-muted border-input`
- Department bg: `bg-gray-800` -> `bg-card`
- Department hover: `hover:bg-gray-750` -> `hover:bg-accent`
- Chevron icons (2): `text-gray-400` -> `text-muted-foreground`
- Department name: `text-white` -> `text-foreground`
- Count: `text-gray-500` -> `text-muted-foreground`, added `font-mono`
- Category hover/selected: `hover:bg-gray-700` / `bg-gray-700/50` -> `hover:bg-accent` / `bg-accent/50`
- Category text: `text-gray-300` -> `text-foreground`
- Empty search: `text-gray-500` -> `text-muted-foreground`

**category-preset-dropdown.tsx:**
- Trigger button: `border-gray-700 bg-gray-800` -> `border-border bg-card`
- Dropdown content: `bg-gray-800 border-gray-700` -> `bg-card border-border`
- Separator: `bg-gray-700` -> `bg-border`
- Delete button: `text-gray-500` -> `text-muted-foreground`
- Save input: `bg-gray-800 border-gray-700` -> `bg-muted border-input`
- Save label: `text-gray-400` -> `text-muted-foreground`

## Decisions Made

1. **Progress bar semantic track**: Track uses `bg-muted`, container uses `bg-background border-border`. Fill colors (orange/blue/yellow/red/green) kept as intentional status colors, not themed.
2. **All metric values use font-mono**: StatCard values, progress percentages, durations, counts all get `font-mono` for tabular numeric alignment.
3. **Category selector accent state**: Selected categories use `bg-accent/50`, hover uses `bg-accent` for tree items - adapts per theme automatically.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `grep -c "gray-"` on all 14 files: all 0
- `npx tsc --noEmit`: passes with no errors
- Feed/timeline layout structure: unchanged
- Log parsing/filtering logic: unchanged
- Progress bar animations/transitions: unchanged
- Cron/schedule parsing logic: unchanged
- Category tree expand/collapse behavior: unchanged
- Dropdown positioning/z-index: unchanged
