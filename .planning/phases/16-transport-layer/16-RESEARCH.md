# Phase 16: Transport Layer - Research

**Researched:** 2026-01-23
**Domain:** FastAPI cursor-based pagination with server-side filtering and sorting
**Confidence:** HIGH

## Summary

Phase 16 builds API endpoints that support cursor-based pagination with server-side filtering and sorting for syncable tables (bookkeeping_records, accounts, sellers). This phase leverages the composite indexes created in Phase 15 (`account_id, updated_at DESC, id DESC`) to provide efficient O(log n) pagination regardless of page depth.

The codebase already uses offset-based pagination (page/page_size pattern) in endpoints like `/admin/users` and `/sellers`. This phase introduces cursor-based pagination as a parallel pattern specifically for sync-capable endpoints. The cursor encodes the last-seen `(updated_at, id)` tuple as a base64-encoded JSON string, enabling clients to resume pagination from any position without performance degradation.

**Primary recommendation:** Implement cursor-based pagination using the supabase-py client's `lt()` filter with compound cursor values. Use base64-encoded JSON for opaque cursors. Support query parameter filters for common fields (status, date ranges) that map directly to indexed WHERE clauses. Return total count estimates from `pg_class.reltuples` for large tables.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.109.0 | API framework | Already in codebase |
| Pydantic | v2 | Request/response models | Already in codebase (via FastAPI) |
| supabase-py | >=2.0.0 | Database client | Already in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Python base64 | stdlib | Cursor encoding | All cursor operations |
| Python json | stdlib | Cursor payload | Serialize cursor data |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual cursor impl | fastapi-pagination | Library adds SQLAlchemy dependency we don't use; manual is simpler with supabase-py |
| Base64 JSON cursor | JWT-signed cursor | JWT adds overhead; base64 sufficient for internal sync API |
| Query param filters | JSON body filters | Query params more RESTful, easier to cache; JSON body for very complex filters only |

**Installation:**
No new packages required - uses existing dependencies.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/app/
├── routers/
│   └── sync.py              # New: sync endpoints with cursor pagination
├── models.py                 # Add: cursor pagination models
├── pagination.py             # New: cursor encode/decode utilities
└── services/
    └── sync.py               # New: sync query logic
```

### Pattern 1: Cursor Encoding/Decoding
**What:** Opaque cursor that encodes position as base64 JSON
**When to use:** All cursor-based pagination endpoints
**Example:**
```python
# Source: Standard base64 cursor pattern
import base64
import json
from datetime import datetime
from typing import Optional

def encode_cursor(updated_at: datetime, id: str) -> str:
    """Encode pagination position as opaque cursor."""
    payload = {
        "u": updated_at.isoformat(),  # updated_at
        "i": id,                       # id
    }
    return base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode().rstrip("=")

def decode_cursor(cursor: str) -> tuple[datetime, str]:
    """Decode cursor to pagination position. Raises ValueError if invalid."""
    # Add back padding
    padding = 4 - (len(cursor) % 4)
    if padding != 4:
        cursor += "=" * padding
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor))
        updated_at = datetime.fromisoformat(payload["u"])
        id = payload["i"]
        return updated_at, id
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        raise ValueError("Invalid cursor") from e
```

### Pattern 2: Cursor Query with Supabase
**What:** Keyset pagination using compound comparison
**When to use:** All sync list endpoints
**Example:**
```python
# Source: Phase 15 Research + Supabase Python docs
from supabase import Client

async def get_records_page(
    supabase: Client,
    account_id: str,
    cursor: Optional[tuple[datetime, str]] = None,
    limit: int = 50,
) -> list[dict]:
    """Fetch a page of records using cursor-based pagination."""
    query = (
        supabase.table("bookkeeping_records")
        .select("*")
        .eq("account_id", account_id)
        .is_("deleted_at", "null")  # Exclude soft-deleted
        .order("updated_at", desc=True)
        .order("id", desc=True)
        .limit(limit + 1)  # Fetch one extra to detect has_more
    )

    if cursor:
        updated_at, id = cursor
        # Compound cursor comparison for DESC ordering
        # WHERE (updated_at, id) < (cursor_updated_at, cursor_id)
        # Supabase doesn't support tuple comparison directly, use OR pattern:
        query = query.or_(
            f"updated_at.lt.{updated_at.isoformat()},"
            f"and(updated_at.eq.{updated_at.isoformat()},id.lt.{id})"
        )

    result = query.execute()
    return result.data or []
