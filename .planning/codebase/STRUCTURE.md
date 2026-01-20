# Codebase Structure

**Analysis Date:** 2026-01-18

## Directory Layout

```
DS-ProSolution/
├── apps/
│   ├── api/                    # FastAPI Python backend
│   │   ├── migrations/         # SQL migration files for Supabase
│   │   ├── src/
│   │   │   └── app/            # Application code
│   │   │       ├── routers/    # API route handlers
│   │   │       ├── main.py     # FastAPI app entry point
│   │   │       ├── models.py   # Pydantic models
│   │   │       ├── auth.py     # JWT validation, user context
│   │   │       ├── audit.py    # Audit logging
│   │   │       ├── background.py # Background workers
│   │   │       ├── database.py # Supabase client factory
│   │   │       └── permissions.py # Permission key definitions
│   │   ├── tests/              # Pytest tests
│   │   └── pyproject.toml      # Python package config
│   │
│   └── web/                    # Next.js frontend
│       ├── public/             # Static assets
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── admin/      # Admin dashboard routes
│           │   ├── auth/       # Auth callback
│           │   ├── bookkeeping/ # (Legacy name, shows Order Tracking)
│           │   ├── client/     # Client dashboard
│           │   ├── login/      # Login page
│           │   ├── setup/      # First-time setup
│           │   ├── suspended/  # Suspended user page
│           │   └── va/         # VA dashboard routes
│           ├── components/     # React components
│           │   ├── admin/      # Admin-specific components
│           │   ├── auth/       # Auth components
│           │   ├── bookkeeping/ # Order tracking components
│           │   ├── ui/         # shadcn/ui primitives
│           │   └── va/         # VA-specific components
│           ├── hooks/          # Custom React hooks
│           └── lib/            # Utilities and clients
│               └── supabase/   # Supabase client helpers
│
├── packages/
│   └── extension/              # Chrome extension (Manifest V3)
│       ├── content/            # Content scripts
│       ├── icons/              # Extension icons
│       ├── manifest.json       # Extension manifest
│       ├── service-worker.js   # Background service worker
│       ├── sidepanel.html      # Side panel UI
│       ├── sidepanel.js        # Side panel logic
│       └── sidepanel.css       # Side panel styles
│
├── scripts/                    # Utility scripts
├── .planning/                  # GSD planning documents
│   └── codebase/               # Codebase analysis docs
├── CLAUDE.md                   # Project instructions for Claude
└── README.md                   # Project readme
```

## Directory Purposes

**apps/api/src/app/routers/:**
- Purpose: FastAPI route handlers grouped by domain
- Contains: Python files exporting `router` APIRouter instances
- Key files:
  - `__init__.py`: Re-exports all routers
  - `accounts.py`: Account listing for users (RLS-filtered)
  - `admin.py`: User management, department roles, account CRUD
  - `auth.py`: Bootstrap endpoint for profile/membership creation
  - `automation.py`: Pairing, agents, jobs for Chrome extension
  - `records.py`: Bookkeeping record CRUD with field-level permissions

**apps/api/migrations/:**
- Purpose: SQL migration files applied to Supabase
- Contains: Numbered `.sql` files (000_*, 001_*, etc.)
- Key files: `028_automation.sql` (automation schema), `001_auth_schema.sql` (core tables)

**apps/web/src/app/:**
- Purpose: Next.js App Router pages (file-based routing)
- Contains: `page.tsx` and `layout.tsx` files in route directories
- Key files:
  - `layout.tsx`: Root layout with providers
  - `page.tsx`: Root redirect page
  - `admin/layout.tsx`: Admin layout with sidebar
  - `va/layout.tsx`: VA layout with sidebar

**apps/web/src/components/ui/:**
- Purpose: shadcn/ui component primitives
- Contains: Radix-based UI components (button, dialog, table, etc.)
- Key files: `button.tsx`, `dialog.tsx`, `table.tsx`, `select.tsx`

**apps/web/src/lib/:**
- Purpose: Shared utilities and API client
- Contains: TypeScript modules for API calls, helpers, Supabase clients
- Key files:
  - `api.ts`: API client with types and fetch wrapper
  - `utils.ts`: Tailwind `cn()` helper
  - `supabase/client.ts`: Browser Supabase client
  - `supabase/server.ts`: Server Component Supabase client
  - `supabase/middleware.ts`: Middleware session helper

