# SellerCollection Pipeline Architecture

**Project:** DS-ProSolution v2 SellerCollection
**Researched:** 2026-01-20
**Confidence:** HIGH (builds on existing codebase patterns)

## Relation to EXISTING-ARCHITECTURE.md

The EXISTING-ARCHITECTURE.md documents two automation paradigms:

| Paradigm | Data Type | Infrastructure | Used For |
|----------|-----------|----------------|----------|
| **Centralized** | Public data | Third-party APIs on server | Product data, search results |
| **Distributed** | Private/authenticated data | PC agents with Playwright | Account dashboards, order automation |

**SellerCollection uses the Centralized paradigm exclusively:**
- All data is PUBLIC (Amazon Best Sellers, eBay search results)
- Uses third-party APIs (Rainforest, ScraperAPI)
- Runs entirely on FastAPI backend
- No browser automation, no account risk, no PC agents needed

This is the simplest architecture case from EXISTING-ARCHITECTURE.md:
```
CENTRALIZED (can run anywhere)
├── Public Data APIs
│   ├── Amazon Best Sellers (Rainforest API)
│   ├── eBay search results (ScraperAPI)
│   └── No account needed, can batch/parallelize
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SELLERCOLLECTION ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   FRONTEND (apps/web)                                                            │
│   ┌────────────────────────────────────────────────────────────────────────────┐ │
│   │  Admin UI                                                                  │ │
│   │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │ │
│   │  │ Collect Sellers  │  │ Collection       │  │ Seller List              │  │ │
│   │  │ Button           │  │ Progress         │  │ Table + Export           │  │ │
│   │  │                  │  │                  │  │                          │  │ │
│   │  │ • Start/Stop     │  │ • Phase display  │  │ • Filter/search          │  │ │
│   │  │ • Schedule       │  │ • Progress bar   │  │ • Export JSON/CSV        │  │ │
│   │  │                  │  │ • Error details  │  │ • Copy to clipboard      │  │ │
│   │  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │ │
│   └────────────────────────────────────────────────────────────────────────────┘ │
│                                          │                                       │
│                                          │ REST API                              │
│                                          ▼                                       │
│   BACKEND (apps/api)                                                             │
│   ┌────────────────────────────────────────────────────────────────────────────┐ │
│   │                                                                            │ │
│   │   Router                      Services                                     │ │
│   │   ┌──────────────────┐        ┌─────────────────────────────────────────┐  │ │
│   │   │ /collection      │───────▶│ CollectionService                       │  │ │
│   │   │                  │        │                                         │  │ │
│   │   │ POST /start      │        │ • orchestrate_collection()              │  │ │
│   │   │ POST /stop       │        │ • get_collection_status()               │  │ │
│   │   │ GET  /status     │        │ • stop_collection()                     │  │ │
│   │   │ GET  /sellers    │        │                                         │  │ │
│   │   └──────────────────┘        └───────────────┬─────────────────────────┘  │ │
│   │                                               │                            │ │
│   │                               ┌───────────────┴───────────────┐            │ │
│   │                               ▼                               ▼            │ │
│   │                    ┌────────────────────┐         ┌────────────────────┐   │ │
│   │                    │ AmazonService      │         │ EbayService        │   │ │
│   │                    │                    │         │                    │   │ │
│   │                    │ • get_bestsellers()│         │ • search_products()│   │ │
│   │                    │ • get_categories() │         │ • extract_sellers()│   │ │
│   │                    └─────────┬──────────┘         └─────────┬──────────┘   │ │
│   │                              │                              │              │ │
│   └──────────────────────────────┼──────────────────────────────┼──────────────┘ │
│                                  │                              │                │
│                                  ▼                              ▼                │
│   EXTERNAL APIs                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────────┐ │
│   │  ┌────────────────────────┐         ┌────────────────────────┐            │ │
│   │  │ Rainforest API         │         │ ScraperAPI             │            │ │
│   │  │                        │         │                        │            │ │
│   │  │ • Best Sellers         │         │ • eBay search          │            │ │
│   │  │ • Product details      │         │ • Seller extraction    │            │ │
│   │  │ • Categories           │         │                        │            │ │
│   │  └────────────────────────┘         └────────────────────────┘            │ │
│   └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│   DATABASE (Supabase)                                                            │
│   ┌────────────────────────────────────────────────────────────────────────────┐ │
│   │  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │ │
│   │  │ sellers            │  │ collection_runs    │  │ collection_items   │    │ │
│   │  │                    │  │                    │  │                    │    │ │
│   │  │ • name (unique)    │  │ • id               │  │ • run_id           │    │ │
│   │  │ • ebay_seller_id   │  │ • status           │  │ • product_title    │    │ │
│   │  │ • first_seen_at    │  │ • started_at       │  │ • amazon_asin      │    │ │
│   │  │ • last_seen_at     │  │ • completed_at     │  │ • seller_name      │    │ │
│   │  │ • collection_count │  │ • products_checked │  │ • ebay_price       │    │ │
│   │  │ • source_products  │  │ • sellers_found    │  │ • amazon_price     │    │ │
│   │  └────────────────────┘  │ • error_message    │  └────────────────────┘    │ │
│   │                          └────────────────────┘                            │ │
│   └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Dependencies | Communicates With |
|-----------|---------------|--------------|-------------------|
| **Admin UI** | Trigger collection, display progress, view/export sellers | Next.js, React | Backend API |
| **Collection Router** | HTTP endpoints for collection operations | FastAPI | CollectionService |
| **CollectionService** | Orchestrate pipeline, manage state, coordinate services | Supabase | AmazonService, EbayService |
| **AmazonService** | Fetch Best Sellers via Rainforest API | httpx | Rainforest API |
| **EbayService** | Search eBay via ScraperAPI, extract sellers | httpx | ScraperAPI |
| **Supabase** | Store sellers, runs, items; provide deduplication | PostgreSQL | - |

---

## Data Flow

### Collection Pipeline

```
PHASE 1: Fetch Amazon Best Sellers
────────────────────────────────────────────────────────────────────

    CollectionService                   AmazonService
    ┌─────────────────┐                 ┌─────────────────┐
    │ Start collection│────────────────▶│ get_bestsellers │
    │ Create run      │                 │                 │
    └─────────────────┘                 │ • Call Rainforest│
                                        │ • Parse response │
                                        │ • Return list    │
                                        └────────┬────────┘
                                                 │
                                                 ▼
                                        [Product titles, ASINs, prices]


