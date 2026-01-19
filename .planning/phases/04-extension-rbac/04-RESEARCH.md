# Phase 4: Extension RBAC - Research

**Researched:** 2026-01-19
**Domain:** Chrome Extension RBAC, Tab-based UI Rendering, Permission-driven Navigation
**Confidence:** HIGH

## Summary

This phase implements RBAC-driven tab visibility in the Chrome extension. The backend infrastructure is fully in place: the `/access-codes/validate` endpoint returns complete RBAC data including `roles` (list of assigned department roles with permission keys), `effective_permission_keys` (flat list of all permissions), and `user.is_admin` flag. The extension already stores this data in `chrome.storage.local` after clock-in.

The implementation involves transforming the static hub UI into a dynamic tab-based interface where each department role becomes a tab (role name = tab name). Admins bypass role checks and see all tabs. VAs see only tabs matching their assigned roles. The logout mechanism exists from Phase 3 (Clock Out button), but needs repositioning to a new profile/identity section per CONTEXT.md decisions.

**Primary recommendation:** Extend the existing hub section with a tab bar rendered from stored `roles` array, show empty state for VAs with no roles, add admin indicator badge, and implement periodic permission re-check using existing `chrome.alarms` pattern.

## Standard Stack

The extension uses vanilla JavaScript with Chrome MV3 APIs. No additional libraries needed.

### Core (Already in Codebase)
| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| chrome.storage.local | - | Stores roles, permissions after clock-in | Existing |
| chrome.alarms | - | Can be used for periodic permission re-check | Existing |
| Service Worker Pattern | - | State management, API communication | Existing |

### Backend Dependencies (Already Built)
| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `POST /access-codes/validate` | Returns RBAC data on clock-in | JWT + user context + roles + effective_permission_keys |
| `GET /admin/department-roles` | List all org roles (for potential re-check) | Array of department roles |

### Data Already Available After Clock-In

```javascript
// In chrome.storage.local (from Phase 3)
{
  user_context: {
    id: string,
    name: string | null,
    email: string,
    user_type: 'admin' | 'va',
    org_id: string,
    is_admin: boolean,  // KEY: Determines admin bypass
  },
  roles: [                     // KEY: Array of assigned department roles
    {
      id: string,
      name: string,           // Becomes tab name
      priority: number,       // Could be used for ordering
      permission_keys: string[]
    }
  ],
  effective_permission_keys: string[],  // Flat list of all permissions
  rbac_version: string,       // ISO timestamp for change detection
}
```

## Architecture Patterns

### Current Extension State Flow (from Phase 3)
```
unpaired -> paired -> needs_clock_in -> clocked_in (hub shown)
                                     -> clocked_out
```

### New Hub UI Structure with RBAC
```
clocked_in -> Hub with:
  - Profile/Identity Section (user name, type, Clock Out button)
  - Tab Bar (rendered from roles array)
  - Active Tab Content
  - Loading State (skeleton tabs while permissions load)
  - Empty State (if VA has zero roles)
  - Admin Badge (if user.is_admin)
```

### Recommended HTML Structure

```html
<!-- Profile/Identity Section -->
<section class="profile-section">
  <div class="profile-info">
    <span class="user-name">{user.name}</span>
    <span class="user-type-badge">{user.user_type}</span>
    <span class="admin-badge hidden">Admin View</span>
  </div>
  <button id="btn-clock-out" class="btn btn-danger">Clock Out</button>
</section>

<!-- Tab Bar (dynamically rendered) -->
<nav class="tab-bar">
  <!-- Rendered from roles array -->
  <button class="tab active" data-role-id="abc">Order Tracking</button>
  <button class="tab" data-role-id="def">Accounts</button>
</nav>

<!-- Tab Content -->
<div class="tab-content">
  <!-- Content for active tab -->
</div>

<!-- Empty State (for VAs with no roles) -->
<section class="empty-state hidden">
  <p>No features assigned. Contact your admin.</p>
</section>

<!-- Skeleton Loading (while permissions load) -->
<nav class="tab-bar-skeleton hidden">
  <div class="skeleton-tab"></div>
  <div class="skeleton-tab"></div>
</nav>
```

