# SellerCollection Pitfalls

**Domain:** Amazon Best Sellers scraping + eBay seller collection workflow
**Researched:** 2026-01-20
**Confidence:** HIGH (verified against official API documentation and scraping service providers)

**Note:** Bot detection and account suspension risks are covered in [EXISTING-RISKS.md](./EXISTING-RISKS.md). This document focuses on SellerCollection-specific pitfalls: API costs, data quality, edge cases, and workflow reliability.

---

## Critical Pitfalls

Mistakes that cause budget overruns, data corruption, or workflow failure.

### Pitfall 1: Unbounded API Cost Explosion

**What goes wrong:**
Admin triggers SellerCollection expecting ~1,000 products. Amazon has 40+ Best Seller categories, each with up to 100 products. For each product, 3-5 eBay searches are triggered. Total: 40 x 100 x 5 = 20,000 API calls. At $2.45/1K (ScraperAPI) or ~$1/1K (Rainforest), a single run costs $20-50. Monthly runs without monitoring quietly burn $600/year.

**Why it happens:**
Developers estimate based on a few test categories. They don't account for category count growth, subcategories, or eBay search multipliers. No cost caps are implemented because "it's just scraping."

**Warning signs:**
- No API budget tracking in admin dashboard
- No cost-per-run estimates shown before triggering
- No alerts when approaching budget thresholds
- Monthly billing surprises from API providers

**Prevention:**
- Display estimated cost before Admin confirms trigger
- Implement hard budget cap per run (e.g., $25 max)
- Track cumulative monthly spend in database
- Alert at 50%, 75%, 90% of monthly budget
- Allow category selection to limit scope

**Phase to address:** Phase 1 (Data Collection Infrastructure) - budget controls must exist before first real run

---

### Pitfall 2: Long-Running Job Timeout Without Progress Persistence

**What goes wrong:**
SellerCollection job processes 10,000 products. At 500ms per API call (rate-limited), job takes ~90 minutes. Server timeout at 60 minutes kills job. No progress saved. Admin restarts, job starts from beginning, doubles API costs, still fails.

**Why it happens:**
Developers test with 50 products (25 seconds). Production has 200x more data. HTTP request timeouts, worker timeouts, and database connection limits all converge to kill long jobs.

**Warning signs:**
- Job starts but never completes
- No progress indicator in admin UI
- API costs double without results
- Database shows partial data from interrupted runs
- "Connection reset" or timeout errors in logs

**Prevention:**
- Implement checkpointing: save progress every 100 products
- Use background job queue (Celery, RQ) not HTTP request
- Store job state: `{total: 10000, completed: 3500, last_category: "Electronics"}`
- On restart, resume from last checkpoint
- Set realistic timeout (2-4 hours) with progress heartbeat

**Phase to address:** Phase 1 (Data Collection Infrastructure) - job architecture must support long runs

---

### Pitfall 3: Amazon Parent ASIN Confusion

**What goes wrong:**
Best Sellers list includes parent ASINs (non-buyable umbrella products). Scraper extracts parent ASIN, searches eBay, finds zero results. Alternatively, scraper follows parent to random child variation, gets inconsistent product data. Seller collection becomes random.

**Why it happens:**
Amazon's parent-child ASIN structure is invisible to naive scrapers. A "product" in Best Sellers might be a family of 50 color/size variations. Only child ASINs are sellable; parent ASINs are catalog structures.

**Warning signs:**
- eBay searches returning zero results for "valid" Amazon products
- Same product appearing multiple times with different attributes
- Price data showing as null or "Select options"
- Inconsistent product titles across runs

**Prevention:**
- Detect parent ASINs (no price, "Select options" present)
- For parent ASINs, either: skip entirely, or extract first/popular child ASIN
- Document strategy: "We collect sellers for best-selling child variations only"
- Validate extracted data has price before proceeding to eBay search

**Phase to address:** Phase 2 (Amazon Best Sellers Collection) - ASIN handling logic is core to data quality

---

### Pitfall 4: eBay Search Returns Zero Sellers (Silent Failure)

**What goes wrong:**
Amazon product "XYZ Widget Pro" searched on eBay returns zero results. Could be: product not sold on eBay, search terms too specific, geographic restrictions, or API error. System logs "0 sellers found" and moves on. After full run, 40% of products yielded zero sellers - but nobody knows if that's expected or a bug.

**Why it happens:**
Zero results is a valid outcome (product genuinely not on eBay). But it's also the outcome of search failures, rate limiting, and malformed queries. Without distinguishing these, data quality degrades silently.

**Warning signs:**
- High percentage (>30%) of products with zero eBay results
- Inconsistent zero-result rates between runs
- No distinction between "searched, nothing found" vs "search failed"
- API error responses logged but not surfaced

