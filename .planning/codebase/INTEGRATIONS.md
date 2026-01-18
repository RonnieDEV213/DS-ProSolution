# External Integrations

**Analysis Date:** 2026-01-18

## APIs & External Services

**Supabase (Primary Backend-as-a-Service):**
- Provider: Supabase (hosted PostgreSQL + Auth + Realtime)
- SDK/Client (Frontend): `@supabase/supabase-js`, `@supabase/ssr`
- SDK/Client (Backend): `supabase` Python package
- Auth: Multiple env vars (see Environment Configuration)
- Files:
  - `apps/web/src/lib/supabase/client.ts` - Browser client
  - `apps/web/src/lib/supabase/server.ts` - Server-side client
  - `apps/web/src/lib/supabase/middleware.ts` - Session refresh
  - `apps/api/src/app/database.py` - Python client factory

**FastAPI Backend (Internal API):**
- Base URL: `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:8000`)
- Client: Native fetch in `apps/web/src/lib/api.ts`
- Auth: Bearer token (Supabase JWT passed to API)
- Endpoints defined in `apps/api/src/app/routers/`

## Data Storage

**Primary Database:**
- Provider: Supabase (PostgreSQL)
- Connection: Via Supabase client libraries (not direct connection string)
- Client (Frontend): `@supabase/ssr` with cookie-based auth
- Client (Backend): `supabase` Python SDK with service role key
- RLS: Row-Level Security enabled - user context passed via JWT
- Files:
  - `apps/api/src/app/database.py` - Two client modes:
    - `get_supabase()` - Service role (admin, bypasses RLS)
    - `get_supabase_for_user(token)` - User context (RLS enforced)

**Key Database Tables (inferred from code):**
- `profiles` - User profile data
- `memberships` - User-org membership and roles
- `accounts` - Business accounts for bookkeeping
- `invites` - User invitations
- `role_permissions` - Role-based permissions
- `department_roles` - Department role definitions
- `automation_agents` - Chrome extension agents
- `automation_jobs` - Automation job queue
- `automation_pairing_requests` - Extension pairing flow
- `automation_devices` - Device tracking for rate limiting
- `automation_events` - Event log for automation

**File Storage:**
- None detected (no S3, Supabase Storage, or file upload code)

**Caching:**
- None detected (no Redis, Memcached)
- In-memory only: `@lru_cache` for Supabase client in `apps/api/src/app/database.py`

## Authentication & Identity

**Auth Provider: Supabase Auth**
- OAuth Providers: Google (primary, possibly only)
- Flow: OAuth 2.0 with PKCE
- Session: Cookie-based via `@supabase/ssr`

**Frontend Auth Flow:**
1. User clicks "Continue with Google" (`apps/web/src/components/auth/login-form.tsx`)
2. Supabase redirects to Google OAuth
3. Callback at `/auth/callback` (`apps/web/src/app/auth/callback/route.ts`)
4. Bootstrap endpoint called to create/verify membership
5. Redirect to role-specific dashboard

**Backend Auth Flow:**
1. JWT extracted from `Authorization: Bearer` header
2. Token verified via JWKS or JWT secret (`apps/api/src/app/auth.py`)
3. User context loaded including membership and permissions
4. Dependencies: `get_current_user()`, `get_current_user_with_membership()`

**Invite-Only Access:**
- New users must have active invite in `invites` table
- Bootstrap endpoint (`/auth/bootstrap`) checks for valid invite
- Invite marked as "used" after successful membership creation
- File: `apps/api/src/app/routers/auth.py`

**Role System:**
- Roles: `admin`, `va` (virtual assistant), `client`
- Role-based route protection in middleware (`apps/web/src/middleware.ts`)
- Permission keys for granular access (e.g., `order_tracking.read`, `admin.automation`)
- Department roles for VAs with specific permission sets

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, etc.)

**Logging:**
- Backend: Python `logging` module
  - Example: `apps/api/src/app/routers/automation.py` uses `logging.getLogger(__name__)`
- Frontend: `console.log` / `console.error` only

**Health Checks:**
- Backend: `GET /health` returns `{"ok": true}` (`apps/api/src/app/main.py`)
- Backend: `GET /version` returns `{"version": "0.1.0"}`

## CI/CD & Deployment

**Hosting:**
- Not configured in codebase (no deployment configs detected)
- Likely targets: Vercel (frontend), Fly.io/Railway (backend)

**CI Pipeline:**
- None detected (no `.github/workflows/`, no CI config files)

**Build Artifacts:**
- Frontend: `.next/` directory (gitignored)
- Backend: Python packages in `.venv/` (gitignored)

## Environment Configuration

**Frontend Required Vars (`apps/web/.env.local.example`):**
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Frontend Optional Vars:**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000  # Defaults if not set
```

**Backend Required Vars (`apps/api/.env.example`):**
```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

**Secrets Location:**
- Local development: `.env.local` (frontend), `.env` (backend)
- Production: Platform environment variables (not in codebase)

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected

**OAuth Callbacks:**
- `/auth/callback` - Supabase OAuth callback handler
  - File: `apps/web/src/app/auth/callback/route.ts`
  - Handles code exchange and bootstrap flow

**Outgoing Webhooks:**
- None detected

## Automation/Extension Integration

**Chrome Extension API:**
- Pairing flow for browser extension agents
- Endpoints in `apps/api/src/app/routers/automation.py`:
  - `POST /automation/pairing/request` - Extension requests pairing (public, rate-limited)
  - `GET /automation/pairing/status/{id}` - Extension polls status (public)
  - `POST /automation/pairing/requests/{id}/approve` - Admin approves
  - `POST /automation/pairing/requests/{id}/reject` - Admin rejects

**Agent Authentication:**
- Custom JWT tokens with per-agent secrets
- Token includes `kid` header with agent_id
- Token secret stored in `automation_agents.token_secret`
- File: `apps/api/src/app/routers/automation.py` (`generate_agent_token()`)

**Agent Types:**
- `EBAY_AGENT` - Creates automation jobs from eBay orders
- `AMAZON_AGENT` - Claims and executes jobs (places Amazon orders)

**Job Queue:**
- Jobs created by eBay agents, claimed by Amazon agents
- Atomic claim via database RPC (`claim_next_automation_job`)
- Retry logic with max 3 attempts
- Statuses: `QUEUED`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED_NEEDS_ATTENTION`

## Background Tasks

**Cleanup Worker:**
- File: `apps/api/src/app/background.py`
- Runs every 2 minutes via `asyncio.create_task()`
- Started in FastAPI lifespan (`apps/api/src/app/main.py`)
- Tasks:
  - Delete stale "replacing" agents (older than 10 minutes)

## CORS Configuration

**Backend CORS:**
- Configured in `apps/api/src/app/main.py`
- Allowed origins: `["http://localhost:3000"]` (dev only)
- All methods and headers allowed
- Credentials allowed

---

*Integration audit: 2026-01-18*