PHASE 2: Search eBay for Each Product
────────────────────────────────────────────────────────────────────

    For each product:
    ┌─────────────────┐                 ┌─────────────────┐
    │ CollectionService│───────────────▶│ EbayService     │
    │                 │                 │                 │
    │ • Apply filters │                 │ • search_products│
    │   - Brand New   │                 │   via ScraperAPI│
    │   - Free ship   │                 │                 │
    │   - Price range │                 │ • extract_sellers│
    └─────────────────┘                 │   from results  │
                                        └────────┬────────┘
                                                 │
                                                 ▼
                                        [Seller names per product]


PHASE 3: Deduplicate and Store
────────────────────────────────────────────────────────────────────

    CollectionService                   Supabase
    ┌─────────────────┐                 ┌─────────────────┐
    │ For each seller │────────────────▶│ UPSERT seller   │
    │                 │                 │                 │
    │ • Normalize name│                 │ • If exists:    │
    │ • Check exists  │                 │   update count  │
    │ • Store metadata│                 │   update seen_at│
    │                 │                 │ • If new:       │
    │                 │                 │   insert record │
    └─────────────────┘                 └─────────────────┘
```

### Filter Logic (eBay Search)

```
Amazon Product: "Apple AirPods Pro 2" @ $249.00

eBay Search Query:
┌─────────────────────────────────────────────────────────────────┐
│ query:     "Apple AirPods Pro 2"                                │
│ condition: Brand New                                            │
│ shipping:  Free                                                 │
│ price_min: $199.20 (Amazon price * 0.80)                        │
│ price_max: $298.80 (Amazon price * 1.20)                        │
│ sort:      Best Match                                           │
│ limit:     50 results                                           │
└─────────────────────────────────────────────────────────────────┘

Results → Extract seller names from each listing
```

---

## Database Schema

### Table: `sellers`

Primary table for collected seller data.

```sql
CREATE TABLE sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id),

    -- Seller identity (normalized for dedup)
    seller_name TEXT NOT NULL,
    seller_name_normalized TEXT NOT NULL,  -- lowercase, trimmed
    ebay_seller_id TEXT,  -- if available from API

    -- Metadata
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    collection_count INT NOT NULL DEFAULT 1,

    -- Source tracking
    source_products JSONB DEFAULT '[]',  -- [{asin, title, run_id}]

    -- Constraints
    UNIQUE (org_id, seller_name_normalized),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sellers_org ON sellers(org_id);
