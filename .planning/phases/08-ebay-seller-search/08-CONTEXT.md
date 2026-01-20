# Phase 8: eBay Seller Search - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

For each Amazon product collected in Phase 7, search eBay with dropshipper filters (Brand New, free shipping, 80-120% of Amazon price, US sellers only) and extract seller names. This phase does NOT verify if eBay listings match Amazon products — it finds eBay sellers in the same product space who exhibit dropshipper characteristics.

</domain>

<decisions>
## Implementation Decisions

### Search Behavior
- Fetch **first 2-3 pages** of results per product (50-150 results) for thorough coverage
- Use **full Amazon product title** as eBay search query (no truncation or keyword extraction)
- If search returns **zero results after filters** — just skip, no special handling (expected for some products)
- No matching/verification between Amazon and eBay listings — just filter by dropshipper criteria

### Rate Limiting & Throttling
- **Same as Amazon phase** — auto-pause on rate limit (429), display throttle status in UI
- Request delay and concurrency at **Claude's discretion** based on Oxylabs recommendations
- **No cost tracking** — cost tracking was removed from the project

### Result Handling
- Extract: **seller name + seller ID/URL + feedback score** from each eBay result
- **Do NOT store** which Amazon product led to finding each seller — only the final seller list matters
- **Dedupe immediately** during collection — check against existing sellers before adding, skip duplicates
- **No hit count tracking** — only care if seller appeared at least once

### Error Recovery
- **Same as Amazon phase:**
  - Retry failed search 3x, then skip
  - 5 consecutive failures auto-pauses collection
  - Checkpoint-based resume from where it stopped

### Claude's Discretion
- Request delay between eBay searches (0ms to 500ms range)
- Sequential vs parallel batch execution
- Exact retry timing and backoff strategy

</decisions>

<specifics>
## Specific Ideas

- Collection pipeline: Amazon products (Phase 7) → eBay search per product → extract sellers → dedupe → store
- Use same Oxylabs E-Commerce Scraper API for eBay as used for Amazon
- Service interface pattern applies here too — `EbayScraperService` alongside `AmazonScraperService`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-ebay-seller-search*
*Context gathered: 2026-01-20*
