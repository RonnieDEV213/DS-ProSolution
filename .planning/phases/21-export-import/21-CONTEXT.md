# Phase 21: Export/Import - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to export large datasets (millions of records) without browser crashes and import data with validation preview and rollback capability. Supports CSV, JSON, and Excel formats. PDF export is out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Export Formats & Columns
- Essential formats: CSV, JSON, Excel (PDF deferred to future phase)
- Include computed fields (profit, COGS, earnings) — export shows same values user sees in UI
- Excel exports get basic formatting: header row frozen, currency columns formatted

### Progress & Background Jobs
- Hybrid execution model: small exports run in browser, large exports run on server
- Notifications: in-app toast when active, browser notification when tab is backgrounded
- Both notification types include download link when export completes

### Import Validation UX
- All-or-nothing import: all rows must be valid before import proceeds
- Import supports same formats as export: CSV, JSON, Excel
- Smart column mapping: auto-suggest mapping based on header similarity, user can manually adjust

### Rollback Behavior
- 24-hour rollback window as specified in requirements
- When rolling back: warn user about records modified since import, require confirmation before deletion
- Show which specific records were edited so user can make informed decision

### Claude's Discretion
- Column selection UI design (checkbox list vs preset groups)
- Threshold for "large export" requiring server-side processing
- Failure recovery strategy for server-side exports (retry vs resume)
- Import validation error display pattern
- Location of import history/rollback UI
- Soft vs hard delete for rollback (likely soft delete per existing patterns)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that match existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

- PDF export format — future phase
- Scheduled/automated exports — separate feature
- Import from external APIs (eBay direct sync) — out of scope

</deferred>

---

*Phase: 21-export-import*
*Context gathered: 2026-01-24*
