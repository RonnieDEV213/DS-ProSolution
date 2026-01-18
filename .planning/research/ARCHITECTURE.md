# Architecture Research

**Domain:** Access Code and Extension RBAC Integration
**Researched:** 2026-01-18
**Confidence:** HIGH

## System Overview

```
                          +-------------------+
                          |   Chrome Extension|
                          |   (MV3)           |
                          |   - Service Worker|
                          |   - Side Panel    |
                          +--------+----------+
                                   |
                                   | (1) Pairing Request
                                   | (2) Access Code Verification
                                   | (3) RBAC Loading
                                   v
+-------------+            +-------------------+            +-------------------+
|  Next.js    |  <-------> |   FastAPI         |  <-------> |   Supabase        |
|  Frontend   |   REST/JWT |   Backend         |   Service  |   PostgreSQL      |
|             |            |   - /automation/* |   Role     |   - memberships   |
|  - Profile  |            |   - /auth/*       |            |   - profiles      |
|    Settings |            |   - /admin/*      |            |   - access_codes  |
|  - Access   |            +-------------------+            |   - dept_roles    |
|    Code UI  |                                             |   - presence?     |
+-------------+                                             +-------------------+
```

### New Components for This Milestone

| Component | Location | Purpose |
|-----------|----------|---------|
| Access Code Table | Supabase `access_codes` | Store hashed access codes with user prefix |
| Access Code API | FastAPI `/auth/access-code/*` | Generate, validate, rotate codes |
| Profile Settings Modal | Next.js `components/profile/` | User-facing settings with tabs |
| Extension Tab in Profile | Next.js | Access code UI for Admin/VA, download for all |
| Extension Auth Step | Extension | Verify access code after pairing approval |
| Extension RBAC Loader | Extension | Fetch roles/permissions on auth success |
| Presence Tracking | TBD | Track who is viewing which account |

## Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Access Code Table** | Store prefix, hashed secret, user link, timestamps | `access_codes` table with FK to profiles |
| **Access Code API** | CRUD + validation + rotation | FastAPI router with Argon2/bcrypt hashing |
| **Profile Settings Modal** | Container for user settings | React Dialog with sidebar tabs pattern |
| **Extension Auth Step** | Second factor after pairing | Extension calls `/auth/verify-access-code` |
| **RBAC Loader** | Fetch and cache user permissions | Extension calls `/auth/extension-permissions` |
| **Presence Manager** | Track active account viewers | Polling or Supabase Realtime on `presence` table |

## Recommended Project Structure

### Backend Additions (`apps/api/src/app/`)

```
routers/
├── auth.py           # Add access code endpoints (existing file)
├── extension.py      # NEW: Extension-specific auth + RBAC endpoints
models.py             # Add access code and presence models (existing file)
```

### Frontend Additions (`apps/web/src/`)

```
components/
├── profile/
│   ├── profile-settings-modal.tsx   # NEW: Main modal container
│   ├── profile-tab-general.tsx      # NEW: Basic profile info
│   └── profile-tab-extension.tsx    # NEW: Extension + access code
lib/
├── api.ts            # Add access code + presence API functions (existing file)
```

### Extension Additions (`packages/extension/`)

```
service-worker.js     # Add access code verification step (existing file)
sidepanel.js          # Add access code input UI (existing file)
auth/
├── access-code.js    # NEW: Access code verification logic
├── rbac.js           # NEW: Permission loading + caching
tabs/
├── tab-registry.js   # NEW: Map roles to tabs
├── account-tab.js    # NEW: Account list with presence
```

### Structure Rationale

- **`routers/extension.py`:** Separates extension-specific logic from user auth; cleaner boundaries
- **`components/profile/`:** Follows existing pattern of feature-specific component directories
- **Extension `auth/` and `tabs/`:** Organizes new functionality without cluttering existing files

## Architectural Patterns

### Pattern 1: Access Code as Second Factor

**What:** After pairing approval, extension must verify access code before receiving JWT
**When to use:** All extension authentication after pairing
**Trade-offs:**
- (+) Adds security layer (device pairing + user authentication)
- (+) Enables RBAC loading per-user instead of per-device
- (-) Additional step for user during initial setup

**Implementation Flow:**
```
Extension                    Backend                      Database
    |                           |                            |
    |--[1] Pairing Request----->|                            |
    |                           |--[2] Check pending-------->|
    |<--[3] Pending-------------|                            |
    |                           |                            |
    |  (Admin approves)         |                            |
    |                           |                            |
    |--[4] Poll status--------->|                            |
    |<--[5] Approved------------|                            |
    |                           |                            |
    |--[6] Verify Access Code-->|--[7] Hash + Compare------->|
    |                           |<--[8] Match + User ID------|
    |<--[9] JWT + Permissions---|                            |
```