**packages/extension/:**
- Purpose: Chrome extension for eBay-to-Amazon automation
- Contains: Manifest V3 extension files (no build step)
- Key files:
  - `manifest.json`: Extension permissions and entry points
  - `service-worker.js`: Background logic, pairing, job queue
  - `sidepanel.html/js/css`: Agent status and control UI

## Key File Locations

**Entry Points:**
- `apps/api/src/app/main.py`: FastAPI application factory
- `apps/web/src/app/layout.tsx`: Next.js root layout
- `apps/web/src/middleware.ts`: Request middleware
- `packages/extension/service-worker.js`: Extension background script

**Configuration:**
- `apps/api/pyproject.toml`: Python dependencies and package config
- `apps/web/package.json`: Node dependencies
- `apps/web/next.config.ts`: Next.js config
- `apps/web/tailwind.config.ts`: Tailwind CSS config
- `packages/extension/manifest.json`: Chrome extension manifest

**Core Logic:**
- `apps/api/src/app/auth.py`: JWT validation, permission checks
- `apps/api/src/app/models.py`: All Pydantic models (request/response)
- `apps/api/src/app/routers/automation.py`: Automation hub endpoints
- `apps/web/src/lib/api.ts`: Frontend API client and types

**Testing:**
- `apps/api/tests/`: Pytest test files
- `apps/api/tests/test_health.py`: Health check test

## Naming Conventions

**Files:**
- React components: `kebab-case.tsx` (e.g., `login-form.tsx`, `records-table.tsx`)
- Python modules: `snake_case.py` (e.g., `automation.py`, `auth.py`)
- Next.js routes: `page.tsx` in `kebab-case/` directories

**Directories:**
- Features: `kebab-case` (e.g., `order-tracking/`, `department-roles/`)
- Component groups: `kebab-case` (e.g., `admin/`, `bookkeeping/`, `ui/`)

**Code:**
- TypeScript functions: `camelCase` (e.g., `fetchAPI`, `handleRecordUpdated`)
- Python functions: `snake_case` (e.g., `get_current_user`, `list_users`)
- React components: `PascalCase` (e.g., `BookkeepingContent`, `RecordsTable`)
- Pydantic models: `PascalCase` (e.g., `RecordCreate`, `AgentResponse`)

## Where to Add New Code

**New API Endpoint:**
1. Create/update router file in `apps/api/src/app/routers/`
2. Add Pydantic models in `apps/api/src/app/models.py`
3. Export router in `apps/api/src/app/routers/__init__.py`
4. Mount router in `apps/api/src/app/main.py`
5. Add migration in `apps/api/migrations/` if schema changes

**New Frontend Page:**
1. Create directory in `apps/web/src/app/{route-name}/`
2. Add `page.tsx` (and optionally `layout.tsx`)
3. Update middleware matcher if needed for auth
4. Add API types/calls in `apps/web/src/lib/api.ts`

**New React Component:**
1. Create `{component-name}.tsx` in appropriate `apps/web/src/components/{category}/`
2. For UI primitives: use shadcn/ui CLI or add to `components/ui/`
3. For feature components: group under feature name (admin, bookkeeping, va)

**New React Hook:**
1. Create `use-{name}.ts` in `apps/web/src/hooks/`
2. Export from hook file (no barrel file pattern)

**Utilities:**
- Frontend helpers: `apps/web/src/lib/utils.ts` or new file in `lib/`
- Backend helpers: Add to relevant router or create module in `apps/api/src/app/`
- Permission keys: `apps/api/src/app/permissions.py`

**Database Changes:**
1. Create new migration file: `apps/api/migrations/{NNN}_{description}.sql`
2. Follow numbering sequence (e.g., `035_new_feature.sql`)
3. Include both schema changes and RLS policies

## Special Directories

**.planning/:**
- Purpose: GSD planning and codebase analysis documents
- Generated: By Claude agents during `/gsd:map-codebase`
- Committed: No (in .gitignore pattern)

**.claude/:**
- Purpose: Claude Code configuration and commands
- Generated: By user/Claude setup
- Committed: Yes

**apps/api/.venv/:**
- Purpose: Python virtual environment
- Generated: Yes (pip install)
- Committed: No

**apps/web/node_modules/:**
- Purpose: Node.js dependencies
- Generated: Yes (npm install)
- Committed: No

**apps/web/.next/:**
- Purpose: Next.js build output
- Generated: Yes (npm run build/dev)
- Committed: No

---

*Structure analysis: 2026-01-18*
