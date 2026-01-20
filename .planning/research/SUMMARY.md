# Project Research Summary

**Project:** DS-ProSolution Access Code System & Extension RBAC
**Domain:** Authentication, RBAC, Chrome Extension Security
**Researched:** 2026-01-18
**Confidence:** HIGH

## Executive Summary

This project extends DS-ProSolution's existing extension pairing system with access code authentication (second factor) and RBAC-driven tab visibility. The research confirms that the existing tech stack (FastAPI, Supabase, Chrome Extension MV3) fully supports these features with minimal additions. The only new dependency required is `argon2-cffi` for cryptographic hashing of access code secrets, which is the OWASP 2025 gold standard for password/secret hashing.

The recommended approach follows a proven pattern: prefix + secret access codes (similar to Stripe's `sk_live_xxx` format), where the prefix enables database lookup and the secret is Argon2-hashed for security. Extension authentication becomes a second factor after the existing pairing approval flow. Tab visibility is computed from permission keys already present in the codebase, with admins bypassing RBAC entirely. Presence tracking uses heartbeat polling with short TTL (simpler than Supabase Realtime for MVP).

The primary risk is security implementation mistakes, particularly storing access codes unhashed or implementing RBAC only client-side. The PITFALLS.md identifies 10 critical pitfalls, all avoidable with proper architecture. Secondary risk is role explosion if tabs are mapped to roles instead of permissions directly. The codebase already uses permission keys correctly, so maintaining this pattern in the extension prevents this issue.

## Key Findings

### Recommended Stack

The existing stack is complete. No framework changes needed, only one new library addition.

**Core technologies:**
- **FastAPI + PyJWT**: API framework with JWT auth already implemented in `auth.py`
- **Supabase**: Database with existing RLS patterns for memberships and permissions
- **Chrome Extension MV3**: Already uses `chrome.storage.local` correctly for token persistence
- **argon2-cffi (NEW)**: OWASP-recommended hashing for access code secrets; memory-hard, resists GPU attacks

**What NOT to add:**
- bcrypt (older, less secure than Argon2)
- localStorage in extension (not available in MV3 service workers)
- chrome.storage.session (clears on browser close, bad for auth tokens)

### Expected Features

**Must have (table stakes):**
- Access code generation with prefix + secret format
- Masked display with reveal toggle (eye icon pattern)
- Copy to clipboard with visual feedback
- Rotation/regeneration with session warning
- Extension auth flow (code entry after pairing approval)
- Role-based tab visibility (permission_keys to tabs)
- Clear error messages on invalid codes
- Basic presence indicator (online/occupied)

**Should have (competitive):**
- Privacy-aware presence (VAs see "Occupied", Admins see names)
- Download code as JSON (non-recoverable backup)
- Auto-logout on code rotation (optional security feature)

**Defer (v2+):**
- Customizable access code prefix
- Named/multiple access codes per user
- Real-time presence updates (WebSocket)
- Expiration dates on codes
- Session audit log

### Architecture Approach

The architecture follows a clear layered pattern: database stores hashed secrets, backend validates and issues JWTs, extension caches permissions and renders UI accordingly. Critically, server-side permission checks remain enforced on all endpoints; extension tab visibility is UX convenience, not security.

**Major components:**
1. **Access Codes Table** (Supabase) — prefix (cleartext), secret_hash (Argon2), timestamps, FK to profiles
2. **Access Code API** (FastAPI `/auth/access-code/*`) — generate, rotate, validate endpoints with rate limiting
3. **Extension Auth Step** (Chrome Extension) — verifies code after pairing, stores user JWT, loads permissions
4. **Profile Settings Modal** (Next.js) — Extension tab with masked code display, reveal, copy, rotate
5. **Presence Manager** (polling-based) — heartbeat endpoint, short TTL, role-filtered responses

### Critical Pitfalls

1. **Access code stored plaintext** — Split prefix/secret; hash secret with Argon2; never log full code after generation
2. **RBAC bypass via client-side only** — Every backend endpoint must use `require_permission_key()` decorator; UI hiding is convenience, not security
3. **Access code brute force** — Rate limit auth endpoint from day one; exponential backoff; 12+ char secrets
4. **Extension auth bypassing pairing** — Auth endpoint must verify BOTH valid code AND approved install_instance_id
5. **Presence privacy leak** — Backend filters presence payloads by role; VAs get `{is_occupied: true}`, Admins get full details

## Implications for Roadmap

Based on research, suggested phase structure follows component dependencies:

### Phase 1: Access Code Foundation
**Rationale:** Access code storage and validation are prerequisites for both Profile UI and Extension auth. Must get hashing right from the start.
**Delivers:** Database schema, code generation/rotation endpoints, validation endpoint
**Addresses:** Access code generation, rotation, basic validation (table stakes)
**Avoids:** Pitfalls 1 (plaintext storage), 7 (rotation session invalidation), 8 (reveal safeguards)

### Phase 2: Profile Settings UI
**Rationale:** UI depends on backend endpoints being available. Can test access code flow end-to-end.
**Delivers:** Profile Settings modal with Extension tab, masked display, copy, reveal, rotate
**Uses:** Access code API endpoints from Phase 1
**Implements:** Frontend component architecture for profile management
**Addresses:** Masked display, copy to clipboard, rotation UX (table stakes)

### Phase 3: Extension Auth Flow
**Rationale:** Extension changes depend on backend verification endpoint. This is the core security feature.
**Delivers:** Access code input UI in extension, verified authentication flow, user JWT storage
**Uses:** `/auth/verify-access-code` endpoint, existing pairing approval
**Implements:** Extension auth step, chrome.storage token management
**Avoids:** Pitfalls 2 (localStorage), 4 (brute force), 9 (pairing bypass)

### Phase 4: Extension RBAC
**Rationale:** RBAC requires authenticated user with permissions loaded. Builds on Phase 3.
**Delivers:** Permission-based tab rendering, admin bypass, conditional UI
**Uses:** Permission keys from JWT, existing `dept_role_permissions` system
**Implements:** Tab registry, permission-to-tab mapping
**Avoids:** Pitfalls 3 (client-only RBAC), 6 (role explosion)

### Phase 5: Presence System
**Rationale:** Independent feature, can be built in parallel with later phases or deferred. Lower priority than core auth.
**Delivers:** Heartbeat endpoint, presence indicators, privacy-aware responses
**Uses:** Polling-based approach (simpler than Supabase Realtime for MVP)
**Addresses:** Basic presence indicator, privacy-aware presence (differentiators)
**Avoids:** Pitfalls 5 (race conditions), 10 (privacy leak)

### Phase Ordering Rationale

- **Dependencies:** Phase 1 -> Phase 2 (UI needs endpoints), Phase 1 -> Phase 3 (auth needs validation), Phase 3 -> Phase 4 (RBAC needs auth)
- **Security first:** Hashing and validation implemented before any UI exposes codes
- **Backend before frontend:** Each phase builds backend foundation before frontend consumption
- **Presence is independent:** Can be developed in parallel or deferred without blocking core features

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Extension Auth):** MV3 service worker lifecycle is tricky; verify token refresh patterns during planning
- **Phase 5 (Presence):** If real-time updates become required, will need Supabase Realtime research