### Pattern 2: RBAC Tab Rendering

**What:** Extension loads permissions, maps to tabs, shows only permitted UI
**When to use:** Every extension session start, on token refresh
**Trade-offs:**
- (+) Server-authoritative permissions (no local tampering)
- (+) Tab list reflects actual permissions
- (-) Requires network call before showing UI

**Example:**
```javascript
// Extension RBAC loading (conceptual)
async function loadPermissions(jwt) {
  const response = await fetch('/auth/extension-permissions', {
    headers: { Authorization: `Bearer ${jwt}` }
  });
  const { permissions, role, is_admin } = await response.json();

  // Admin bypasses RBAC
  if (is_admin) {
    return ALL_TABS;
  }

  // Map permissions to tabs
  const visibleTabs = [];
  if (permissions.includes('account:view')) {
    visibleTabs.push('accounts');
  }
  if (permissions.includes('order_tracking.read')) {
    visibleTabs.push('order-tracking');
  }
  // ... more mappings

  return visibleTabs;
}
```

### Pattern 3: Presence Tracking

**What:** Track who is viewing which account in real-time or near-real-time
**When to use:** Account list view in extension, admin dashboard
**Trade-offs:**
- Polling: Simple, works everywhere, 5-10s latency
- Realtime: Instant, Supabase channels, more complex

**Recommended: Polling with Short TTL**
```python
# Backend presence endpoint (conceptual)
@router.post("/presence/heartbeat")
async def presence_heartbeat(
    account_id: UUID,
    user: dict = Depends(get_current_user_with_membership)
):
    """Update presence for current user viewing an account."""
    supabase = get_supabase()
    supabase.table("account_presence").upsert({
        "account_id": str(account_id),
        "user_id": user["user_id"],
        "last_seen": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="account_id,user_id").execute()
    return {"ok": True}

@router.get("/presence/{account_id}")
async def get_presence(
    account_id: UUID,
    user: dict = Depends(get_current_user_with_membership)
):
    """Get who is viewing this account (within last 30 seconds)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
    result = supabase.table("account_presence").select(
        "user_id, profiles(display_name)"
    ).eq("account_id", str(account_id)).gt("last_seen", cutoff).execute()

    # VAs see "Occupied" if anyone else is viewing
    # Admins see actual names
    if user["membership"]["role"] == "admin":
        return {"viewers": result.data}
    else:
        is_occupied = len(result.data) > 0
        return {"occupied": is_occupied}
```

## Data Flow

### Request Flow: Access Code Verification

```
[Extension Side Panel]
    |
    |--[User enters access code]
    v
[Service Worker] --> POST /auth/verify-access-code
    |                    |
    |                    v
    |               [FastAPI] --> hash(code) --> compare with stored
    |                    |
    |                    v
    |               [Supabase] --> access_codes.secret_hash
    |                    |
    |               <---[user_id, membership_id]
    |                    |
    |               [Generate JWT with user context]
    |                    |
    <---[jwt, role, permissions, tabs]
    |
    v
[Store in chrome.storage.local]
    |
    v
[Render permitted tabs]
```

### State Management: Extension

```
chrome.storage.local
    |
    |-- install_instance_id (device identifier, persisted)
    |-- agent_id (from pairing, null until paired)
    |-- install_token (agent JWT, null until paired)
    |-- access_code_verified (boolean, false until verified)
    |-- user_jwt (user JWT, null until access code verified)
    |-- user_id (from access code verification)
    |-- role (admin/va/client)
    |-- permissions (array of permission keys)
    |-- visible_tabs (computed from permissions)
```

### Key Data Flows

1. **Access Code Generation:** User opens Profile Settings > Extension tab > access code is generated server-side > stored hashed in DB > displayed masked to user
2. **Access Code Verification:** Extension prompts for code > sends to backend > backend hashes and compares > returns user JWT + permissions
3. **Tab Rendering:** Extension receives permissions > maps to tabs > renders only permitted tabs
4. **Presence Heartbeat:** Extension sends heartbeat every 10-15s while viewing account > backend upserts presence row > stale rows expire

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current polling approach works fine; 10-15s heartbeat intervals |
| 1k-100k users | Consider Supabase Realtime for presence; batch permission checks |
| 100k+ users | Dedicated presence service; Redis for ephemeral presence data |

