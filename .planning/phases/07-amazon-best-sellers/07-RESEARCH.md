# Phase 7: Amazon Best Sellers - Research

**Researched:** 2026-01-20
**Domain:** Oxylabs E-Commerce Scraper API integration, Amazon category UI
**Confidence:** HIGH

## Summary

This phase integrates the Oxylabs E-Commerce Scraper API to fetch Amazon Best Sellers products and builds a category selection UI. The CONTEXT.md locks key decisions: department-based hierarchy with collapsible category sublists, preset system via dropdown (Select All + custom saved presets), search filtering, and an abstract service interface for future swappability.

The Oxylabs `amazon_bestsellers` source provides structured JSON responses with product data (title, price, ASIN, rating, URL) at approximately $0.40-0.50 per 1,000 results. Rate limits on the Micro plan allow 50 requests/second. The API accepts browse node IDs (Amazon's category identifiers) to target specific categories.

**Primary recommendation:** Implement `AmazonScraperService` as an abstract interface with `OxylabsAmazonScraper` implementation. Store Amazon departments and categories in a static JSON file (not database) since they rarely change. Use the existing `CollectionService` pattern for orchestration.

## Phase Context

### From CONTEXT.md (User Decisions - Locked)

**Category Selection UI:**
- List organized by **department headers** with **category sublists** beneath each
- Clicking department header **toggles all children**, individual categories also toggleable independently
- **Search box at top** to filter categories (matches category names, hides non-matching departments)
- **Checkboxes + selection count badge** (e.g., "12 selected") - no chips/tags

**Preset System:**
- **Dropdown above category list** to select presets
- Two built-in presets: "Select All" and saved custom presets (NO "Top 10" preset)
- **Auto-save with edit** - current selection is a working preset that can be named and saved
- **Delete option in dropdown** - each custom preset shows delete icon to remove it

**Product Display:**
- **No product preview** - products are internal data for eBay search
- Just show progress during fetch (X/Y products fetched)
- **Warning inline** if a category returns zero products (mark with warning icon after fetch)

**API Interaction:**
- Use **Oxylabs E-Commerce Scraper API** (not proxies + custom scraper)
- **Show throttle status** when rate limited: "Waiting X seconds before next request..."
- **Show running API cost** during fetch: "API cost so far: $X.XX"
- Error handling: Retry failed category 3x, then skip
- If **multiple consecutive failures**, pause collection and notify user
- **Credentials in environment variables only** (not configurable from UI)

**Architecture:**
- **Service interface pattern** for scraping layer
- Abstract interface (e.g., `AmazonScraperService`) with methods like `fetch_bestsellers(category)`
- Current implementation uses Oxylabs E-Commerce API
- Later can swap to proxies + custom scraper without rewriting UI/business logic

### Claude's Discretion
- Progress detail level (simple bar vs category-by-category)
- Whether to show breakdown table of products per category after fetch
- How to notify user when multiple consecutive failures occur (toast, popup, inline label)
- Exact throttle/waiting message styling

## Standard Stack

### Core Dependencies (Already in Project)
| Library | Purpose | Notes |
|---------|---------|-------|
| FastAPI | API framework | Already used |
| Pydantic | Request/response models | Already used |
| supabase-py | Database client | Already used |
| asyncio | Async background tasks | Already used |

### New Dependencies Needed
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| httpx | >=0.25.0 | Async HTTP client for Oxylabs API | Modern async client, better than aiohttp for this use case |

**Installation:**
```bash
pip install httpx
# Or add to pyproject.toml: httpx>=0.25.0
```

## Oxylabs API Details

### Endpoint and Authentication
- **Endpoint:** `https://realtime.oxylabs.io/v1/queries`
- **Method:** POST with JSON body
- **Auth:** HTTP Basic Authentication (`username:password`)
- **Credentials:** Store in environment variables `OXYLABS_USERNAME` and `OXYLABS_PASSWORD`

### Request Format for Amazon Best Sellers
```python
payload = {
    "source": "amazon_bestsellers",
    "domain": "com",  # Amazon marketplace
    "query": "493964",  # Browse node ID (category)
    "parse": True,  # Return structured JSON
    "start_page": 1,
    "pages": 1,  # Max pages per request
}
```

### Response Format (Parsed)
```json
{
  "results": [
    {
      "content": {
        "url": "https://www.amazon.com/gp/bestsellers/electronics/493964",
        "page": 1,
        "results": [
          {
            "pos": 1,
            "url": "https://www.amazon.com/dp/B0CX23V2ZK",
            "asin": "B0CX23V2ZK",
            "price": 29.99,
            "title": "Product Title Here",
            "rating": 4.5,
            "currency": "USD"
          }
        ],
        "parse_status_code": 12000
      },
      "status_code": 200
    }
  ]
}
```

### Cost and Rate Limits

**Pricing (Micro Plan - $49/month):**
| Target | Cost per 1K Results | Max Results/Month |
|--------|---------------------|-------------------|
| Amazon (no JS) | ~$0.40-0.50 | 98,000 |
| Amazon (with JS) | ~$0.65 | ~75,000 |

**Rate Limits (Micro Plan):**
| Metric | Limit |
|--------|-------|
| Total jobs/sec | 50 |
| Rendered jobs/sec | 13 |
| Concurrent jobs | 50 |

**Rate Limit Response:**
- Returns 429 status with message: "Access to {domain} has been limited to 1 req/s due to a low success rate"
- Headers include `x-ratelimit-limit-remaining` for tracking

**Update Cost Estimation (from Phase 6 placeholder):**
- Phase 6 uses `COST_PER_AMAZON_PRODUCT_CENTS = 5` (placeholder)
- Actual Oxylabs cost: ~$0.50 per 1,000 results = $0.0005 per product
- Update to `COST_PER_AMAZON_PRODUCT_CENTS = 1` (0.1 cents per product, rounding up)
- Best Sellers page returns ~50 products per page, so ~$0.025 per category page

## Amazon Category Structure

### Browse Node IDs
Amazon organizes products using "browse node IDs" - numeric identifiers for each category/subcategory.

**Top-Level Departments (Amazon.com):**
| Department | Node ID |
|------------|---------|
| Appliances | 2619526011 |
| Arts, Crafts & Sewing | 2617942011 |
| Automotive | 15690151 |
| Baby | 165797011 |
| Beauty & Personal Care | 11055981 |
| Books | 1000 |
| Electronics | 493964 |
| Grocery & Gourmet Food | 16310211 |
| Health & Personal Care | 3760931 |
| Home & Kitchen | 1063498 |
| Industrial & Scientific | 16310161 |
| Lawn & Garden | 3238155011 |
| Musical Instruments | 11965861 |
| Office Products | 1084128 |
| Pet Supplies | 2619534011 |
| Sports & Outdoors | 3375301 |
| Tools & Home Improvement | 468240 |
| Toys & Games | 165795011 |
| Video Games | 11846801 |

### Category Data Storage
**Recommendation:** Store categories as a static JSON file, not database:

```json
// apps/api/src/app/data/amazon_categories.json
{
  "departments": [
    {
      "id": "electronics",
      "name": "Electronics",
      "node_id": "493964",
      "categories": [
        { "id": "computers", "name": "Computers & Accessories", "node_id": "541966" },
        { "id": "headphones", "name": "Headphones", "node_id": "12097479011" },
        { "id": "cameras", "name": "Camera & Photo", "node_id": "502394" }
      ]
    }
  ]
}
```

**Why static file:**
- Amazon categories rarely change
- No database overhead
- Easy to update manually
- Can bundle with application

## Architecture Patterns

### Service Interface Pattern (Locked in CONTEXT.md)

```python
# apps/api/src/app/services/scrapers/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class AmazonProduct:
    """Product data from Amazon Best Sellers."""
    asin: str
    title: str
    price: float | None
    currency: str
    rating: float | None
    url: str
    position: int

@dataclass
class ScrapeResult:
    """Result from a scrape operation."""
    products: list[AmazonProduct]
    cost_cents: int
    page: int
    total_pages: int | None
    error: str | None = None

class AmazonScraperService(ABC):
    """Abstract interface for Amazon scraping."""

    @abstractmethod
    async def fetch_bestsellers(
        self,
        category_node_id: str,
        page: int = 1,
    ) -> ScrapeResult:
        """Fetch best sellers for a category."""
        pass

    @abstractmethod
    async def get_categories(self) -> list[dict]:
        """Get available categories for selection."""
        pass
```

### Oxylabs Implementation

```python
# apps/api/src/app/services/scrapers/oxylabs.py
import httpx
import os
import logging
from .base import AmazonScraperService, AmazonProduct, ScrapeResult

logger = logging.getLogger(__name__)

# Cost per API call in cents (1/10th of a cent per product, ~50 products/page)
COST_PER_BESTSELLERS_PAGE_CENTS = 3  # ~$0.03 per page

class OxylabsAmazonScraper(AmazonScraperService):
    """Oxylabs E-Commerce API implementation."""

    def __init__(self):
        self.username = os.environ.get("OXYLABS_USERNAME")
        self.password = os.environ.get("OXYLABS_PASSWORD")
        self.base_url = "https://realtime.oxylabs.io/v1/queries"

        if not self.username or not self.password:
            raise ValueError("OXYLABS_USERNAME and OXYLABS_PASSWORD required")

    async def fetch_bestsellers(
        self,
        category_node_id: str,
        page: int = 1,
    ) -> ScrapeResult:
        """Fetch best sellers from Oxylabs API."""
        payload = {
            "source": "amazon_bestsellers",
            "domain": "com",
            "query": category_node_id,
            "parse": True,
            "start_page": page,
            "pages": 1,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.base_url,
                json=payload,
                auth=(self.username, self.password),
                timeout=30.0,
            )

        if response.status_code == 429:
            # Rate limited
            return ScrapeResult(
                products=[],
                cost_cents=0,
                page=page,
                total_pages=None,
                error="rate_limited",
            )

        response.raise_for_status()
        data = response.json()

        # Parse response
        result = data["results"][0]
        content = result.get("content", {})
        raw_products = content.get("results", [])

        products = [
            AmazonProduct(
                asin=p.get("asin", ""),
                title=p.get("title", ""),
                price=p.get("price"),
                currency=p.get("currency", "USD"),
                rating=p.get("rating"),
                url=p.get("url", ""),
                position=p.get("pos", 0),
            )
            for p in raw_products
        ]

        return ScrapeResult(
            products=products,
            cost_cents=COST_PER_BESTSELLERS_PAGE_CENTS,
            page=page,
            total_pages=None,  # Oxylabs doesn't report total
            error=None,
        )
```

### Integration with CollectionService

```python
# In apps/api/src/app/services/collection.py

async def run_amazon_collection(
    self,
    run_id: str,
    category_ids: list[str],
    scraper: AmazonScraperService,
) -> None:
    """Execute Amazon best sellers collection."""
    consecutive_failures = 0
    MAX_CONSECUTIVE_FAILURES = 5

    for cat_id in category_ids:
        # Get node_id from category
        category = get_category_by_id(cat_id)

        for attempt in range(3):  # 3 retries per category
            result = await scraper.fetch_bestsellers(category["node_id"])

            if result.error == "rate_limited":
                # Wait and retry
                await asyncio.sleep(5)
                continue

            if result.error:
                consecutive_failures += 1
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    await self.pause_run_with_notification(run_id, "Multiple consecutive failures")
                    return
                break

            # Success - process products
            consecutive_failures = 0
            for product in result.products:
                await self.save_collection_item(run_id, product)

            # Update cost tracking
            await self.add_cost(run_id, result.cost_cents)
            break
```

### Category Selection Preset Schema

```sql
-- Migration: 041_amazon_presets.sql
CREATE TABLE amazon_category_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_ids TEXT[] NOT NULL,  -- Array of category IDs from static JSON
  is_builtin BOOLEAN NOT NULL DEFAULT false,  -- "Select All" is builtin
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT amazon_presets_unique_name UNIQUE (org_id, name)
);

ALTER TABLE amazon_category_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_amazon_presets" ON amazon_category_presets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### UI Component Structure

```
apps/web/src/components/admin/collection/
  amazon-category-selector.tsx   # Main selector with search, departments, categories
  category-preset-dropdown.tsx   # Preset dropdown with save/delete
```

**Category Selector Pattern (from existing department-role-dialog.tsx):**
```tsx
// Department header with collapsible categories
<div className="space-y-3">
  {filteredDepartments.map((dept) => {
    const allSelected = dept.categories.every((c) => selected.has(c.id));
    const someSelected = dept.categories.some((c) => selected.has(c.id));

    return (
      <div key={dept.id} className="bg-gray-800 rounded-lg p-4">
        {/* Department header - toggles all */}
        <div
          className="flex items-center gap-2 cursor-pointer mb-2"
          onClick={() => toggleDepartment(dept.id)}
        >
          <Checkbox
            checked={allSelected}
            className={someSelected && !allSelected ? "opacity-50" : ""}
          />
          <span className="font-medium text-white">{dept.name}</span>
          <ChevronDown className={cn("h-4 w-4", expanded && "rotate-180")} />
        </div>

        {/* Category list */}
        {expanded && (
          <div className="ml-6 space-y-1">
            {dept.categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => toggleCategory(cat.id)}
              >
                <Checkbox checked={selected.has(cat.id)} />
                <span className="text-sm text-gray-300">{cat.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  })}
</div>
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Amazon scraping | Custom scraper with proxies | Oxylabs API | CAPTCHA bypass, ML proxy rotation, structured output |
| HTML parsing | BeautifulSoup/lxml | Oxylabs `parse: true` | API returns structured JSON |
| Category list | Web scraping Amazon | Static JSON file | Categories rarely change, avoid API calls |
| Retry logic | Custom exponential backoff | Simple 3-retry loop | CONTEXT.md specifies 3 retries then skip |

## Common Pitfalls

### Pitfall 1: Hardcoded Browse Node IDs
**What goes wrong:** Node IDs change or become invalid
**Why it happens:** Amazon restructures categories occasionally
**How to avoid:** Store in JSON file that can be updated; log warnings if API returns empty results
**Warning signs:** Categories returning 0 products

### Pitfall 2: Missing Rate Limit Handling
**What goes wrong:** Requests fail or account gets throttled
**Why it happens:** Not respecting Oxylabs rate limits or 429 responses
**How to avoid:** Check for 429 status, implement wait-and-retry, track `x-ratelimit-remaining` header
**Warning signs:** Sudden increase in failures, 429 responses

### Pitfall 3: No Cost Tracking Update
**What goes wrong:** Budget estimates wrong, users overspend
**Why it happens:** Phase 6 placeholder costs don't match actual Oxylabs pricing
**How to avoid:** Update `COST_PER_AMAZON_PRODUCT_CENTS` to match actual API costs
**Warning signs:** Actual cost >> estimated cost in collection runs

### Pitfall 4: Blocking API Calls
**What goes wrong:** API endpoint hangs during collection
**Why it happens:** Making Oxylabs calls synchronously in request handler
**How to avoid:** Collection runs as background task, return immediately
**Warning signs:** POST /runs/start times out

### Pitfall 5: Not Storing Product Data
**What goes wrong:** Products fetched but lost
**Why it happens:** Not saving to `collection_items` table
**How to avoid:** Save each product as `item_type='amazon_product'` with ASIN as `external_id`
**Warning signs:** Collection completes but no items in database

## Code Examples

### Oxylabs Request (from official docs)
```python
# Source: https://developers.oxylabs.io/scraping-solutions/web-scraper-api/targets/amazon/best-sellers
import requests
from pprint import pprint

payload = {
    'source': 'amazon_bestsellers',
    'domain': 'com',
    'query': '493964',  # Electronics browse node
    'start_page': 1,
    'parse': True,
}

response = requests.post(
    'https://realtime.oxylabs.io/v1/queries',
    auth=('USERNAME', 'PASSWORD'),
    json=payload,
)

pprint(response.json())
```

### Async Version with httpx
```python
import httpx

async def fetch_bestsellers(category_node_id: str) -> dict:
    payload = {
        "source": "amazon_bestsellers",
        "domain": "com",
        "query": category_node_id,
        "parse": True,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://realtime.oxylabs.io/v1/queries",
            json=payload,
            auth=("USERNAME", "PASSWORD"),
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()
```

### Category Selector with Search (following codebase patterns)
```tsx
// Following pattern from department-role-dialog.tsx
const [searchQuery, setSearchQuery] = useState("");

const filteredDepartments = useMemo(() => {
  if (!searchQuery.trim()) return departments;

  const query = searchQuery.toLowerCase();
  return departments.filter((dept) => {
    const matchesDept = dept.name.toLowerCase().includes(query);
    const matchesCats = dept.categories.some((c) =>
      c.name.toLowerCase().includes(query)
    );
    return matchesDept || matchesCats;
  }).map((dept) => ({
    ...dept,
    categories: dept.categories.filter((c) =>
      c.name.toLowerCase().includes(query) ||
      dept.name.toLowerCase().includes(query)
    ),
  }));
}, [departments, searchQuery]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom proxies + scraping | Oxylabs E-Commerce API | 2024 | No CAPTCHA handling, ML proxy rotation |
| Sync requests | httpx async client | Current | Non-blocking API calls |
| Selenium/Playwright | API with `parse: true` | Current | Structured JSON, no browser overhead |

## Open Questions

1. **Category subcategory depth**
   - What we know: Amazon has 25,000+ subcategories
   - What's unclear: How deep to go (departments only? one level of subcategories?)
   - Recommendation: Start with 1 level of subcategories per department, expand if needed

2. **Products per category estimate**
   - What we know: Best Sellers pages show ~50 products per page
   - What's unclear: How many pages to fetch per category
   - Recommendation: Fetch 1 page (top 50) per category initially, make configurable

3. **Category refresh frequency**
   - What we know: Static JSON file for categories
   - What's unclear: How often to update category list
   - Recommendation: Manual update when needed, no auto-refresh

## Sources

### Primary (HIGH confidence)
- [Oxylabs Best Sellers Documentation](https://developers.oxylabs.io/scraping-solutions/web-scraper-api/targets/amazon/best-sellers) - Request format, response structure
- [Oxylabs Rate Limits](https://developers.oxylabs.io/scraping-solutions/web-scraper-api/usage-and-billing/rate-limits) - Rate limits by plan
- [BrowseNodes.com](https://www.browsenodes.com/) - Amazon browse node IDs

### Secondary (MEDIUM confidence)
- [Oxylabs Pricing Documentation](https://developers.oxylabs.io/help-center/billing-and-payments/how-does-web-scraper-api-pricing-work) - Cost calculation
- [GitHub: oxylabs/amazon-scraper](https://github.com/oxylabs/amazon-scraper) - Python examples
- [Oxylabs Blog: Scraping Amazon Best Sellers](https://oxylabs.io/blog/how-to-scrape-amazon-best-sellers) - Tutorial

### Codebase (HIGH confidence)
- `apps/api/src/app/services/collection.py` - Existing CollectionService pattern
- `apps/api/src/app/routers/collection.py` - Existing router pattern
- `apps/web/src/components/admin/department-role-dialog.tsx` - Checkbox/search UI pattern
- `apps/web/src/components/admin/collection/run-config-modal.tsx` - Existing config modal

## Metadata

**Confidence breakdown:**
- Oxylabs API integration: HIGH - Official documentation, tested examples
- Category structure: MEDIUM - Browse nodes may change, static file mitigates
- UI patterns: HIGH - Follows existing codebase patterns exactly
- Cost estimation: MEDIUM - Oxylabs pricing documentation, may vary

**Research date:** 2026-01-20
**Valid until:** 30 days (stable API, may need category refresh)
