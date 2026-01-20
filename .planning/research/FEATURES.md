# Feature Research

**Domain:** Access Code Systems, Extension Authentication, RBAC-Driven UI, Presence Indicators
**Researched:** 2026-01-18
**Confidence:** HIGH (multiple authoritative sources verified patterns)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Access Code Generation** | Users need codes to authenticate; no code = no access | LOW | Generate cryptographically secure random strings; use prefix pattern (e.g., `va_` for VAs) for type identification |
| **Masked Display with Reveal Toggle** | Industry standard for secrets; users expect eye icon toggle | LOW | Default masked (dots/bullets), click to reveal. [Nielsen Norman Group research](https://www.nngroup.com/articles/stop-password-masking/) shows masking reduces usability without meaningfully improving security |
| **Copy to Clipboard** | Universal expectation for any code/key; reduces errors | LOW | Button adjacent to code field, immediate visual feedback ("Copied!"), auto-dismiss tooltip after 1-3 seconds |
| **Rotation/Regeneration** | Security best practice; users expect to revoke compromised codes | MEDIUM | Warn before regenerating (existing sessions invalidated), show new code only once, confirm action |
| **Extension Auth after Pairing** | Two-factor security is standard; pairing alone isn't sufficient | MEDIUM | Access code as second factor after device pairing approval; validates user identity, not just device |
| **Permission-Based Tab Visibility** | Users expect to see only features they can access | LOW | Hide tabs/features user has no permission for; reduces confusion and cognitive load |
| **Clear Error Messages on Invalid Code** | Form validation is expected to be helpful | LOW | Inline error below input, specific message ("Invalid access code" vs generic "Error"), red visual indicator |
| **Basic Presence Indicator** | Multi-user systems need occupancy awareness | MEDIUM | Green dot = online/active, gray = offline; prevents stepping on others' work |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Prefix + Secret Pattern** | Immutable prefix (user identification) + rotatable secret (security) | LOW | Pattern from [Stripe API keys](https://dev.to/hamd_writer_8c77d9c88c188/api-keys-the-complete-2025-guide-to-security-management-and-best-practices-3980) (`sk_live_xxx`); enables caching prefix while rotating secret |
| **Named Access Codes** | Multiple codes with recognizable names for different devices/purposes | MEDIUM | [Carbon Design System](https://carbondesignsystem.com/community/patterns/generate-an-api-key/) recommends naming keys for multi-key management; helps identify which code is used where |
| **Download as JSON** | Non-recoverable keys need backup option | LOW | One-click JSON download with timestamp; especially valuable since secret is shown only once |
| **Role-Based Tab Rendering** | Extension shows exactly what VA's roles permit | LOW | Each role = one tab; simple mental model; Admin bypasses = sees all tabs |
| **Privacy-Aware Presence ("Occupied" vs "Who")** | VAs see "Occupied" not specific user; Admin sees who | LOW | Respects VA privacy while giving Admin full visibility; reduces workplace politics |
| **Real-Time Presence Updates** | Live occupancy changes without refresh | HIGH | WebSocket/Supabase Realtime for instant updates; requires careful connection handling |
| **Customizable Access Code Prefix** | Let users personalize their prefix (within constraints) | LOW | Optional vanity prefix (validated: alphanumeric, length limits); improves recognition |
| **Auto-Logout on Code Rotation** | Security: rotating code invalidates active extension sessions | MEDIUM | Forces re-authentication; prevents lingering sessions after code change |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Show Access Code in Plaintext by Default** | "Easier to copy" | Security risk (shoulder surfing); violates principle of least exposure | Default masked with reveal toggle |
| **Retrievable Access Codes After Generation** | "I forgot my code" | Requires storing plaintext/reversible encryption; security anti-pattern | Show once + download option + regenerate; store only salted hash |
| **Automatic Code Rotation** | "Set and forget security" | Unexpected invalidation breaks active sessions; users lose trust | Manual rotation with clear warnings + optional expiration notification |
| **Fine-Grained Permission Toggles in Extension** | "Let users customize access" | RBAC already handles this; duplicates admin work; users can't grant themselves permissions | Permission display is read-only in extension; admin controls roles |
| **"Remember Me" for Access Code** | "Don't make me enter it again" | Defeats purpose of second factor; stored code is compromised code | Session persistence after successful auth (not code storage) |
| **Show Other Users' Specific Activities** | "I want to see what they're doing" | Privacy violation; creates surveillance anxiety; scope creep | Presence only shows "Occupied" + account name, not activity details |
| **Multiple Active Sessions Per Code** | "Use same code on multiple devices" | Security risk; hard to audit; can't revoke individual sessions | One active session per code; new login invalidates previous |
| **Extension-Side Permission Changes** | "Let VAs request permissions" | Bypasses admin workflow; audit complexity; security risk | VAs see what they have; permission changes go through admin UI only |

## Feature Dependencies

```
[Access Code Generation]
    |
    +--requires--> [Secure Hash Storage (bcrypt/argon2)]
    |
    +--enables--> [Masked Display with Reveal]
    |               |
    |               +--enables--> [Copy to Clipboard]
    |
    +--enables--> [Rotation/Regeneration]
                    |
                    +--requires--> [Session Invalidation Logic]

[Extension Pairing Approval] (existing)
    |
    +--enables--> [Access Code Authentication]
                    |
                    +--requires--> [Access Code Generation]
                    |
                    +--enables--> [Role/Permission Loading]
                                    |
                                    +--enables--> [Tab Rendering by Permission]

[Account Assignment] (existing)
    |
    +--enables--> [Presence Tracking]
                    |
                    +--requires--> [WebSocket/Realtime Connection]
                    |
                    +--enables--> [Presence Indicator Display]
```

### Dependency Notes

- **Access Code Generation requires Secure Hash Storage:** Codes must be stored as salted hashes (bcrypt/argon2), never plaintext; this is non-negotiable for security
- **Rotation requires Session Invalidation:** When code rotates, all active sessions using old code must terminate; requires backend tracking of which code issued which session
- **Tab Rendering requires Role/Permission Loading:** Extension must fetch user's roles on auth success; tab visibility is computed client-side from permission list
- **Presence Tracking requires Realtime Connection:** Heartbeat or WebSocket presence channel; Supabase Presence is a natural fit given existing stack
- **Extension Auth requires prior Pairing Approval:** Access code auth is second factor after device pairing; pairing flow already exists

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the core value proposition.

- [x] **Access Code Generation** - Core functionality; VAs need codes to authenticate
- [x] **Masked Display + Reveal Toggle** - Security baseline; standard UX
- [x] **Copy to Clipboard** - Usability essential; reduces friction
- [x] **Rotation with Warning** - Security baseline; handle compromised codes
- [x] **Extension Auth Flow (code entry after pairing)** - Core feature; second factor
- [x] **Invalid Code Error Handling** - Usability essential; clear feedback
- [x] **Role-Based Tab Visibility** - Core value; RBAC in extension
- [x] **Basic Presence Indicator (Online/Occupied)** - Prevents conflicts

### Add After Validation (v1.x)

Features to add once core is working and user feedback confirms direction.

- [ ] **Customizable Prefix** - When users request personalization
- [ ] **Download Code as JSON** - When users report code loss issues
- [ ] **Named Access Codes (multi-code)** - When VAs use multiple devices
- [ ] **Real-Time Presence Updates** - When polling latency causes issues
- [ ] **Session History/Audit** - When admins request visibility into code usage

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Expiration Dates on Codes** - Adds complexity; manual rotation sufficient for now
- [ ] **Two-Key Pattern (Primary/Secondary)** - Enterprise feature; overkill for internal tool
- [ ] **Biometric Confirmation for Reveal** - Paranoid security; adds friction
- [ ] **Permission Request Workflow** - Scope creep; admin workflow handles this

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Access Code Generation | HIGH | LOW | P1 |
| Masked Display + Reveal | HIGH | LOW | P1 |
| Copy to Clipboard | HIGH | LOW | P1 |
| Rotation/Regenerate | HIGH | MEDIUM | P1 |
| Extension Access Code Auth | HIGH | MEDIUM | P1 |
| Role-Based Tab Rendering | HIGH | LOW | P1 |
| Invalid Code Errors | HIGH | LOW | P1 |
| Basic Presence Indicator | MEDIUM | MEDIUM | P1 |
| Privacy-Aware Presence (Occupied vs Who) | MEDIUM | LOW | P1 |
| Customizable Prefix | LOW | LOW | P2 |
| Download as JSON | MEDIUM | LOW | P2 |
| Real-Time Presence Updates | MEDIUM | HIGH | P2 |
| Named/Multiple Codes | MEDIUM | MEDIUM | P3 |
| Session Audit Log | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (core value delivery)
- P2: Should have, add when resources allow
- P3: Nice to have, future consideration

## Competitor/Reference Feature Analysis

| Feature | Stripe (API Keys) | GitHub (PATs) | Slack (Extensions) | Our Approach |
|---------|-------------------|---------------|--------------------|--------------|
| Key Format | `sk_live_` prefix + random | `ghp_` prefix + random | OAuth tokens | Prefix (`va_`/`admin_`) + random secret |
| Visibility | Shown once, then masked | Shown once only | OAuth flow | Shown once, masked display with reveal |
| Rotation | Regenerate (instant revoke) | Regenerate | Re-auth | Regenerate with warning, session invalidation |
| Copy UX | Click to copy | Click to copy | N/A | Click to copy with feedback |
| Permissions | Per-key restrictions | Fine-grained scopes | OAuth scopes | Role-based (inherited from user) |
| Multi-key | Yes (multiple keys) | Yes (multiple PATs) | Multiple workspaces | Single code per user (v1); multi-code (v2) |

## UX Pattern Sources

### Access Code Management UX

**Masked Display Pattern:**
- Default to masked (dots/bullets)
- Eye icon toggle (LinkedIn, Adobe, Twitter pattern)
- Text-based "Show/Hide" acceptable alternative
- [Password UX research](https://www.toptal.com/designers/ux/password-ux) supports reveal toggle

**Copy to Clipboard Pattern:**
- Button immediately adjacent to code field
- Visual feedback: icon change (copy -> check) or tooltip ("Copied!")
- Auto-dismiss after 1-3 seconds
- [Flowbite](https://flowbite.com/docs/components/clipboard/), [PatternFly](https://www.patternfly.org/components/clipboard-copy/) document this pattern

**Rotation UX Pattern:**
- Warning modal before regeneration ("This will invalidate your current code")
- Show new code only once
- Optionally offer download before closing
- [Carbon Design System](https://carbondesignsystem.com/community/patterns/generate-an-api-key/) covers non-recoverable key warnings

### Extension Auth UX

**Post-Pairing Authentication:**
- Device pairing establishes trust in the device
- Access code establishes trust in the user
- Two-factor model: device (something you have) + code (something you know)
- Clear separation of concerns in UI

**Auth Flow Steps:**
1. Extension requests pairing (existing)
2. Admin approves pairing (existing)
3. Extension prompts for access code (NEW)
4. Code validated, roles fetched (NEW)
5. Tabs rendered per permissions (NEW)

### RBAC-Driven UI

**Conditional Rendering Pattern:**
- [React RBAC](https://www.permit.io/blog/implementing-react-rbac-authorization) recommends PermissionProvider + Restricted component
- UI gates are for visibility, not security (always validate server-side)
- Use typed permission keys (enums), not raw strings
- Hide vs disable: prefer hiding features user can't use

**Tab Visibility Logic:**
```
For each tab:
  if user.role === 'admin': show (bypass RBAC)
  else if user.permissions.includes(tab.requiredPermission): show
  else: hide
```

### Presence Indicators

**Visual Patterns:**
- Green dot = online/active
- Gray/hollow dot = offline
- [PubNub](https://www.pubnub.com/guides/the-importance-of-user-presence-in-real-time-technology/) and [Phoenix Presence](https://hexshift.medium.com/how-to-build-a-live-user-presence-indicator-with-phoenix-liveview-7f4ff57d077d) document these patterns

**Privacy-Aware Presence:**
- Admin view: "Account X: John (Online)"
- VA view: "Account X: Occupied"
- Prevents workplace surveillance while maintaining utility

**Handling Connection Jitter:**
- Don't immediately show "offline" on disconnect
- Use heartbeat with grace period (5-10 seconds)
- Prevents flickering presence on unstable connections

## Validation Rules for Access Codes

| Rule | Requirement | Error Message |
|------|-------------|---------------|
| Format | Prefix + underscore + alphanumeric | "Access code must be in format PREFIX_xxxxx" |
| Length | Prefix: 2-10 chars; Secret: 32+ chars | "Invalid access code format" |
| Expiration | None by default (v1) | N/A |
| Rate Limit | Max 5 failed attempts per minute | "Too many attempts. Try again in X seconds." |
| Case Sensitivity | Case-sensitive | "Access code is case-sensitive" |

## Sources

### Authoritative Design Systems
- [Carbon Design System - Generate an API Key](https://carbondesignsystem.com/community/patterns/generate-an-api-key/)
- [Flowbite - Copy to Clipboard](https://flowbite.com/docs/components/clipboard/)
- [PatternFly - Clipboard Copy](https://www.patternfly.org/components/clipboard-copy/)
- [Cloudscape Design System - Copy to Clipboard](https://cloudscape.design/components/copy-to-clipboard/)

### UX Research
- [Nielsen Norman Group - Stop Password Masking](https://www.nngroup.com/articles/stop-password-masking/)
- [Nielsen Norman Group - Error Form Design Guidelines](https://www.nngroup.com/articles/errors-forms-design-guidelines/)
- [Smashing Magazine - Inline Validation UX](https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/)
- [Smashing Magazine - Error Messages UX Design](https://www.smashingmagazine.com/2022/08/error-messages-ux-design/)
- [Toptal - Password UX](https://www.toptal.com/designers/ux/password-ux)

### Security Best Practices
- [GitGuardian - API Key Rotation Best Practices](https://blog.gitguardian.com/api-key-rotation-best-practices/)
- [DEV.to - API Keys Complete 2025 Guide](https://dev.to/hamd_writer_8c77d9c88c188/api-keys-the-complete-2025-guide-to-security-management-and-best-practices-3980)
- [Frontegg - API Token Generation Guide](https://frontegg.com/blog/the-full-guide-to-api-token-generation)

### RBAC and Authorization
- [Permit.io - Implementing React RBAC](https://www.permit.io/blog/implementing-react-rbac-authorization)
- [LogRocket - Access Control Models for Frontend](https://blog.logrocket.com/choosing-best-access-control-model-frontend/)
- [DEV.to - Conditional React UI based on Permissions](https://dev.to/worldlinetech/how-to-conditionally-render-react-ui-based-on-user-permissions-2amg)

### Presence Systems
- [PubNub - User Presence Guide](https://www.pubnub.com/guides/the-importance-of-user-presence-in-real-time-technology/)
- [System Design - Real Time Presence Platform](https://systemdesign.one/real-time-presence-platform-system-design/)
- [Medium - Live User Presence with Phoenix LiveView](https://hexshift.medium.com/how-to-build-a-live-user-presence-indicator-with-phoenix-liveview-7f4ff57d077d)

---
*Feature research for: Access Code Systems, Extension Authentication, RBAC-Driven UI, Presence Indicators*
*Researched: 2026-01-18*