**Prevention:**
- Track three states: `sellers_found`, `no_sellers_exist`, `search_failed`
- Log API response status separately from result count
- Alert if zero-result rate exceeds historical baseline by >20%
- Implement search term fallback: full title -> shortened title -> brand + keywords
- Store raw API response for debugging failed searches

**Phase to address:** Phase 3 (eBay Seller Search) - error handling strategy before scaling

---

### Pitfall 5: Seller Name Deduplication Inconsistency

**What goes wrong:**
Seller "TechGadgets_Store" found in run 1. In run 2, same seller appears as "techgadgets_store" (lowercase) or "TechGadgets Store" (underscore removed). System inserts as new seller. Database accumulates duplicates. Seller count inflated, downstream analysis corrupted.

**Why it happens:**
eBay seller names have display variations. API might return different casing or formatting based on context. Simple string equality misses these duplicates.

**Warning signs:**
- Seller count growing faster than expected
- Similar-looking seller names in database
- Same seller appearing in "new sellers" list repeatedly
- Downstream reports showing inflated unique seller counts

**Prevention:**
- Normalize seller names before storage: lowercase, strip special chars, trim whitespace
- Store both `display_name` (original) and `normalized_name` (for dedup)
- Deduplicate on normalized_name, not display_name
- Consider fuzzy matching for near-duplicates (Levenshtein distance < 2)
- Log dedup decisions for audit trail

**Phase to address:** Phase 4 (Data Storage & Deduplication) - normalization rules before first storage

---

## Moderate Pitfalls

Mistakes that cause delays, tech debt, or degraded user experience.

### Pitfall 6: Category Structure Changes Breaking Scraper

**What goes wrong:**
Amazon reorganizes Best Sellers categories. "Cell Phones & Accessories" splits into "Smartphones" and "Phone Accessories". Hardcoded category list now misses half the products. Alternatively, category URLs change, scraper returns 404s.

**Why it happens:**
Amazon updates Best Sellers structure periodically. Scrapers hardcode category paths assuming stability. No monitoring detects when categories change.

**Warning signs:**
- Sudden drop in products collected (categories missing)
- 404 errors in logs for category URLs
- New categories appearing in Amazon UI but not in results
- Manual comparison shows missing categories

**Prevention:**
- Dynamically discover categories from Best Sellers main page
- Don't hardcode category URLs; scrape them each run
- Alert if category count changes >10% from last run
- Store category metadata (name, URL, product count) for comparison
- Fallback to cached category list if discovery fails

**Phase to address:** Phase 2 (Amazon Best Sellers Collection) - dynamic discovery vs hardcoded paths

---

### Pitfall 7: Rate Limit Exhaustion Mid-Job

**What goes wrong:**
Third-party API (Rainforest, ScraperAPI) has daily rate limits. Job starts, processes 60% of products, hits rate limit. Remaining 40% fails. Partial data stored. Next day, job restarts from beginning (no checkpoint), re-processes same 60%, hits limit again at same point.

**Why it happens:**
Rate limits are documented but not enforced in code. Developers assume "we won't hit the limit" without calculating actual needs.

**Warning signs:**
- Consistent failure at same percentage of job completion
- HTTP 429 errors in logs
- API provider dashboard showing limit reached
- Jobs completing but with less data than expected

**Prevention:**
- Calculate required API calls before job start
- Compare to remaining daily quota
- If insufficient quota: queue job for next day, or split across days
- Implement exponential backoff on 429 errors
- Track API usage in database, not just provider dashboard

**Phase to address:** Phase 1 (Data Collection Infrastructure) - quota awareness before scaling

---

### Pitfall 8: Stale Best Sellers Data (Hourly Update Mismatch)

**What goes wrong:**
Amazon Best Sellers updates hourly. Job takes 90 minutes to complete. Products at start of job reflect 9 AM rankings; products at end reflect 10:30 AM rankings. Data is internally inconsistent. Worse: job runs at 11:55 PM, rankings shift at midnight, introducing discontinuities.

**Why it happens:**
Developers assume Best Sellers is static during collection. It isn't - Amazon updates rankings every hour based on recent sales.

**Warning signs:**
- Same product appearing with different rankings in same run
- Analytics showing "rank changed during collection" patterns
- Products disappearing from list mid-collection
- Inconsistent category rankings within single dataset

**Prevention:**
- Document limitation: "Rankings reflect point-in-time, not atomic snapshot"
- Consider collection window: finish within 1 hour to minimize drift
- For critical accuracy: collect only top 20 per category (faster)
- Store collection timestamp per record for context
- Accept and document that hourly drift is inherent limitation

**Phase to address:** Phase 2 (Amazon Best Sellers Collection) - set expectations in documentation

---

### Pitfall 9: eBay Geographic Restrictions Hiding Sellers

