# Stack Research: Access Code System and Extension RBAC

**Domain:** Access code authentication + Chrome extension RBAC
**Researched:** 2026-01-18
**Confidence:** HIGH

## Executive Summary

The existing stack (FastAPI, Supabase, Chrome Extension MV3) provides everything needed for access code authentication and extension RBAC. **No new runtime dependencies required.** The implementation uses:

1. **Access codes**: Python's built-in `secrets` module + `argon2-cffi` for hashing (new dependency, but standard security practice)
2. **Extension auth**: Existing JWT pattern with new `/extension/auth` endpoint + `chrome.storage.local` for token persistence
3. **Extension RBAC**: Server-side permission keys (already implemented) + client-side tab rendering

---

## Recommended Stack

### Core Technologies (Existing - No Changes)

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| FastAPI | 0.109.0+ | API framework | Already handles JWT auth |
| Python `secrets` | stdlib | Cryptographic token generation | Built-in, no install needed |
| PyJWT | 2.0.0+ | JWT encode/decode | Already in pyproject.toml |
| Supabase | 2.0.0+ | Database + RLS | Already in pyproject.toml |
| Chrome Extension MV3 | - | Extension runtime | Already implemented |

### New Dependencies Required

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `argon2-cffi` | 25.1.0 | Secret hashing | OWASP 2025 gold standard for password/secret hashing; PHC winner; memory-hard (resists GPU attacks); better than bcrypt for new implementations |

**Installation:**
```bash
cd apps/api
pip install argon2-cffi>=25.1.0
```

Update `pyproject.toml`:
```toml
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "python-dotenv>=1.0.0",
    "supabase>=2.0.0",
    "PyJWT>=2.0.0",
    "argon2-cffi>=25.1.0",  # NEW: Access code hashing
]
```

---

## Access Code System Stack

### Code Generation (Python stdlib)

Use `secrets` module for cryptographically secure token generation.

**Pattern: Prefix + Secret**
```python
import secrets

# Generate user prefix (immutable, 6 chars, URL-safe)
def generate_prefix() -> str:
    return secrets.token_urlsafe(4)[:6].upper()  # e.g., "A3K9X2"

# Generate rotatable secret (32 chars, URL-safe)
def generate_secret() -> str:
    return secrets.token_urlsafe(24)  # 32 chars, 192 bits entropy

# Full access code format: PREFIX_SECRET
# e.g., "A3K9X2_xYz123AbCdEfGhIjKlMnOpQrSt"
```

**Why this format:**
- Prefix allows database lookup without exposing the secret
- Secret provides authentication (hashed in DB)
- 32+ chars recommended for API keys per industry standards
- URL-safe encoding avoids special character issues

### Secret Hashing (argon2-cffi)

```python
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=3,      # iterations (default)
    memory_cost=65536, # 64MB (default, OWASP minimum is 19MB)
    parallelism=4,    # threads (default)
)

# Hash secret before storing
hashed = ph.hash(secret)

# Verify on auth
try:
    ph.verify(stored_hash, provided_secret)
    # Check if rehash needed (params changed)
    if ph.check_needs_rehash(stored_hash):
        new_hash = ph.hash(provided_secret)
        # Update DB with new_hash
except VerifyMismatchError:
    # Invalid secret
    raise HTTPException(401, "Invalid access code")
```

**Why Argon2 over bcrypt:**
- Argon2 is OWASP 2025 recommended
- Memory-hard (resists GPU/FPGA attacks)
- bcrypt only uses 4KB memory, making it vulnerable to parallel attacks
- Argon2id variant (default) resists both side-channel and time-memory trade-off attacks
- Native Python bindings via `argon2-cffi` (well-maintained, 25.1.0 supports Python 3.13/3.14)

### Database Schema (Supabase)

```sql
-- Add to user_access_codes table (or memberships table)
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS
    access_code_prefix VARCHAR(8) UNIQUE,
    access_code_hash TEXT,
    access_code_created_at TIMESTAMPTZ,
    access_code_rotated_at TIMESTAMPTZ;

-- Index for prefix lookup
CREATE INDEX idx_memberships_access_code_prefix
    ON memberships(access_code_prefix);
```

**Storage pattern:**
- Store prefix in cleartext (for lookup)
- Store secret hash only (never store plaintext secret)
- RLS policy: users can only read/rotate their own access code

---

## Chrome Extension Authentication Stack

### Extension-Side Token Storage (chrome.storage.local)

The extension already uses `chrome.storage.local` for credentials. This is the correct pattern for MV3.

**Current implementation (service-worker.js lines 46-90):**
```javascript
// Already implemented correctly
async function getState() {
  const data = await chrome.storage.local.get([
    'install_token',
    'agent_id',
    // ...
  ]);
  return { ... };
}
```

**Why chrome.storage.local:**
- Persists across service worker restarts (critical for MV3)
- Accessible from service worker, popup, sidepanel
- Better than localStorage (not available in service workers)
- chrome.storage.session exists but clears on browser close (not suitable for long-lived tokens)

### Authentication Flow (New Endpoint)

```
Extension                    Backend
    |                           |
    | POST /extension/auth      |
    | { access_code }           |
    |-------------------------->|
    |                           | 1. Parse prefix from code
    |                           | 2. Lookup user by prefix
    |                           | 3. Verify secret with Argon2
    |                           | 4. Load permission_keys
    |                           | 5. Issue extension JWT
    |<--------------------------|
    | { token, permissions }    |
    |                           |
    | Store in chrome.storage   |
```

**JWT payload for extension:**
```python
{
    "sub": user_id,
    "membership_id": membership_id,
    "role": "admin" | "va",
    "permission_keys": ["order_tracking.read", ...],  # VAs only
    "aud": "extension",  # Different audience from web
    "exp": now + 30 days,  # Long-lived for extension
}
```

