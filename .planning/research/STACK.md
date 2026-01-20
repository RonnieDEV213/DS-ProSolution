# Stack Research: SellerCollection - Third-Party APIs

**Domain:** Amazon Best Sellers scraping + eBay product search APIs
**Researched:** 2026-01-20
**Confidence:** MEDIUM (pricing varies by volume, requires trial validation)

---

## What EXISTING-TOOLS.md Already Covers

The [EXISTING-TOOLS.md](./EXISTING-TOOLS.md) provides comprehensive coverage of:

- **Browser automation frameworks** (Playwright, Puppeteer, Selenium)
- **Stealth and anti-detection** techniques
- **Proxy services** and pricing tiers
- **CAPTCHA solving** services
- **HTTP clients** (httpx, aiohttp, tls-client)
- **Data extraction** libraries (BeautifulSoup, lxml)
- **General recommendation:** For public data scraping, use third-party APIs like Rainforest or ScraperAPI

**This document supplements EXISTING-TOOLS.md** with specific API recommendations, pricing analysis, and implementation details for:
1. Amazon Best Sellers data collection
2. eBay product search for seller identification

---

## Executive Summary

**Recommendation:** Use **Oxylabs E-Commerce Scraper API** for both Amazon and eBay scraping.

**Rationale:**
- Best price-to-performance ratio at our scale (~10,000 products/month)
- Single API for both platforms (simpler integration)
- 100% success rate in independent tests
- Amazon-specific pricing: $0.40-0.50/1K requests (no JS rendering needed)
- eBay-specific pricing: Same tier, ~10 second response time
- Free trial: 2,000 results to validate before commitment

**Alternative:** If Oxylabs doesn't meet quality needs, **Rainforest API** for Amazon (higher accuracy, premium pricing) + **ScraperAPI** for eBay.

---

## Scale Analysis: What We're Scraping

### Amazon Best Sellers