Phases with standard patterns (skip research-phase):
- **Phase 1 (Access Code Foundation):** Well-documented Argon2 hashing, established prefix+secret pattern
- **Phase 2 (Profile Settings UI):** Standard React modal with shadcn/ui, follows existing codebase patterns
- **Phase 4 (Extension RBAC):** Permission-to-tab mapping is straightforward; existing `permission_keys` pattern is correct

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against official docs (Python secrets, argon2-cffi, Chrome Storage API); existing stack is sufficient |
| Features | HIGH | Multiple authoritative sources (Carbon Design, NNGroup, OWASP) confirm UX patterns; table stakes well-defined |
| Architecture | HIGH | Architecture derived from existing codebase patterns; integration points clearly identified |
| Pitfalls | HIGH | Verified against OWASP cheat sheets, Chrome extension docs, Supabase docs; mapped to specific phases |

**Overall confidence:** HIGH

### Gaps to Address

- **Token refresh strategy for extension:** Research recommended 30-day tokens for MVP simplicity; may need refinement based on actual session lengths
- **Presence scaling:** Polling works for current scale; if >100 concurrent users, revisit Supabase Realtime
- **Multi-device support:** v1 assumes single active session per code; multi-code feature deferred but may need earlier if VAs use multiple devices

## Sources

### Primary (HIGH confidence)
- [Python secrets module documentation](https://docs.python.org/3/library/secrets.html) — token generation patterns
- [argon2-cffi documentation](https://argon2-cffi.readthedocs.io/) — hashing implementation
- [OWASP Password Hashing Guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) — Argon2 recommendation
- [OWASP Browser Extension Vulnerabilities Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Browser_Extension_Vulnerabilities_Cheat_Sheet.html) — extension security
- [Chrome Extension MV3 Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — token storage patterns

### Secondary (MEDIUM confidence)
- [Carbon Design System - Generate an API Key](https://carbondesignsystem.com/community/patterns/generate-an-api-key/) — UX patterns for key management
- [Stripe API Key pattern](https://dev.to/hamd_writer_8c77d9c88c188/api-keys-the-complete-2025-guide-to-security-management-and-best-practices-3980) — prefix + secret format
- [NNGroup - Stop Password Masking](https://www.nngroup.com/articles/stop-password-masking/) — reveal toggle UX
- [Permit.io - Implementing React RBAC](https://www.permit.io/blog/implementing-react-rbac-authorization) — permission-based rendering

### Tertiary (LOW confidence)
- [PubNub Presence Guide](https://www.pubnub.com/guides/the-importance-of-user-presence-in-real-time-technology/) — presence patterns (may not apply directly to Supabase)

---
*Research completed: 2026-01-18*
*Ready for roadmap: yes*
