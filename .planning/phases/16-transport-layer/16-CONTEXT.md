# Phase 16: Transport Layer - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

API endpoints that support cursor-based pagination with server-side filtering and sorting for syncable tables (sales, listings, etc.). This phase builds the transport layer that clients call to fetch paginated data. Creating new data models, client-side caching, or UI rendering are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

The user delegated all implementation decisions to Claude. The following areas were discussed, and Claude has flexibility to choose the best approach during research and planning:

**Cursor format & encoding:**
- Opaque vs readable cursor format
- Invalid/expired cursor handling
- Cursor expiry policy
- Cursor security (signing)

**Filter API design:**
- Query parameter style vs JSON body
- Supported filter operators
- Compound filter logic (AND/OR)
- Filter field validation

**Sort API design:**
- Sort direction syntax
- Multi-column sorting
- Default sort order
- Sort field validation

**Response structure:**
- Total count strategy (exact vs estimate)
- Pagination metadata fields
- Default page size
- Error response format

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude to choose best practices based on:
- Existing FastAPI patterns in the codebase
- Sync use case requirements (Phase 19 downstream)
- Performance needs for millions of records
- RESTful API conventions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-transport-layer*
*Context gathered: 2026-01-24*