| Metric | Value | Source |
|--------|-------|--------|
| Main departments | ~35-40 | [Amazon Best Sellers page](https://www.amazon.com/Best-Sellers/zgbs) |
| Products per category | 100 (top 100 only) | Amazon limits public view to top 100 |
| Products per page | 50 | Requires 2 pages per category |
| **Total products** | ~4,000 | 40 categories x 100 products |
| **Total API requests** | ~80 | 40 categories x 2 pages |

### eBay Search (per Amazon product)

| Metric | Value | Notes |
|--------|-------|-------|
| Products to search | ~4,000 | From Amazon Best Sellers |
| Search results per product | 1-10 | Filter to most relevant matches |
| **Total API requests** | ~4,000-10,000 | Depends on matching strategy |

### Monthly Volume Estimate

| Scenario | Amazon Requests | eBay Requests | Total |
|----------|-----------------|---------------|-------|
| Main categories only | 80 | 4,000 | 4,080 |
| With subcategories (10x) | 800 | 40,000 | 40,800 |
| With deep subcategories | 2,000 | 100,000 | 102,000 |

**Baseline estimate:** ~5,000-10,000 requests/month for MVP scope.

---

## API Comparison Matrix

### Amazon Best Sellers APIs

| API | Price/1K Requests | Success Rate | Response Time | Best Sellers Support | Confidence |
|-----|-------------------|--------------|---------------|----------------------|------------|
| **Oxylabs** | $0.40-0.50 | 100% | 5.4s | Yes (category scraping) | HIGH |
| **Rainforest** | ~$1.00-1.50 | 99.9%+ | 2-3s | Dedicated endpoint | HIGH |
| **Bright Data** | $0.90-1.50 | 100% | 3-5s | Yes | MEDIUM |
| **Scrapingdog** | $0.20-0.40 | 89-100% | 2.5-3.5s | Yes | MEDIUM |
| **ScraperAPI** | $0.49-1.49 | 95% | 8-40s | Via e-commerce preset | MEDIUM |

### eBay Search APIs

| API | Price/1K Requests | Success Rate | Response Time | JSON Parsing | Confidence |
|-----|-------------------|--------------|---------------|--------------|------------|
| **Oxylabs** | $0.40-0.50 | 100% | 10s | Yes | HIGH |
| **ScraperAPI** | $0.49-1.49 | 95% | 8-15s | Yes (structured data) | MEDIUM |
| **Scrapingdog** | $0.20-0.40 | 100% | 5.9s | Yes | MEDIUM |
| **Bright Data** | $0.90-1.50 | 100% | 5-8s | Yes | MEDIUM |

---

## Recommended API: Oxylabs E-Commerce Scraper

### Why Oxylabs

1. **Single integration** for both Amazon and eBay
2. **Best value** at our volume: $49/month Micro plan = 98,000 Amazon results
3. **100% success rate** in independent testing
4. **No JavaScript rendering needed** for e-commerce targets (cheaper tier)
5. **Free trial** (2,000 results) to validate before commitment
6. **Success-based billing** - no charge for failed requests

### Pricing Tiers (2026)

| Plan | Monthly Cost | Results Included | Cost/1K (Amazon) | Concurrent |
|------|--------------|------------------|------------------|------------|
| Free Trial | $0 | 2,000 | $0 | 10 req/s |
| Micro | $49 | 98,000 | $0.50 | 50 req/s |
| Starter | $99 | 220,000 | $0.45 | 50 req/s |
| Advanced | $249 | 622,500 | $0.40 | 50 req/s |
| Business | $999 | 3,330,000 | $0.30 | 100 req/s |

**Our fit:** Micro plan ($49/month) covers ~10K requests with significant headroom.

### API Integration

**Amazon Best Sellers:**
```python
import httpx

async def scrape_amazon_bestsellers(category_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://realtime.oxylabs.io/v1/queries",
            auth=("USERNAME", "PASSWORD"),
            json={
                "source": "amazon_bestsellers",
                "domain": "com",
                "query": category_id,
                "start_page": 1,
                "pages": 2,  # Get full top 100
                "parse": True,  # Return structured JSON
            }
        )
        return response.json()
```

**eBay Search:**
```python
async def search_ebay_product(product_title: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://realtime.oxylabs.io/v1/queries",
            auth=("USERNAME", "PASSWORD"),
            json={
                "source": "ebay_search",
                "domain": "com",
                "query": product_title,
                "parse": True,
            }
        )
        return response.json()
```

### Response Data Fields

**Amazon Best Sellers (parsed):**
- `results[].title` - Product name
- `results[].price` - Current price
- `results[].asin` - Amazon product ID
- `results[].url` - Product page URL
- `results[].image` - Product image URL
- `results[].rating` - Star rating
- `results[].reviews_count` - Number of reviews

**eBay Search (parsed):**
- `results[].title` - Listing title
- `results[].price` - Current/Buy It Now price
- `results[].seller.name` - **Seller username** (key field for dropshipper identification)
- `results[].seller.feedback_score` - Seller rating
- `results[].url` - Listing URL
- `results[].condition` - New/Used/Refurbished

### Rate Limits

| Tier | Requests/Second | Daily Soft Limit | Notes |
|------|-----------------|------------------|-------|
| Free Trial | 10 | N/A | 2,000 total |
| Micro-Advanced | 50 | None | Billed per result |
| Business+ | 100 | None | Dedicated manager |

**For our use case:** 50 req/s is more than sufficient for batch processing.

---

## Alternative: Rainforest API (Amazon-specific)

### When to Choose Rainforest Over Oxylabs

- Need **dedicated Best Sellers endpoint** (more reliable parsing)
- Need **all Amazon page types** (reviews, offers, search, categories)
- **Data accuracy is critical** (99.9%+ claimed)
- Budget allows premium pricing

### Rainforest Bestsellers Endpoint

```python
import httpx

async def scrape_rainforest_bestsellers(category_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.rainforestapi.com/request",
            params={
                "api_key": "YOUR_API_KEY",
                "type": "bestsellers",
                "amazon_domain": "amazon.com",
                "category_id": category_id,
                "max_page": 2,  # Automatically paginate
            }
        )
        return response.json()
```

### Rainforest Pricing (Estimated)

| Volume | Cost/Request | Monthly Cost (10K requests) |
|--------|--------------|----------------------------|
| Low volume | ~$0.001-0.002 | $10-20 |
| Medium volume | ~$0.0008-0.001 | $8-10 |
| High volume | Custom | Contact sales |

**Note:** Rainforest pricing is not publicly listed. Contact sales for exact quotes.

### Rainforest vs Oxylabs for Amazon

| Factor | Rainforest | Oxylabs |
|--------|------------|---------|
| Best Sellers support | Dedicated endpoint | Generic e-commerce |
| Accuracy | 99.9%+ claimed | 100% success rate |
| eBay support | No | Yes |
| Pricing transparency | Contact sales | Public tiers |
| Free trial | Yes (unspecified credits) | 2,000 results |
| **Recommendation** | Premium choice | Budget choice |

---

## Alternative: ScraperAPI (eBay-focused)

### When to Choose ScraperAPI

- **Primary focus is eBay** data
- Need **structured JSON output** without custom parsing
- Want **simpler credit-based pricing**

### ScraperAPI eBay Pricing

| Plan | Monthly Cost | API Credits | eBay Searches (5 credits each) |
|------|--------------|-------------|--------------------------------|
| Free | $0 | 1,000 | 200 |
| Hobby | $49 | 100,000 | 20,000 |
| Startup | $149 | 1,000,000 | 200,000 |
| Business | $299 | 3,000,000 | 600,000 |

**Credit multipliers:**
- Basic sites: 1 credit
- E-commerce (Amazon, eBay): 5 credits
- Search engines: 25 credits

### ScraperAPI eBay Integration

```python
import httpx

async def search_ebay_scraperapi(product_title: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.scraperapi.com/structured/ebay/search",
            params={
                "api_key": "YOUR_API_KEY",
                "query": product_title,
                "country": "us",
            }
        )
        return response.json()
```

### ScraperAPI Limitations

- **Slower response times:** 8-40 seconds (vs 5-10s for Oxylabs)
- **5% failure rate** in some tests (requires retry logic)
- **Credit system confusing** - e-commerce costs 5x basic

---

## Budget Analysis

### Scenario: 10,000 Requests/Month (MVP)

| API | Plan | Monthly Cost | Coverage |
|-----|------|--------------|----------|
| Oxylabs Micro | $49 | 98,000 results | 9.8x headroom |
| ScraperAPI Hobby | $49 | 20,000 e-commerce | 2x headroom |
| Rainforest | ~$15-30 | ~10,000 requests | 1x (estimated) |
| Bright Data Pay-as-you-go | ~$10-15 | ~10,000 requests | 1x |

### Scenario: 100,000 Requests/Month (Full categories)

| API | Plan | Monthly Cost | Notes |
|-----|------|--------------|-------|
| Oxylabs Advanced | $249 | 622,500 results | Best value |
| ScraperAPI Startup | $149 | 200,000 e-commerce | Marginal fit |
| Bright Data Tier 1 | $499 | 510,000 records | Overkill |

---

## Implementation Stack

### Dependencies (New)

```toml
# apps/api/pyproject.toml additions
dependencies = [
    # ... existing ...
    "httpx>=0.27.0",  # Async HTTP client (may already exist)
]
```

### Service Architecture

```
SellerCollection Service
├── amazon_scraper.py      # Oxylabs Amazon Best Sellers
├── ebay_scraper.py        # Oxylabs eBay Search
├── rate_limiter.py        # Respect API limits
├── data_processor.py      # Normalize/store results
└── scheduler.py           # Monthly batch jobs
```

### Database Schema (New Tables)

```sql
-- Amazon Best Sellers snapshots
CREATE TABLE amazon_bestsellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(100) NOT NULL,
    category_name VARCHAR(255),
    rank INTEGER NOT NULL,
    asin VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    price_cents INTEGER,
    image_url TEXT,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_id, asin, scraped_at::date)
);

-- eBay seller matches
CREATE TABLE ebay_seller_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amazon_asin VARCHAR(20) REFERENCES amazon_bestsellers(asin),
    ebay_seller_name VARCHAR(255) NOT NULL,
    ebay_listing_url TEXT,
    match_score DECIMAL(3,2),  -- 0.00-1.00 title similarity
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Identified dropshippers
CREATE TABLE identified_dropshippers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ebay_seller_name VARCHAR(255) UNIQUE NOT NULL,
    match_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Risk Mitigation

### API Reliability

| Risk | Mitigation |
|------|------------|
| API downtime | Implement retry with exponential backoff |
| Rate limit exceeded | Track usage, pause if approaching limit |
| Data format changes | Version response parsers, monitor for errors |
| Account suspension | Follow ToS, avoid aggressive scraping |

### Cost Overruns

| Risk | Mitigation |
|------|------------|
| Unexpected volume | Set hard monthly limits in code |
| Category expansion | Require approval for new categories |
| Failed retries | Only retry 3x, log failures for manual review |

### Data Quality

| Risk | Mitigation |
|------|------------|
| Incomplete data | Validate required fields, flag incomplete records |
| Stale data | Track scrape timestamps, re-scrape if >24h old |
| Duplicate products | Dedupe by ASIN before eBay search |

---

## Decision Matrix: Final Recommendation

| Criterion | Oxylabs | Rainforest + ScraperAPI |
|-----------|---------|-------------------------|
| **Cost (10K/mo)** | $49 | ~$60-80 |
| **Integration complexity** | Single API | Two APIs |
| **Amazon accuracy** | Good | Excellent |
| **eBay support** | Included | Separate |
| **Free trial** | 2,000 results | Varies |
| **Pricing transparency** | Public | Contact sales |

**Final recommendation: Start with Oxylabs Micro ($49/month)**

Rationale:
1. Validate concept with free trial (2,000 results)
2. Single integration for both platforms
3. Clear upgrade path if volume increases
4. Switch to Rainforest later if Amazon accuracy insufficient

---

## Action Items

1. [ ] Sign up for Oxylabs free trial
2. [ ] Test Amazon Best Sellers scraping with 5 categories
3. [ ] Test eBay search with 100 product titles
4. [ ] Validate data quality and response times
5. [ ] If satisfactory, upgrade to Micro plan
6. [ ] If not, evaluate Rainforest API trial

---

## Sources

### Pricing & Features
- [Oxylabs Web Scraper API Pricing](https://oxylabs.io/products/scraper-api/web/pricing) - Tier details, rate limits
- [Oxylabs Amazon Scraper](https://oxylabs.io/products/scraper-api/ecommerce/amazon) - Amazon-specific features
- [Oxylabs eBay Scraper](https://oxylabs.io/products/scraper-api/ecommerce/ebay) - eBay-specific features
- [Bright Data Web Scraper Pricing](https://brightdata.com/pricing/web-scraper) - Alternative pricing
- [ScraperAPI Pricing](https://www.scraperapi.com/pricing/) - Credit-based model
- [Rainforest API Bestsellers](https://docs.trajectdata.com/rainforestapi/product-data-api/parameters/bestsellers) - Dedicated endpoint docs

### Comparisons & Reviews
- [Scrapingdog: Best Amazon Scraping APIs 2026](https://www.scrapingdog.com/blog/best-amazon-scraping-apis/) - Independent testing
- [Bright Data: Top 10 Amazon Scrapers 2026](https://brightdata.com/blog/web-data/best-amazon-scrapers) - Feature comparison
- [Medium: Top 7 Web Scraping APIs 2026](https://medium.com/@datajournal/best-web-scraping-apis-fbbdcf7b88f4) - General overview

### Amazon Best Sellers Structure
- [Amazon Best Sellers Page](https://www.amazon.com/Best-Sellers/zgbs) - Category listing
- [Amazon BSR Guide](https://sell.amazon.com/blog/amazon-best-sellers-rank) - How rankings work

---

*Stack research for: SellerCollection v2 milestone*
*Researched: 2026-01-20*
