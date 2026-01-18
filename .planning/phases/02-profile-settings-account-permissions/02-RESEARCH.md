# Phase 2: Profile Settings & Account Permissions - Research

**Researched:** 2026-01-18
**Domain:** Web UI (React/Next.js), Modal patterns, Access Code UI, RBAC
**Confidence:** HIGH

## Summary

This phase builds a Profile Settings modal triggered from the sidebar bottom-left user area, with two tabs (Profile and Extension). The Extension tab shows access code management for Admin/VA users only. Additionally, the phase implements account:view permission for VAs to see a restricted view of accounts.

The codebase has well-established patterns for vertical-tab modals (UserEditDialog, DepartmentRoleDialog, AccountDialog). The access code API is fully implemented from Phase 1 with GET /access-codes/me, POST /access-codes (generate), and POST /access-codes/rotate endpoints. The permission system uses RBAC with department roles storing permission keys.

**Primary recommendation:** Follow the existing vertical-tab modal pattern (w-52 sidebar, h-[500px] content area, hideCloseButton). Use the existing toast notification system (sonner) for copy feedback. Implement hold-to-reveal with onMouseDown/onMouseUp or onPointerDown/onPointerUp events.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | latest | Modal dialogs | Already used throughout codebase |
| sonner | latest | Toast notifications | Established pattern in all dialogs |
| lucide-react | latest | Icons | Used via shadcn/ui |
| class-variance-authority | latest | Button variants | Already in shadcn/ui setup |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/lib/supabase/client | N/A | Auth session | API calls requiring Bearer token |
| @/lib/utils (cn) | N/A | Class merging | All conditional styling |
| @/hooks/use-user-role | N/A | Role detection | Checking if user is Admin/VA/Client |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom hold-to-reveal | react-use-gesture | Overkill for simple hold behavior |
| Icon feedback for copy | Toast feedback | Both valid; icon feels more immediate |

**Installation:**
No new packages needed - all libraries already available in apps/web/package.json.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── components/
│   ├── profile/
│   │   ├── profile-settings-dialog.tsx    # Main modal component
│   │   ├── profile-tab.tsx                # Profile info tab content
│   │   ├── extension-tab.tsx              # Extension/Access code tab content
│   │   └── access-code-display.tsx        # Access code reveal/copy/rotate widget
│   └── admin/
│       └── accounts-table.tsx             # Modified for account:view permission
├── hooks/
│   └── use-user-role.ts                   # Already exists - may need enhancement
└── app/
    ├── admin/layout.tsx                   # Sidebar with profile trigger
    ├── va/layout.tsx                      # Sidebar with profile trigger
    └── client/layout.tsx                  # Sidebar with profile trigger
```

### Pattern 1: Vertical-Tab Modal Dialog
**What:** Modal with sidebar navigation on left, content area on right
**When to use:** Settings dialogs, multi-section edit forms
**Example:**
```typescript
// Source: apps/web/src/components/admin/user-edit-dialog.tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent hideCloseButton className="sm:max-w-3xl p-0 bg-gray-900 border-gray-800 text-white overflow-hidden">
    <div className="flex h-[500px]">
      {/* Sidebar */}
      <div className="w-52 border-r border-gray-800 flex flex-col bg-gray-950">
        <DialogHeader className="p-4 border-b border-gray-800">
          <DialogTitle className="text-base">Title</DialogTitle>
          <DialogDescription className="sr-only">Description</DialogDescription>
        </DialogHeader>

        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => setActiveTab("tab-name")}
            className={cn(
              "w-full text-left px-3 py-2 rounded text-sm transition-colors",
              activeTab === "tab-name"
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800"
            )}
          >
            Tab Label
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab content */}
        </div>

        {/* Footer - optional */}
        <div className="border-t border-gray-800 p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

### Pattern 2: Toast Notification for Actions
**What:** Use sonner for success/error feedback
**When to use:** After API calls, user actions
**Example:**
```typescript
// Source: apps/web/src/components/admin/user-edit-dialog.tsx
import { toast } from "sonner";

// Success
toast.success("Code copied to clipboard");

// Error
toast.error(err instanceof Error ? err.message : "Failed to copy");

// Info
toast.info("No changes to save");
```

### Pattern 3: API Calls with Auth
**What:** Get session token and call API with Bearer header
**When to use:** All authenticated API calls
**Example:**
```typescript
// Source: apps/web/src/components/admin/accounts-table.tsx
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  toast.error("Not authenticated");
  return;
}

const res = await fetch(`${API_BASE}/access-codes/me`, {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
```

