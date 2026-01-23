# Phase 7: Amazon Best Sellers - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can fetch products from Amazon Best Sellers with category selection. Includes viewing Amazon departments/categories with checkboxes, using presets (Select All, custom saved presets), and fetching product titles and prices from selected categories via Oxylabs E-Commerce Scraper API.

</domain>

<decisions>
## Implementation Decisions

### Category Selection UI
- List organized by **department headers** with **category sublists** beneath each
  - Amazon structure: Departments (e.g., Appliances) → Categories (e.g., Cooktops, Dishwashers)
- Clicking department header **toggles all children**, but individual categories can also be toggled independently
- **Search box at top** to filter categories (matches category names, hides non-matching departments)
- **Checkboxes + selection count badge** (e.g., "12 selected") — no chips/tags

### Preset System
- **Dropdown above category list** to select presets
- Two built-in presets: "Select All" and saved custom presets (NO "Top 10" preset)
- **Auto-save with edit** — current selection is a working preset that can be named and saved
- **Delete option in dropdown** — each custom preset shows delete icon to remove it

### Product Display
- **No product preview** — products are internal data for eBay search
- Just show progress during fetch (X/Y products fetched)
- **Warning inline** if a category returns zero products (mark with warning icon after fetch)

### API Interaction
- Use **Oxylabs E-Commerce Scraper API** (not proxies + custom scraper)
  - $49/month Micro plan, 17,500-98,000 results depending on targets
  - Returns structured JSON (no custom parsing needed)
- **Show throttle status** when rate limited: "Waiting X seconds before next request..."
- **Show running API cost** during fetch: "API cost so far: $X.XX"
- Error handling:
  - Retry failed category 3x, then skip
  - If **multiple consecutive failures**, pause collection and notify user (Claude decides notification method)
- **Credentials in environment variables only** (not configurable from UI)

### Architecture
- **Service interface pattern** for scraping layer
  - Abstract interface (e.g., `AmazonScraperService`) with methods like `fetch_bestsellers(category)`
  - Current implementation uses Oxylabs E-Commerce API
  - Later can swap to proxies + custom scraper without rewriting UI/business logic

### Claude's Discretion
- Progress detail level (simple bar vs category-by-category)
- Whether to show breakdown table of products per category after fetch
- How to notify user when multiple consecutive failures occur (toast, popup, inline label)
- Exact throttle/waiting message styling

</decisions>

<specifics>
## Specific Ideas

- Amazon structure is Departments → Categories (not generic "categories/subcategories")
- Design for future swap-ability: Oxylabs API now, could switch to proxies + 2captcha later

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-amazon-best-sellers*
*Context gathered: 2026-01-20*
