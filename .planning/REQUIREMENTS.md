# Requirements: DS-ProSolution v2 SellerCollection

**Defined:** 2026-01-20
**Core Value:** Automate the discovery and collection of Amazon-to-eBay dropshippers at scale

## v2 Requirements

Requirements for the SellerCollection milestone. Each maps to roadmap phases.

### Amazon Best Sellers

- [ ] **AMZN-01**: Scrape product titles and prices from Amazon Best Sellers via third-party API
- [ ] **AMZN-02**: Display list of Amazon categories with checkboxes for selection
- [ ] **AMZN-03**: "Select All" preset to check all categories
- [ ] **AMZN-04**: "Top 10" preset to select highest-volume categories
- [ ] **AMZN-05**: Save custom category selection as named preset

### eBay Search

- [ ] **EBAY-01**: Search eBay with Amazon product titles via third-party API
- [ ] **EBAY-02**: Apply filter: Condition = Brand New
- [ ] **EBAY-03**: Apply filter: Free shipping only
- [ ] **EBAY-04**: Apply filter: Price 80-120% of Amazon price
- [ ] **EBAY-05**: Apply filter: US sellers only
- [ ] **EBAY-06**: Extract seller names from search results

### Collection Management

- [ ] **COLL-01**: "Collect Sellers" button to trigger collection
- [x] **COLL-02**: Progress indicator showing current product / total products
- [x] **COLL-03**: Stop/cancel button to abort running collection
- [x] **COLL-04**: Collection history list showing past runs with timestamps
- [x] **COLL-05**: Scheduled monthly collection (configurable cron)
- ~~**COLL-06**: Display estimated API cost before starting collection~~ (Removed - flat-rate subscription)
- ~~**COLL-07**: Hard budget cap per collection run (configurable, default $25)~~ (Removed - flat-rate subscription)

### Storage & Export

- [x] **STOR-01**: Deduplicate sellers against existing database (normalized comparison)
- [x] **STOR-02**: Store seller with collection metadata (discovered_at, from_product)
- [x] **STOR-03**: Export as JSON
- [x] **STOR-04**: Export as CSV
- [x] **STOR-05**: Copy sellers to clipboard

## v2.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Seller Filtering Pipeline

- **FILT-01**: Reverse image search to verify products sourced from Amazon
- **FILT-02**: Hero image metadata detection (phone vs professional)
- **FILT-03**: Win rate analysis (sellers with high sell-through)
- **FILT-04**: Seller quality scoring based on multiple signals

### Advanced Features

- **ADV-01**: Multi-marketplace support (UK, DE, etc.)
- **ADV-02**: Pause/resume for long-running collections
- **ADV-03**: Collection presets (saved filter configurations)
- **ADV-04**: Seller metadata capture (feedback score, item count)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Profit calculator | Output goes to third-party software that handles this |
| Listing automation | Separate project, not part of seller discovery |
| Real-time monitoring | Brute force monthly is sufficient per cost/work ratio |
| Custom scrapers/proxies | Buy from Oxylabs, don't build |
| Authenticated scraping | All data is public, no account risk |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AMZN-01 | Phase 7 | Complete |
| AMZN-02 | Phase 7 | Complete |
| AMZN-03 | Phase 7 | Complete |
| AMZN-04 | Phase 7 | Omitted |
| AMZN-05 | Phase 7 | Complete |
| EBAY-01 | Phase 8 | Complete |
| EBAY-02 | Phase 8 | Complete |
| EBAY-03 | Phase 8 | Complete |
| EBAY-04 | Phase 8 | Complete |
| EBAY-05 | Phase 8 | Complete |
| EBAY-06 | Phase 8 | Complete |
| COLL-01 | Phase 6 | Complete |
| COLL-02 | Phase 9 | Complete |
| COLL-03 | Phase 9 | Complete |
| COLL-04 | Phase 9 | Complete |
| COLL-05 | Phase 9 | Complete |
| COLL-06 | Phase 6 | Removed |
| COLL-07 | Phase 6 | Removed |
| STOR-01 | Phase 9 | Complete |
| STOR-02 | Phase 9 | Complete |
| STOR-03 | Phase 9 | Complete |
| STOR-04 | Phase 9 | Complete |
| STOR-05 | Phase 9 | Complete |

**Coverage:**
- v2 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-21 after Phase 8 completion*