**What goes wrong:**
eBay search API uses IP-based geographic restrictions. Scraper runs from US datacenter, sees US sellers. UK sellers selling same product not returned. Collected seller list is regionally biased without anyone realizing.

**Why it happens:**
eBay shows different results based on location/marketplace. API might default to US marketplace. Developers test from one location, assume results are global.

**Warning signs:**
- Seller locations heavily skewed to one country
- Known international sellers not appearing in results
- Results differ between API and manual eBay.com search
- Proxy location changes yield different seller sets

**Prevention:**
- Explicitly specify marketplace in API calls (ebay.com, ebay.co.uk)
- Document target marketplace: "SellerCollection targets US eBay marketplace"
- If multi-market needed: separate runs per marketplace
- Use residential proxies from target region if API allows
- Compare sample results with manual search to validate

**Phase to address:** Phase 3 (eBay Seller Search) - marketplace specification in API calls

---

### Pitfall 10: No Visibility Into Job Progress

**What goes wrong:**
Admin clicks "Start Collection". Button goes to loading state. 90 minutes later, still loading. Is it working? Failed? Stuck? Admin refreshes page, loses context. Clicks button again, now two jobs running in parallel, doubling API costs.

**Why it happens:**
Background jobs are fire-and-forget. No status endpoint exists. UI doesn't poll for progress. Admin has no visibility into long-running operations.

**Warning signs:**
- Admin refreshing page repeatedly during collection
- Multiple parallel jobs discovered in logs
- Support tickets: "Is the collection running?"
- No way to cancel a stuck job

**Prevention:**
- Job status endpoint: `GET /api/collection/status`
- Response: `{status: "running", progress: 3500, total: 10000, started_at: "..."}`
- UI polls every 30 seconds, shows progress bar
- Cancel button to abort job
- Prevent starting new job while one is running
- Email/notification on completion or failure

**Phase to address:** Phase 1 (Data Collection Infrastructure) - observability before scaling

---

## Minor Pitfalls

Annoyances that should be addressed but won't block launch.

### Pitfall 11: Duplicate Products Across Categories

**What goes wrong:**
Product "Echo Dot" appears in both "Electronics" and "Smart Home" Best Sellers. System processes it twice, searches eBay twice, stores duplicate seller associations. API cost wasted on redundant searches.

**Prevention:**
- Track processed ASINs within run
- Skip duplicate ASINs across categories
- Deduplicate before eBay search phase

---

### Pitfall 12: Unicode/Special Characters in Seller Names

**What goes wrong:**
Seller name contains emoji, Chinese characters, or invisible Unicode. Database stores correctly but comparison/search breaks. UI displays garbled text.

**Prevention:**
- Normalize to NFD/NFC Unicode form
- Strip zero-width characters
- Validate encoding on insert
- Test with international seller names

---

### Pitfall 13: API Response Format Changes

**What goes wrong:**
Third-party API updates response schema. Field `seller_name` renamed to `sellerName`. Parser returns null, silent data loss.

**Prevention:**
- Validate expected fields exist in response
- Alert on unexpected null values
- Version-pin API client libraries
- Monitor API provider changelogs

---

## Edge Cases to Handle

Specific scenarios that need explicit handling logic.

| Scenario | Expected Behavior | Implementation |
|----------|-------------------|----------------|
| eBay seller has no feedback | Include seller, mark as unverified | Store `feedback_score: null`, flag for review |
| Amazon product has no brand | Use "Unknown Brand" for eBay search | Fallback search term: category + product type |
| eBay search times out | Retry 3x with backoff, then mark failed | Store `search_status: "timeout"`, retry in next run |
| Same seller, multiple eBay accounts | Treat as separate sellers | No fuzzy matching on seller names (too risky) |
| Best Sellers category empty | Log warning, continue to next category | Don't fail entire job for empty category |
| API returns HTML instead of JSON | Likely rate-limited or blocked | Parse error, implement backoff, alert |
| Product delisted mid-collection | Skip gracefully | 404/410 response = mark as unavailable, continue |
| eBay returns 10,000 results | Cap at first 100 sellers per product | Diminishing returns beyond top sellers |

---

## Cost Estimation Reference

Planning guidance for budget allocation.

| Component | Cost per Unit | Units per Run | Est. Cost per Run |
|-----------|---------------|---------------|-------------------|
| Amazon Best Sellers scrape | $0.50-2.45/1K | ~4,000 products | $2-10 |
| eBay search per product | $0.50-2.45/1K | ~4,000 searches | $2-10 |
| Total (conservative) | - | - | $5-25 |
| Monthly (4 runs) | - | - | $20-100 |

