---
status: diagnosed
trigger: "UAT gap #1: success checkmark readability, status column width cutoff, remove '(no refund)' text"
created: 2026-01-26T00:00:00Z
updated: 2026-01-26T00:00:00Z
---

## Current Focus

hypothesis: Three independent UI issues in bookkeeping table status rendering
test: Code inspection of record-row.tsx, records-table.tsx, api.ts, badge.tsx, globals.css
expecting: Identify root causes for each sub-issue
next_action: Report diagnosis

## Symptoms

expected: Success checkmark is clearly readable; status column text is not cut off; refund status does not show "(no refund)" text
actual: Checkmark has slight readability issue; status text gets cut off; "(No Return)" text appears in refund status
errors: none (visual/UX issues)
reproduction: View any bookkeeping table with records in various statuses
started: Phase 25 UAT

## Eliminated

(none - root causes identified on first pass)

## Evidence

- timestamp: 2026-01-26
  checked: record-row.tsx STATUS_ICONS definition (line 43-44)
  found: Check icon is w-3 h-3 (12x12px), rendered inside a Badge with variant="default"
  implication: Small icon inside a colored badge may lack contrast/size

- timestamp: 2026-01-26
  checked: badge.tsx variant "default" (line 12-13)
  found: default variant uses "bg-primary text-primary-foreground" - icon inherits text-primary-foreground
  implication: On dark themes, primary is a saturated color (blue/teal/purple); primary-foreground is near-white (oklch 0.98). The icon should be readable. On light theme (:root), primary is oklch(0.205 0 0) (near-black), primary-foreground is oklch(0.985 0 0) (near-white) -- high contrast. Issue may be icon SIZE (w-3 h-3 = 12px) rather than color contrast.

- timestamp: 2026-01-26
  checked: record-row.tsx status column container (line 459)
  found: Status column has class "w-40 shrink-0" (160px) in virtualized row
  implication: 160px may be too narrow for badge + icon + text like "Return Label" or "Refund (No Return)"

- timestamp: 2026-01-26
  checked: records-table.tsx status SelectTrigger (line 530)
  found: SelectTrigger uses "min-w-[160px]" but the TableHead (line 383) has no explicit width
  implication: In non-virtualized table, column auto-sizes but min-w may still be too narrow for longer status labels

- timestamp: 2026-01-26
  checked: api.ts STATUS_LABELS (lines 25-30)
  found: REFUND_NO_RETURN label is "Refund (No Return)"
  implication: This is the source of the "(No Return)" text the user wants removed

- timestamp: 2026-01-26
  checked: record-row.tsx STATUS_OPTIONS (line 38)
  found: Dropdown also has hardcoded label "Refund (No Return)"
  implication: Two sources of the text: STATUS_LABELS in api.ts (used for display) and STATUS_OPTIONS in record-row.tsx (used for dropdown)

- timestamp: 2026-01-26
  checked: records-table.tsx STATUS_OPTIONS (line 59)
  found: Also has hardcoded "Refund (No Return)" label
  implication: Three total locations with this label text

## Resolution

root_cause: See detailed report below
fix: Not applied (diagnosis only)
verification: N/A
files_changed: []
