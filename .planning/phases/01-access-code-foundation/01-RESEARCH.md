# Phase 1: Access Code Foundation - Research

**Researched:** 2026-01-18
**Domain:** Secure access code generation, Argon2 hashing, JWT tokens, rate limiting
**Confidence:** HIGH

## Summary

This phase implements backend infrastructure for secure access code generation, storage, and validation. The access code system uses a split design: a 4-character prefix for user lookup (stored plaintext) and a 12-character secret hashed with Argon2id before storage. Validation returns a short-lived JWT plus full user context.

The standard Python stack for this domain is well-established: `argon2-cffi` for password/secret hashing (winner of Password Hashing Competition), `secrets` module for cryptographically secure random generation (stdlib since Python 3.6), `PyJWT` for token generation (already in use), and `slowapi` for rate limiting.

**Primary recommendation:** Use argon2-cffi with RFC 9106 LOW_MEMORY profile defaults, store prefix plaintext for O(1) lookup, hash secret with Argon2id, and implement rate limiting at both IP and prefix levels using database-backed counters for distributed deployment.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| argon2-cffi | 25.1.0 | Password/secret hashing | Winner of Password Hashing Competition, RFC 9106 compliant, recommended over bcrypt/scrypt |
| secrets | stdlib | Cryptographically secure random generation | Built into Python 3.6+, uses OS entropy source |
| PyJWT | 2.10.1 | JWT token creation/validation | Already in codebase, industry standard for JWTs |
| slowapi | 0.1.9 | FastAPI rate limiting | Adapted from flask-limiter, production-proven |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| redis | 5.0+ | Distributed rate limit storage | Multi-instance deployment (future) |
| pydantic | 2.x | Request/response validation | Already in codebase via FastAPI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| argon2-cffi | bcrypt | Argon2 is newer, memory-hard, RFC 9106 standard; bcrypt is older but still secure |
| slowapi | fastapi-limiter | slowapi has more features, better docs, flask-limiter heritage |
| In-memory rate limiting | Redis-backed | Redis needed for distributed; in-memory fine for single instance |

**Installation:**
```bash
pip install argon2-cffi slowapi
```

Add to `pyproject.toml`:
```toml
dependencies = [
    # ... existing
    "argon2-cffi>=25.1.0",
    "slowapi>=0.1.9",
]
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/
├── routers/
│   └── access_codes.py     # POST /access-codes, POST /access-codes/validate
├── services/
│   └── access_code.py      # Business logic: generate, validate, rate limit
├── models.py               # Add AccessCode* Pydantic models
├── auth.py                 # Add access code auth dependency
└── database.py             # (existing) Supabase client
```

### Pattern 1: Split Prefix/Secret Design
**What:** Access code = plaintext prefix (lookup key) + hashed secret (verification)
**When to use:** When you need both fast lookup AND secure storage
**Example:**
```python
# Source: Verified pattern from access token security best practices
# Prefix: 4 chars, stored plaintext, used for O(1) user lookup
# Secret: 12 chars, hashed with Argon2id, never stored plaintext

from argon2 import PasswordHasher
import secrets
import string

ALPHABET = string.ascii_letters + string.digits  # A-Za-z0-9

def generate_access_code(user_id: str) -> tuple[str, str]:
    """Generate prefix + secret, return (full_code, hashed_secret)."""
    ph = PasswordHasher()

    # Generate 4-char prefix (case-sensitive alphanumeric)
    prefix = ''.join(secrets.choice(ALPHABET) for _ in range(4))

    # Generate 12-char secret
    secret = ''.join(secrets.choice(ALPHABET) for _ in range(12))

    # Hash the secret
    hashed_secret = ph.hash(secret)

    # Full code shown to user: AbC1-xYz2AbCdEfGh
    full_code = f"{prefix}-{secret}"

    return full_code, prefix, hashed_secret
```

### Pattern 2: Argon2 Hashing with PasswordHasher
**What:** Use argon2-cffi's PasswordHasher class with sensible defaults
**When to use:** Any secret that needs secure storage
**Example:**
```python
# Source: https://argon2-cffi.readthedocs.io/en/stable/api.html
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

ph = PasswordHasher()  # Uses Argon2id, RFC 9106 LOW_MEMORY defaults

# Hash a secret
hashed = ph.hash("my_secret")
# Returns: $argon2id$v=19$m=65536,t=3,p=4$...

# Verify a secret
try:
    ph.verify(stored_hash, user_provided_secret)
    # Returns True on match
except VerifyMismatchError:
    # Secret doesn't match
    pass
except (VerificationError, InvalidHashError):
    # Other verification errors
    pass

# Check if rehash needed (after parameter updates)
if ph.check_needs_rehash(stored_hash):
    new_hash = ph.hash(user_provided_secret)
    # Update stored hash
```