```

### Pattern 3: Paginated Response Model
**What:** Standard response structure for cursor pagination
**When to use:** All cursor-paginated endpoints
**Example:**
```python
# Source: REST API pagination best practices
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

T = TypeVar("T")

class CursorPage(BaseModel, Generic[T]):
    """Standard cursor-based pagination response."""
    items: list[T]
    next_cursor: Optional[str] = None  # None when no more pages
    has_more: bool
    total_estimate: Optional[int] = None  # Approximate count for UI

class RecordSyncResponse(CursorPage[RecordResponse]):
    """Paginated records for sync."""
    pass
```

### Pattern 4: Filter Query Parameters
**What:** Query params for common filter operations
**When to use:** Endpoints supporting server-side filtering
**Example:**
```python
# Source: REST API filter best practices
from fastapi import Query
from typing import Optional
from datetime import date

@router.get("/sync/records", response_model=RecordSyncResponse)
async def sync_records(
    account_id: str = Query(..., description="Account to fetch records for"),
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(50, ge=1, le=100, description="Page size"),
    # Filters
    status: Optional[BookkeepingStatus] = Query(None, description="Filter by status"),
    updated_since: Optional[datetime] = Query(None, description="Only records updated after this time"),
    # Sort (optional override)
    sort: Optional[str] = Query(None, regex="^-?(updated_at|sale_date)$", description="Sort field, prefix with - for DESC"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    ...
```

### Pattern 5: Total Count Estimate
**What:** Fast approximate count using PostgreSQL statistics
**When to use:** Large tables where COUNT(*) is too slow
**Example:**
```python
# Source: PostgreSQL wiki - Count estimate
async def get_table_count_estimate(supabase: Client, table: str) -> int:
    """Get fast approximate row count from pg_class statistics."""
    # Note: This requires a raw SQL query or RPC function
    # Option 1: Create an RPC function in Supabase
    result = supabase.rpc("get_table_estimate", {"table_name": table}).execute()
    return result.data or 0

# SQL function to create in Supabase:
# CREATE OR REPLACE FUNCTION get_table_estimate(table_name text)
# RETURNS bigint AS $$
#   SELECT reltuples::bigint FROM pg_class WHERE relname = table_name;
# $$ LANGUAGE sql STABLE;
```

### Anti-Patterns to Avoid
- **Offset pagination for sync:** Offset degrades 17x at 1M records; cursor is O(log n) constant
- **Single-column cursor:** Using only `updated_at` causes duplicate/missing records; always include `id` as tiebreaker
- **Exposing cursor internals:** Clients should treat cursor as opaque; don't document the internal format
- **COUNT(*) on large tables:** Requires full table scan; use `pg_class.reltuples` estimate instead
- **Unindexed filter columns:** All filter columns must have supporting indexes from Phase 15

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor encoding | Custom binary format | Base64 JSON | Standard, debuggable, extensible |
| URL-safe base64 | Manual character replacement | `base64.urlsafe_b64encode` | Handles all edge cases |
| Compound cursor comparison | Multiple WHERE clauses | PostgREST OR pattern | Matches index structure |
| Count for large tables | COUNT(*) query | pg_class.reltuples | 10,000x faster for large tables |

**Key insight:** The supabase-py client's fluent API maps directly to PostgREST operators. Use `lt()`, `gt()`, `eq()`, and `or_()` methods rather than raw SQL to maintain RLS enforcement.

## Common Pitfalls

### Pitfall 1: Cursor Comparison Direction
**What goes wrong:** Using `>` comparison for DESC-ordered pagination returns wrong results.
**Why it happens:** Intuition says "next page = greater than current", but DESC ordering reverses this.
**How to avoid:** For `ORDER BY updated_at DESC, id DESC`, use `<` comparison: `WHERE (updated_at, id) < (cursor_updated_at, cursor_id)`.
**Warning signs:** Pagination returns same records or skips records.

### Pitfall 2: Supabase Tuple Comparison Limitation
**What goes wrong:** Supabase-py doesn't support PostgreSQL's native tuple comparison `(col1, col2) < (val1, val2)`.
**Why it happens:** PostgREST API limitations.
**How to avoid:** Use the OR pattern: `updated_at < X OR (updated_at = X AND id < Y)`.
**Warning signs:** Query syntax errors or incorrect results.

### Pitfall 3: Invalid Cursor Handling
**What goes wrong:** Malformed cursor causes 500 error instead of 400.
**Why it happens:** Base64 decode or JSON parse fails with exception.
**How to avoid:** Wrap cursor decode in try/except, return 400 Bad Request with clear error message.
**Warning signs:** Unhandled exceptions in logs when clients send garbage cursors.

### Pitfall 4: Timezone Handling in Cursors
**What goes wrong:** Cursor created with UTC time compared against records with different timezone.
**Why it happens:** `datetime.isoformat()` may or may not include timezone.
**How to avoid:** Always use timezone-aware datetimes (`datetime.now(timezone.utc)`), ensure cursor stores ISO format with timezone.
**Warning signs:** Off-by-hours pagination gaps.

### Pitfall 5: Soft-Delete Filter Missing
**What goes wrong:** Sync returns soft-deleted records to client.
**Why it happens:** Forgot to add `is_("deleted_at", "null")` filter.
**How to avoid:** All sync queries must include soft-delete filter. Consider wrapping in service layer.
**Warning signs:** Deleted records reappear on client after sync.

### Pitfall 6: has_more Detection
**What goes wrong:** Client doesn't know when to stop fetching.
**Why it happens:** No indicator that current page is the last one.
**How to avoid:** Fetch `limit + 1` records, set `has_more = len(records) > limit`, return only `limit` records.
**Warning signs:** Infinite loading loops or missing final page indicator.

## Code Examples

Verified patterns from official sources and existing codebase:

### Complete Sync Endpoint
```python
# Source: Codebase patterns + cursor pagination research
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime, timezone

from app.auth import require_permission_key
from app.database import get_supabase_for_user
from app.models import RecordResponse, RecordSyncResponse
from app.pagination import encode_cursor, decode_cursor

router = APIRouter(prefix="/sync", tags=["sync"])

@router.get("/records", response_model=RecordSyncResponse)
async def sync_records(
    account_id: str = Query(..., description="Account ID"),
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(50, ge=1, le=100, description="Page size"),
    updated_since: Optional[datetime] = Query(None, description="Filter: updated after"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Fetch records for sync with cursor-based pagination.

    Pagination:
    - First request: omit cursor
    - Subsequent requests: pass next_cursor from previous response
    - Stop when has_more is false

    Filters:
    - updated_since: Only return records updated after this timestamp (for incremental sync)
    """
    supabase = get_supabase_for_user(user["token"])

    # Build base query
    query = (
        supabase.table("bookkeeping_records")
        .select("*")
        .eq("account_id", account_id)
        .order("updated_at", desc=True)
        .order("id", desc=True)
        .limit(limit + 1)  # Extra for has_more detection
    )

    # Apply cursor if provided
    if cursor:
        try:
            cursor_updated_at, cursor_id = decode_cursor(cursor)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid cursor")

        # Compound cursor comparison for DESC ordering
        query = query.or_(
            f"updated_at.lt.{cursor_updated_at.isoformat()},"
            f"and(updated_at.eq.{cursor_updated_at.isoformat()},id.lt.{cursor_id})"
        )

    # Apply filters
    if updated_since:
        query = query.gte("updated_at", updated_since.isoformat())

    # Execute query
    try:
        result = query.execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Database error")

    records = result.data or []

    # Determine has_more and trim to limit
    has_more = len(records) > limit
    if has_more:
        records = records[:limit]

    # Build next cursor from last record
    next_cursor = None
    if has_more and records:
        last = records[-1]
        next_cursor = encode_cursor(
            datetime.fromisoformat(last["updated_at"]),
            last["id"]
        )

    # Build response
    return RecordSyncResponse(
        items=[RecordResponse.from_db(r) for r in records],
        next_cursor=next_cursor,
        has_more=has_more,
        total_estimate=None,  # Add if needed for UI
    )
```

### Filter Parameter Validation
```python
# Source: Existing codebase pattern (admin.py)
from fastapi import Query, HTTPException
import re

# Allowlist of sortable fields (must have indexes)
ALLOWED_SORT_FIELDS = {"updated_at", "sale_date", "created_at"}

def parse_sort_param(sort: Optional[str]) -> tuple[str, bool]:
    """Parse sort parameter like '-updated_at' into (field, desc)."""
    if not sort:
        return "updated_at", True  # Default: newest first

    desc = sort.startswith("-")
    field = sort.lstrip("-")

    if field not in ALLOWED_SORT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort field. Allowed: {', '.join(ALLOWED_SORT_FIELDS)}"
        )

    return field, desc
```

### Error Response for Invalid Cursor
```python
# Source: JSON:API specification + REST best practices
from pydantic import BaseModel

class ErrorResponse(BaseModel):
    """Standard error response."""
    code: str
    message: str
    detail: Optional[str] = None

# In endpoint:
if cursor:
    try:
        cursor_updated_at, cursor_id = decode_cursor(cursor)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_CURSOR",
                "message": "The provided cursor is invalid or malformed",
            }
        )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Offset pagination (`page`, `page_size`) | Cursor/keyset pagination | Long-standing best practice | O(log n) vs O(n) at scale |
| COUNT(*) for totals | pg_class.reltuples estimate | PostgreSQL feature | 10,000x faster for large tables |
| Page number in response | Opaque cursor only | Cursor pagination standard | Clients can't jump to arbitrary pages |
| Hardcoded sort order | Sort parameter with allowlist | API flexibility | Clients control ordering |

**Deprecated/outdated:**
- Offset pagination: Still valid for admin UIs with page numbers, but not for sync
- Exact counts: Only use for small tables or when exact count is required

## Codebase Integration Notes

### Existing Patterns to Follow
1. **Router structure:** New sync router at `apps/api/src/app/routers/sync.py`
2. **Auth dependency:** Use `require_permission_key()` from existing auth module
3. **Supabase client:** Use `get_supabase_for_user(user["token"])` for RLS enforcement
4. **Error handling:** Follow pattern from records.py with HTTPException and logging
5. **Response models:** Add new models to `app/models.py` following existing conventions

### Differences from Existing Pagination
| Aspect | Current (admin.py) | New (sync endpoints) |
|--------|-------------------|---------------------|
| Style | Offset (page/page_size) | Cursor (cursor/limit) |
| Response | total, page, page_size | next_cursor, has_more, total_estimate |
| Performance | Degrades with page depth | Constant O(log n) |
| Use case | Admin UI with page numbers | Client sync, infinite scroll |

### Supabase-py Filter Methods Reference
From official docs:
- `eq(column, value)` - equals
- `neq(column, value)` - not equals
- `gt(column, value)` - greater than
- `gte(column, value)` - greater than or equal
- `lt(column, value)` - less than
- `lte(column, value)` - less than or equal
- `is_(column, value)` - IS NULL/IS NOT NULL
- `or_(filters)` - OR condition with PostgREST syntax

## Open Questions

Things that couldn't be fully resolved:

1. **Supabase tuple comparison support**
   - What we know: PostgREST may support row value comparison syntax
   - What's unclear: Whether supabase-py exposes this
   - Recommendation: Use OR pattern which is verified to work

2. **pg_class access via supabase-py**
   - What we know: pg_class contains row estimates
   - What's unclear: Whether RLS allows querying system catalogs
   - Recommendation: Create RPC function in migration, test with service role

3. **Cursor expiry policy**
   - What we know: Cursors encode timestamp+id which may reference deleted data
   - What's unclear: Should cursors expire after time period?
   - Recommendation: No expiry needed; if cursor references deleted row, pagination continues from next valid row

## Sources

### Primary (HIGH confidence)
- Phase 15 Research - Database index patterns and cursor query structure
- Existing codebase (apps/api/src/app/routers/) - FastAPI patterns, auth, error handling
- [Supabase Python gt documentation](https://supabase.com/docs/reference/python/gt) - Filter method syntax

### Secondary (MEDIUM confidence)
- [Keyset Cursors for Postgres Pagination](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/) - Compound cursor patterns
- [PostgreSQL wiki - Count estimate](https://wiki.postgresql.org/wiki/Count_estimate) - reltuples usage
- [REST API Design: Filtering, Sorting, and Pagination](https://www.moesif.com/blog/technical/api-design/REST-API-Design-Filtering-Sorting-and-Pagination/) - API design patterns
- [FastAPI Pagination Techniques](https://uriyyo-fastapi-pagination.netlify.app/learn/pagination/techniques/) - Cursor vs offset comparison

### Tertiary (LOW confidence)
- WebSearch results on cursor encoding formats - Verified against multiple sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing codebase dependencies, no new packages
- Architecture: HIGH - Patterns verified against existing codebase and official docs
- Pitfalls: HIGH - Multiple authoritative sources, PostgreSQL documentation
- Integration: HIGH - Based on direct codebase analysis

**Research date:** 2026-01-23
**Valid until:** 90 days (FastAPI and Supabase-py APIs are stable)
