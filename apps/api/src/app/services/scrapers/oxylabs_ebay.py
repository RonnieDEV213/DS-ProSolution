"""Oxylabs Web Scraper API implementation for eBay seller search.

Uses Oxylabs ebay source with custom parsing instructions to extract seller
data from filtered search results. Credentials: OXYLABS_USERNAME and
OXYLABS_PASSWORD environment variables.
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
        """Build eBay search URL with all dropshipper filters embedded.

        Filters applied:
        - _nkw: search term (URL encoded)
        - LH_ItemCondition=1000: Brand New (EBAY-02)
        - LH_Free=1: Free shipping (EBAY-03)
        - LH_PrefLoc=1: US sellers only (EBAY-05)
        - _udlo: Min price 80% of Amazon price (EBAY-04)
        - _udhi: Max price 120% of Amazon price (EBAY-04)
        - _ipg=60: Items per page
        - _pgn: Page number
        """
        min_price = int(amazon_price * 0.80)
        max_price = int(amazon_price * 1.20)

        params = [
            f"_nkw={quote_plus(query)}",
            "LH_ItemCondition=1000",  # Brand New
            "LH_Free=1",  # Free shipping
            "LH_PrefLoc=1",  # US only
            f"_udlo={min_price}",
            f"_udhi={max_price}",
            "_ipg=60",  # Items per page
            f"_pgn={page}",
        ]
        return f"https://www.ebay.com/sch/i.html?{'&'.join(params)}"

    def _parse_seller_info(self, seller_text: str | None) -> dict:
        """Parse eBay seller info string.

        Handles multiple formats:
        - Full: "username (1,234) 99.5%"
        - Partial: "username (1,234)"
        - Minimal: "username"

        Args:
            seller_text: Raw seller info string from eBay

        Returns:
            Dict with username, feedback_count, positive_percent
        """
        if not seller_text:
            return {"username": None, "feedback_count": None, "positive_percent": None}

        text = seller_text.strip()

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

        # Just username (no parentheses)
        return {"username": text, "feedback_count": None, "positive_percent": None}

    async def search_sellers(
        self,
        query: str,
        amazon_price: float,
        page: int = 1,
    ) -> EbaySearchResult:
        """Search eBay for sellers with dropshipper characteristics.

        Uses Oxylabs ebay source with a pre-filtered URL containing all
        dropshipper criteria. Custom parsing instructions extract seller
        info from search result items.

        Args:
            query: Search term (Amazon product title)
            amazon_price: Reference price for 80-120% filtering
            page: Page number (1-indexed)

        Returns:
            EbaySearchResult with extracted sellers, deduped within page
        """
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
                                {"_fn": "element_text"},
                            ]
                        },
                        "item_link": {
                            "_fns": [
                                {"_fn": "css_one", "_args": ["a.s-item__link"]},
                                {"_fn": "attribute", "_args": ["href"]},
                            ]
                        },
                    },
                },
                "has_next": {
                    "_fns": [
                        {"_fn": "css_one", "_args": ["a.pagination__next"]},
                        {"_fn": "exists"},
                    ]
                },
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    auth=(self.username, self.password),
                    timeout=30.0,
                )

            # Handle rate limiting
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

            # Parse response structure
            results = data.get("results", [])
            if not results:
                return EbaySearchResult(
                    sellers=[],
                    page=page,
                    has_more=False,
                    error="empty_response",
                )

            content = results[0].get("content", {})
            raw_items = content.get("items", [])
            has_more = content.get("has_next", False)

            # Extract unique sellers within this page
            sellers = []
            seen_usernames: set[str] = set()

            for item in raw_items:
                seller_data = self._parse_seller_info(item.get("seller_info"))
                username = seller_data.get("username")

                if username and username not in seen_usernames:
                    seen_usernames.add(username)
                    sellers.append(
                        EbaySeller(
                            username=username,
                            feedback_count=seller_data.get("feedback_count"),
                            positive_percent=seller_data.get("positive_percent"),
                            item_url=item.get("item_link", ""),
                        )
                    )

            logger.info(f"Found {len(sellers)} unique sellers from page {page}")

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
            logger.error(f"Unexpected error on eBay search: {e}")
            return EbaySearchResult(
                sellers=[],
                page=page,
                has_more=False,
                error=str(e),
            )