### Pattern 3: JWT Token Generation (follow existing codebase pattern)
**What:** Generate short-lived JWT for access code authentication
**When to use:** After successful access code validation
**Example:**
```python
# Source: Existing pattern from apps/api/src/app/routers/automation.py
import jwt
from datetime import datetime, timedelta, timezone

ACCESS_CODE_JWT_SECRET = os.getenv("ACCESS_CODE_JWT_SECRET")
TOKEN_EXPIRY_MINUTES = 15  # Short-lived

def generate_access_token(
    user_id: str,
    membership_id: str,
    org_id: str,
) -> str:
    """Generate JWT for access code authentication."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "membership_id": membership_id,
        "org_id": org_id,
        "type": "access_code",  # Distinguish from Supabase tokens
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, ACCESS_CODE_JWT_SECRET, algorithm="HS256")
```

### Pattern 4: Database-Backed Rate Limiting
**What:** Store failed attempts in database for distributed rate limiting
**When to use:** When you need rate limits that survive restarts and work across instances
**Example:**
```python
# Source: Adapted from automation.py IPThrottler + Supabase RPC pattern
# Database table: access_code_attempts
# Columns: prefix, ip_address, attempted_at, success

async def check_rate_limit(prefix: str, ip: str) -> tuple[bool, int]:
    """Check if request should be rate limited.

    Returns (is_allowed, seconds_until_allowed).
    """
    supabase = get_supabase()

    # Use RPC for atomic check-and-increment
    result = supabase.rpc(
        "check_access_code_rate_limit",
        {
            "p_prefix": prefix,
            "p_ip": ip,
            "p_window_seconds": 300,  # 5 minutes
            "p_max_attempts": 10,
        }
    ).execute()

    row = result.data[0]
    return row["allowed"], row["retry_after_seconds"]
```

### Anti-Patterns to Avoid
- **Storing secret plaintext:** Never store the secret portion of access code unencrypted
- **Using MD5/SHA1 for secrets:** Use Argon2id, not fast hashes vulnerable to brute force
- **Rate limiting only by IP:** Attackers can use multiple IPs; also limit by prefix
- **Revealing failure reasons:** Don't tell attacker "prefix not found" vs "secret wrong"
- **Global rate limit storage:** Use per-prefix counters, not a single global counter

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | argon2-cffi PasswordHasher | Memory-hard, timing-attack resistant, RFC 9106 standard |
| Secure random | random.choice() | secrets.choice() | random module is NOT cryptographically secure |
| Rate limiting | Custom counter dict | slowapi + database table | Thread-safe, distributed-ready, handles edge cases |
| JWT creation | Manual JSON + base64 | PyJWT | Handles signatures, expiry, claims validation |
| Timing-safe compare | `==` operator | secrets.compare_digest() | Prevents timing attacks on secret comparison |

**Key insight:** Cryptographic operations have subtle security requirements (constant-time comparison, memory hardening, entropy sources) that standard libraries handle correctly. Custom implementations almost always have vulnerabilities.

## Common Pitfalls

### Pitfall 1: Timing Attacks on Secret Verification
**What goes wrong:** Using `==` to compare secrets leaks information via timing differences
**Why it happens:** String comparison short-circuits on first mismatch
**How to avoid:** argon2-cffi's verify() handles this internally; for other comparisons use `secrets.compare_digest()`
**Warning signs:** Direct string comparison anywhere in auth code

### Pitfall 2: Prefix Collision During Generation
**What goes wrong:** Generated prefix already exists, causing database unique constraint violation
**Why it happens:** 62^4 = 14.8M possibilities, collisions likely at scale
**How to avoid:** Retry loop with new random prefix on constraint violation
**Warning signs:** Uncaught database errors during code generation

### Pitfall 3: Rate Limit Bypass via Prefix Enumeration
**What goes wrong:** Attacker tries random prefixes to find valid ones, then focuses attacks
**Why it happens:** Only rate limiting by prefix, not by IP
**How to avoid:** Rate limit by BOTH IP address AND prefix
**Warning signs:** Many requests from same IP with different prefixes

### Pitfall 4: Stale Rate Limit Data
**What goes wrong:** Old failed attempts never cleaned up, database grows unbounded
**Why it happens:** No cleanup job for expired rate limit windows
**How to avoid:** Scheduled cleanup job or TTL on records; existing `cleanup_worker` pattern in codebase
**Warning signs:** access_code_attempts table growing continuously

