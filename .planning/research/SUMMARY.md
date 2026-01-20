# Project Research Summary

**Project:** DS-ProSolution v2 SellerCollection
**Domain:** Amazon-to-eBay dropshipper discovery automation
**Researched:** 2026-01-20
**Confidence:** HIGH

## Executive Summary

SellerCollection is a narrowly scoped automation feature: scrape Amazon Best Sellers via third-party API, search matching products on eBay with dropshipper-indicator filters (Brand New, free shipping, 80-120% price markup), extract seller names, deduplicate against existing database, and export as JSON/CSV. This is the simplest architecture case from the project's scraping paradigm — purely public data via centralized APIs, no browser automation, no account risk.

The recommended approach uses **Oxylabs E-Commerce Scraper API** ($49/month Micro plan) for both Amazon and eBay scraping. This provides a single integration point, 100% success rate in independent testing, and 98,000 results/month — roughly 10x headroom for the estimated 5,000-10,000 requests/month baseline. The existing FastAPI backend handles orchestration; the existing Supabase/PostgreSQL database handles storage and deduplication. No new infrastructure is required.

Critical risks center on cost control and job reliability, not technical complexity. Unbounded API costs can silently accumulate ($20-50/run without caps), long-running jobs (90+ minutes for 10K products) can timeout without progress persistence, and seller name deduplication requires normalization to avoid inflated counts. All risks have straightforward mitigations that should be implemented in the foundation phase before any real collection runs.

## Key Findings

### Recommended Stack

Use **Oxylabs E-Commerce Scraper API** for both Amazon Best Sellers and eBay product search. Single vendor simplifies integration and billing. At the MVP volume (~10K requests/month), the $49/month Micro plan provides significant headroom. Free trial (2,000 results) allows validation before commitment.

**Core technologies:**
- **Oxylabs API**: Amazon Best Sellers + eBay search — best price/performance at our scale ($0.40-0.50/1K requests), 100% success rate, single integration
- **httpx**: Async HTTP client — already in use, no new dependencies
- **Existing FastAPI backend**: Orchestration + background workers — follows established patterns in `apps/api/src/app/background.py`
- **Existing Supabase/PostgreSQL**: Storage + deduplication — row-level security already configured

**What NOT to add:**
- Custom proxies or browser automation (unnecessary for public data)
- Rainforest + ScraperAPI separately (use single vendor unless quality insufficient)
- Real-time eBay search (batch processing is sufficient)

**Alternative path:** If Oxylabs data quality proves insufficient during trial, switch to Rainforest API for Amazon (higher accuracy, premium pricing) + ScraperAPI for eBay (structured JSON output).

### Expected Features

**Must have (table stakes):**
- Amazon Best Sellers scraping with category selection
- eBay search with filters (Brand New, free shipping, price markup range)
- Seller name extraction and deduplication
- Progress indication during collection
- Export: JSON, CSV, copy to clipboard
- Admin-only access (existing RBAC)

**Should have (competitive):**
- Scheduled monthly collection (cron job)
- Seller metadata capture (feedback score, item count)
- Collection history/past runs list

**Defer (v2.1+):**
- Multi-category batch processing
- Pause/resume for long collections
- Collection presets
- Profit margin calculator (explicitly anti-feature — output goes to third-party software)
- Seller quality scoring (reverse image search, hero detection — future milestone)

### Architecture Approach

SellerCollection follows the **Centralized paradigm** from EXISTING-ARCHITECTURE.md: all data is public, uses third-party APIs, runs entirely on FastAPI backend. No browser automation, no PC agents, no account risk. The pipeline is linear: Admin triggers -> Fetch Amazon Best Sellers -> For each product, search eBay with filters -> Extract seller names -> Deduplicate and store -> Export.

**Major components:**
1. **CollectionService** — Orchestrates pipeline, manages background worker state, coordinates AmazonService and EbayService
2. **AmazonApiService** — Oxylabs client for Best Sellers scraping, returns product list with ASINs/titles/prices
3. **EbayApiService** — Oxylabs client for eBay search, extracts seller names from results
4. **Collection Router** — REST endpoints: POST /start, POST /stop, GET /status, GET /sellers, GET /export
5. **Database tables** — `sellers` (deduped master list), `collection_runs` (job tracking), `collection_items` (audit trail)

### Critical Pitfalls

1. **Unbounded API Cost Explosion** — Display estimated cost before trigger, implement hard budget cap per run ($25 max), track cumulative monthly spend, alert at 50%/75%/90% of budget
2. **Long-Running Job Timeout** — Implement checkpointing every 100 products, store progress in `collection_runs`, enable resume from checkpoint on restart
3. **Amazon Parent ASIN Confusion** — Detect parent ASINs (no price, "Select options"), skip or extract child ASIN; validate price exists before eBay search
4. **eBay Zero Results Silent Failure** — Track three states: `sellers_found`, `no_sellers_exist`, `search_failed`; alert if zero-result rate exceeds baseline by >20%
5. **Seller Name Deduplication** — Normalize names (lowercase, strip special chars) before comparison; store both `display_name` and `normalized_name`

