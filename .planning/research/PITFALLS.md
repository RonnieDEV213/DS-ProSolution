# Pitfalls Research

**Domain:** Access codes, extension authentication, RBAC, and presence systems
**Researched:** 2026-01-18
**Confidence:** HIGH (verified against OWASP, official docs, codebase patterns)

## Critical Pitfalls

### Pitfall 1: Access Code Stored in Plain Text

**What goes wrong:**
Access codes (prefix + secret) are stored unhashed in the database. A database breach exposes all valid access codes, allowing attackers to authenticate as any user into the extension.

**Why it happens:**
Developers treat access codes like display identifiers rather than credentials. The prefix portion needs to be readable (for user identification), so the entire code gets stored plaintext.

**How to avoid:**
- Store prefix and secret separately in the database
- Hash the secret portion using bcrypt/argon2 (same as passwords)
- On authentication: user provides full code, backend splits by known prefix length, hashes secret, compares
- Never log or return the full access code after initial generation

**Warning signs:**
- Database schema stores `access_code VARCHAR` as a single column
- Access code appears in API responses or logs after creation
- No hashing library imported in access code generation/validation code

**Phase to address:**
Phase 1 (Access Code System) - core security requirement before any code generation

---

### Pitfall 2: Extension Token Storage in localStorage

**What goes wrong:**
Extension stores authentication tokens (install_token) in localStorage instead of chrome.storage. Malicious scripts on web pages can read localStorage, exfiltrating tokens and hijacking extension sessions.

**Why it happens:**
Web developers default to localStorage because it's familiar. They don't realize that content scripts execute in webpage context where localStorage is vulnerable.

**How to avoid:**
- Use `chrome.storage.local` for tokens (current codebase does this correctly)
- For highly sensitive data, use `chrome.storage.session` (clears on browser close)
- Consider encrypting tokens before storage using Web Crypto API
- Never store tokens in content scripts or pass them to webpage context

**Warning signs:**
- `localStorage.setItem()` calls with token data in extension code
- Tokens accessible from `window.localStorage` in browser devtools on web pages
- Content scripts handling authentication directly

**Phase to address:**
Phase 2 (Extension Auth Flow) - verify storage patterns before implementing auth

---

### Pitfall 3: RBAC Bypass via Client-Side Only Enforcement

**What goes wrong:**
Extension renders tabs based on permissions loaded from backend, but backend doesn't re-verify permissions on each action. Attacker modifies extension code to show hidden tabs, then calls APIs that lack server-side permission checks.

**Why it happens:**
RBAC feels "implemented" once the UI hides features. Developers assume hidden UI means protected functionality. Backend permission checks seem redundant.

**How to avoid:**
- Every backend endpoint must independently verify permissions (current codebase pattern)
- Extension tab visibility is UX convenience, not security
- Use `require_permission_key()` decorator pattern on all sensitive endpoints
- Log and alert on permission violations (could indicate tampering)

**Warning signs:**
- API endpoints without permission decorators/middleware
- Permission checks only in frontend code
- "The extension checks permissions" used as justification for missing backend validation

**Phase to address:**
Phase 3 (Extension RBAC) - enforce server-side checks for every feature exposed via extension

---

### Pitfall 4: Access Code Brute Force via Insufficient Rate Limiting

**What goes wrong:**
Access codes use short secrets (6-8 chars). Without rate limiting, attackers enumerate valid codes by trying combinations. A 6-digit numeric code has only 1 million possibilities - trivially brute-forceable.

**Why it happens:**
Rate limiting feels like an optimization, not a security requirement. Teams plan to "add it later" but ship without it.

**How to avoid:**
- Implement rate limiting on extension auth endpoint from day one
- Rate limit per: IP address, install_instance_id, and globally
- Use exponential backoff: 5 failures = 30s wait, 10 failures = 5min, 15 failures = 1hr lockout
- Log failed attempts for security monitoring
- Use sufficiently long secrets (12+ chars mixing alphanumeric)

**Warning signs:**
- No rate limiting middleware on `/extension/auth` endpoint
- Access code secret less than 12 characters
- No logging of failed authentication attempts
- No lockout mechanism after repeated failures

**Phase to address:**
Phase 2 (Extension Auth Flow) - implement before allowing access code authentication

---

### Pitfall 5: Presence Race Conditions on Connect/Disconnect

