# Phase 8: eBay Seller Search - Research

**Researched:** 2026-01-20
**Domain:** Oxylabs eBay Search API integration, HTML parsing, dropshipper filtering
**Confidence:** HIGH

## Summary

This phase extends the existing scraper infrastructure to search eBay for potential dropshippers based on Amazon products collected in Phase 7. The CONTEXT.md locks key decisions: use Oxylabs for eBay search (same API as Amazon), apply dropshipper-characteristic filters (Brand New, free shipping, 80-120% Amazon price, US sellers), extract seller name + feedback score, and dedupe immediately during collection.

Oxylabs `ebay_search` source returns **HTML only** (not parsed JSON like Amazon). This requires custom parsing instructions using XPath/CSS selectors to extract structured data. The eBay search URL can encode all filters directly (condition, shipping, location, price range), reducing post-processing. Seller information is available in search results via `span.s-item__seller-info-text` selector.

**Primary recommendation:** Build `EbayScraperService` interface with `OxylabsEbayScraper` implementation. Construct filtered eBay URLs with all dropshipper criteria embedded. Use Oxylabs custom parsing instructions to extract seller info from HTML results. Dedupe sellers against existing `sellers` table during collection (not after).

## Phase Context

### From CONTEXT.md (User Decisions - Locked)

**Search Behavior:**
- Fetch **first 2-3 pages** of results per product (50-150 results total)
- Use **full Amazon product title** as eBay search query (no truncation)
- If search returns **zero results after filters** - just skip, no special handling
- No matching/verification between Amazon and eBay listings

**Rate Limiting & Throttling:**
- **Same as Amazon phase** - auto-pause on rate limit (429), display throttle status in UI
- Request delay and concurrency at **Claude's discretion**
- **No cost tracking** - removed from project

**Result Handling:**
- Extract: **seller name + seller ID/URL + feedback score**
- **Do NOT store** which Amazon product led to finding each seller
- **Dedupe immediately** during collection - check existing sellers before adding
- **No hit count tracking** - only care if seller appeared at least once

**Error Recovery:**
- Same as Amazon: Retry failed search 3x, then skip
- 5 consecutive failures auto-pauses collection
- Checkpoint-based resume

### Claude's Discretion
- Request delay between eBay searches (0ms to 500ms range)
- Sequential vs parallel batch execution
- Exact retry timing and backoff strategy

## Standard Stack

### Core Dependencies (Already in Project)
| Library | Purpose | Notes |
|---------|---------|-------|
| httpx | Async HTTP client | Already used for Amazon Oxylabs |
| FastAPI | API framework | Already used |
| Pydantic | Request/response models | Already used |
| supabase-py | Database client | Already used |

### No New Dependencies Needed
The eBay integration uses the same Oxylabs API endpoint and httpx client as Amazon. Custom HTML parsing uses Oxylabs' built-in parsing instructions feature - no BeautifulSoup or lxml needed.

## Oxylabs eBay API Details

### Endpoint and Source
- **Endpoint:** `https://realtime.oxylabs.io/v1/queries`
- **Source:** `ebay` (for custom URLs with filters) OR `ebay_search` (for query-based)
- **Auth:** HTTP Basic Authentication (same credentials as Amazon)
- **Output:** HTML by default; use `parsing_instructions` for structured JSON

### Recommended Approach: Pre-filtered URLs with `ebay` Source

Rather than using `ebay_search` with query and post-filtering, construct eBay URLs with all filters embedded:

```python
# Construct filtered eBay search URL
base_url = "https://www.ebay.com/sch/i.html"
params = {
    "_nkw": amazon_product_title,  # Search query (full title)
    "LH_ItemCondition": "1000",     # Brand New only
    "LH_Free": "1",                 # Free shipping only
    "LH_PrefLoc": "1",              # US sellers only
    "_udlo": str(int(amazon_price * 0.80)),  # Min price (80% of Amazon)
    "_udhi": str(int(amazon_price * 1.20)),  # Max price (120% of Amazon)
    "_ipg": "60",                   # Items per page
    "_pgn": page_number,            # Page number for pagination
}
url = f"{base_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"
```

