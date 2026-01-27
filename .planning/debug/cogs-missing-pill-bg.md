---
status: resolved
trigger: "Monospace is correct but the subtle pill background doesnt exist for the COGs"
created: 2026-01-26T00:00:00Z
updated: 2026-01-26T00:00:00Z
---

## Current Focus

hypothesis: COGS cell span is missing `px-1.5 py-0.5 rounded bg-primary/10` classes that Earnings and Profit have
test: Compare class strings on COGS span vs Earnings/Profit spans
expecting: COGS span will lack the pill classes
next_action: Report root cause

## Symptoms

expected: COGS monetary values in the main table row should display with monospace font AND a subtle pill background (bg-primary/10 rounded), matching Earnings and Profit columns
actual: COGS has monospace font but no pill background styling
errors: None (visual styling issue only)
reproduction: View any bookkeeping record row - compare Earnings, COGS, and Profit columns
started: Since implementation

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-01-26T00:00:00Z
  checked: records-table.tsx Earnings cell (line 480)
  found: `<span className="text-foreground font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">`
  implication: Earnings has full pill styling

- timestamp: 2026-01-26T00:00:00Z
  checked: records-table.tsx Profit cell (line 501)
  found: `<span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">`
  implication: Profit has full pill styling

- timestamp: 2026-01-26T00:00:00Z
  checked: records-table.tsx COGS cell (line 488)
  found: `<span className="font-mono text-sm">`
  implication: COGS is MISSING `px-1.5 py-0.5 rounded bg-primary/10`

- timestamp: 2026-01-26T00:00:00Z
  checked: record-row.tsx (virtualized) Earnings cell (line 428)
  found: `<span className="text-foreground font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">`
  implication: Virtualized Earnings has full pill styling

- timestamp: 2026-01-26T00:00:00Z
  checked: record-row.tsx (virtualized) Profit cell (line 448)
  found: `<span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10">`
  implication: Virtualized Profit has full pill styling

- timestamp: 2026-01-26T00:00:00Z
  checked: record-row.tsx (virtualized) COGS cell (line 435)
  found: `<span className="font-mono text-sm">`
  implication: Virtualized COGS is MISSING `px-1.5 py-0.5 rounded bg-primary/10`

## Resolution

root_cause: The COGS `<span>` in the main table row is missing the pill background classes (`px-1.5 py-0.5 rounded bg-primary/10`) that Earnings and Profit both have. This occurs in both records-table.tsx and record-row.tsx.
fix: Add `px-1.5 py-0.5 rounded bg-primary/10` to the COGS span className in both files.
verification: pending
files_changed:
  - apps/web/src/components/bookkeeping/records-table.tsx (line 488)
  - apps/web/src/components/bookkeeping/record-row.tsx (line 435)
