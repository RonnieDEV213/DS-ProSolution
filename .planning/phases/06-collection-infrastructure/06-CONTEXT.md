# Phase 6: Collection Infrastructure - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish foundation for the collection pipeline: database schema for jobs/state, job framework with checkpointing, and budget controls. Admin can trigger collection runs from the web app with cost visibility and enforcement. This phase delivers infrastructure — Amazon and eBay API integration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Budget Controls
- Detailed cost breakdown before starting: show per-category estimates (e.g., "50 Amazon calls ($X) + ~200 eBay calls ($Y) = $Z total")
- Tiered budget enforcement: soft warning at 80% of cap, hard block at 100%
- Global admin setting for budget cap (not per-run override)
- Budget cap applies per individual run (not monthly or cumulative)

### Job Triggering
- Add collection UI to existing /admin/automation page (alongside other jobs)
- Full review dialog before starting: modal showing categories selected, estimated products, cost estimate, then confirm
- Multiple collections can run in parallel (no queue, no blocking)
- Optional custom name for runs (text field, auto-generated "Collection 2026-01-20 14:30" if blank)

### Progress Visibility
- Real-time live updates via WebSocket — data surfaces as it's collected
- **Progressive data availability** — scraped items usable immediately, don't wait for run completion
- Both views: summary at top (progress bar + current category + counts) + expandable live feed showing each product/seller as processed
- Timeline view for collection history showing runs over time with expandable details
- Status indicator badge in nav showing running collections (not toast notifications)

### Failure Handling
- Individual item failures: skip immediately (no retry) — keep moving fast
- API provider down/rate-limited: pause and wait, retry periodically until API recovers, then auto-resume
- Failed/skipped items: detailed log visible in run details (each item + reason)
- Server restart/crash recovery: auto-resume from checkpoint when server starts

### Claude's Discretion
- WebSocket vs polling implementation details
- Checkpoint granularity and storage format
- Exact retry timing for API recovery
- Progress feed truncation/pagination for very long runs

</decisions>

<specifics>
## Specific Ideas

- "I don't want to wait a couple of hours and then have usable data — I want to use the ones that have been processed already"
- In-house software with <1k users, so can optimize for rich real-time experience over scale

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-collection-infrastructure*
*Context gathered: 2026-01-20*
