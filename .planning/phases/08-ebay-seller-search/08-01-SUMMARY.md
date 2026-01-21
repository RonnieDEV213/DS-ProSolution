---
phase: 08-ebay-seller-search
plan: 01
subsystem: api
tags: [oxylabs, ebay, scraper, httpx, dropshipper]

# Dependency graph
requires:
  - phase: 07-amazon-bestsellers
    provides: Oxylabs scraper pattern, AmazonScraperService interface
provides:
  - EbayScraperService abstract interface
  - OxylabsEbayScraper implementation
  - Dropshipper-filtered eBay search (5 filters)
  - Seller info parsing with fallback formats
affects: [08-02, ebay-search-endpoint, collection-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EbayScraperService interface mirrors AmazonScraperService pattern"
    - "URL-embedded filters instead of post-fetch filtering"
    - "Oxylabs custom parsing_instructions for HTML extraction"
    - "Seller deduplication within page using seen_usernames set"

key-files:
  created:
    - apps/api/src/app/services/scrapers/ebay_base.py
    - apps/api/src/app/services/scrapers/oxylabs_ebay.py
  modified:
    - apps/api/src/app/services/scrapers/__init__.py

key-decisions:
  - "Use ebay source with pre-filtered URL instead of ebay_search + post-filter"
  - "All 5 dropshipper filters embedded in URL construction"
  - "Seller info regex with three fallback patterns (full, partial, minimal)"
  - "Rate limit returns error field (consistent with Amazon scraper)"

patterns-established:
  - "URL filter embedding: Encode filters in URL params for server-side filtering"
  - "Seller parsing: Three-tier regex fallback for varying eBay formats"

# Metrics
duration: 4min
completed: 2026-01-21
---

# Phase 8 Plan 1: eBay Scraper Service Summary

**EbayScraperService interface with OxylabsEbayScraper implementation - URL-embedded dropshipper filters (Brand New, free shipping, US only, 80-120% price range) and robust seller info parsing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-21T00:00:00Z
- **Completed:** 2026-01-21T00:04:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- EbayScraperService abstract interface following Amazon pattern
- OxylabsEbayScraper with all 5 dropshipper filters in URL
- Seller info parsing handles full, partial, and minimal formats
- Rate limiting returns error field (not exception) for consistent handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create eBay scraper base interface** - `a253776` (feat)
2. **Task 2: Create Oxylabs eBay scraper implementation** - `f45ae45` (feat)
3. **Task 3: Update module exports** - `20fea69` (feat)

## Files Created/Modified
- `apps/api/src/app/services/scrapers/ebay_base.py` - EbaySeller, EbaySearchResult dataclasses and EbayScraperService abstract class
- `apps/api/src/app/services/scrapers/oxylabs_ebay.py` - OxylabsEbayScraper implementation with URL building and seller parsing
- `apps/api/src/app/services/scrapers/__init__.py` - Exports for all Amazon and eBay scraper classes

## Decisions Made
- **URL-embedded filters:** All 5 dropshipper filters (EBAY-02 through EBAY-05) are embedded directly in the eBay search URL rather than post-filtering. This means Oxylabs fetches pre-filtered results, reducing data transfer and processing.
- **Three-tier seller parsing:** Regex handles "username (count) percent%", "username (count)", and plain "username" formats with graceful fallback.
- **Error field for rate limits:** Consistent with Amazon scraper, 429 responses return `error="rate_limited"` instead of raising exceptions, allowing callers to handle rate limits gracefully.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - uses existing OXYLABS_USERNAME and OXYLABS_PASSWORD environment variables from Phase 7.

## Next Phase Readiness
- EbayScraperService ready for integration with CollectionService
- OxylabsEbayScraper can be instantiated and called via search_sellers()
- All dropshipper filters verified in URL construction tests
- Next plan (08-02) can build search endpoint using this scraper

---
*Phase: 08-ebay-seller-search*
*Completed: 2026-01-21*
