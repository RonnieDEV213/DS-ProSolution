# Phase 1: Access Code Foundation - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend infrastructure for secure access code generation, hashing, and validation using Argon2. This phase delivers the API endpoints that generate codes, store hashed secrets, and validate codes returning user context. UI for managing codes belongs in Phase 2; extension usage belongs in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Access code format
- **Structure:** 4-character prefix + hyphen + 12-character secret (e.g., `AbC1-xYz2AbCdEfGh`)
- **Character set:** Full alphanumeric (A-Z, a-z, 0-9) — case-sensitive
- **Separator:** Hyphen between prefix and secret
- **Prefix uniqueness:** Globally unique — one prefix maps to one user
- **Collision handling:** Retry with new random prefix until unique (no length extension)

### API response behavior
- **Success response:** Return short-lived JWT access token AND full user context in same response:
  - `user`: { id, name, email, user_type, org_id, is_admin }
  - `roles`: [{ id, name, priority, permission_keys: [...] }] — for VAs; admins marked is_admin=true
  - `effective_permission_keys`: [...] — union across roles (or all perms if admin)
  - `rbac_version` or `permissions_updated_at` — so extension can detect changes
  - `expires_in` — token TTL
- **Response structure:** Same shape for Admin and VA users (Admin has is_admin=true)
- **Account status:** Validation endpoint checks if user account is active — rejects disabled accounts even with valid code
- **Error messages:**
  - User-facing: Generic "Invalid access code" — reveals nothing about what failed
  - Machine-readable: Stable `error_code` for extension/web app to handle UX
  - Server-side: Log detailed failure reasons
  - Exceptions: Show different message for "Access disabled" or "Too many attempts, try again later"

### Rate limiting strategy
- **Rate limit key:** Both IP address AND prefix (defense in depth)
- **Attempt threshold:** 10 failed attempts before lockout
- **Lockout duration:** Progressive — first lockout 5 min, second 15 min, third 1 hour, etc.
- **Manual unlock:** Admins can clear lockout for a user via admin action

### Code generation rules
- **Multiple codes:** No — one active code per user at a time. Generating new invalidates old
- **Expiration:** 90-day expiration — forces periodic rotation
- **Custom codes:** User can set custom secret portion (prefix always system-generated)
- **Custom secret validation:** 12+ characters, must include uppercase, lowercase, and numbers

### Claude's Discretion
- Prefix generation: random vs derived from user ID (user said "you decide")
- Display chunking: whether to show secret in groups of 4 for readability (user said "you decide")

</decisions>

<specifics>
## Specific Ideas

- JWT should be short-lived with refresh pattern for subsequent API calls
- Extension needs enough context in initial response to render UI without additional calls
- Machine-readable error codes allow extension to provide localized/branded error UX

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-access-code-foundation*
*Context gathered: 2026-01-18*
