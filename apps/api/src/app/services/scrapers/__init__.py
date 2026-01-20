"""Amazon scraper service interfaces and implementations."""

from .base import AmazonProduct, AmazonScraperService, ScrapeResult
from .oxylabs import OxylabsAmazonScraper

__all__ = [
    "AmazonProduct",
    "ScrapeResult",
    "AmazonScraperService",
    "OxylabsAmazonScraper",
]
