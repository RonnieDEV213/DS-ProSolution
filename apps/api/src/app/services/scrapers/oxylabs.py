"""Oxylabs E-Commerce Scraper API implementation.

Uses Oxylabs amazon_bestsellers source to fetch structured product data.
Credentials: OXYLABS_USERNAME and OXYLABS_PASSWORD environment variables.
"""

import logging
import os

import httpx

from .base import AmazonProduct, AmazonScraperService, ScrapeResult

logger = logging.getLogger(__name__)


class OxylabsAmazonScraper(AmazonScraperService):
    """Oxylabs E-Commerce API implementation for Amazon Best Sellers."""

    def __init__(self):
        self.username = os.environ.get("OXYLABS_USERNAME")
        self.password = os.environ.get("OXYLABS_PASSWORD")
        self.base_url = "https://realtime.oxylabs.io/v1/queries"

        if not self.username or not self.password:
            raise ValueError("OXYLABS_USERNAME and OXYLABS_PASSWORD environment variables required")

    async def fetch_bestsellers(
        self,
        category_node_id: str,
        page: int = 1,
    ) -> ScrapeResult:
        """Fetch best sellers for a category from Oxylabs API."""
        payload = {
            "source": "amazon_bestsellers",
            "domain": "com",
            "query": category_node_id,
            "parse": True,
            "start_page": page,
            "pages": 1,
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
                logger.warning(f"Rate limited on category {category_node_id}")
                return ScrapeResult(
                    products=[],
                    page=page,
                    total_pages=None,
                    error="rate_limited",
                )

            response.raise_for_status()
            data = response.json()

            # Parse response structure
            results = data.get("results", [])
            if not results:
                return ScrapeResult(
                    products=[],
                    page=page,
                    total_pages=None,
                    error="empty_response",
                )

            content = results[0].get("content", {})
            raw_products = content.get("results", [])

            # Parse products
            products = []
            for p in raw_products:
                try:
                    product = AmazonProduct(
                        asin=p.get("asin", ""),
                        title=p.get("title", ""),
                        price=p.get("price"),
                        currency=p.get("currency", "USD"),
                        rating=p.get("rating"),
                        url=p.get("url", ""),
                        position=p.get("pos", 0),
                    )
                    products.append(product)
                except Exception as e:
                    logger.warning(f"Failed to parse product: {e}")
                    continue

            logger.info(f"Fetched {len(products)} products from category {category_node_id}")

            return ScrapeResult(
                products=products,
                page=page,
                total_pages=None,  # Oxylabs doesn't report total pages
                error=None,
            )

        except httpx.TimeoutException:
            logger.error(f"Timeout fetching category {category_node_id}")
            return ScrapeResult(
                products=[],
                page=page,
                total_pages=None,
                error="timeout",
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching category {category_node_id}: {e}")
            return ScrapeResult(
                products=[],
                page=page,
                total_pages=None,
                error=f"http_error:{e.response.status_code}",
            )
        except Exception as e:
            logger.error(f"Unexpected error fetching category {category_node_id}: {e}")
            return ScrapeResult(
                products=[],
                page=page,
                total_pages=None,
                error=str(e),
            )