### eBay URL Filter Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `_nkw` | search term | Keyword search |
| `LH_ItemCondition` | `1000` | Brand New condition |
| `LH_Free` | `1` | Free shipping only |
| `LH_PrefLoc` | `1` | US sellers only |
| `_udlo` | min price | Minimum price filter |
| `_udhi` | max price | Maximum price filter |
| `_ipg` | `60` | Items per page (default 60) |
| `_pgn` | page number | Pagination (1-indexed) |

### Request Format with Custom Parsing

```python
payload = {
    "source": "ebay",
    "url": constructed_url,
    "parse": True,
    "parsing_instructions": {
        "items": {
            "_fns": [
                {"_fn": "css", "_args": ["li.s-item"]}
            ],
            "_items": {
                "seller_name": {
                    "_fns": [
                        {"_fn": "css_one", "_args": ["span.s-item__seller-info-text"]},
                        {"_fn": "element_text"}
                    ]
                },
                "item_link": {
                    "_fns": [
                        {"_fn": "css_one", "_args": ["a.s-item__link"]},
                        {"_fn": "attribute", "_args": ["href"]}
                    ]
                },
                "price": {
                    "_fns": [
                        {"_fn": "css_one", "_args": ["span.s-item__price"]},
                        {"_fn": "element_text"}
                    ]
                },
                "shipping": {
                    "_fns": [
                        {"_fn": "css_one", "_args": ["span.s-item__logisticsCost"]},
                        {"_fn": "element_text"}
                    ]
                }
            }
        }
    }
}
```

### Response Format (with parsing_instructions)

```json
{
  "results": [
    {
      "content": {
        "items": [
          {
            "seller_name": "sellername123 (1,234) 99.5%",
            "item_link": "https://www.ebay.com/itm/123456789",
            "price": "$29.99",
            "shipping": "Free shipping"
          }
        ]
      },
      "status_code": 200
    }
  ]
}
```

### Seller Info Parsing

The `span.s-item__seller-info-text` returns a formatted string like:
```
"sellername123 (1,234) 99.5%"
```

Parse this with regex:
```python
import re

def parse_seller_info(seller_text: str) -> dict:
    """Parse eBay seller info string."""
    # Pattern: "username (feedback_count) positive_percent%"
    match = re.match(r"^(.+?)\s*\(([0-9,]+)\)\s*([0-9.]+)%?$", seller_text.strip())
    if match:
        return {
            "username": match.group(1).strip(),
            "feedback_count": int(match.group(2).replace(",", "")),
            "positive_percent": float(match.group(3)),
        }
    # Fallback: just username
    return {"username": seller_text.strip(), "feedback_count": None, "positive_percent": None}
```

### Cost and Rate Limits

Same Micro plan as Amazon ($49/month):

| Metric | Limit |
|--------|-------|
| Total jobs/sec | 50 |
| Concurrent jobs | 50 |

eBay requests are typically cheaper than Amazon - standard web scraping vs e-commerce specialized parsing.

### Rate Limit Handling

Same as Amazon implementation:
- 429 response returns `error: "rate_limited"` in ScrapeResult
- Checkpoint JSONB stores throttle status for UI display
- Wait 5 seconds and retry

## Architecture Patterns

### Service Interface Pattern (Parallel to Amazon)

```python
# apps/api/src/app/services/scrapers/ebay_base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EbaySeller:
    """Seller data from eBay search results."""
    username: str
    feedback_count: int | None
    positive_percent: float | None
    item_url: str  # URL where seller was found (for debugging)


@dataclass
class EbaySearchResult:
    """Result from an eBay search operation."""
    sellers: list[EbaySeller]
    page: int
    has_more: bool
    error: str | None = None


class EbayScraperService(ABC):
    """Abstract interface for eBay scraping."""

    @abstractmethod
    async def search_sellers(
        self,
        query: str,
        amazon_price: float,
        page: int = 1,
    ) -> EbaySearchResult:
        """Search eBay for sellers matching dropshipper criteria.

        Filters applied:
        - Brand New condition
        - Free shipping
        - US sellers only
        - Price 80-120% of amazon_price

        Args:
            query: Search term (Amazon product title)
            amazon_price: Reference price for filtering
            page: Page number (1-indexed)

        Returns:
            EbaySearchResult with extracted sellers
        """
        pass
```

### Oxylabs Implementation

