# Feature Landscape: SellerCollection (v2)

**Domain:** Amazon-to-eBay dropshipper discovery tool
**Researched:** 2026-01-20
**Confidence:** HIGH (based on existing competitive tools and project requirements)

## Executive Summary

The seller collection domain is well-established with mature competitors (ZIK Analytics, Salefreaks, AutoDS, SuperDS). However, DS-ProSolution's use case is fundamentally different: **collect seller names only**, not build a full arbitrage/listing platform. This dramatically simplifies the feature set.

Most competitor features are irrelevant because:
1. We output to third-party software for analysis (not in-house)
2. We don't need pricing, profit margins, or listing automation
3. We want bulk seller discovery, not product-by-product analysis

**Key insight:** Competitors solve "find profitable products to list." We solve "find dropshippers to analyze elsewhere." Different problem = different features.

---

## Table Stakes

Features users expect. Missing = tool feels incomplete for the stated purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Amazon Best Sellers scraping** | Core input data source | Medium | Via Rainforest API per PROJECT.md |
| **Category/department selection** | Not all categories relevant | Low | UI dropdown or multi-select |
| **eBay search with filters** | Core matching logic | Medium | Brand New, free shipping, price range |
| **Price markup filter (80-120%)** | Identifies dropshipper pricing behavior | Low | Configurable percentage range |
| **Seller name extraction** | The actual output we need | Low | Parse from eBay search results |
| **Deduplication against existing DB** | Avoid re-processing known sellers | Low | Simple unique constraint check |
| **Progress indication** | Collections take time; users need feedback | Low | Progress bar or percentage |
| **Collection history/status** | Know what ran, when, and results | Low | Basic log of runs |
| **Export: JSON** | Standard machine-readable format | Low | Single button |
| **Export: CSV** | Spreadsheet-compatible | Low | Single button |
| **Export: Copy to clipboard** | Quick transfer to other tools | Low | Single button |
| **Error handling/retry** | API calls fail; need graceful recovery | Medium | Per-product retry, not full restart |
| **Admin-only access** | Per PROJECT.md constraints | Low | Already have RBAC |

### Why These Are Table Stakes

The current manual workflow (VA browses Amazon, searches eBay, collects names) defines the baseline. Automation must do at least what VAs do manually:
- Browse Amazon Best Sellers (category selection)
- Search on eBay with specific filters (Brand New, free shipping, price markup)
- Collect unique seller names (dedup)
- Export the list (for third-party software)

Anything less = tool doesn't replace manual work.

---

## Differentiators

Features that add value beyond the manual workflow. Nice to have but not required for MVP.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Scheduled collection** | Monthly recurring without manual trigger | Low | Cron job or Supabase scheduled function |
| **Multi-category batch** | Run all categories in one operation | Medium | Queue management |
| **Seller metadata capture** | Store feedback score, item count, join date | Low | Extra fields from eBay results |
| **Collection pause/resume** | Long-running jobs can be interrupted | Medium | Checkpoint state in DB |
| **Rate limit visualization** | Show API usage/remaining quota | Low | Display from API response headers |
| **Seller count estimates** | Preview expected results before running | Medium | Sample query first |
| **Email notification on complete** | Notify admin when background job finishes | Low | Integrate with existing notification system |
| **Result filtering/sorting** | Filter collected sellers by metadata | Low | UI table controls |
| **Seller tagging/notes** | Annotate sellers for later reference | Low | Extra DB fields |
| **Collection presets** | Save filter configurations for reuse | Medium | Preset management UI |

### Differentiator Prioritization

**High value, low effort (do in v2 if time):**
- Scheduled collection (explicitly in PROJECT.md as optional)
- Seller metadata capture (no extra API calls, just parse more fields)
- Result filtering/sorting (standard table features)

**Medium value, medium effort (defer to v2.1):**
- Multi-category batch
- Collection pause/resume
- Collection presets

**Low value (skip):**
- Email notifications (overkill for admin-only internal tool)
- Seller count estimates (just run it)

---

## Anti-Features

Features to explicitly NOT build in v2. Common mistakes or scope creep traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Profit margin calculator** | Output goes to third-party software that does this | Just collect seller names |
| **Product listing/import** | Separate project per PROJECT.md out-of-scope | Focus on discovery only |
| **Seller quality scoring** | Explicitly out of scope (reverse image search, hero detection, win rate) | Defer to future milestone |
| **Real-time price monitoring** | Out of scope; brute force monthly is sufficient | One-time collection per run |
| **VeRO database/protection** | We're not listing products, just collecting sellers | Not applicable |
| **eBay account integration** | We scrape public data via API | No auth needed |
| **Amazon account integration** | Same - public data only | No auth needed |
| **Custom proxy management** | Third-party APIs handle this per PROJECT.md | Use Rainforest/ScraperAPI |
| **Title optimization/SEO** | Not listing products | Not applicable |
| **Competitor analysis dashboard** | We output to external tools | Keep output simple |
| **Seller watchlist/tracking** | Overkill for one-time collection | Just re-run collection |
| **Mobile/responsive UI** | Desktop-first per PROJECT.md | Admin dashboard only |
| **VA access to SellerCollection** | Admin-only per PROJECT.md | RBAC exclusion |
| **Authenticated scraping** | Public data only per PROJECT.md | Third-party APIs only |

