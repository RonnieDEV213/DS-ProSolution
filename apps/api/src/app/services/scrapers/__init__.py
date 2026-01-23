"""Amazon and eBay scraper service interfaces and implementations.

Amazon scrapers:
- AmazonScraperService: Abstract interface for Amazon Best Sellers scraping
- OxylabsAmazonScraper: Production implementation using Oxylabs E-Commerce API

eBay scrapers:
- EbayScraperService: Abstract interface for eBay seller search
- OxylabsEbayScraper: Production implementation using Oxylabs Web Scraper API
"""

from .base import AmazonProduct, AmazonScraperService, ScrapeResult
from .ebay_base import EbaySeller, EbayScraperService, EbaySearchResult
from .oxylabs import OxylabsAmazonScraper
from .oxylabs_ebay import OxylabsEbayScraper

__all__ = [
    # Amazon
    "AmazonProduct",
    "ScrapeResult",
    "AmazonScraperService",
    "OxylabsAmazonScraper",
    # eBay
    "EbaySeller",
    "EbaySearchResult",
    "EbayScraperService",
    "OxylabsEbayScraper",
]