```python
# apps/api/src/app/services/scrapers/oxylabs_ebay.py
import logging
import os
import re
from urllib.parse import quote_plus

import httpx

from .ebay_base import EbaySeller, EbayScraperService, EbaySearchResult

logger = logging.getLogger(__name__)


class OxylabsEbayScraper(EbayScraperService):
    """Oxylabs implementation for eBay seller search."""

    def __init__(self):
        self.username = os.environ.get("OXYLABS_USERNAME")
        self.password = os.environ.get("OXYLABS_PASSWORD")
        self.base_url = "https://realtime.oxylabs.io/v1/queries"

        if not self.username or not self.password:
            raise ValueError("OXYLABS_USERNAME and OXYLABS_PASSWORD required")

    def _build_search_url(
        self,
        query: str,
        amazon_price: float,
        page: int,
    ) -> str:
        """Build eBay search URL with all dropshipper filters."""
        min_price = int(amazon_price * 0.80)
        max_price = int(amazon_price * 1.20)

        params = [
            f"_nkw={quote_plus(query)}",
            "LH_ItemCondition=1000",  # Brand New
            "LH_Free=1",              # Free shipping
            "LH_PrefLoc=1",           # US only
            f"_udlo={min_price}",
            f"_udhi={max_price}",
            "_ipg=60",                # Items per page
            f"_pgn={page}",
        ]
        return f"https://www.ebay.com/sch/i.html?{'&'.join(params)}"

    def _parse_seller_info(self, seller_text: str | None) -> dict:
        """Parse seller info string like 'username (1,234) 99.5%'."""
        if not seller_text:
            return {"username": None, "feedback_count": None, "positive_percent": None}

        match = re.match(r"^(.+?)\s*\(([0-9,]+)\)\s*([0-9.]+)%?$", seller_text.strip())
        if match:
            return {
                "username": match.group(1).strip(),
                "feedback_count": int(match.group(2).replace(",", "")),
                "positive_percent": float(match.group(3)),
            }
        return {"username": seller_text.strip(), "feedback_count": None, "positive_percent": None}

    async def search_sellers(
        self,
        query: str,
        amazon_price: float,
        page: int = 1,
    ) -> EbaySearchResult:
        """Search eBay for sellers with dropshipper characteristics."""
        url = self._build_search_url(query, amazon_price, page)

        payload = {
            "source": "ebay",
            "url": url,
            "parse": True,
            "parsing_instructions": {
                "items": {
                    "_fns": [{"_fn": "css", "_args": ["li.s-item"]}],
                    "_items": {
                        "seller_info": {
                            "_fns": [
                                {"_fn": "css_one", "_args": ["span.s-item__seller-info-text"]},
                                {"_fn": "element_text"}
                            ]
                        },
                        "item_link": {
                            "_fns": [
                                {"_fn": "css_one", "_args": ["a.s-item__link"]},
                                {"_fn": "attribute", "_args": ["href"]}
                            ]
                        }
                    }
                },
                "has_next": {
                    "_fns": [
                        {"_fn": "css_one", "_args": ["a.pagination__next"]},
                        {"_fn": "exists"}
                    ]
                }
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    auth=(self.username, self.password),
                    timeout=30.0,
                )

            if response.status_code == 429:
                return EbaySearchResult(sellers=[], page=page, has_more=False, error="rate_limited")

            response.raise_for_status()
            data = response.json()

            content = data.get("results", [{}])[0].get("content", {})
            raw_items = content.get("items", [])
            has_more = content.get("has_next", False)

            # Extract unique sellers
            sellers = []
            seen_usernames = set()

            for item in raw_items:
                seller_data = self._parse_seller_info(item.get("seller_info"))
                username = seller_data.get("username")

                if username and username not in seen_usernames:
                    seen_usernames.add(username)
                    sellers.append(EbaySeller(
                        username=username,
                        feedback_count=seller_data.get("feedback_count"),
                        positive_percent=seller_data.get("positive_percent"),
                        item_url=item.get("item_link", ""),
                    ))

            logger.info(f"Found {len(sellers)} unique sellers from page {page}")
            return EbaySearchResult(sellers=sellers, page=page, has_more=has_more, error=None)

        except httpx.TimeoutException:
            return EbaySearchResult(sellers=[], page=page, has_more=False, error="timeout")
        except Exception as e:
            logger.error(f"eBay search error: {e}")
            return EbaySearchResult(sellers=[], page=page, has_more=False, error=str(e))
```