CREATE INDEX idx_sellers_name ON sellers(seller_name_normalized);
CREATE INDEX idx_sellers_last_seen ON sellers(last_seen_at DESC);
```

### Table: `collection_runs`

Tracks collection job executions.

```sql
CREATE TABLE collection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES orgs(id),

    -- Status
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, stopped

    -- Progress
    phase TEXT,  -- 'amazon_fetch', 'ebay_search', 'storing'
    phase_progress INT DEFAULT 0,
    phase_total INT DEFAULT 0,

    -- Results
    products_checked INT DEFAULT 0,
    sellers_found INT DEFAULT 0,
    new_sellers INT DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error handling
    error_message TEXT,
    error_details JSONB,

    -- Scheduling
    scheduled_by UUID REFERENCES auth.users(id),
    is_scheduled BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Table: `collection_items`

Detailed record of each product-seller pair found (for debugging/audit).

```sql
CREATE TABLE collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES collection_runs(id) ON DELETE CASCADE,

    -- Amazon source
    amazon_asin TEXT NOT NULL,
    product_title TEXT NOT NULL,
    amazon_price_cents INT,
    amazon_category TEXT,

    -- eBay result
    seller_name TEXT NOT NULL,
    ebay_item_id TEXT,
    ebay_price_cents INT,
    ebay_listing_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for run lookup
CREATE INDEX idx_collection_items_run ON collection_items(run_id);
```

---

## Service Layer Design

Following the existing pattern in `apps/api/src/app/services/`:

### File Structure

```
apps/api/src/app/
├── routers/
│   └── collection.py       # HTTP endpoints
├── services/
│   ├── collection.py       # Orchestration logic
│   ├── amazon_api.py       # Rainforest API client
│   └── ebay_api.py         # ScraperAPI client for eBay
└── models.py               # Add collection models
```

### CollectionService Interface

```python
# apps/api/src/app/services/collection.py

class CollectionService:
    """Orchestrates seller collection pipeline."""

    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.amazon = AmazonApiService()
        self.ebay = EbayApiService()

    async def start_collection(
        self,
        org_id: str,
        user_id: str,
        categories: list[str] | None = None
    ) -> str:
        """
        Start a new collection run.

        Returns: run_id
        """
        pass

    async def get_status(self, run_id: str) -> CollectionStatus:
        """Get current status of a collection run."""
        pass

    async def stop_collection(self, run_id: str) -> bool:
        """Stop a running collection."""
        pass

    async def get_sellers(
        self,
        org_id: str,
        limit: int = 100,
        offset: int = 0,
        search: str | None = None
    ) -> SellerListResponse:
        """Get collected sellers with pagination and search."""
        pass
```

### AmazonApiService Interface

```python
# apps/api/src/app/services/amazon_api.py

class AmazonApiService:
    """Rainforest API client for Amazon data."""

    async def get_bestsellers(
        self,
        category: str | None = None,
        page: int = 1
    ) -> list[AmazonProduct]:
        """
        Fetch Amazon Best Sellers.

        Returns list of products with:
        - asin
        - title
        - price_cents
        - category
        - rank
        """
        pass

    async def get_categories(self) -> list[AmazonCategory]:
        """Get available Best Seller categories."""
        pass
```

### EbayApiService Interface

```python
# apps/api/src/app/services/ebay_api.py

class EbayApiService:
    """ScraperAPI client for eBay search."""

    async def search_products(
        self,
        query: str,
        price_min_cents: int | None = None,
        price_max_cents: int | None = None,
        condition: str = "Brand New",
        free_shipping: bool = True,
        limit: int = 50
    ) -> list[EbayListing]:
        """
        Search eBay for products matching criteria.

        Returns list of listings with:
        - item_id
        - title
        - price_cents
        - seller_name
        - listing_url
        """
        pass

    def extract_seller_names(
        self,
        listings: list[EbayListing]
    ) -> list[str]:
        """Extract unique seller names from listings."""
        pass
```

---

## Background Processing

### Pattern: Async Background Task

Following the existing pattern in `apps/api/src/app/background.py`:

```python
# In background.py or new collection_worker.py

async def collection_worker(run_id: str, org_id: str):
    """
    Background worker for a single collection run.

    Called via asyncio.create_task() when collection starts.
    Updates collection_runs table with progress.
    """
    service = CollectionService(get_supabase())

    try:
        # Phase 1: Fetch Amazon Best Sellers
        await service.update_phase(run_id, "amazon_fetch")
        products = await service.amazon.get_bestsellers()

        # Phase 2: Search eBay for each product
        await service.update_phase(run_id, "ebay_search", total=len(products))

        for i, product in enumerate(products):
            # Check for stop signal
            if await service.is_stopped(run_id):
                break

            # Search eBay with filters
            listings = await service.ebay.search_products(
                query=product.title,
                price_min_cents=int(product.price_cents * 0.80),
                price_max_cents=int(product.price_cents * 1.20),
            )

            # Extract and store sellers
            sellers = service.ebay.extract_seller_names(listings)
            await service.store_sellers(run_id, product, sellers)

            # Update progress
            await service.update_progress(run_id, i + 1)

            # Rate limiting (be nice to APIs)
            await asyncio.sleep(0.5)

        # Mark complete
        await service.complete_run(run_id)

    except Exception as e:
        await service.fail_run(run_id, str(e))
        raise
```