## Implications for Roadmap

Based on research, suggested 4-phase structure:

### Phase 1: Collection Infrastructure
**Rationale:** Foundation must exist before any API calls — database schema, job management, cost controls
**Delivers:** Database migrations, background job framework with progress tracking, budget controls
**Addresses:** Progress indication, admin-only access
**Avoids:** Unbounded API costs (Pitfall 1), job timeout without persistence (Pitfall 2), no visibility into job progress (Pitfall 10)

### Phase 2: Amazon Best Sellers Integration
**Rationale:** Input data source must work before eBay search can be built
**Delivers:** Oxylabs Amazon client, category selection UI, product list extraction
**Addresses:** Amazon Best Sellers scraping, category selection
**Avoids:** Parent ASIN confusion (Pitfall 3), category structure changes breaking scraper (Pitfall 6)

### Phase 3: eBay Seller Search
**Rationale:** Depends on Amazon data; search filters define dropshipper identification logic
**Delivers:** Oxylabs eBay client, filter implementation (Brand New, free shipping, price range), seller extraction
**Addresses:** eBay search with filters, seller name extraction
**Avoids:** Zero results silent failure (Pitfall 4), geographic restrictions hiding sellers (Pitfall 9)

### Phase 4: Storage, Export, and UI
**Rationale:** Output layer depends on working pipeline; UI can be built in parallel with Phase 3
**Delivers:** Deduplication logic, export endpoints (JSON/CSV/clipboard), admin UI (trigger, progress, results table)
**Addresses:** Deduplication, export formats, collection history
**Avoids:** Seller name deduplication inconsistency (Pitfall 5), duplicate products across categories (Pitfall 11)

### Phase Ordering Rationale

- **Infrastructure first:** Budget controls and progress tracking must exist before API integration to prevent cost overruns and lost work
- **Amazon before eBay:** Linear dependency — cannot search eBay without Amazon product data
- **Storage/UI last:** Can be developed in parallel with Phase 3; depends on working data pipeline
- **Scheduling deferred:** Optional feature, can be added after core pipeline works

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** Amazon category structure may have changed; validate category list discovery during implementation
- **Phase 3:** eBay search filter parameters need API documentation review; may need to adjust ScraperAPI fallback if Oxylabs eBay parsing insufficient

Phases with standard patterns (skip research-phase):
- **Phase 1:** Standard FastAPI background jobs, PostgreSQL migrations — well-documented patterns already in codebase
- **Phase 4:** Standard CRUD UI, file export — established patterns in apps/web

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Oxylabs pricing/features verified from official docs; multiple comparison sources confirm recommendation |
| Features | HIGH | Features derived from explicit PROJECT.md requirements; anti-features explicitly marked as out-of-scope |
| Architecture | HIGH | Builds directly on existing codebase patterns; follows established EXISTING-ARCHITECTURE.md paradigm |
| Pitfalls | HIGH | Verified against official API documentation and multiple scraping service providers |

**Overall confidence:** HIGH

### Gaps to Address

- **Oxylabs trial validation:** Must test with real Amazon Best Sellers and eBay search before committing to Micro plan
- **eBay seller name field availability:** Verify Oxylabs eBay response includes seller_name in parsed output; fallback to raw HTML parsing if needed
- **Category list completeness:** Amazon may have more/fewer than 40 Best Sellers categories; validate during Phase 2
- **Price markup calculation edge cases:** Amazon price may be unavailable or in different currencies; define handling rules

## Sources

### Primary (HIGH confidence)
- [Oxylabs Web Scraper API Pricing](https://oxylabs.io/products/scraper-api/web/pricing) — tier details, rate limits, pricing structure
- [Oxylabs Amazon Scraper](https://oxylabs.io/products/scraper-api/ecommerce/amazon) — Amazon-specific features and endpoints
- [Oxylabs eBay Scraper](https://oxylabs.io/products/scraper-api/ecommerce/ebay) — eBay-specific features and endpoints
- [Rainforest API Bestsellers](https://docs.trajectdata.com/rainforestapi/product-data-api/parameters/bestsellers) — dedicated endpoint documentation

### Secondary (MEDIUM confidence)
- [Scrapingdog: Best Amazon Scraping APIs 2026](https://www.scrapingdog.com/blog/best-amazon-scraping-apis/) — independent testing, success rate comparison
- [Bright Data: Top 10 Amazon Scrapers 2026](https://brightdata.com/blog/web-data/best-amazon-scrapers) — feature comparison across providers
- [ZIK Analytics Features](https://www.zikanalytics.com/ebay/competitor-research) — competitive landscape reference

### Tertiary (LOW confidence)
- Pricing estimates for high-volume scenarios — may vary based on negotiated contracts
- Category count estimates — based on manual observation, subject to Amazon changes

---
*Research completed: 2026-01-20*
*Ready for roadmap: yes*
