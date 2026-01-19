# Phase 3: Extension Auth Flow - Research

**Researched:** 2026-01-19
**Domain:** Chrome Extension MV3 Authentication, JWT Token Management, Session State Machines
**Confidence:** HIGH

## Summary

This phase adds access code authentication to the Chrome extension after pairing approval. The existing codebase provides a solid foundation: the backend access code validation endpoint (`POST /access-codes/validate`) returns a JWT and full RBAC context, and the extension already has state management patterns via `chrome.storage.local` and service worker communication.

The implementation involves adding a new "Clock In" flow between the existing pairing approval state and the hub/main UI. The extension will validate access codes against the backend, store the returned JWT in `chrome.storage.local`, and manage session state including 1-hour inactivity timeout with warning. The service worker's ephemeral nature requires careful state persistence and alarm-based timeout management.

**Primary recommendation:** Extend the existing extension state machine to include `clocked_in` state with access code input UI, using `chrome.alarms` for inactivity timeout and the existing `chrome.storage.local` pattern for JWT persistence.

## Standard Stack

The extension already uses vanilla JavaScript with Chrome MV3 APIs. No additional libraries needed.

### Core (Already in Codebase)
| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Chrome Extension MV3 | - | Extension platform | Existing |
| chrome.storage.local | - | Persistent state storage | Existing |
| chrome.alarms | - | Scheduled events/timeouts | Existing |
| chrome.runtime.connect | - | Side panel communication | Existing |
| fetch API | - | HTTP requests | Existing |

### Backend Dependencies (Already Built)
| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `POST /access-codes/validate` | Validate code, return JWT | JWT + user context + RBAC |
| Error codes | INVALID_CODE, RATE_LIMITED, CODE_EXPIRED, ACCOUNT_DISABLED | Structured errors |

### No Additional Libraries
The existing extension architecture is sufficient. Adding a state management library would be overkill for this simple auth flow.

## Architecture Patterns

### Current Extension State Flow
```
unpaired -> (pairing request) -> pending -> (approved) -> paired/hub
                                         -> (rejected) -> rejected
                                         -> (expired) -> expired
```

### New State Flow with Access Code Auth
```
unpaired -> (pairing request) -> pending -> (approved) -> needs_clock_in
                                                        -> (access code) -> clocked_in/hub
                                                        -> (clock out) -> needs_clock_in
                                                        -> (inactivity) -> clocked_out
needs_clock_in -> (access code validated) -> clocked_in
              -> (pairing revoked) -> unpaired
clocked_in -> (clock out button) -> needs_clock_in
           -> (code rotated) -> needs_clock_in
           -> (inactivity timeout) -> clocked_out
           -> (token expired) -> needs_clock_in
clocked_out -> (resume) -> needs_clock_in
```

### Recommended State Storage Schema

```javascript
// In chrome.storage.local
{
  // Existing pairing state
  install_instance_id: string,
  agent_id: string | null,
  install_token: string | null,  // Agent token from pairing

  // NEW: Access code auth state
  auth_state: 'needs_clock_in' | 'clocked_in' | 'clocked_out',
  access_token: string | null,        // JWT from access code validation
  access_token_expires_at: number,    // Unix timestamp
  user_context: {                     // From validation response
    id: string,
    name: string | null,
    email: string,
    user_type: 'admin' | 'va',
    org_id: string,
    is_admin: boolean,
  } | null,
  roles: Array<{id, name, priority, permission_keys}>,
  effective_permission_keys: string[],
  rbac_version: string,               // For cache invalidation

  // Session management
  last_activity_at: number,           // Unix timestamp
  session_started_at: number | null,  // For future time tracking
  clock_out_reason: 'manual' | 'inactivity' | 'code_rotated' | 'token_expired' | null,
}
```

### Service Worker Pattern: Validate Access Code

