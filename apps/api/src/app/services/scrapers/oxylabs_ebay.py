"""Oxylabs Web Scraper API implementation for eBay seller search.

Uses Oxylabs universal_ecommerce source to fetch eBay search results and extract
seller data from the HTML. Credentials: OXYLABS_USERNAME and OXYLABS_PASSWORD
environment variables.
"""

import logging
import os
import re
from urllib.parse import quote_plus

import httpx

from .ebay_base import EbaySeller, EbayScraperService, EbaySearchResult

logger = logging.getLogger(__name__)


class OxylabsEbayScraper(EbayScraperService):
    """Oxylabs Web Scraper API implementation for eBay seller search."""

    def __init__(self):
        self.username = os.environ.get("OXYLABS_USERNAME")
        self.password = os.environ.get("OXYLABS_PASSWORD")
        self.base_url = "https://realtime.oxylabs.io/v1/queries"

        if not self.username or not self.password:
            raise ValueError(
                "OXYLABS_USERNAME and OXYLABS_PASSWORD environment variables required"
            )

    def _build_search_url(
        self,
        query: str,
        amazon_price: float,
        page: int,
    ) -> tuple[str, dict]:
        """Build eBay search URL with dropshipper filters.

        Filters applied:
        - _nkw: search term (URL encoded)
        - LH_ItemCondition=1000: Brand New
        - LH_Free=1: Free shipping
        - LH_PrefLoc=1: US sellers only
        - _udlo: Min price (80% of Amazon price)
        - _udhi: Max price (120% of Amazon price)
        - _ipg=60: Items per page
        - _pgn: Page number

        Returns:
            tuple of (url, params_dict for logging)
        """
        # Price range: 80-120% of Amazon price (dropshipper markup range)
        min_price = round(amazon_price * 0.8, 2)
        max_price = round(amazon_price * 1.2, 2)

        params = [
            f"_nkw={quote_plus(query)}",
            "LH_ItemCondition=1000",  # Brand New
            "LH_Free=1",              # Free Shipping
            "LH_PrefLoc=1",           # US Only
            f"_udlo={min_price}",     # Min price
            f"_udhi={max_price}",     # Max price
            "_ipg=60",                # Items per page
            f"_pgn={page}",           # Page number
        ]

        params_dict = {
            "query": query,
            "condition": "Brand New",
            "free_shipping": True,
            "us_only": True,
            "price_min": min_price,
            "price_max": max_price,
            "items_per_page": 60,
            "page": page,
        }

        return f"https://www.ebay.com/sch/i.html?{'&'.join(params)}", params_dict

    async def search_sellers(
        self,
        query: str,
        amazon_price: float,
        page: int = 1,
    ) -> EbaySearchResult:
        """Search eBay for sellers listing products matching the query.

        Uses Oxylabs universal_ecommerce source with rendered HTML to extract
        seller names from eBay's card structure.

        Args:
            query: Search term (Amazon product title)
            amazon_price: Reference price (currently unused)
            page: Page number (1-indexed)

        Returns:
            EbaySearchResult with extracted sellers, deduped within page
        """
        url, params = self._build_search_url(query, amazon_price, page)

        # Log the search with all parameters
        truncated_query = query[:60] + "..." if len(query) > 60 else query
        print(f"\n{'-'*60}")
        print(f"[EBAY] Searching: \"{truncated_query}\"")
        print(f"[EBAY] Parameters:")
        print(f"       Condition: {params['condition']}")
        print(f"       Free Shipping: {params['free_shipping']}")
        print(f"       US Only: {params['us_only']}")
        print(f"       Price Range: ${params['price_min']:.2f} - ${params['price_max']:.2f}")
        print(f"       Page: {params['page']}, Items/Page: {params['items_per_page']}")
        print(f"[EBAY] URL: {url[:100]}...")

        payload = {
            "source": "universal_ecommerce",
            "url": url,
            "geo_location": "United States",
            "user_agent_type": "desktop",
            "render": "html",
            "browser_instructions": [
                {"type": "wait", "wait_time_s": 5},
            ],
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    auth=(self.username, self.password),
                    timeout=90.0,
                )

            if response.status_code == 429:
                logger.warning(f"Rate limited on eBay search: {query[:50]}...")
                print(f"[EBAY] ⚠ Rate limited - waiting...")
                return EbaySearchResult(
                    sellers=[],
                    page=page,
                    has_more=False,
                    error="rate_limited",
                    url=url,
                )

            response.raise_for_status()
            data = response.json()

            results = data.get("results", [])
            if not results:
                return EbaySearchResult(
                    sellers=[],
                    page=page,
                    has_more=False,
                    error="empty_response",
                    url=url,
                )

            content = results[0].get("content", "")
            if not isinstance(content, str):
                content = str(content)

            # PRIMARY: Extract from eBay's card structure (current format)
            # <div class="s-card__attribute-row">
            #   <span>sellername </span>
            #   <span>99.6% positive (785)</span>
            # </div>
            card_matches = re.findall(
                r's-card__attribute-row"[^>]*>\s*<span[^>]*>([^<]+)</span>\s*<span[^>]*>([^<]*positive[^<]*)</span>',
                content
            )

            # FALLBACK: Generic pattern for "username" followed by "XX.X% positive"
            # Works if eBay changes class names but keeps the same text structure
            if not card_matches:
                # Look for: >username</span> ... >XX.X% positive</span>
                # Constrained: username must look valid (no spaces, 3-25 chars, starts with letter)
                fallback_matches = re.findall(
                    r'>([a-zA-Z][a-zA-Z0-9_\-\.]{2,24})\s*</span>[^>]{0,200}>(\d{1,3}(?:\.\d)?\s*%\s*positive[^<]*)</span>',
                    content
                )
                if fallback_matches:
                    logger.info(f"Using fallback pattern, found {len(fallback_matches)} matches")
                    card_matches = fallback_matches

            sellers = []
            seen_usernames: set[str] = set()
            skip_names = {'myebay', 'savedsellers', 'watchlist', 'purchase-history', 'signin'}

            for seller_name, feedback_str in card_matches:
                seller_name = seller_name.strip()

                if not seller_name or len(seller_name) < 2:
                    continue
                if seller_name.lower() in skip_names:
                    continue
                if seller_name in seen_usernames:
                    continue
                if ' ' in seller_name or seller_name.startswith('$'):
                    continue

                seen_usernames.add(seller_name)

                feedback_percent = None
                percent_match = re.search(r'(\d+\.?\d*)%', feedback_str)
                if percent_match:
                    try:
                        feedback_percent = float(percent_match.group(1))
                    except ValueError:
                        pass

                sellers.append(
                    EbaySeller(
                        username=seller_name,
                        feedback_count=None,
                        positive_percent=feedback_percent,
                        item_url=f"https://www.ebay.com/usr/{seller_name}",
                    )
                )

            has_more = "pagination__next" in content

            logger.info(f"eBay search found {len(sellers)} sellers for: {query[:50]}...")
            print(f"[EBAY] ✓ Found {len(sellers)} sellers")
            if sellers:
                print(f"[EBAY] Sellers: {', '.join(s.username for s in sellers[:5])}" +
                      (f" (+{len(sellers)-5} more)" if len(sellers) > 5 else ""))
            if has_more:
                print(f"[EBAY] More pages available")

            return EbaySearchResult(
                sellers=sellers,
                page=page,
                has_more=has_more,
                error=None,
                url=url,
            )

        except httpx.TimeoutException:
            logger.error(f"Timeout on eBay search: {query[:50]}...")
            print(f"[EBAY] ✗ Timeout error")
            return EbaySearchResult(
                sellers=[],
                page=page,
                has_more=False,
                error="timeout",
                url=url,
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error on eBay search: {e}")
            print(f"[EBAY] ✗ HTTP error: {e.response.status_code}")
            return EbaySearchResult(
                sellers=[],
                page=page,
                has_more=False,
                error=f"http_error:{e.response.status_code}",
                url=url,
            )
        except Exception as e:
            logger.error(f"Unexpected error on eBay search: {type(e).__name__}: {e}")
            print(f"[EBAY] ✗ Error: {e}")
            return EbaySearchResult(
                sellers=[],
                page=page,
                has_more=False,
                error=f"{type(e).__name__}: {e}",
                url=url,
            )