### Tab Rendering Logic

```javascript
// Source: Pattern based on existing sidepanel.js render() function
function renderTabs() {
  const state = await getState();
  const { user_context, roles } = state;

  // Admin sees all tabs
  if (user_context?.is_admin) {
    renderAdminTabs();
    showAdminBadge();
    return;
  }

  // VA with no roles - empty state
  if (!roles || roles.length === 0) {
    showEmptyState();
    return;
  }

  // VA with roles - render assigned tabs
  // Sort by role assignment order (priority field or array order)
  const sortedRoles = roles.sort((a, b) => a.priority - b.priority);

  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = sortedRoles.map((role, index) => `
    <button class="tab ${index === 0 ? 'active' : ''}"
            data-role-id="${role.id}"
            data-role-name="${escapeHtml(role.name)}">
      ${getRoleIcon(role.name)}
      <span>${escapeHtml(role.name)}</span>
    </button>
  `).join('');

  // Show first tab content
  if (sortedRoles.length > 0) {
    showTabContent(sortedRoles[0].id);
  }
}
```

### Admin Tab Rendering

```javascript
// Source: For admin users, show all possible extension tabs
// These correspond to the extension features, not database roles
const ADMIN_TABS = [
  { id: 'order_tracking', name: 'Order Tracking', icon: '📋' },
  { id: 'accounts', name: 'Accounts', icon: '🏪' },
  // Add more as features are built
];

function renderAdminTabs() {
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = ADMIN_TABS.map((tab, index) => `
    <button class="tab ${index === 0 ? 'active' : ''}"
            data-tab-id="${tab.id}">
      <span class="tab-icon">${tab.icon}</span>
      <span>${tab.name}</span>
    </button>
  `).join('');
}
```

### Permission Re-check Pattern

```javascript
// Source: Adapted from existing chrome.alarms pattern
const PERMISSION_RECHECK_MINUTES = 5;

// Start periodic re-check on clock-in
async function startPermissionRecheck() {
  await chrome.alarms.clear('permission_recheck');
  chrome.alarms.create('permission_recheck', {
    periodInMinutes: PERMISSION_RECHECK_MINUTES
  });
}

// Handle re-check alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'permission_recheck') {
    await checkPermissionChanges();
  }
});

async function checkPermissionChanges() {
  const state = await getState();
  if (state.auth_state !== 'clocked_in') return;

  // Fetch current RBAC version from backend
  // Could use /access-codes/validate with stored JWT, or a lightweight check endpoint
  // For simplicity: re-validate using stored data won't work (no code)
  // Instead: check rbac_version via a new endpoint or on next API call

  // If rbac_version changed, force re-auth
  const currentVersion = await fetchRbacVersion();
  if (currentVersion !== state.rbac_version) {
    await clockOut('roles_changed');
  }
}
```

### Anti-Patterns to Avoid

- **Storing tabs in hardcoded HTML:** Tabs must be rendered dynamically from roles array
- **Checking permissions on every click:** Check once on render, cache in state
- **Polling backend every second:** Use reasonable interval (5 min) or on visibility change
- **Hiding tabs with CSS only:** Actually don't render unauthorized tabs (security, not just UX)

## Don't Hand-Roll

Problems that have existing solutions in the codebase or platform.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role data storage | Custom state manager | Existing chrome.storage.local pattern | Already working |
| User type checking | Complex role hierarchy | `user_context.is_admin` boolean | Backend already computes |
| Permission checking | Manual permission tree | `effective_permission_keys` array | Flat list, O(1) lookup |
| Tab ordering | Custom sort | `roles[].priority` from backend | Already provided |
| Periodic checks | setInterval | chrome.alarms | Survives SW termination |
| Logout | New mechanism | Existing Clock Out handler | Just reposition UI |

**Key insight:** Phase 3 already implemented the hard parts (auth state, JWT storage, logout). Phase 4 is primarily UI rendering based on stored data.

## Common Pitfalls

### Pitfall 1: Forgetting Admin Has No Roles Array