### Pattern 4: Role-Based UI Visibility
**What:** Show/hide UI based on user role
**When to use:** Admin-only features, VA-specific content
**Example:**
```typescript
// Source: apps/web/src/hooks/use-user-role.ts
const { role, isAdmin, hasAccessProfile, loading } = useUserRole();

// In component
{(role === "admin" || role === "va") && (
  <AccessCodeSection />
)}
```

### Anti-Patterns to Avoid
- **Hardcoded heights in content areas:** Use flex-1 and overflow-y-auto for scrollable content
- **Direct DOM manipulation for clipboard:** Use navigator.clipboard.writeText() with try/catch
- **Inline API_BASE urls:** Use const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
- **Missing loading states:** Always show loading indicator while fetching

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom overlay + portal | Dialog from @/components/ui/dialog | Accessibility, focus trap, escape handling |
| Tab navigation | Custom state management | useState + cn() pattern from existing dialogs | Consistency, tested pattern |
| Toast notifications | Custom notification system | sonner (already integrated) | Queueing, animations, types |
| Copy to clipboard | document.execCommand | navigator.clipboard.writeText() | Modern API, better error handling |
| Button variants | Custom button styles | Button from @/components/ui/button | Consistent design system |
| Role checking | Direct Supabase queries | useUserRole hook | Centralized, cached |

**Key insight:** The codebase has mature patterns. Copy existing dialog implementations rather than building from scratch.

## Common Pitfalls

### Pitfall 1: Sidebar Layout Differences
**What goes wrong:** Admin/VA/Client layouts have slightly different sidebars - modifying all three inconsistently
**Why it happens:** Each layout file (admin/layout.tsx, va/layout.tsx, client/layout.tsx) has its own sidebar implementation
**How to avoid:** Extract the user info + profile trigger into a reusable component OR modify all three consistently
**Warning signs:** Profile modal works on admin but not VA layout

### Pitfall 2: Access Code Secret Exposure
**What goes wrong:** Storing or logging the full access code secret
**Why it happens:** Confusion about which fields contain sensitive data
**How to avoid:** full_code from generate/rotate endpoints is ONE-TIME only. AccessCodeInfoResponse (GET /me) returns only prefix, never the secret.
**Warning signs:** Tests or logs showing full access codes

### Pitfall 3: Hold-to-Reveal State Leaks
**What goes wrong:** Access code stays revealed after mouse leaves component or window loses focus
**Why it happens:** Only handling mouseUp, not mouseLeave or blur events
**How to avoid:** Clear revealed state on: onMouseUp, onMouseLeave, onPointerCancel, window blur
**Warning signs:** Code stays visible when moving mouse away while holding

### Pitfall 4: Missing Role Checks for API Calls
**What goes wrong:** Client users can trigger access code API calls (which will fail with 403)
**Why it happens:** UI is hidden but keyboard/devtools can trigger
**How to avoid:** Check role before API call, not just for UI visibility
**Warning signs:** 403 errors in console for client users

### Pitfall 5: account:view Permission Not in RBAC System
**What goes wrong:** Trying to check "account:view" permission via existing has_permission function
**Why it happens:** account:view is a NEW permission key not yet in DEPT_ROLE_PERMISSION_KEYS
**How to avoid:** Add accounts.view to the permissions system (backend permissions.py + frontend dept role dialog)
**Warning signs:** Permission not being recognized, always returning false

## Code Examples

Verified patterns from the codebase:

### Vertical Tab Button (Active/Inactive State)
```typescript
// Source: apps/web/src/components/admin/user-edit-dialog.tsx
<button
  onClick={() => setActiveTab("profile")}
  className={cn(
    "w-full text-left px-3 py-2 rounded text-sm transition-colors",
    activeTab === "profile"
      ? "bg-blue-600 text-white"
      : "text-gray-300 hover:bg-gray-800"
  )}
>
  Profile
</button>
```

### Access Code API Response Types
```typescript
// Source: apps/api/src/app/models.py (lines 761-768)
interface AccessCodeInfoResponse {
  prefix: string;           // 4-char prefix (always safe to show)
  created_at: string;       // ISO datetime
  expires_at: string;       // ISO datetime
  rotated_at: string | null;// ISO datetime or null
}

// Generate/Rotate response (ONE-TIME secret exposure)
interface AccessCodeGenerateResponse {
  prefix: string;
  full_code: string;  // prefix-secret (ONLY shown once!)
  expires_at: string;
}
```