### Stop Signal Pattern

```python
# Check for stop signal (stored in collection_runs.status)
async def is_stopped(self, run_id: str) -> bool:
    result = self.supabase.table("collection_runs")\
        .select("status")\
        .eq("id", run_id)\
        .single()\
        .execute()
    return result.data["status"] == "stopping"
```

---

## API Endpoints

### Router: `/api/collection`

```python
# apps/api/src/app/routers/collection.py

router = APIRouter(prefix="/collection", tags=["collection"])

@router.post("/start", response_model=CollectionStartResponse)
async def start_collection(
    body: CollectionStartRequest,
    user: dict = Depends(require_permission_key("admin.*")),
):
    """
    Start a new seller collection run.

    Admin-only. Creates background task.
    """
    pass

@router.post("/stop/{run_id}")
async def stop_collection(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.*")),
):
    """
    Stop a running collection.

    Sets status to 'stopping', worker checks and exits.
    """
    pass

@router.get("/status/{run_id}", response_model=CollectionStatus)
async def get_collection_status(
    run_id: str,
    user: dict = Depends(require_permission_key("admin.*")),
):
    """Get current status and progress of a collection run."""
    pass

@router.get("/runs", response_model=CollectionRunListResponse)
async def list_collection_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_permission_key("admin.*")),
):
    """List past collection runs with pagination."""
    pass

@router.get("/sellers", response_model=SellerListResponse)
async def list_sellers(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_permission_key("admin.*")),
):
    """List collected sellers with search and pagination."""
    pass

@router.get("/sellers/export")
async def export_sellers(
    format: str = Query("json", regex="^(json|csv)$"),
    user: dict = Depends(require_permission_key("admin.*")),
):
    """Export all sellers as JSON or CSV."""
    pass
```

---

## Frontend Components

### Page Structure

```
apps/web/src/app/admin/collection/
├── page.tsx              # Main collection page
└── components/
    ├── start-collection.tsx    # Start button + options
    ├── collection-progress.tsx # Progress display
    ├── sellers-table.tsx       # Seller list + export
    └── collection-history.tsx  # Past runs list
```

### Component Hierarchy

```
CollectionPage
├── StartCollectionCard
│   ├── Start Button
│   └── Category Select (optional)
├── CollectionProgressCard (shown when running)
│   ├── Phase Indicator
│   ├── Progress Bar
│   └── Stop Button
├── SellersTable
│   ├── Search Input
│   ├── Table (name, first_seen, last_seen, count)
│   ├── Pagination
│   └── Export Buttons (JSON, CSV, Copy)
└── CollectionHistoryCard
    └── Past Runs List
```

---

## Integration Points

### With Existing Codebase

| Integration | How | File |
|-------------|-----|------|
| **Auth** | Use existing `require_permission_key()` | `apps/api/src/app/auth.py` |
| **Database** | Use existing `get_supabase()` | `apps/api/src/app/database.py` |
| **Router mounting** | Add to `main.py` router list | `apps/api/src/app/main.py` |
| **Background tasks** | Follow `cleanup_worker()` pattern | `apps/api/src/app/background.py` |
| **API client** | Use existing pattern from `apps/web/src/lib/api.ts` | - |

### New Dependencies

| Dependency | Purpose | Install |
|------------|---------|---------|
| None | Uses existing `httpx` for API calls | Already installed |

### Environment Variables

```bash
# Add to apps/api/.env
RAINFOREST_API_KEY=your_key_here
SCRAPERAPI_KEY=your_key_here
```

---

## Suggested Build Order

Based on dependencies between components:

