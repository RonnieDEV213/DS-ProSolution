# Architecture

**Analysis Date:** 2026-01-18

## Pattern Overview

**Overall:** Monorepo with separate frontend/backend applications and a browser extension package

**Key Characteristics:**
- Next.js App Router frontend with Server Components
- FastAPI Python backend with Router-based organization
- Supabase as BaaS (authentication, database, RLS)
- Chrome Extension (Manifest V3) for automation
- Role-based access control (admin/va/client) enforced at both layers

## Layers

**Frontend (apps/web):**
- Purpose: User-facing web application for order tracking and bookkeeping management
- Location: `apps/web/`
- Contains: Next.js 14+ App Router pages, React components, hooks, API client
- Depends on: Supabase client, FastAPI backend
- Used by: Admin users, VAs (virtual assistants), Clients

**Backend API (apps/api):**
- Purpose: REST API for business logic, data access, and automation coordination
- Location: `apps/api/src/app/`
- Contains: FastAPI routers, Pydantic models, auth/permission logic, background workers
- Depends on: Supabase (service role), JWT validation
- Used by: Frontend, Chrome extension agents

**Browser Extension (packages/extension):**
- Purpose: Automates eBay-to-Amazon order processing via Chrome extension
- Location: `packages/extension/`
- Contains: Service worker, side panel UI, content scripts for eBay/Amazon
- Depends on: FastAPI automation endpoints
- Used by: Paired automation agents (eBay/Amazon)

**Database (Supabase):**
- Purpose: PostgreSQL database with Row-Level Security (RLS), auth, and stored functions
- Location: `apps/api/migrations/` (SQL migration files)
- Contains: Tables, RLS policies, triggers, RPCs
- Depends on: Nothing (foundational layer)
- Used by: Backend API (service role), Frontend (user token)

## Data Flow

**User Authentication:**

1. User logs in via Supabase Auth (`apps/web/src/app/login/`)
2. Supabase issues JWT token stored in browser cookies
3. Middleware (`apps/web/src/middleware.ts`) validates session and fetches membership
4. User redirected to role-specific dashboard (`/admin`, `/va`, `/client`)

**API Request Flow:**

1. Frontend calls `api.*` functions (`apps/web/src/lib/api.ts`)
2. API client fetches Supabase session token and includes in Authorization header
3. FastAPI validates JWT in `apps/api/src/app/auth.py` (supports HS256 and RS256/ES256)
4. Router handlers query Supabase with user token (RLS enforced) or service role (admin ops)
5. Response returned to frontend

**Automation Agent Flow:**

1. Extension requests pairing via `/automation/pairing/request`
2. Admin approves pairing via `/automation/pairing/requests/{id}/approve`
3. Extension receives install token (JWT with agent_id in kid header)
4. eBay agent creates jobs via `/automation/jobs` (from eBay orders)
5. Amazon agent claims jobs via `/automation/jobs/claim`
6. Amazon agent completes/fails jobs with order details

**State Management:**
- Frontend: React `useState`/`useEffect` hooks with URL query params for persistence
- Backend: Stateless request handling; state in Supabase database
- Extension: Chrome storage API for pairing state, in-memory for jobs

## Key Abstractions

**User Roles:**
- Purpose: Control access to features and data
- Examples: `apps/api/src/app/models.py` (`UserRole` enum), `apps/api/src/app/auth.py`
- Pattern: Admin has full access, VA access controlled by department roles/access profiles, Client sees own data

**Department Roles (Access Profiles):**
- Purpose: Granular permission assignment for VAs
- Examples: `apps/api/src/app/routers/admin.py` (CRUD), `apps/api/src/app/permissions.py` (keys)
- Pattern: Permission keys like `order_tracking.read`, `order_tracking.write.basic_fields`

**Accounts:**
- Purpose: Represent eBay seller accounts for bookkeeping/order tracking
- Examples: `apps/api/src/app/routers/accounts.py`, `apps/api/src/app/routers/admin.py`
- Pattern: Accounts have records, can be assigned to VAs, linked to automation agents

**Automation Agents:**
- Purpose: Chrome extension instances that process orders
- Examples: `apps/api/src/app/routers/automation.py`, `packages/extension/service-worker.js`
- Pattern: eBay agents create jobs, Amazon agents claim/complete jobs; two-phase replacement on reconnect

**Bookkeeping Records:**
- Purpose: Track eBay sales with Amazon sourcing costs and profit calculation
- Examples: `apps/api/src/app/routers/records.py`, `apps/api/src/app/models.py`
- Pattern: CRUD with field-level permissions, computed fields (earnings_net, cogs, profit)

## Entry Points

**Frontend Entry:**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: Browser navigation
- Responsibilities: Root layout, TooltipProvider, Toaster setup

**API Entry:**
- Location: `apps/api/src/app/main.py`
- Triggers: HTTP requests to `localhost:8000`
- Responsibilities: CORS, router mounting, background worker lifecycle

**Middleware Entry:**
- Location: `apps/web/src/middleware.ts`
- Triggers: Every frontend request (except static assets)
- Responsibilities: Session refresh, auth redirect, role-based route protection

**Extension Entry:**
- Location: `packages/extension/service-worker.js`
- Triggers: Chrome extension activation, alarms, messages
- Responsibilities: Agent pairing, job queue, tab orchestration

## Error Handling

**Strategy:** Structured error responses with codes and messages

**Patterns:**
- FastAPI: `HTTPException` with `status_code` and `detail` dict (`{"code": "...", "message": "..."}`)
- Frontend: Try/catch with toast notifications (`sonner`)
- Supabase: RLS denials return empty results or permission errors
- Extension: Events logged, failures reported via `/automation/jobs/{id}/fail`

## Cross-Cutting Concerns

**Logging:**
- Backend: Python `logging` module in routers
- Frontend: `console.error` for development
- Extension: `console.log` with prefixed messages

**Validation:**
- Backend: Pydantic models with `@field_validator` decorators
- Frontend: TypeScript types, form validation in components
- Database: Constraints and triggers in migrations

**Authentication:**
- JWT validation: `apps/api/src/app/auth.py` (user tokens) and `apps/api/src/app/routers/automation.py` (agent tokens)
- User tokens: Supabase-issued, validated with JWKS or JWT secret
- Agent tokens: Self-issued with per-agent secrets, agent_id in kid header

**Audit Logging:**
- Location: `apps/api/src/app/audit.py`
- Pattern: `write_audit_log()` called on admin mutations with before/after state

---

*Architecture analysis: 2026-01-18*