### Clipboard Copy with Feedback
```typescript
// Pattern for copy-to-clipboard with toast feedback
const handleCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Failed to copy to clipboard");
  }
};
```

### Hold-to-Reveal Implementation
```typescript
// Robust hold-to-reveal pattern
const [isRevealed, setIsRevealed] = useState(false);

const handlePointerDown = () => setIsRevealed(true);
const handlePointerUp = () => setIsRevealed(false);
const handlePointerLeave = () => setIsRevealed(false);

// Also handle window blur for safety
useEffect(() => {
  const handleBlur = () => setIsRevealed(false);
  window.addEventListener("blur", handleBlur);
  return () => window.removeEventListener("blur", handleBlur);
}, []);

<button
  onPointerDown={handlePointerDown}
  onPointerUp={handlePointerUp}
  onPointerLeave={handlePointerLeave}
  onPointerCancel={handlePointerUp}
>
  {isRevealed ? fullCode : "********"}
</button>
```

### Sidebar User Info (Current Implementation)
```typescript
// Source: apps/web/src/components/admin/sidebar.tsx (lines 206-217)
<div className="p-4 border-t border-gray-800">
  {userEmail && (
    <div className="mb-3 px-4">
      <p className="text-white font-medium text-sm truncate">
        {displayName || userEmail.split("@")[0]}
      </p>
      <p className="text-gray-400 text-xs truncate" title={userEmail}>
        {userEmail}
      </p>
    </div>
  )}
  {/* Sign out button below */}
</div>
```

### Existing Account List API (VAs use RLS filtering)
```typescript
// Source: apps/api/src/app/routers/accounts.py
// GET /accounts - filtered by RLS based on user's account_assignments
@router.get("", response_model=list[AccountResponse])
async def get_accounts(user: dict = Depends(get_current_user)):
    """Get accounts accessible to the current user (filtered by RLS)."""
    supabase = get_supabase_for_user(user["token"])
    response = supabase.table("accounts").select("id, account_code, name").execute()
    return [AccountResponse(**row) for row in response.data]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| document.execCommand('copy') | navigator.clipboard.writeText() | 2020+ | Async, better error handling |
| onMouseDown/Up only | onPointerDown/Up | Modern browsers | Works on touch devices too |
| role_permissions table | department_roles + RBAC | Phase 1 | More granular permissions |

**Deprecated/outdated:**
- Old sidebar showed static user info - now becomes clickable modal trigger
- Direct permission checks on membership.role - now use has_permission function or useUserRole hook

## Open Questions

Things that couldn't be fully resolved:

1. **account:view permission key naming**
   - What we know: New permission key needs to be added
   - What's unclear: Should it be "account.view" or "accounts.view" to match existing patterns?
   - Recommendation: Use "accounts.view" to match "order_tracking.read" pattern (plural resource name)

2. **Chrome Web Store URL**
   - What we know: Extension download button needs a URL
   - What's unclear: What is the actual Chrome Web Store URL for the extension?
   - Recommendation: Use placeholder URL for now, configure via environment variable

3. **VA account list filtering**
   - What we know: VAs with account:view see only assigned accounts
   - What's unclear: Should this use existing /accounts endpoint with RLS or new VA-specific endpoint?
   - Recommendation: Use existing /accounts endpoint - RLS already filters by account_assignments table

## Sources

### Primary (HIGH confidence)
- apps/web/src/components/admin/user-edit-dialog.tsx - Vertical tab modal pattern
- apps/web/src/components/admin/department-role-dialog.tsx - Vertical tab modal pattern
- apps/web/src/components/admin/account-dialog.tsx - Vertical tab modal pattern
- apps/web/src/components/admin/sidebar.tsx - Current user info area implementation
- apps/api/src/app/routers/access_codes.py - Access code API endpoints
- apps/api/src/app/services/access_code.py - Access code service functions
- apps/api/src/app/models.py - API response models
- apps/web/src/hooks/use-user-role.ts - Role detection hook

### Secondary (MEDIUM confidence)
- apps/api/src/app/permissions.py - Permission key definitions
- apps/api/src/app/routers/admin.py - Account management endpoints
- apps/web/src/components/ui/dialog.tsx - Dialog component implementation

### Tertiary (LOW confidence)
- None - all findings verified with codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly verified in codebase
- Architecture patterns: HIGH - multiple examples in existing dialogs
- Pitfalls: HIGH - based on actual code patterns and potential edge cases
- API: HIGH - Phase 1 implementation reviewed

**Research date:** 2026-01-18
**Valid until:** 30 days (stable patterns, minimal external dependencies)