**What goes wrong:** Admin user sees empty state because `roles` is empty for admins.
**Why it happens:** Backend doesn't fetch roles for admins (they have all permissions).
**How to avoid:** Check `is_admin` FIRST, before checking `roles.length`.
**Warning signs:** Admin can clock in but sees "No features assigned" message.

```javascript
// WRONG
if (roles.length === 0) {
  showEmptyState();
}

// CORRECT
if (user_context.is_admin) {
  renderAdminTabs();
  return;
}
if (!roles || roles.length === 0) {
  showEmptyState();
}
```

### Pitfall 2: Re-rendering Tabs on Every State Update

**What goes wrong:** Tabs flicker/reset on any state change (task progress, stats, etc.)
**Why it happens:** Calling renderTabs() in generic render() function.
**How to avoid:** Only re-render tabs when role data actually changes.

```javascript
// Track rendered state
let renderedRbacVersion = null;

function maybeRenderTabs() {
  const state = await getState();
  if (state.rbac_version !== renderedRbacVersion) {
    renderTabs();
    renderedRbacVersion = state.rbac_version;
  }
}
```

### Pitfall 3: Not Handling Role Changes Mid-Session

**What goes wrong:** VA continues working with outdated permissions after admin changes their roles.
**Why it happens:** No mechanism to detect permission changes.
**How to avoid:** Periodic rbac_version check + force re-auth on change.
**Warning signs:** VA sees tabs they shouldn't (or missing tabs they should have).

### Pitfall 4: Exposing Tab Content to Unauthorized Users

**What goes wrong:** Hidden tabs still have their content in DOM, accessible via dev tools.
**Why it happens:** Using CSS `display: none` instead of not rendering.
**How to avoid:** Don't render unauthorized tab content at all. Check permissions before any data fetch.

### Pitfall 5: Tab Icons Not Stored in Roles

**What goes wrong:** Trying to get icons from `roles` data but field doesn't exist.
**Why it happens:** CONTEXT.md mentions icons but backend doesn't have them yet.
**How to avoid:** Use role name to look up icons from a local mapping, or defer icon support.

```javascript
// Icons are a UI concern - map locally
const ROLE_ICONS = {
  'Order Tracking': '📋',
  'Accounts': '🏪',
  'default': '📁'
};

function getRoleIcon(roleName) {
  return ROLE_ICONS[roleName] || ROLE_ICONS.default;
}
```

## Code Examples

Verified patterns adapted from existing codebase.

### Profile Section Rendering

```javascript
// Source: Adapted from existing renderHub() pattern
function renderProfileSection() {
  const { user_context } = currentState;

  if (elements.userName) {
    elements.userName.textContent = user_context?.name || 'User';
  }
  if (elements.userTypeBadge) {
    elements.userTypeBadge.textContent = user_context?.user_type || 'va';
  }
  if (elements.adminBadge) {
    if (user_context?.is_admin) {
      elements.adminBadge.classList.remove('hidden');
    } else {
      elements.adminBadge.classList.add('hidden');
    }
  }
}
```

### Tab Click Handler

```javascript
// Source: Standard event delegation pattern
elements.tabBar?.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;

  // Update active state
  elements.tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  // Show content
  const roleId = tab.dataset.roleId;
  showTabContent(roleId);
});
```

### Empty State

```javascript
function showEmptyState() {
  elements.tabBar?.classList.add('hidden');
  elements.tabContent?.classList.add('hidden');
  elements.emptyState?.classList.remove('hidden');

  if (elements.emptyStateMessage) {
    elements.emptyStateMessage.textContent = 'No features assigned. Contact your admin.';
  }
}
```

### Skeleton Loading State

```javascript
function showTabSkeleton() {
  elements.tabBarSkeleton?.classList.remove('hidden');
  elements.tabBar?.classList.add('hidden');
}

function hideTabSkeleton() {
  elements.tabBarSkeleton?.classList.add('hidden');
  elements.tabBar?.classList.remove('hidden');
}
```

### Logout with Reason