**Budget safeguards to implement:**
- Pre-run cost estimate based on category count
- Hard cap: abort if estimated cost exceeds $30
- Monthly cap: $150 with alerts at $75, $100, $125
- Cost tracking per category for optimization

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Job Triggering:** Has progress tracking? Can be cancelled? Prevents duplicate runs?
- [ ] **Amazon Scraping:** Handles parent ASINs? Dynamic category discovery? Timeout handling?
- [ ] **eBay Search:** Marketplace specified? Error vs. no-results distinguished? Fallback search terms?
- [ ] **Deduplication:** Normalized comparison? Handles case differences? Logs decisions?
- [ ] **Cost Control:** Pre-run estimate? Budget caps? Monthly tracking? Alerts configured?
- [ ] **Observability:** Progress visible to admin? Failure notifications? Logs searchable?
- [ ] **Resumability:** Checkpoints saved? Can resume after failure? Doesn't re-process completed items?

---

## Pitfall-to-Phase Mapping

| Pitfall | Severity | Prevention Phase | Verification |
|---------|----------|------------------|--------------|
| Unbounded API costs | Critical | Phase 1 | Budget cap blocks run if exceeded |
| Job timeout without progress | Critical | Phase 1 | Job completes 10K products successfully |
| Parent ASIN confusion | Critical | Phase 2 | No null prices in collected products |
| Zero sellers silent failure | Critical | Phase 3 | Distinct `no_results` vs `error` states |
| Seller name deduplication | Critical | Phase 4 | Same seller doesn't appear twice |
| Category structure changes | Moderate | Phase 2 | Categories dynamically discovered |
| Rate limit exhaustion | Moderate | Phase 1 | Job respects quota, queues remainder |
| Stale Best Sellers data | Moderate | Phase 2 | Documented in user-facing materials |
| Geographic restrictions | Moderate | Phase 3 | Marketplace param in all API calls |
| No job progress visibility | Moderate | Phase 1 | Admin sees progress bar during run |
| Duplicate products | Minor | Phase 2 | ASIN dedup within run |
| Unicode seller names | Minor | Phase 4 | Test with international names passes |
| API format changes | Minor | Phase 1 | Validation alerts on missing fields |

---

## Sources

### Amazon Scraping & Best Sellers
- [Amazon Best Sellers scraping guide - Traject Data](https://trajectdata.com/how-to-scrape-amazon-best-seller/)
- [Amazon ASIN parent-child relationships - Zquared](https://zquared.com/understanding-amazon-asins-parent-child-relationships-and-variations/)
- [ScraperAPI Amazon Best Seller scraper](https://www.scraperapi.com/solutions/amazon-best-seller-scraper/)
- [Best Amazon scraping APIs 2026 - Proxyway](https://proxyway.com/best/best-amazon-scrapers)

### eBay API & Seller Search
- [eBay API call limits](https://developer.ebay.com/develop/get-started/api-call-limits)
- [eBay Browse API search documentation](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search)
- [eBay Finding API pagination - Community discussion](https://community.ebay.com/t5/eBay-APIs-Talk-to-your-fellow/How-do-I-get-a-maximum-of-10000-items-in-a-single-API-query/td-p/34214539)
- [eBay private listings](https://www.ebay.com/help/selling/listings/listing-tips/private-listings?id=4161)

### Data Quality & Deduplication
- [Fixing inaccurate web scraping data - Bright Data](https://brightdata.com/blog/web-data/fix-inaccurate-web-scraping-data)
- [Web scraping challenges - Octoparse](https://www.octoparse.com/blog/9-web-scraping-challenges)
- [Fuzzy matching large datasets - Medium](https://medium.com/@tacettincankrc/fuzzy-matching-with-large-datasets-challenges-and-solutions-901b8446dcdc)
- [Deduplication using fuzzy scoring - Towards Data Science](https://towardsdatascience.com/deduplication-of-customer-data-using-fuzzy-scoring-3f77bd3bb4dc/)

### Job Processing & Timeouts
- [AWS Batch job timeouts](https://docs.aws.amazon.com/batch/latest/userguide/job_timeouts.html)
- [Scrapy job persistence](https://docs.scrapy.org/en/latest/topics/jobs.html)
- [Shopify job-iteration for resumable jobs](https://github.com/shopify/job-iteration)
- [Long running tasks: batch vs queue - Medium](https://medium.com/@logan.young87/long-running-tasks-batch-it-or-queue-it-b261fd5ea4d6)

### Cost Monitoring
- [Scrapfly billing documentation](https://scrapfly.io/docs/scrape-api/billing)
- [Web scraping cost analysis - Pangolin](https://www.pangolinfo.com/in-house-web-scraping-cost-analysis/)
- [Zyte cost estimator](https://www.zyte.com/blog/simplifying-web-scraping-costs-with-web-scraping-apis/)

---
*Pitfalls research for: SellerCollection v2 milestone (Amazon Best Sellers + eBay seller collection)*
*Researched: 2026-01-20*
