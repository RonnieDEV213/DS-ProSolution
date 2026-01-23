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
        category_name: str | None = None,
    ) -> ScrapeResult:
        """Fetch best sellers for a category from Oxylabs API."""
        # Build the Amazon bestsellers URL for logging
        amazon_url = f"https://www.amazon.com/gp/bestsellers/node/{category_node_id}"
        display_name = category_name or category_node_id
        print(f"\n{'='*60}")
        print(f"[AMAZON] Fetching: {display_name}")
        print(f"[AMAZON] URL: {amazon_url}")
        print(f"[AMAZON] Node ID: {category_node_id}, Page: {page}")

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
                print(f"[AMAZON] ⚠ Rate limited - waiting...")
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
                    # Debug: log raw price data for first product
                    if len(products) == 0:
                        print(f"[AMAZON] DEBUG - Raw product data sample:")
                        print(f"         price: {p.get('price')} (type: {type(p.get('price')).__name__})")
                        print(f"         price_strikethrough: {p.get('price_strikethrough')}")
                        print(f"         price_string: {p.get('price_string')}")
                        print(f"         currency: {p.get('currency')}")

                    # Price handling: Oxylabs may return price in cents or as float
                    raw_price = p.get("price")
                    if raw_price is not None:
                        # If price looks like it's in cents (> 100 and is an int), convert to dollars
                        if isinstance(raw_price, int) and raw_price > 100:
                            raw_price = raw_price / 100.0
                        # If it's a string, try to parse it
                        elif isinstance(raw_price, str):
                            raw_price = float(raw_price.replace("$", "").replace(",", ""))

                    product = AmazonProduct(
                        asin=p.get("asin", ""),
                        title=p.get("title", ""),
                        price=raw_price,
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
            print(f"[AMAZON] ✓ Found {len(products)} products")
            if products:
                print(f"[AMAZON] Sample products:")
                for p in products[:3]:  # Show first 3 products
                    price_str = f"${p.price:.2f}" if p.price else "N/A"
                    print(f"         - {p.title[:50]}... ({price_str})")

            return ScrapeResult(
                products=products,
                page=page,
                total_pages=None,  # Oxylabs doesn't report total pages
                error=None,
            )

        except httpx.TimeoutException:
            logger.error(f"Timeout fetching category {category_node_id}")
            print(f"[AMAZON] ✗ Timeout error")
            return ScrapeResult(
                products=[],
                page=page,
                total_pages=None,
                error="timeout",
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching category {category_node_id}: {e}")
            print(f"[AMAZON] ✗ HTTP error: {e.response.status_code}")
            return ScrapeResult(
                products=[],
                page=page,
                total_pages=None,
                error=f"http_error:{e.response.status_code}",
            )
        except Exception as e:
            logger.error(f"Unexpected error fetching category {category_node_id}: {e}")
            print(f"[AMAZON] ✗ Error: {e}")
            return ScrapeResult(
                products=[],
                page=page,
                total_pages=None,
                error=str(e),
            )