### Integration with CollectionService

```python
# In collection.py - new method for Phase 8

async def run_ebay_seller_search(
    self,
    run_id: str,
    org_id: str,
) -> dict:
    """
    Execute eBay seller search for Amazon products in a collection run.

    For each Amazon product collected:
    1. Search eBay with product title + dropshipper filters
    2. Extract sellers from 2-3 pages of results
    3. Dedupe against existing sellers table
    4. Add new sellers
    """
    # Get Amazon products from Phase 7
    products = self.supabase.table("collection_items").select(
        "id, external_id, data"
    ).eq("run_id", run_id).eq("item_type", "amazon_product").execute()

    if not products.data:
        return {"status": "completed", "message": "No Amazon products to search"}

    scraper = OxylabsEbayScraper()
    consecutive_failures = 0
    MAX_CONSECUTIVE_FAILURES = 5
    PAGES_PER_PRODUCT = 3
    sellers_found = 0
    sellers_new = 0

    for product in products.data:
        title = product["data"].get("title", "")
        price = product["data"].get("price")

        if not title or not price:
            continue

        for page in range(1, PAGES_PER_PRODUCT + 1):
            result = await scraper.search_sellers(title, price, page)

            if result.error == "rate_limited":
                # Update checkpoint with throttle status
                self.supabase.table("collection_runs").update({
                    "checkpoint": {"status": "rate_limited", "waiting_seconds": 5}
                }).eq("id", run_id).execute()
                await asyncio.sleep(5)
                continue

            if result.error:
                consecutive_failures += 1
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    await self.pause_run(run_id, org_id)
                    return {"status": "paused", "error": "Multiple consecutive failures"}
                break

            consecutive_failures = 0

            # Process sellers - dedupe immediately
            for seller in result.sellers:
                sellers_found += 1
                normalized = self._normalize_seller_name(seller.username)

                # Check if already exists
                existing = self.supabase.table("sellers").select("id").eq(
                    "org_id", org_id
                ).eq("normalized_name", normalized).eq("platform", "ebay").execute()

                if not existing.data:
                    # New seller - add it
                    self.supabase.table("sellers").insert({
                        "org_id": org_id,
                        "display_name": seller.username,
                        "normalized_name": normalized,
                        "platform": "ebay",
                        "platform_id": seller.username,
                        "feedback_score": seller.feedback_count,
                        "first_seen_run_id": run_id,
                        "last_seen_run_id": run_id,
                        "times_seen": 1,
                    }).execute()
                    sellers_new += 1

            if not result.has_more:
                break

        # Update progress
        await self.checkpoint(
            run_id=run_id,
            checkpoint_data={"current_product": product["id"]},
            processed_items=products.data.index(product) + 1,
            failed_items=0,
        )

    return {"status": "completed", "sellers_found": sellers_found, "sellers_new": sellers_new}
```

### Project Structure Addition