### Pitfall 5: Argon2 Parameter Mismatch
**What goes wrong:** Hashes created with different parameters can't be verified
**Why it happens:** Changing Argon2 parameters without migration strategy
**How to avoid:** Use `check_needs_rehash()` after successful verification; hash string contains parameters
**Warning signs:** Users can't log in after parameter change

### Pitfall 6: JWT Secret Confusion
**What goes wrong:** Using Supabase JWT secret for access code tokens or vice versa
**Why it happens:** Multiple JWT secrets in the system
**How to avoid:** Separate `ACCESS_CODE_JWT_SECRET` env var, include `type` claim in payload
**Warning signs:** Tokens from one system accepted by another

## Code Examples

Verified patterns from official sources:

### Complete Access Code Generation
```python
# Source: argon2-cffi docs + secrets docs + codebase patterns
import secrets
import string
from argon2 import PasswordHasher

ALPHABET = string.ascii_letters + string.digits  # 62 characters
PREFIX_LENGTH = 4
SECRET_LENGTH = 12

ph = PasswordHasher()  # Argon2id with RFC 9106 LOW_MEMORY defaults


def generate_prefix() -> str:
    """Generate 4-character case-sensitive alphanumeric prefix."""
    return ''.join(secrets.choice(ALPHABET) for _ in range(PREFIX_LENGTH))


def generate_secret() -> str:
    """Generate 12-character case-sensitive alphanumeric secret."""
    return ''.join(secrets.choice(ALPHABET) for _ in range(SECRET_LENGTH))


def validate_custom_secret(secret: str) -> list[str]:
    """Validate custom secret meets requirements.

    Requirements: 12+ chars, has uppercase, lowercase, and digit.
    Returns list of validation errors (empty if valid).
    """
    errors = []
    if len(secret) < SECRET_LENGTH:
        errors.append(f"Secret must be at least {SECRET_LENGTH} characters")
    if not any(c.isupper() for c in secret):
        errors.append("Secret must contain at least one uppercase letter")
    if not any(c.islower() for c in secret):
        errors.append("Secret must contain at least one lowercase letter")
    if not any(c.isdigit() for c in secret):
        errors.append("Secret must contain at least one number")
    return errors


def hash_secret(secret: str) -> str:
    """Hash secret with Argon2id."""
    return ph.hash(secret)


def verify_secret(stored_hash: str, provided_secret: str) -> bool:
    """Verify secret against stored hash. Returns True if match."""
    try:
        ph.verify(stored_hash, provided_secret)
        return True
    except Exception:
        return False
```

### Rate Limiting with Progressive Lockout
```python
# Source: CONTEXT.md requirements + slowapi patterns
from datetime import datetime, timedelta, timezone
from typing import NamedTuple


class RateLimitResult(NamedTuple):
    allowed: bool
    retry_after_seconds: int
    lockout_level: int  # 0=none, 1=5min, 2=15min, 3=1hr


# Lockout durations by level
LOCKOUT_DURATIONS = [
    timedelta(minutes=5),   # Level 1
    timedelta(minutes=15),  # Level 2
    timedelta(hours=1),     # Level 3+
]
MAX_ATTEMPTS = 10


def get_lockout_duration(level: int) -> timedelta:
    """Get lockout duration for given level (1-indexed)."""
    if level <= 0:
        return timedelta(seconds=0)
    idx = min(level - 1, len(LOCKOUT_DURATIONS) - 1)
    return LOCKOUT_DURATIONS[idx]


# PostgreSQL RPC for atomic rate limit check (pseudo-SQL):
"""
CREATE OR REPLACE FUNCTION check_access_code_rate_limit(
    p_prefix TEXT,
    p_ip TEXT,
    p_max_attempts INT DEFAULT 10
) RETURNS TABLE (
    allowed BOOLEAN,
    retry_after_seconds INT,
    lockout_level INT
) AS $$
DECLARE
    v_prefix_attempts INT;
    v_ip_attempts INT;
    v_prefix_lockout_level INT;
    v_ip_lockout_level INT;
    v_lockout_until TIMESTAMPTZ;
BEGIN
    -- Check prefix lockout
    SELECT lockout_level, lockout_until
    INTO v_prefix_lockout_level, v_lockout_until
    FROM access_code_lockouts
    WHERE prefix = p_prefix;

    IF v_lockout_until > NOW() THEN
        RETURN QUERY SELECT
            FALSE,
            EXTRACT(EPOCH FROM (v_lockout_until - NOW()))::INT,
            v_prefix_lockout_level;
        RETURN;
    END IF;

    -- Count recent attempts for prefix
    SELECT COUNT(*) INTO v_prefix_attempts
    FROM access_code_attempts
    WHERE prefix = p_prefix
      AND attempted_at > NOW() - INTERVAL '5 minutes'
      AND success = FALSE;

    -- Count recent attempts for IP
    SELECT COUNT(*) INTO v_ip_attempts
    FROM access_code_attempts
    WHERE ip_address = p_ip
      AND attempted_at > NOW() - INTERVAL '5 minutes'
      AND success = FALSE;

    -- Check if either limit exceeded
    IF v_prefix_attempts >= p_max_attempts OR v_ip_attempts >= p_max_attempts THEN
        -- Increment lockout level and set lockout
        -- ... implementation details ...
        RETURN QUERY SELECT FALSE, lockout_seconds, new_lockout_level;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 0, 0;
END;
$$ LANGUAGE plpgsql;
"""
```