### Scaling Priorities

1. **First bottleneck:** Presence heartbeats (10-15s intervals * users * accounts)
   - **Fix:** Aggregate heartbeats per extension session, batch updates
2. **Second bottleneck:** Permission loading on every extension open
   - **Fix:** Cache permissions with TTL, refresh on tab focus

## Anti-Patterns

### Anti-Pattern 1: Storing Access Codes in Plain Text

**What people do:** Store access code secrets without hashing
**Why it's wrong:** Database breach exposes all access codes
**Do this instead:** Hash secrets with Argon2 or bcrypt; only store hash

### Anti-Pattern 2: Client-Side RBAC Only

**What people do:** Send all permissions to extension, hide tabs with JS
**Why it's wrong:** Users can inspect/modify localStorage, bypass UI restrictions
**Do this instead:** Server validates permissions on every sensitive operation; UI is convenience, not security

### Anti-Pattern 3: Polling Without TTL

**What people do:** Store presence without expiration, never clean up
**Why it's wrong:** Stale presence data accumulates; users appear "online" forever
**Do this instead:** Short TTL (30s), background job cleans stale rows, or query with `last_seen > NOW() - interval`

### Anti-Pattern 4: Mixed User/Agent Auth

**What people do:** Use same JWT for user actions and agent automation
**Why it's wrong:** Conflates device authorization with user authorization
**Do this instead:** Separate tokens: `install_token` (agent/device), `user_jwt` (user after access code)

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | JWT validation via JWKS | Existing, no changes needed |
| Supabase Realtime | Optional for presence | Can use polling instead for simplicity |
| Chrome Storage | Extension state persistence | Already in use |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js <-> FastAPI | REST + Supabase JWT | Existing pattern; extend for access codes |
| Extension <-> FastAPI | REST + Agent JWT + User JWT | Add access code verification step |
| FastAPI <-> Supabase | Service role client | Existing; add access_codes table |
| Profile Modal <-> API | React Query or fetchAPI | Follow existing `lib/api.ts` pattern |

## Suggested Build Order

Based on component dependencies:

### Phase 1: Access Code Foundation
1. **Database:** Create `access_codes` table (prefix, secret_hash, user_id, timestamps)
2. **Backend:** Add access code models to `models.py`
3. **Backend:** Add `/auth/access-code/generate` and `/auth/access-code/rotate` endpoints
4. **Backend:** Add `/auth/verify-access-code` endpoint (returns user JWT + basic info)

**Rationale:** Access code storage and validation are prerequisite for both Profile UI and Extension auth.

### Phase 2: Profile Settings UI
5. **Frontend:** Create Profile Settings modal shell with sidebar tabs pattern
6. **Frontend:** Build Extension tab with access code display (masked, reveal, copy, rotate)
7. **Frontend:** Wire up API calls to access code endpoints
8. **Frontend:** Add download button (visible to all roles)

**Rationale:** UI depends on backend endpoints being available. Can test access code flow end-to-end.

### Phase 3: Extension Auth Flow
9. **Extension:** Add access code input UI after pairing approval
10. **Extension:** Call `/auth/verify-access-code`, store user JWT
11. **Extension:** Implement RBAC loader (`/auth/extension-permissions` endpoint)
12. **Extension:** Map permissions to tabs, render conditionally

**Rationale:** Extension changes depend on backend verification endpoint. RBAC requires permissions endpoint.

### Phase 4: Presence (Optional/Parallel)
13. **Database:** Create `account_presence` table (account_id, user_id, last_seen)
14. **Backend:** Add `/presence/heartbeat` and `/presence/{account_id}` endpoints
15. **Extension:** Implement heartbeat when viewing account list
16. **Extension:** Show "Occupied" for VAs, names for Admins

**Rationale:** Presence is independent feature; can be built in parallel or deferred.

## Sources

- Existing codebase analysis:
  - `apps/api/src/app/auth.py` - Current user auth patterns
  - `apps/api/src/app/routers/automation.py` - Agent auth patterns
  - `apps/api/src/app/permissions.py` - RBAC permission keys
  - `packages/extension/service-worker.js` - Extension state management
  - `apps/web/src/middleware.ts` - Role-based routing
- Project context:
  - `.planning/PROJECT.md` - Requirements and constraints
  - `.planning/codebase/ARCHITECTURE.md` - Existing architecture patterns
  - `.planning/codebase/INTEGRATIONS.md` - Integration patterns

---
*Architecture research for: Access Code and Extension RBAC Integration*
*Researched: 2026-01-18*