### Why These Are Anti-Features

**Scope creep from competitors:** Tools like ZIK Analytics and Salefreaks offer comprehensive arbitrage platforms. DS-ProSolution is NOT building that. Copying their feature set would:
1. Duplicate functionality that exists in third-party software you already use
2. Massively increase scope (v2 would take months instead of weeks)
3. Violate the explicit out-of-scope boundaries in PROJECT.md

**The principle:** We collect raw material (seller names). Third-party software refines it. Don't build the refinery.

---

## Feature Dependencies

```
Category Selection
    |
    v
Amazon Best Sellers Scrape (Rainforest API)
    |
    v
For each product:
    |
    +-> eBay Search with Filters (ScraperAPI)
    |       |
    |       v
    +-> Seller Name Extraction
            |
            v
        Deduplication Check
            |
            +-> New seller -> Store in DB
            |
            +-> Known seller -> Skip

Progress Tracking (parallel to data flow)
    |
    v
Collection Complete
    |
    v
Export Options (JSON/CSV/Clipboard)
```

### Critical Path

1. **API integrations first** - Cannot test anything without Rainforest and ScraperAPI working
2. **Data flow second** - Amazon -> eBay -> Seller extraction pipeline
3. **Storage third** - Dedup and persistence
4. **UI fourth** - Trigger, progress, results display
5. **Export fifth** - Output formats

---

## MVP Recommendation

For MVP, prioritize in this order:

### Must Ship (v2.0)

1. **Amazon Best Sellers scraping** - Core input
2. **Category selection UI** - Basic dropdown
3. **eBay search with filters** - Core matching
4. **Seller extraction and dedup** - Core output
5. **Basic progress display** - Percentage or count
6. **Collection trigger button** - Start the process
7. **Results table** - View collected sellers
8. **Export: JSON, CSV, clipboard** - Get data out

### Should Ship (v2.0 stretch)

9. **Scheduled collection** - Monthly cron
10. **Seller metadata** - Feedback score, item count (if available in API response)
11. **Collection history** - List of past runs

### Defer to v2.1

- Multi-category batch processing
- Pause/resume for long collections
- Collection presets
- Result filtering beyond basic table sort

### Never Build

- Anything in the Anti-Features list

---

## Competitive Landscape Reference

For context, here's what competitors offer (NOT recommendations to copy):

| Tool | Core Focus | Pricing | Relevant Learning |
|------|-----------|---------|-------------------|
| [ZIK Analytics](https://www.zikanalytics.com) | Full arbitrage platform | $19.90/mo | Competitor research feature shows seller analysis is complex |
| [Salefreaks](https://www.salefreaks.com) | Amazon-to-eBay scanning | Varies | Large VeRO database emphasizes compliance (not our problem) |
| [AutoDS](https://www.autods.com) | Listing automation | $19.90/mo | Full integration shows we're in different space |
| [Apify eBay Scraper](https://apify.com/parseforge/ebay-scraper) | Data extraction | Usage-based | Good reference for what data is extractable |

**Key takeaway:** These tools solve different problems. Don't feature-match; stay focused on seller collection.

---

## Sources

**Amazon-to-eBay Dropshipping Tools:**
- [ZIK Analytics - Best Amazon to eBay Dropshipping Software](https://www.zikanalytics.com/blog/best-amazon-to-ebay-dropshipping-software/)
- [AutoDS - Amazon to eBay Dropshipping](https://www.autods.com/ebay/suppliers/amazon-dropshipping/)
- [Salefreaks](https://www.salefreaks.com/)

**eBay Scraping Tools:**
- [Apify eBay Scraper](https://apify.com/parseforge/ebay-scraper)
- [Scrape.do - 2025 Guide to Scraping eBay](https://scrape.do/blog/ebay-scraping/)
- [Oxylabs - eBay Data Scraping Guide](https://oxylabs.io/blog/ebay-data-scraping-guide/)

**Amazon Best Sellers Scraping:**
- [Apify Amazon Bestsellers Scraper](https://apify.com/junglee/amazon-bestsellers)
- [Oxylabs - How to Scrape Amazon Best Sellers](https://oxylabs.io/blog/how-to-scrape-amazon-best-sellers)

**ZIK Analytics Features:**
- [ZIK Competitor Research Tool](https://www.zikanalytics.com/ebay/competitor-research)
- [ZIK Competitor Research Guide](https://help.zikanalytics.com/en/articles/7978193-competitor-research-guide)

**eBay Policy:**
- [eBay Dropshipping Policy](https://www.ebay.com/help/selling/posting-items/setting-postage-options/drop-shipping?id=4176)

**MVP Principles:**
- [Atlassian - Minimum Viable Product](https://www.atlassian.com/agile/product-management/minimum-viable-product)

---

*Confidence: HIGH - Features derived from explicit project requirements in PROJECT.md, validated against competitive landscape. Anti-features explicitly marked as out-of-scope in project documentation.*