### Access Code Validation Response
```python
# Source: CONTEXT.md requirements
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RoleResponse(BaseModel):
    id: str
    name: str
    priority: int
    permission_keys: list[str]


class UserContextResponse(BaseModel):
    id: str
    name: Optional[str]
    email: str
    user_type: str  # "admin" | "va"
    org_id: str
    is_admin: bool


class AccessCodeValidateResponse(BaseModel):
    """Response from successful access code validation."""
    access_token: str
    expires_in: int  # seconds
    user: UserContextResponse
    roles: list[RoleResponse]
    effective_permission_keys: list[str]
    rbac_version: str  # or permissions_updated_at timestamp


class AccessCodeErrorResponse(BaseModel):
    """Response for failed access code validation."""
    error_code: str  # Machine-readable: "INVALID_CODE", "ACCOUNT_DISABLED", "RATE_LIMITED"
    message: str     # User-facing: "Invalid access code"
    retry_after: Optional[int] = None  # For rate limit errors
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt for hashing | Argon2id | 2015 (PHC winner), RFC 9106 in 2021 | More memory-hard, better against GPU attacks |
| SHA256 + salt | argon2-cffi PasswordHasher | Always was wrong | Never use fast hashes for secrets |
| random.choice() | secrets.choice() | Python 3.6 (2016) | Cryptographically secure RNG |
| In-memory rate limits | Database-backed | When scaling to multiple instances | Survives restarts, works distributed |

**Deprecated/outdated:**
- **bcrypt:** Still secure but Argon2 is the modern standard (RFC 9106)
- **flask-limiter patterns:** slowapi is the FastAPI adaptation, same concepts

## Open Questions

Things that couldn't be fully resolved:

1. **Redis vs PostgreSQL for rate limiting**
   - What we know: PostgreSQL works fine for moderate scale, Redis is faster
   - What's unclear: At what scale does PostgreSQL become insufficient?
   - Recommendation: Start with PostgreSQL (already in stack), add Redis if needed

2. **Access code JWT secret management**
   - What we know: Need separate secret from Supabase JWT secret
   - What's unclear: Should it be rotatable? How to handle rotation?
   - Recommendation: Use static secret for v1, add rotation mechanism later if needed

3. **Token refresh pattern for extension**
   - What we know: Short-lived tokens (15 min) need refresh mechanism
   - What's unclear: Should extension use refresh tokens or re-validate access code?
   - Recommendation: Use refresh tokens (include refresh_token in response)

## Sources

### Primary (HIGH confidence)
- [argon2-cffi 25.1.0 documentation](https://argon2-cffi.readthedocs.io/en/stable/) - API, parameters, profiles
- [argon2-cffi API Reference](https://argon2-cffi.readthedocs.io/en/stable/api.html) - PasswordHasher class details
- [Python secrets module](https://docs.python.org/3/library/secrets.html) - Secure random generation
- [PyJWT 2.10.1 documentation](https://pyjwt.readthedocs.io/en/latest/usage.html) - JWT encoding/decoding
- [slowapi GitHub](https://github.com/laurentS/slowapi) - Rate limiting for FastAPI

### Secondary (MEDIUM confidence)
- [argon2-cffi parameters](https://argon2-cffi.readthedocs.io/en/stable/parameters.html) - Parameter tuning guidance
- [slowapi documentation](https://slowapi.readthedocs.io/) - Usage patterns
- [HackerOne rate limiting guide](https://www.hackerone.com/blog/rate-limiting-strategies-protecting-your-api-ddos-and-brute-force-attacks) - Security patterns
- [OWASP Blocking Brute Force Attacks](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks) - Security best practices
- Existing codebase: `apps/api/src/app/routers/automation.py` - JWT generation pattern

### Tertiary (LOW confidence)
- WebSearch results for progressive lockout patterns - Community patterns, not officially documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation and established libraries
- Architecture: HIGH - Follows existing codebase patterns + official docs
- Pitfalls: MEDIUM - Mix of official docs and community experience

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - stable domain, well-established patterns)