```javascript
// Source: Based on existing apiRequest pattern in service-worker.js
async function validateAccessCode(code) {
  const response = await fetch(`${API_BASE}/access-codes/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    return {
      ok: false,
      error_code: error.detail?.error_code || 'UNKNOWN',
      message: error.detail?.message || 'Validation failed',
      retry_after: error.detail?.retry_after || null,
    };
  }

  const data = await response.json();
  return { ok: true, data };
}
```

### Side Panel UI Pattern: Clock In Form

```html
<!-- Source: Matches existing section patterns in sidepanel.html -->
<section id="clock-in-section" class="section hidden">
  <h2>Clock In</h2>
  <div class="clock-in-form">
    <div class="input-group">
      <input
        type="password"
        id="access-code-input"
        placeholder="Enter access code"
        autocomplete="off"
      />
      <button id="btn-toggle-code" class="btn-icon" title="Show/hide code">
        <!-- eye icon -->
      </button>
    </div>
    <button id="btn-clock-in" class="btn btn-primary btn-full">Clock In</button>
    <div id="clock-in-error" class="error hidden"></div>
  </div>
</section>

<!-- Validating overlay -->
<div id="validating-overlay" class="overlay hidden">
  <div class="spinner"></div>
  <p>Clocking in...</p>
</div>
```

### Inactivity Timeout Pattern

```javascript
// Source: Chrome alarms API documentation
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes

// Create alarm when session starts
async function startInactivityTimer() {
  await chrome.alarms.clear('inactivity_warning');
  await chrome.alarms.clear('inactivity_timeout');

  const now = Date.now();
  await chrome.storage.local.set({ last_activity_at: now });

  // Warning at 55 minutes
  chrome.alarms.create('inactivity_warning', {
    when: now + INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS
  });

  // Timeout at 60 minutes
  chrome.alarms.create('inactivity_timeout', {
    when: now + INACTIVITY_TIMEOUT_MS
  });
}