```
PHASE 1: Foundation (no external deps)
────────────────────────────────────────
1.1 Database migrations (sellers, collection_runs, collection_items)
1.2 Pydantic models for collection data
1.3 Collection router skeleton (endpoints without logic)

    Delivers: Schema, types, API structure
    Blocked by: Nothing
    Blocks: Everything else


PHASE 2: External API Integration
────────────────────────────────────────
2.1 AmazonApiService (Rainforest client)
    - get_bestsellers()
    - get_categories()
    - Unit tests with mocked responses

2.2 EbayApiService (ScraperAPI client)
    - search_products()
    - extract_seller_names()
    - Unit tests with mocked responses

    Delivers: Working API clients
    Blocked by: Phase 1.2 (models)
    Blocks: Phase 3


PHASE 3: Collection Orchestration
────────────────────────────────────────
3.1 CollectionService
    - start_collection() - creates run, spawns worker
    - get_status() - reads from collection_runs
    - stop_collection() - sets stopping flag
    - store_sellers() - upsert logic with dedup

3.2 Background worker
    - collection_worker() async task
    - Progress updates
    - Stop signal handling

    Delivers: Complete backend pipeline
    Blocked by: Phase 2 (API services)
    Blocks: Phase 4


PHASE 4: Frontend UI
────────────────────────────────────────
4.1 Collection page layout
4.2 Start collection button + API call
4.3 Progress display (polling collection status)
4.4 Sellers table with pagination
4.5 Export functionality (JSON, CSV, clipboard)
4.6 Collection history (past runs)

    Delivers: Complete feature
    Blocked by: Phase 3 (backend endpoints)
    Blocks: Nothing


OPTIONAL: Scheduling
────────────────────────────────────────
5.1 Scheduled collection (cron-like)
5.2 Schedule UI in admin settings

    Delivers: Automated monthly runs
    Blocked by: Phase 4
    Blocks: Nothing (optional enhancement)
```

---

## Error Handling

### API Errors

```python
class CollectionError(Exception):
    """Base exception for collection errors."""
    pass

class AmazonApiError(CollectionError):
    """Rainforest API error."""
    pass

class EbayApiError(CollectionError):
    """ScraperAPI error."""
    pass

class CollectionStoppedError(CollectionError):
    """Collection was stopped by user."""
    pass
```

### Error Storage

Collection errors are stored in `collection_runs.error_message` and `error_details`:

```json
{
  "error_message": "Rainforest API rate limit exceeded",
  "error_details": {
    "phase": "amazon_fetch",
    "progress": 45,
    "api_response": {
      "status_code": 429,
      "message": "Rate limit exceeded"
    }
  }
}
```

### Retry Logic

- **API rate limits:** Exponential backoff (1s, 2s, 4s, max 3 retries)
- **Network errors:** Retry once after 5 seconds
- **Validation errors:** Fail immediately, log and skip item

---

## Rate Limiting

### API Quotas

| API | Estimated Quota | Collection Impact |
|-----|-----------------|-------------------|
| Rainforest | 100 req/min | ~100 products/min |
| ScraperAPI | 1000 req/month (starter) | ~1000 products/month |

### Internal Rate Limiting

```python
# In collection_worker

# Delay between eBay searches (500ms)
await asyncio.sleep(0.5)

# Delay between Rainforest pages (1s)
await asyncio.sleep(1.0)
```

---

## Scalability Considerations

| Concern | At 100 products | At 1K products | At 10K products |
|---------|----------------|----------------|-----------------|
| **Runtime** | ~1 minute | ~10 minutes | ~100 minutes |
| **API cost** | $0.10-1.00 | $1-10 | $10-100 |
| **DB rows** | ~500 sellers | ~5K sellers | ~50K sellers |
| **Memory** | Minimal | Minimal | Minimal (streaming) |

### For Large Scale (Future)

- Batch API calls where possible
- Paginate large result sets
- Consider job queue (Redis) for distributed processing
- API caching layer for repeated searches

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| API key exposure | Store in env vars, never in code |
| Admin-only access | `require_permission_key("admin.*")` on all endpoints |
| Rate limit abuse | Backend enforces delays, no client bypass |
| Data privacy | Seller names are public data, no PII |

---

## Monitoring

### Metrics to Track

- Collection runs per day/week
- Average collection duration
- Sellers found per run
- New vs. duplicate seller ratio
- API error rate

### Logging

```python
logger.info(f"Collection {run_id} started")
logger.info(f"Collection {run_id} phase: {phase} ({progress}/{total})")
logger.warning(f"Collection {run_id} API error: {error}")
logger.info(f"Collection {run_id} completed: {sellers_found} sellers, {new_sellers} new")
```

---

## Sources

- EXISTING-ARCHITECTURE.md (project scraping architecture)
- apps/api/src/app/background.py (existing background worker pattern)
- apps/api/src/app/routers/automation.py (existing service pattern)
- apps/api/src/app/services/access_code.py (existing service pattern)
- PROJECT.md (v2 requirements)

---

*Architecture research for: v2 SellerCollection Pipeline*
*Researched: 2026-01-20*
