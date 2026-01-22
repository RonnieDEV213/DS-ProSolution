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
    ) -> str:
        """Build eBay search URL with dropshipper filters.

        Filters applied:
        - _nkw: search term (URL encoded)
        - LH_ItemCondition=1000: Brand New
        - LH_Free=1: Free shipping
        - LH_PrefLoc=1: US sellers only
        - _ipg=60: Items per page
        - _pgn: Page number
        """
        params = [
            f"_nkw={quote_plus(query)}",
            "LH_ItemCondition=1000",
            "LH_Free=1",
            "LH_PrefLoc=1",
            "_ipg=60",
            f"_pgn={page}",
        ]
        return f"https://www.ebay.com/sch/i.html?{'&'.join(params)}"

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
        url = self._build_search_url(query, amazon_price, page)

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
                return EbaySearchResult(
                    sellers=[],
                    page=page,
                    has_more=False,
                    error="rate_limited",
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

            return EbaySearchResult(
                sellers=sellers,
                page=page,
                has_more=has_more,
                error=None,
            )

        except httpx.TimeoutException:
            logger.error(f"Timeout on eBay search: {query[:50]}...")
            return EbaySearchResult(
                sellers=[],
                page=page,
                has_more=False,
                error="timeout",
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error on eBay search: {e}")
            return EbaySearchResult(
                sellers=[],
                page=page,
                has_more=False,
                error=f"http_error:{e.response.status_code}",
            )
        except Exception as e:
            logger.error(f"Unexpected error on eBay search: {type(e).__name__}: {e}")
            return EbaySearchResult(
                sellers=[],
                page=page,
                has_more=False,
                error=f"{type(e).__name__}: {e}",
            )