// Reset on activity
async function resetInactivityTimer() {
  const state = await getState();
  if (state.auth_state !== 'clocked_in') return;
  await startInactivityTimer();
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'inactivity_warning') {
    broadcastToSidePanels({ type: 'INACTIVITY_WARNING', minutes_remaining: 5 });
  } else if (alarm.name === 'inactivity_timeout') {
    await clockOut('inactivity');
  }
});
```

### Anti-Pattern: Polling for Token Expiry

**Do not** poll for token expiry. Instead:
1. Store `access_token_expires_at` timestamp
2. Check on each API request
3. Use alarm for proactive warning if needed

## Don't Hand-Roll

Problems that have existing solutions in the codebase or platform.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom localStorage wrapper | `chrome.storage.local` | Already used, survives SW restart |
| Periodic checks | setInterval (won't survive SW death) | `chrome.alarms` | Persists across SW lifecycle |
| Side panel communication | Custom events | Existing port pattern | Already robust in codebase |
| JWT expiry calculation | Manual math | Backend `expires_in` field | Already provided in response |
| Error message display | Custom error handling | Existing `error` class pattern | Matches current UI |

**Key insight:** The existing extension architecture already solves the hard problems. Extend patterns, don't reinvent.

## Common Pitfalls

### Pitfall 1: Service Worker State Loss

**What goes wrong:** Storing auth state in service worker variables, losing it on SW termination.
**Why it happens:** MV3 service workers are ephemeral, terminated after 30 seconds of inactivity.
**How to avoid:** Always use `chrome.storage.local` as source of truth, never rely on in-memory state.
**Warning signs:** Auth state lost after browser sits idle, user has to re-enter code.

### Pitfall 2: Alarms Not Persisting

**What goes wrong:** Inactivity alarm doesn't fire after browser restart.
**Why it happens:** Chrome alarms are not guaranteed to persist across browser restarts.
**How to avoid:** Check alarm existence on service worker startup, recreate if missing.
**Warning signs:** User stays "clocked in" indefinitely after restart.

```javascript
// On service worker startup
chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  if (state.auth_state === 'clocked_in') {
    // Check if alarm exists
    const alarm = await chrome.alarms.get('inactivity_timeout');
    if (!alarm) {
      // Check if already expired based on last_activity_at
      const elapsed = Date.now() - state.last_activity_at;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        await clockOut('inactivity');
      } else {
        await startInactivityTimer();
      }
    }
  }
});
```

### Pitfall 3: Race Condition on Clock In

**What goes wrong:** User clicks Clock In twice, two validation requests fire.
**Why it happens:** Button not disabled during validation.
**How to avoid:** Disable button + show overlay immediately on click.
**Warning signs:** Duplicate API calls in network tab.

### Pitfall 4: Ignoring Network Errors vs Auth Errors

**What goes wrong:** Network error treated as invalid code, user frustrated.
**Why it happens:** All errors shown as "Invalid access code".
**How to avoid:** Distinguish error types, show appropriate messages.

```javascript
// Error type mapping
const ERROR_MESSAGES = {
  INVALID_CODE: 'Invalid access code',
  CODE_EXPIRED: 'Access code has expired. Generate a new one from your profile.',
  RATE_LIMITED: 'Too many attempts. Please wait.',
  ACCOUNT_DISABLED: 'Account suspended. Contact administrator.',
  NETWORK_ERROR: 'Connection error. Check your internet and try again.',
};
```

### Pitfall 5: Not Clearing Sensitive Data on Clock Out

**What goes wrong:** JWT remains in storage after clock out.
**Why it happens:** Only changing `auth_state`, not clearing tokens.
**How to avoid:** Explicitly clear `access_token` and user context on clock out.

```javascript
async function clockOut(reason) {
  await updateState({
    auth_state: 'clocked_out',
    access_token: null,
    user_context: null,
    roles: [],
    effective_permission_keys: [],
    clock_out_reason: reason,
    session_started_at: null,
  });
  await chrome.alarms.clear('inactivity_warning');
  await chrome.alarms.clear('inactivity_timeout');
}
```

### Pitfall 6: Blocking UI During Validation

**What goes wrong:** Side panel freezes, user thinks extension crashed.
**Why it happens:** No visual feedback during async operation.
**How to avoid:** Show overlay with spinner immediately, per CONTEXT.md requirements.

## Code Examples

Verified patterns adapted from existing codebase.

### Clock In Handler (Service Worker)

```javascript
// Source: Adapted from existing handleSidePanelMessage pattern
async function handleClockIn(code, port) {
  // Notify UI of validation start
  port.postMessage({ type: 'CLOCK_IN_STARTED' });

  // Validate against backend
  const result = await validateAccessCode(code);

  if (!result.ok) {
    port.postMessage({
      type: 'CLOCK_IN_FAILED',
      error_code: result.error_code,
      message: result.message,
      retry_after: result.retry_after,
    });
    return;
  }

  // Store auth data
  const { access_token, expires_in, user, roles, effective_permission_keys, rbac_version } = result.data;

  await updateState({
    auth_state: 'clocked_in',
    access_token,
    access_token_expires_at: Date.now() + (expires_in * 1000),
    user_context: user,
    roles,
    effective_permission_keys,
    rbac_version,
    session_started_at: Date.now(),
    clock_out_reason: null,
  });

  // Start inactivity timer
  await startInactivityTimer();

  // Notify success
  port.postMessage({ type: 'CLOCK_IN_SUCCESS' });
}
```

### Network Check Utility

```javascript
// Source: Based on navigator.onLine with fetch fallback
async function checkNetworkAvailable() {
  if (!navigator.onLine) {
    return false;
  }

  // Double-check with actual request (navigator.onLine can be unreliable)
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

### Token Validity Check

```javascript
// Source: Local pattern, no external call needed
function isTokenValid() {
  const state = await getState();
  if (!state.access_token || !state.access_token_expires_at) {
    return false;
  }
  // Add 30-second buffer for clock skew
  return Date.now() < state.access_token_expires_at - 30000;
}
```

### Resume Session on Browser Restart

```javascript
// Source: Adapted from existing initialize() pattern
async function checkSessionOnStartup() {
  const state = await getState();

  // Not clocked in, nothing to check
  if (state.auth_state !== 'clocked_in') {
    return;
  }

  // Check if token still valid
  if (!isTokenValid()) {
    await clockOut('token_expired');
    return;
  }

  // Check inactivity (alarm may not have fired during shutdown)
  const elapsed = Date.now() - state.last_activity_at;
  if (elapsed >= INACTIVITY_TIMEOUT_MS) {
    await clockOut('inactivity');
    return;
  }

  // Session valid, restart inactivity timer
  await startInactivityTimer();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Background pages | Service workers (MV3) | Chrome 88+ (2021) | Must use storage + alarms for persistence |
| setInterval for timeouts | chrome.alarms | MV3 migration | Alarms survive SW termination |
| localStorage in extensions | chrome.storage.local | Always recommended | Works in service workers |

**Deprecated/outdated:**
- `chrome.storage.sync` for auth tokens: Rate limited, not for frequent updates
- WebSQL: Removed from Chrome
- Background pages: Only for MV2 (deprecated)

## Open Questions

Things that couldn't be fully resolved.

1. **Token Refresh Strategy**
   - What we know: Access tokens expire in 15 minutes per existing code
   - What's unclear: Should we silently refresh, or require re-entry on expiry?
   - Recommendation: Per CONTEXT.md, require re-entry ("Clock In again") on token expiry. This is simpler and more secure for a VA work session context. Silent refresh adds complexity and the 1-hour inactivity timeout will usually trigger first anyway.

2. **Code Rotation Detection**
   - What we know: CONTEXT.md says "Immediate clock-out if access code is rotated"
   - What's unclear: How does extension know code was rotated? No push mechanism exists.
   - Recommendation: Detect on next API call (401 response), or add a polling check for code validity. Could also rely on user manually clocking out when they rotate their code in the web app. Simplest: Handle 401 from any API call as "session invalidated, please clock in again."

3. **Pairing Revocation While Clocked In**
   - What we know: CONTEXT.md mentions "Immediate clock-out if pairing is revoked"
   - What's unclear: Existing pairing uses `install_token`, separate from `access_token`
   - Recommendation: A 401 on any request using install_token should trigger full logout (unpaired state), while 401 on access_token just requires re-clock-in.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/packages/extension/service-worker.js` - state management patterns
- Existing codebase: `/packages/extension/sidepanel.js` - UI communication patterns
- Existing codebase: `/apps/api/src/app/routers/access_codes.py` - validation endpoint
- Existing codebase: `/apps/api/src/app/services/access_code.py` - JWT generation
- [Chrome alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) - timeout scheduling
- [Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) - persistence requirements

### Secondary (MEDIUM confidence)
- [Secure JWT Storage Best Practices](https://www.syncfusion.com/blogs/post/secure-jwt-storage-best-practices) - token storage patterns
- [Auth0 Community: MV3 Authentication](https://community.auth0.com/t/chrome-extension-manifest-v3-using-auth0-in-a-secure-manner/125433) - extension auth patterns
- [chrome.storage encryption](https://www.codestudy.net/blog/chrome-extension-encrypting-data-to-be-stored-in-chrome-storage/) - security considerations

### Tertiary (LOW confidence)
- Chrome extension state management forum discussions - community patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing codebase patterns, no new dependencies
- Architecture: HIGH - Extension already has the patterns, just extending state machine
- Pitfalls: HIGH - Well-documented MV3 challenges, verified with official docs
- Session management: MEDIUM - Inactivity timeout via alarms is proven, but edge cases around browser restart less documented

**Research date:** 2026-01-19
**Valid until:** 30 days (stable extension APIs, stable codebase patterns)
