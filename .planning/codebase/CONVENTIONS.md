# Coding Conventions

**Analysis Date:** 2025-01-18

## Naming Patterns

**Files:**
- Frontend components: PascalCase with hyphenated filenames (`records-table.tsx`, `add-record-form.tsx`)
- Frontend utility files: kebab-case (`use-user-role.ts`, `supabase/client.ts`)
- Backend Python modules: snake_case (`records.py`, `database.py`)
- UI components (shadcn): kebab-case (`button.tsx`, `alert-dialog.tsx`)

**Functions:**
- Frontend: camelCase (`getAccessToken`, `handleEditSave`, `formatCents`)
- Backend Python: snake_case (`get_current_user`, `fetch_remarks_for_records`)
- React hooks: `use` prefix with camelCase (`useUserRole`, `useAutomationPolling`)

**Variables:**
- Frontend: camelCase (`editingId`, `pendingStatus`, `orderRemarks`)
- Backend Python: snake_case (`permission_keys`, `order_remarks`, `record_data`)
- Constants: SCREAMING_SNAKE_CASE in both (`STATUS_LABELS`, `BASIC_FIELDS`, `DEFAULT_ORG_ID`)

**Types:**
- Frontend TypeScript: PascalCase interfaces/types (`BookkeepingRecord`, `UserRole`, `RecordCreate`)
- Backend Pydantic models: PascalCase (`RecordResponse`, `UserMembershipUpdate`)
- Backend Enums: PascalCase with SCREAMING_SNAKE_CASE values (`BookkeepingStatus.SUCCESSFUL`)

## Code Style

**Formatting (Frontend):**
- ESLint with Next.js config (`eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`)
- Config: `apps/web/eslint.config.mjs`
- No Prettier config detected - uses ESLint formatting rules

**Linting (Backend):**
- Ruff for linting and formatting
- Target version: Python 3.11
- Line length: 88 characters
- Rules enabled: E, F, I, N, W, UP (pycodestyle, pyflakes, isort, pep8-naming, pycodestyle warnings, pyupgrade)
- Config: `apps/api/pyproject.toml`

**TypeScript:**
- Strict mode enabled
- Path aliases: `@/*` maps to `./src/*`
- Target: ES2017
- Module resolution: bundler

## Import Organization

**Frontend (TypeScript):**
1. React and Next.js imports (`import { useState } from "react"`)
2. Third-party packages (`import { toast } from "sonner"`)
3. Internal UI components (`import { Button } from "@/components/ui/button"`)
4. Internal lib/utils (`import { api, formatCents } from "@/lib/api"`)

**Path Aliases (Frontend):**
- `@/*` resolves to `./src/*`
- Example: `@/components/ui/button` -> `src/components/ui/button.tsx`

**Backend (Python):**
1. Standard library imports
2. Third-party imports (FastAPI, Pydantic)
3. Local app imports (`from app.auth import ...`)
- Ruff isort plugin enforces order

## Error Handling

**Frontend Patterns:**
- Use `try/catch` with `toast.error()` for user feedback
- API errors thrown as `Error` with `detail` from response:
```typescript
if (!res.ok) {
  const error = await res.json().catch(() => ({ detail: "Request failed" }));
  throw new Error(error.detail || "Request failed");
}
```
- 204 No Content returns `null as T`

**Backend Patterns:**
- Raise `HTTPException` with appropriate status codes
- Re-raise `HTTPException` in except blocks to preserve original error
- Use logger for unexpected errors before raising 500:
```python
except HTTPException:
    raise
except Exception:
    logger.exception("Failed to update record %s", record_id)
    raise HTTPException(status_code=500, detail="Failed to update record")
```
- Permission errors: 403 with descriptive message
- Not found: 404
- Validation/bad request: 400
- Conflict (duplicate): 409

## Logging

**Frontend:**
- `console.error()` for caught errors in hooks
- No structured logging framework

**Backend:**
- Standard Python `logging` module
- Logger per module: `logger = logging.getLogger(__name__)`
- Use `logger.exception()` for stack traces
- Pattern: Log then raise HTTPException

## Comments

**When to Comment:**
- Module-level docstrings for Python files explaining purpose
- Function docstrings for public API functions (describe what, not how)
- Inline comments for non-obvious business logic (e.g., permission checks)
- Section separators using `# ============` for grouping related code

**JSDoc/TSDoc:**
- Not widely used in frontend
- Use for utility functions explaining edge cases:
```typescript
/**
 * Normalize value for comparison:
 * - undefined => undefined
 * - null => null
 * - string => trimmed; if empty after trim => null
 */
```

**Python Docstrings:**
- Triple quotes for module/function docs
- Brief one-liner or multi-line with Args/Returns for complex functions:
```python
"""Expand permission keys with aliases and implied permissions.

1. Apply aliases: bookkeeping.* -> order_tracking.* (backward compat)
2. Apply implied permissions: order_tracking.read -> order_tracking.read.*_remark
"""
```

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Extract helper functions for reusable logic (`fetch_remarks_for_records`)
- Long component functions acceptable when handling multiple state concerns

**Parameters:**
- Frontend: Use object destructuring for props
- Backend: Use Pydantic models for request bodies, Query/Path for URL params
- Default parameters at end of signature

**Return Values:**
- Frontend: Explicit return types on API functions, implicit on components
- Backend: Use `response_model` decorator for type hints
- Use Optional/None for nullable returns

## Module Design

**Exports (Frontend):**
- Named exports for components: `export function RecordsTable() {}`
- Named exports for utilities: `export const api = {...}`
- No default exports (Next.js page exceptions)

**Exports (Backend):**
- Router patterns: `router = APIRouter(prefix="/records", tags=["records"])`
- Re-export routers in `__init__.py`: `from .records import router as records_router`
- Use `__all__` for explicit exports

**Barrel Files:**
- Backend: `apps/api/src/app/routers/__init__.py` re-exports all routers
- Frontend: No barrel files - direct imports preferred

## Component Patterns (Frontend)

**Client Components:**
- Add `"use client"` directive at top
- Use React hooks for state management
- Handle async operations within components using `useState` + async handlers

**Props:**
- Define interface above component: `interface RecordsTableProps { ... }`
- Destructure in function signature

**State Management:**
- Local state with `useState` for component-specific data
- No global state library - data fetched per component/page
- Lift state to parent when needed for sibling communication

## API Patterns (Backend)

**Router Structure:**
- One router per domain (`records.py`, `accounts.py`, `admin.py`)
- Group related endpoints with section comments
- Use dependency injection for auth/permissions

**Request/Response:**
- Pydantic models for all request bodies
- `response_model` decorator for all responses
- Use `exclude_unset=True` for partial updates (PATCH)

**Permissions:**
- Field-level permission checks in endpoint logic
- Admin bypass pattern: `if user["membership"]["role"] == "admin":`
- Use `require_permission_key()` dependency for endpoint-level checks