**What goes wrong:**
User connects to account, presence shows "occupied". Network hiccup causes brief disconnect. During reconnection window, another user connects. Both think they have exclusive access. Data conflicts or duplicate operations result.

**Why it happens:**
Presence systems handle happy paths (connect, disconnect) but not edge cases (reconnect, network jitter, browser crash). Supabase Presence doesn't guarantee message delivery.

**How to avoid:**
- Add grace period on disconnect (30-60 seconds) before marking account as available
- Use optimistic locking on account operations (check occupant before mutation)
- Implement "session takeover" confirmation when occupant mismatch detected
- Store authoritative occupancy state in database, not just Presence channel
- Handle `TIMED_OUT` errors gracefully with automatic reconnection

**Warning signs:**
- Presence shows user as disconnected immediately on network issues
- No database-backed occupancy state (relying solely on realtime)
- Multiple users successfully connecting to same account simultaneously
- Operations proceeding without checking current occupant

**Phase to address:**
Phase 4 (Presence/Occupancy) - design for reconnection scenarios from the start

---

### Pitfall 6: Role Explosion in Extension Tab Mapping

**What goes wrong:**
Each combination of permissions creates a new "extension role". With 10 possible tabs and binary show/hide, there are 1024 possible configurations. System becomes unmaintainable as each role needs custom tab rendering logic.

**Why it happens:**
Teams start with "simple" role-to-tab mapping. Requirements grow: "VAs with permission X should also see tab Y if they have permission Z". Combinatorial explosion follows.

**How to avoid:**
- Map permissions directly to tabs, not roles to tabs (current codebase pattern is correct)
- Each tab declares its required permission_key(s)
- Extension loads user's permission_keys and shows tabs where all requirements are met
- Admins bypass (see all tabs) - no special role handling needed
- Keep permission-to-tab mapping in single configuration object

**Warning signs:**
- Conditionals like `if (role === 'va_senior' || role === 'va_lead') showTab('X')`
- Growing switch statements based on role names
- Backend returning "extension_tabs" list instead of permission_keys
- Roles being created specifically to control extension access

**Phase to address:**
Phase 3 (Extension RBAC) - design permission-based (not role-based) tab visibility

---

### Pitfall 7: Access Code Rotation Invalidating Active Sessions

**What goes wrong:**
User rotates their access code. All active extension sessions using the old code become invalid. VAs mid-task get kicked out, losing work. Confusion and support tickets follow.

**Why it happens:**
Rotation is implemented as "delete old, create new" rather than "create new, grace period, delete old". Sessions are tied directly to access code validation on every request.

**How to avoid:**
- Extension auth should issue session tokens, not validate access code on each request
- Access code is for initial authentication only, not ongoing session validation
- After auth, extension uses install_token (JWT) for API calls (current pattern is correct)
- Rotation should not invalidate existing JWTs - they have their own expiration
- Consider optional "force logout all sessions" as separate action from rotation

**Warning signs:**
- Access code passed in Authorization header for all extension API calls
- "Rotate code" button warns about session invalidation
- Users complaining about being logged out unexpectedly
- Backend re-validates access code on every request

**Phase to address:**
Phase 1 (Access Code System) - clarify auth vs session distinction early

---

### Pitfall 8: Unmasked Access Code Exposed via Screen Sharing

**What goes wrong:**
Admin shares screen during support call. User clicks "reveal" on access code. Remote viewer captures the code. Later uses it to access extension with user's permissions.

**Why it happens:**
Reveal functionality is implemented without considering screen-sharing contexts. No warning or additional confirmation before reveal.

**How to avoid:**
- Add friction to reveal: require click-and-hold (2 seconds) or re-authentication
- Display warning: "Your code will be visible. Are you sharing your screen?"
- Auto-mask after timeout (5-10 seconds of visibility)
- Consider "copy to clipboard" as primary action (code never visually shown)
- Log reveal events for audit trail

**Warning signs:**
- Reveal is instant single-click without confirmation
- No auto-re-mask timer
- No audit logging of reveal events
- Screen reader announces full code without warning

**Phase to address:**
Phase 1 (Access Code System) - UX design should include reveal safeguards

---

### Pitfall 9: Extension Auth Bypassing Pairing Approval

