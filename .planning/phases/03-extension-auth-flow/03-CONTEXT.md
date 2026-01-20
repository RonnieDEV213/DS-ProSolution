# Phase 3: Extension Auth Flow - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Extension requires and validates access code entry after pairing approval, storing user JWT on success. Users "clock in" with their access code to start a work session, and "clock out" when done. Session persists until logout, code rotation, or 1-hour inactivity.

</domain>

<decisions>
## Implementation Decisions

### Auth Entry UI
- Single text input for full access code (prefix + secret together)
- Input is masked by default (password-style) with optional reveal toggle
- Minimal UI — just the input field and submit button, no helper text or branding
- No "remember me" option — sessions always persist until explicit clock-out or timeout

### Validation Feedback
- Full overlay with spinner during validation (dim screen, centered loading indicator)
- Inline error messages below input on validation failure (red text)
- Clear input field after failed attempt (user starts fresh)
- "Clock In" button terminology, not "Login"

### Session Behavior
- Use "Clock In" / "Clock Out" terminology throughout (work session framing)
- Immediate clock-out when access code is rotated (extension detects and logs out)
- 1-hour inactivity timeout with warning before expiry ("Session expiring in 5 min")
- Show "Clocked out due to inactivity" message when user returns after timeout
- Visible "Clock Out" button in extension UI — prominent, not hidden in a menu
- Resume session on browser restart if JWT is still valid (skip clock-in)
- No visible session timer (duration tracked internally for future admin metrics)

### Edge Cases
- No offline mode — show "Connection required" message when network unavailable
- Immediate clock-out if pairing is revoked while user is clocked in

### Claude's Discretion
- Rate limiting lockout display (countdown vs simple message vs disabled input)
- Network error handling during validation (auto-retry vs manual retry)
- Exact placement of Clock Out button in extension UI
- Warning timing for inactivity timeout (5 min or different threshold)

</decisions>

<specifics>
## Specific Ideas

- "Clock In/Out" framing positions this as a work session, not just authentication
- Admin should eventually see time-worked metrics per VA on accounts/users pages (future phase)

</specifics>

<deferred>
## Deferred Ideas

- **Time tracking metrics for admin** — Display time worked per VA on accounts or users page. Not a new page, integrate into existing admin views. (Noted for future phase)

</deferred>

---

*Phase: 03-extension-auth-flow*
*Context gathered: 2026-01-18*