```
apps/api/src/app/services/scrapers/
  __init__.py          # Add EbayScraperService, OxylabsEbayScraper exports
  base.py              # Existing Amazon base (unchanged)
  oxylabs.py           # Existing Amazon Oxylabs (unchanged)
  ebay_base.py         # NEW: EbaySeller, EbaySearchResult, EbayScraperService
  oxylabs_ebay.py      # NEW: OxylabsEbayScraper implementation
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| eBay HTML parsing | BeautifulSoup locally | Oxylabs `parsing_instructions` | Parsing happens server-side, cleaner code, handles JS |
| URL encoding | Manual string concat | `urllib.parse.quote_plus` | Handles special characters in product titles |
| Seller deduplication | Post-collection batch | Immediate check during collection | Simpler, no separate dedup phase |
| Price filtering | Post-fetch filtering | URL parameters | Fewer results to process, less API usage |
| Condition/shipping filter | Post-fetch filtering | URL parameters | Same - filter at source |

**Key insight:** All dropshipper filters (condition, shipping, price, location) can be encoded in the eBay URL. This means Oxylabs fetches pre-filtered results - no need to fetch all results and filter locally.

## Common Pitfalls

### Pitfall 1: HTML Structure Changes
**What goes wrong:** eBay updates page layout, CSS selectors break
**Why it happens:** eBay regularly updates their frontend
**How to avoid:**
- Use multiple fallback selectors
- Log when parsing returns empty/null
- Monitor success rate
**Warning signs:** Sudden drop in sellers found, empty seller names

### Pitfall 2: URL Encoding Issues
**What goes wrong:** Search returns no results or wrong results
**Why it happens:** Product titles contain special characters (&, +, quotes)
**How to avoid:** Always use `quote_plus()` for the search query
**Warning signs:** HTTP errors, empty results for known products

### Pitfall 3: Missing Price Data
**What goes wrong:** Cannot apply 80-120% price filter
**Why it happens:** Some Amazon products have null/missing price
**How to avoid:** Skip products without price, log warning
**Warning signs:** NaN/None in URL parameters

### Pitfall 4: Seller Info Format Variations
**What goes wrong:** Regex fails to parse seller info
**Why it happens:** Different formats: "seller (123) 99%", "seller", "seller (123)"
**How to avoid:** Robust regex with fallback to raw username
**Warning signs:** Many sellers with null feedback_count

### Pitfall 5: Pagination Beyond Results
**What goes wrong:** Requesting page 3 when only 2 pages exist
**Why it happens:** Not checking `has_more` / pagination element
**How to avoid:** Check `has_next` in parsed response, stop early
**Warning signs:** Empty results on later pages

### Pitfall 6: Rate Limiting Cascades
**What goes wrong:** Multiple workers all get rate limited
**Why it happens:** Parallel execution without coordination
**How to avoid:** Sequential execution recommended (per CONTEXT.md discretion), or add jitter
**Warning signs:** All workers showing rate_limited status

## Code Examples

### eBay URL Construction (Verified Pattern)
```python
# Source: eBay URL parameters from SerpApi and community documentation
from urllib.parse import quote_plus

def build_ebay_dropshipper_url(
    product_title: str,
    amazon_price: float,
    page: int = 1,
) -> str:
    """Construct eBay search URL with all dropshipper filters."""
    min_price = int(amazon_price * 0.80)
    max_price = int(amazon_price * 1.20)

    params = {
        "_nkw": quote_plus(product_title),
        "LH_ItemCondition": "1000",   # Brand New
        "LH_Free": "1",               # Free shipping
        "LH_PrefLoc": "1",            # US only
        "_udlo": str(min_price),      # Min price
        "_udhi": str(max_price),      # Max price
        "_ipg": "60",                 # Items per page
        "_pgn": str(page),            # Page number
    }

    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://www.ebay.com/sch/i.html?{query_string}"

# Example output:
# https://www.ebay.com/sch/i.html?_nkw=Apple+AirPods+Pro+2nd+Gen&LH_ItemCondition=1000&LH_Free=1&LH_PrefLoc=1&_udlo=200&_udhi=300&_ipg=60&_pgn=1
```

### Oxylabs Custom Parsing Instructions (Verified Pattern)
```python
# Source: Oxylabs Custom Parser documentation
parsing_instructions = {
    "items": {
        "_fns": [
            {"_fn": "css", "_args": ["li.s-item"]}  # Select all search result items
        ],
        "_items": {
            "seller_info": {
                "_fns": [
                    {"_fn": "css_one", "_args": ["span.s-item__seller-info-text"]},
                    {"_fn": "element_text"}
                ]
            },
            "item_link": {
                "_fns": [
                    {"_fn": "css_one", "_args": ["a.s-item__link"]},
                    {"_fn": "attribute", "_args": ["href"]}
                ]
            },
            "price": {
                "_fns": [
                    {"_fn": "css_one", "_args": ["span.s-item__price"]},
                    {"_fn": "element_text"}
                ]
            }
        }
    },
    "has_next": {
        "_fns": [
            {"_fn": "css_one", "_args": ["a.pagination__next"]},
            {"_fn": "exists"}
        ]
    }
}
```

### Seller Info Regex Parsing
```python
import re