**What goes wrong:**
Access code auth endpoint doesn't verify that the extension instance (install_instance_id) was previously approved via pairing flow. Attacker installs extension, skips pairing, directly calls auth endpoint with stolen access code.

**Why it happens:**
Pairing and access code auth are developed as separate features. No one connects them: "User has valid access code" doesn't imply "User's extension instance was approved".

**How to avoid:**
- Extension auth endpoint must verify: (1) valid access code AND (2) approved pairing for this install_instance_id
- Store pairing approval status and associate with install_instance_id
- Auth should fail with "Extension not authorized" if pairing missing/rejected
- Consider access code as second factor after pairing, not standalone auth

**Warning signs:**
- Auth endpoint only validates access code, ignores install_instance_id
- Fresh extension install can authenticate without admin approval
- Pairing approval stored but never checked during auth
- No "unauthorized device" error path in auth flow

**Phase to address:**
Phase 2 (Extension Auth Flow) - integrate pairing verification into auth

---

### Pitfall 10: Presence System Leaking User Identity to VAs

**What goes wrong:**
Presence payload includes user_id or username. VAs see "John Smith is working on Account X". Privacy violated - VAs shouldn't know who else is working, only that account is occupied.

**Why it happens:**
Developers include all available data in presence payload for debugging or "future features". They forget the requirement that VAs see "Occupied" while Admins see "John Smith".

**How to avoid:**
- Design presence payloads with minimal data (is_occupied, occupant_role only)
- Backend filters presence data based on requester's role before returning
- Admins get full payload (user_id, name, started_at)
- VAs get sanitized payload (is_occupied: true, no user identity)
- Never send sensitive data that "might be filtered client-side"

**Warning signs:**
- Presence payload includes username/email
- Same presence endpoint returns same data to all requesters
- Client-side filtering of presence data based on viewer role
- Console logging presence updates shows user identity

