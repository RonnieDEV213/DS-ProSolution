# Phase 12: Live Activity Feed & Concurrency - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers three capabilities:
1. Fix "sellers at this point" snapshot counts for history entries (collection runs and manual edits)
2. Add live activity feed to progress detail modal (creative visualization, not terminal text dump)
3. Implement parallel collection with optimal concurrency (both Amazon and eBay phases)

Activity text moves from main progress bar to detail modal. Concurrency slider removed — system uses optimal concurrency automatically.

</domain>

<decisions>
## Implementation Decisions

### Live Activity Feed
- **Visual style:** Creative, application-consistent design — NOT terminal/console aesthetic
- Use same data as backend terminal prints but present it visually (cards, timeline, structured entries)
- Keep theme colors consistent with application design language
- **Entry content:** Full context per entry — category, product name, action, seller found, price range, parameters, timestamp
- **Entry order:** Newest at top (prepend), scroll down for older entries
- **Buffer limit:** Fixed buffer (50-100 entries), older entries drop off for performance
- **Worker visibility:** Show worker ID per entry (Worker 1, Worker 2, etc.)

### Concurrency Behavior
- **Remove concurrency slider** — system uses optimal concurrency automatically
- Claude determines safe maximum based on Oxylabs Micro plan limits (likely 5-10 concurrent)
- **Both phases parallel:** Amazon product fetches AND eBay searches both run with multiple workers
- **Failure handling:** Apply existing 5-consecutive-failure pause system to parallel workers (shared counter)
- **Work distribution:** Work-stealing queue — workers grab next available item as they finish
- **Race condition prevention:** Atomic task claiming to prevent duplicate processing
- **Resume behavior:** Claude's discretion on whether to use original or current concurrency

### History Seller Counts
- **"Sellers at this point" meaning:** Snapshot of total sellers in database when that event completed
- **Storage approach:** Claude's discretion (store with record vs compute from logs, based on reliability)
- **Manual edits:** Also show seller count snapshot (consistent with collection runs)
- **Performance:** Claude's discretion on caching vs on-demand computation

### Progress Bar Changes
- **Main bar content:** Claude's discretion (clean percentage vs counts)
- **Click behavior:** Clicking main progress bar opens detail modal with activity feed
- **Cancel button:** Available both on main bar AND in modal
- **Completion:** Auto-dismiss after run completes (brief success indication)

### Claude's Discretion
- Live activity feed visual component design (cards, timeline, structured entries)
- Optimal concurrency level for Oxylabs Micro plan
- Work-stealing queue implementation details
- Progress display content on main bar
- Whether to cache seller snapshot counts or compute on demand
- Progress percentage calculation (total only vs per-worker breakdown)

</decisions>

<specifics>
## Specific Ideas

- "Don't just display text really fast like a terminal — figure out a creative way of creating a live activity feed view"
- Same rich data as terminal output (price range, parameters, new sellers, product being searched) but presented visually
- Worker IDs visible so user can see parallel processing in action
- Concurrency should be the maximum that's reliable, not user-configurable

</specifics>

<deferred>
## Deferred Ideas

- **Remove duplicate preset areas** — User noted there are two places where presets can be created/selected, wants duplicates removed. This is UI cleanup outside Phase 12's stated scope.

</deferred>

---

*Phase: 12-live-activity-feed-concurrency*
*Context gathered: 2026-01-22*
