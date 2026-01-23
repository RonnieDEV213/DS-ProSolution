"""Abstract base interface for eBay scraping services.

This module defines the contract for eBay seller search. The abstract
EbayScraperService class can be implemented by different backends (e.g.,
Oxylabs API, mock for testing).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EbaySeller:
    """Seller data from eBay search results."""

    username: str
    feedback_count: int | None
    positive_percent: float | None
    item_url: str


@dataclass
class EbaySearchResult:
    """Result from an eBay search operation."""

    sellers: list[EbaySeller]
    page: int
    has_more: bool
    error: str | None = None
    url: str | None = None  # The search URL used


class EbayScraperService(ABC):
    """Abstract interface for eBay scraping.

    Implementations:
    - OxylabsEbayScraper: Production implementation using Oxylabs Web Scraper API
    - MockEbayScraper: Testing implementation with static data
    """

    @abstractmethod
    async def search_sellers(
        self,
        query: str,
        amazon_price: float,
        page: int = 1,
    ) -> EbaySearchResult:
        """Search eBay for sellers matching dropshipper criteria.

        Filters applied:
        - Brand New condition (LH_ItemCondition=1000)
        - Free shipping (LH_Free=1)
        - US sellers only (LH_PrefLoc=1)
        - Price 80-120% MARKUP on amazon_price (_udlo/_udhi)
          Formula: ebay_price = amazon_price * (1 + markup%)
          80% markup:  amazon_price * 1.8 (e.g., $10 -> $18)
          120% markup: amazon_price * 2.2 (e.g., $10 -> $22)

        Args:
            query: Search term (Amazon product title)
            amazon_price: Reference price for markup calculation
            page: Page number to fetch (1-indexed)

        Returns:
            EbaySearchResult with extracted sellers and error info
        """
        pass