**Phase to address:**
Phase 4 (Presence/Occupancy) - define payload schema with privacy requirements

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single access code column (no prefix/secret split) | Simpler schema | Can't hash secret while keeping prefix readable | Never - fundamental security issue |
| Hardcoded permission-to-tab mapping in extension | Faster to ship | Extension update required for any RBAC change | MVP only, plan migration before launch |
| Presence via polling instead of realtime | Avoids WebSocket complexity | High API load, delayed updates, poor UX | Never for occupancy - stale data causes conflicts |
| Skipping rate limiting on internal endpoints | "Only we call these" | Attackers find internal endpoints, brute force | Never on auth endpoints |
| Storing full access code in JWT claims | Avoid database lookup | Token theft exposes access code; code rotation requires token reissue | Never - JWT should contain user_id only |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Presence | Trusting presence state without database backup | Store authoritative state in DB; use Presence for real-time UI updates only |
| Supabase Realtime | Missing initial state fetch before subscribing | Fetch current state, then subscribe; handle events that arrive during transition |
| Chrome Storage API | Using sync storage for tokens | Use local storage (sync has size limits and cloud exposure) |
| Chrome Extension messaging | Trusting sender without validation | Always validate sender.id matches your extension ID |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Permission check on every API call via DB query | Slow API responses | Cache permission_keys in memory/JWT for session duration | >100 concurrent users |
| Presence channel per account | Too many realtime connections | Use single presence channel with account_id in payload | >50 accounts with active presence |
| Full RBAC reload on extension focus | UI flicker, slow tab rendering | Cache permissions, reload only on explicit refresh/reauth | Frequent tab switching |
| Storing presence history in database | Database growth, slow queries | Use time-partitioned tables or time-series DB | >1M presence events |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Access code in URL query params | Leaks via referrer header, browser history, server logs | POST body only, never GET params |
| Displaying access code in error messages | Leaks via screenshots, error reporting | Generic "invalid credentials" message |
| Same rate limit for all users | Distributed attack bypasses per-user limits | Global rate limit + per-user + per-IP combination |
| Extension debugging in production | Console logs expose auth flow | Conditional logging, strip in production build |
| Allowing unlimited prefix customization | Users choose predictable prefixes | Enforce format rules, disallow common patterns |
| No audit log for access code operations | Can't investigate compromises | Log: generate, rotate, reveal, auth_success, auth_fail |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Auto-rotate access code on schedule | VA loses access mid-shift without warning | Manual rotation with prominent "rotation recommended" notice |
| Reveal toggle with no visual timeout | User forgets code is visible | Auto-mask after 10 seconds with countdown |
| Presence showing stale "occupied" after crash | Other users can't access account | Heartbeat timeout (2 min) marks user as disconnected |
| Extension shows loading spinner during RBAC load | Perceived slowness on every focus | Cache last known permissions, update silently in background |
| Copy button requires reveal first | Extra click for common action | Copy without reveal (masked display remains) |
| No feedback on access code validation format | User types invalid format, submits, gets error | Real-time format validation as they type |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Access Code System:** Often missing audit logging - verify all operations (generate, rotate, reveal, copy) are logged
- [ ] **Access Code System:** Often missing format validation - verify prefix/secret both have enforced formats
- [ ] **Extension Auth:** Often missing install_instance_id verification - verify pairing approval is checked during auth
- [ ] **Extension Auth:** Often missing rate limiting - verify brute force protection exists before shipping
- [ ] **Extension RBAC:** Often missing server-side enforcement - verify every action has backend permission check
- [ ] **Extension RBAC:** Often missing admin bypass - verify admins see all tabs without requiring explicit permissions
- [ ] **Presence System:** Often missing reconnection handling - verify presence survives network hiccups
- [ ] **Presence System:** Often missing database backup - verify presence state is authoritative somewhere besides realtime channel
- [ ] **Presence System:** Often missing role-based filtering - verify VAs cannot see occupant identity

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Access codes stored unhashed | HIGH | Force-rotate all access codes; notify users; implement hashing; can't recover already-exposed codes |
| RBAC bypass exploited | MEDIUM | Audit logs to identify scope; add missing server-side checks; review affected data; notify impacted users |
| Extension tokens leaked | MEDIUM | Revoke all install_tokens; require re-pairing; implement token encryption |
| Presence race condition caused data conflict | LOW | Manual data reconciliation; add optimistic locking; implement conflict resolution |
| Role explosion | MEDIUM | Migration to permission-based system; consolidate redundant roles; update extension config |
| Rate limiting absent, brute force occurred | HIGH | Implement rate limiting; force-rotate affected access codes; review access logs; notify users |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Access code stored plaintext | Phase 1: Access Code System | Database schema review: separate columns for prefix (VARCHAR) and secret_hash (VARCHAR) |
| Access code brute force | Phase 2: Extension Auth Flow | Penetration test: attempt 100 invalid codes rapidly, verify lockout triggers |
| Extension token storage | Phase 2: Extension Auth Flow | Code review: grep for localStorage in extension code, should be zero |
| RBAC client-only enforcement | Phase 3: Extension RBAC | Security review: every endpoint has permission decorator |
| Admin bypass missing | Phase 3: Extension RBAC | Manual test: admin account sees all tabs without any role assignment |
| Role explosion | Phase 3: Extension RBAC | Code review: no role name strings in tab visibility logic |
| Presence race condition | Phase 4: Presence/Occupancy | Test: disconnect WiFi while connected, reconnect, verify presence recovers |
| Presence privacy leak | Phase 4: Presence/Occupancy | Test: VA cannot see admin name on shared account presence |
| Rotation session invalidation | Phase 1: Access Code System | Test: rotate code, verify existing extension sessions continue working |
| Pairing bypass | Phase 2: Extension Auth Flow | Test: fresh extension install, try auth without pairing, must fail |

## Sources

- [OWASP Browser Extension Vulnerabilities Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP Blocking Brute Force Attacks](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks)
- [Chrome Extension Permissions Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome Storage API Documentation](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Supabase Presence Documentation](https://supabase.com/docs/guides/realtime/presence)
- [Supabase Realtime Troubleshooting](https://supabase.com/docs/guides/troubleshooting)
- [6 Common RBAC Implementation Pitfalls (Idenhaus)](https://idenhaus.com/rbac-implementation-pitfalls/)
- [10 RBAC Best Practices (Oso)](https://www.osohq.com/learn/rbac-best-practices)
- [NN/g Password Masking UX](https://www.nngroup.com/articles/stop-password-masking/)
- [Handling Race Conditions in Real-Time Apps (DEV Community)](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8)
- Existing codebase patterns in `apps/api/src/app/auth.py` and `packages/extension/service-worker.js`

---
*Pitfalls research for: Access codes, extension authentication, RBAC, and presence systems*
*Researched: 2026-01-18*
