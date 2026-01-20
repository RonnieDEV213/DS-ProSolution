"""Abstract base interface for Amazon scraping services.

This module defines the contract for Amazon product scraping. The abstract
AmazonScraperService class can be implemented by different backends (e.g.,
Oxylabs API, custom proxies, mock for testing).
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


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
    page: int
    total_pages: int | None
    error: str | None = None


class AmazonScraperService(ABC):
    """Abstract interface for Amazon scraping.

    Implementations:
    - OxylabsAmazonScraper: Production implementation using Oxylabs E-Commerce API
    - MockAmazonScraper: Testing implementation with static data
    """

    @abstractmethod
    async def fetch_bestsellers(
        self,
        category_node_id: str,
        page: int = 1,
    ) -> ScrapeResult:
        """Fetch best sellers for a category.

        Args:
            category_node_id: Amazon browse node ID for the category
            page: Page number to fetch (1-indexed)

        Returns:
            ScrapeResult with products and error info
        """
        pass

    def get_categories(self) -> list[dict]:
        """Get available Amazon categories from static JSON file.

        Returns:
            List of department dicts, each containing:
            - id: Department identifier
            - name: Display name
            - node_id: Amazon browse node ID
            - categories: List of subcategory dicts
        """
        categories_path = Path(__file__).parent.parent.parent / "data" / "amazon_categories.json"
        with open(categories_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data["departments"]