### Token Refresh Strategy

**Option A: Long-lived token (Recommended for MVP)**
- Issue 30-day tokens
- On rotation, old token works until next refresh
- Simpler implementation

**Option B: Refresh token pattern**
- Short-lived access token (1 hour)
- Long-lived refresh token (30 days)
- More complex, better for high-security requirements

**Recommendation:** Start with Option A. The access code itself provides revocation (rotating the code invalidates all sessions using the old secret).

---

## Extension RBAC Stack

### Permission Loading (Server-Side)

The permission system is already implemented in `auth.py`:

```python
# Existing code in auth.py
dept_role_keys = _get_dept_role_permissions(supabase, membership["id"])
# Returns: {"order_tracking.read", "order_tracking.write.basic_fields", ...}
```

**For extension auth endpoint:**
```python
@router.post("/extension/auth")
async def authenticate_extension(access_code: str):
    # ... validate access code ...

    # Load permissions (reuse existing logic)
    if membership["role"] == "va":
        permission_keys = _get_dept_role_permissions(supabase, membership["id"])
    else:
        permission_keys = []  # Admins bypass RBAC

    # Issue JWT with permissions embedded
    token = jwt.encode({
        "sub": user_id,
        "role": membership["role"],
        "permission_keys": sorted(permission_keys),
        "aud": "extension",
        "exp": datetime.utcnow() + timedelta(days=30),
    }, JWT_SECRET, algorithm="HS256")

    return {
        "token": token,
        "role": membership["role"],
        "permission_keys": sorted(permission_keys),
    }
```

### Tab Rendering (Client-Side)

**Pattern: Map permission keys to tab visibility**

```javascript
// Extension sidepanel.js
const TAB_CONFIG = {
    'order_tracking': {
        permission: 'order_tracking.read',
        label: 'Order Tracking',
    },
    'accounts': {
        permission: 'account:view',  // New permission for this milestone
        label: 'Accounts',
    },
    // ... more tabs
};

function renderTabs(userRole, permissionKeys) {
    // Admin bypass - show all tabs
    if (userRole === 'admin') {
        return Object.values(TAB_CONFIG);
    }

    // VA - filter by permissions
    return Object.entries(TAB_CONFIG)
        .filter(([key, config]) => permissionKeys.includes(config.permission))
        .map(([key, config]) => config);
}
```

**Why client-side rendering with server-side enforcement:**
- Client-side: Fast tab rendering, no additional API calls
- Server-side: All API endpoints still check permissions (existing `require_permission_key`)
- Defense in depth: Even if client UI is bypassed, server rejects unauthorized requests

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bcrypt` | Less memory-hard than Argon2, 72-byte input limit, older standard | `argon2-cffi` |
| `hashlib.pbkdf2_hmac` | Not memory-hard, slower to configure correctly | `argon2-cffi` |
| Custom hash implementations | Security-critical code should use battle-tested libraries | `argon2-cffi` |
| `chrome.identity` API | For Google OAuth only, not custom auth | Custom fetch + chrome.storage |
| localStorage in extension | Not available in MV3 service workers | `chrome.storage.local` |
| `chrome.storage.session` | Clears on browser close, bad for auth tokens | `chrome.storage.local` |
| Storing plaintext secrets | Security violation | Argon2 hashing |
| Short-lived extension tokens | Poor UX (frequent re-auth), complexity | 30-day tokens with rotation |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `argon2-cffi` | `bcrypt` | Only if maintaining existing bcrypt hashes; migrate to Argon2 over time |
| Python `secrets` | `uuid4()` | Never for secrets; UUIDs are not cryptographically secure |
| 30-day extension tokens | 1-hour + refresh | If compliance requires short-lived tokens |
| Embedded permissions in JWT | Fetch on each request | If permissions change frequently (trade-off: more API calls) |
| `chrome.storage.local` | IndexedDB | If storing large amounts of structured data (overkill for tokens) |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| argon2-cffi 25.1.0 | Python 3.8-3.14 | Latest release (June 2025) |
| PyJWT 2.0.0+ | Python 3.7+ | Already in use |
| FastAPI 0.109.0+ | Python 3.8+ | Already in use |

---

## Implementation Checklist

### Backend (apps/api)
- [ ] Add `argon2-cffi>=25.1.0` to pyproject.toml
- [ ] Add access code columns to memberships table (migration)
- [ ] Create `/extension/auth` endpoint
- [ ] Create access code generation/rotation utilities
- [ ] Add RLS policy for access code self-service

### Extension (packages/extension)
- [ ] Add access code input UI in sidepanel
- [ ] Call `/extension/auth` endpoint
- [ ] Store token in chrome.storage.local
- [ ] Implement tab rendering based on permissions
- [ ] Handle auth errors (expired, revoked)

### Frontend (apps/web)
- [ ] Add Profile Settings modal
- [ ] Add Extension tab with access code display
- [ ] Implement masked display + reveal toggle
- [ ] Add copy-to-clipboard functionality
- [ ] Add rotate button with confirmation

---

## Sources

- [Python secrets module documentation](https://docs.python.org/3/library/secrets.html) - Token generation patterns
- [argon2-cffi documentation](https://argon2-cffi.readthedocs.io/) - Hashing implementation
- [OWASP Password Hashing Guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) - Argon2 recommendation rationale
- [API Key Best Practices (Mergify)](https://articles.mergify.com/api-keys-best-practice/) - Prefix + secret pattern
- [Chrome Extension MV3 Migration Guide](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) - Storage patterns
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) - Access control patterns
- Existing codebase: `apps/api/src/app/auth.py`, `packages/extension/service-worker.js`

---

*Stack research for: Access code system + Extension RBAC*
*Researched: 2026-01-18*