```javascript
// Source: Existing clockOut pattern, extended for roles_changed
async function clockOut(reason) {
  await updateState({
    auth_state: 'clocked_out',
    access_token: null,
    access_token_expires_at: null,
    user_context: null,
    roles: [],
    effective_permission_keys: [],
    session_started_at: null,
    clock_out_reason: reason,
  });

  await chrome.alarms.clear('inactivity_warning');
  await chrome.alarms.clear('inactivity_timeout');
  await chrome.alarms.clear('permission_recheck');

  broadcastState();
}

// Add to clocked-out messages
const CLOCK_OUT_MESSAGES = {
  'manual': 'You have clocked out.',
  'inactivity': 'Clocked out due to inactivity.',
  'code_rotated': 'Your access code was changed. Please clock in again.',
  'token_expired': 'Your session has expired. Please clock in again.',
  'roles_changed': 'Your permissions have changed. Please clock in again.',  // NEW
  'permission_fetch_failed': 'Could not verify permissions. Please clock in again.',  // NEW
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded feature tabs | Dynamic role-based tabs | This phase | Tabs match user permissions |
| Single hub view | Tab-based navigation | This phase | Multiple feature areas |
| No permission refresh | Periodic re-check | This phase | Catches mid-session role changes |

**Deprecated/outdated:**
- Static HTML tabs: Replace with dynamic rendering
- Permission checks on backend only: Extension must also respect RBAC for UX

## Open Questions

Things that couldn't be fully resolved.

1. **Tab Content Implementation**
   - What we know: Each tab shows different content (Order Tracking, Accounts, etc.)
   - What's unclear: What content goes in each tab? Are these just placeholders for now?
   - Recommendation: Phase 4 focuses on tab visibility/navigation. Content within tabs (actual Order Tracking UI, etc.) is likely future phases. Use placeholder content showing tab name for now.

2. **Permission Re-check Endpoint**
   - What we know: Need to detect if roles changed since clock-in
   - What's unclear: No lightweight endpoint exists for just rbac_version
   - Recommendation: Options:
     a) Re-validate access code (requires storing code - security risk)
     b) Add lightweight `/access-codes/rbac-version` endpoint
     c) Check on first API call in each tab (lazy)
     d) Use existing `/admin/department-roles` but requires admin token
   - Best option: Add simple endpoint that takes membership_id (from JWT) and returns rbac_version. Or detect 403 on any API call and force re-auth.

3. **What Tabs Should Admins See?**
   - What we know: "Admins see all extension tabs"
   - What's unclear: What ARE all the extension tabs? Only what's been built?
   - Recommendation: Define a constant `ADMIN_TABS` array with all planned extension features. For now: Order Tracking, Accounts. Add more as features are implemented.

4. **Role Icons**
   - What we know: CONTEXT.md says "Tabs have icons alongside role name - icon comes from role definition"
   - What's unclear: Backend `department_roles` table doesn't have an icon field
   - Recommendation: Two options:
     a) Add icon field to department_roles (requires migration) - deferred per CONTEXT.md
     b) Map role names to icons locally in extension (simpler, implement now)
   - Use option (b) for this phase.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/packages/extension/service-worker.js` - state schema, getState(), updateState()
- Existing codebase: `/packages/extension/sidepanel.js` - render patterns, element handling
- Existing codebase: `/apps/api/src/app/routers/access_codes.py` - validate endpoint response structure
- Existing codebase: `/apps/api/src/app/models.py` - RoleResponse, AccessCodeUserContext
- Existing codebase: `/apps/api/src/app/permissions.py` - DEPT_ROLE_PERMISSION_KEYS
- Phase 3 implementation: Complete auth flow with JWT storage

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions: Tab ordering, admin badge, empty state message, icon mention

### Tertiary (LOW confidence)
- Icon implementation details (role definition doesn't include icons yet)
- Permission re-check endpoint (needs to be designed)

## Metadata

**Confidence breakdown:**
- Tab rendering from roles: HIGH - Data structure is clear, existing patterns work
- Admin bypass: HIGH - `is_admin` boolean already available
- Empty state: HIGH - Simple UI with clear message
- Logout repositioning: HIGH - Just HTML/CSS changes
- Permission re-check: MEDIUM - Pattern is clear but endpoint may need creation
- Tab content: LOW - Placeholder until future phases define feature UIs

**Research date:** 2026-01-19
**Valid until:** 30 days (stable extension APIs, stable backend)