def parse_seller_info(text: str | None) -> dict:
    """
    Parse eBay seller info from search results.

    Formats seen:
    - "sellername (1,234) 99.5%"
    - "sellername (1234) 99%"
    - "sellername" (no feedback)
    """
    if not text:
        return {"username": None, "feedback_count": None, "positive_percent": None}

    text = text.strip()

    # Full format: username (count) percent%
    full_match = re.match(r"^(.+?)\s*\(([0-9,]+)\)\s*([0-9.]+)%?$", text)
    if full_match:
        return {
            "username": full_match.group(1).strip(),
            "feedback_count": int(full_match.group(2).replace(",", "")),
            "positive_percent": float(full_match.group(3)),
        }

    # Partial format: username (count) - no percent
    partial_match = re.match(r"^(.+?)\s*\(([0-9,]+)\)$", text)
    if partial_match:
        return {
            "username": partial_match.group(1).strip(),
            "feedback_count": int(partial_match.group(2).replace(",", "")),
            "positive_percent": None,
        }

    # Just username
    return {"username": text, "feedback_count": None, "positive_percent": None}
```

### CSS Selectors Reference (eBay Search Results)
```python
# Source: HasData eBay scraping guide + community testing
EBAY_SEARCH_SELECTORS = {
    # Container for each search result item
    "item_container": "li.s-item",

    # Within each item:
    "title": "div.s-item__title",
    "price": "span.s-item__price",
    "seller_info": "span.s-item__seller-info-text",
    "shipping": "span.s-item__logisticsCost",
    "item_link": "a.s-item__link",
    "listing_date": "span.s-item__listingDate",

    # Pagination
    "next_page": "a.pagination__next",
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| eBay Finding API | Browse API | Feb 2025 | Finding API deprecated/decommissioned |
| Post-fetch filtering | URL parameter filtering | Current | Fewer API calls, cleaner data |
| Client-side HTML parsing | Oxylabs parsing_instructions | Current | Server-side, handles JS rendering |
| Fetch all, dedupe after | Dedupe during collection | CONTEXT decision | Simpler architecture |

**Deprecated/outdated:**
- eBay Finding API was decommissioned February 5, 2025
- Raw HTML scraping without anti-bot handling (Oxylabs handles this)

## Open Questions

1. **Seller info availability in search results**
   - What we know: `span.s-item__seller-info-text` selector documented
   - What's unclear: Whether ALL search results include seller info (some may not)
   - Recommendation: Parse what's available, skip items without seller info

2. **eBay page structure stability**
   - What we know: eBay updates layouts periodically
   - What's unclear: How often selectors change
   - Recommendation: Log parsing failures, plan for selector updates

3. **Long product titles**
   - What we know: Use full Amazon title as query (CONTEXT decision)
   - What's unclear: Max URL length / query length for eBay
   - Recommendation: URL-encode properly, monitor for truncation issues

4. **Optimal pages per product**
   - What we know: CONTEXT says 2-3 pages (50-150 results)
   - What's unclear: Diminishing returns after page 1
   - Recommendation: Start with 3 pages, adjust based on new seller discovery rate

## Sources

### Primary (HIGH confidence)
- [Oxylabs eBay Documentation](https://developers.oxylabs.io/scraping-solutions/web-scraper-api/targets/ebay) - API sources, endpoint
- [Oxylabs eBay Data Scraping Guide](https://oxylabs.io/blog/ebay-data-scraping-guide) - Custom parsing instructions format
- [HasData eBay Scraping Guide](https://hasdata.com/blog/scrape-ebay-with-python) - CSS selectors for search results
- [SerpApi eBay Search API](https://serpapi.com/ebay-search-api) - URL parameters, response structure reference

### Secondary (MEDIUM confidence)
- [eBay Browse API Documentation](https://developer.ebay.com/api-docs/buy/browse/overview.html) - Filter parameter names
- [SearchAPI eBay Documentation](https://www.searchapi.io/docs/ebay-search-api) - URL parameter values

### Codebase (HIGH confidence)
- `apps/api/src/app/services/scrapers/base.py` - Existing AmazonScraperService pattern
- `apps/api/src/app/services/scrapers/oxylabs.py` - Existing Oxylabs implementation pattern
- `apps/api/src/app/services/collection.py` - CollectionService with seller methods
- `apps/api/migrations/037_collection_infrastructure.sql` - sellers table schema

## Metadata

**Confidence breakdown:**
- Oxylabs API integration: HIGH - Same pattern as Amazon, documented
- eBay URL filters: HIGH - Well-documented, community verified
- CSS selectors: MEDIUM - eBay can change layout, selectors verified as of 2025
- Seller info parsing: MEDIUM - Format variations exist, regex handles common cases

**Research date:** 2026-01-20
**Valid until:** 30 days (monitor for eBay layout changes)
