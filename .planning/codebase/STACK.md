# Technology Stack

**Analysis Date:** 2026-01-18

## Languages

**Primary:**
- TypeScript 5.x - Frontend (`apps/web/`)
- Python 3.11+ - Backend (`apps/api/`)

**Secondary:**
- CSS/TailwindCSS - Styling

## Runtime

**Frontend:**
- Node.js (version not pinned, no .nvmrc)
- npm (package manager)
- Lockfile: `apps/web/package-lock.json` present

**Backend:**
- Python 3.11+ (specified in `apps/api/pyproject.toml`)
- pip with editable install (`pip install -e ".[dev]"`)
- Virtual environment: `apps/api/.venv/`

## Frameworks

**Frontend Core:**
- Next.js 16.1.1 - App Router pattern (`apps/web/src/app/`)
- React 19.2.3 - UI library
- React DOM 19.2.3 - DOM rendering

**Frontend UI:**
- TailwindCSS 4.x - Utility-first CSS (`apps/web/postcss.config.mjs`)
- shadcn/ui - Component library (Radix UI primitives)
- Framer Motion 12.25.0 - Animations
- Lucide React 0.562.0 - Icons
- Sonner 1.7.0 - Toast notifications

**Backend Core:**
- FastAPI 0.109.0+ - API framework (`apps/api/src/app/main.py`)
- Uvicorn 0.27.0+ - ASGI server (with standard extras)
- Pydantic - Data validation (via FastAPI, models in `apps/api/src/app/models.py`)

**Testing:**
- Pytest 8.0.0+ - Python testing (`apps/api/pyproject.toml`)
- httpx 0.26.0+ - Async HTTP client for testing
- Frontend: No test framework configured (`"test": "echo \"No tests configured yet\""`)

**Linting/Formatting:**
- ESLint 9.x - Frontend linting (`apps/web/eslint.config.mjs`)
- eslint-config-next 16.1.1 - Next.js ESLint rules
- Ruff 0.2.0+ - Python linting/formatting (`apps/api/pyproject.toml`)
  - Line length: 88
  - Target: Python 3.11
  - Rules: E, F, I, N, W, UP

## Key Dependencies

**Frontend Critical:**
- `@supabase/ssr` 0.8.0 - Server-side Supabase client
- `@supabase/supabase-js` 2.90.1 - Supabase JavaScript client
- `next` 16.1.1 - Full-stack React framework

**Frontend UI Components (Radix):**
- `@radix-ui/react-alert-dialog` 1.1.15
- `@radix-ui/react-checkbox` 1.3.3
- `@radix-ui/react-dialog` 1.1.15
- `@radix-ui/react-dropdown-menu` 2.1.16
- `@radix-ui/react-label` 2.1.8
- `@radix-ui/react-select` 2.2.6
- `@radix-ui/react-slot` 1.2.4
- `@radix-ui/react-tooltip` 1.2.8

**Frontend Utilities:**
- `class-variance-authority` 0.7.1 - Variant styling for components
- `clsx` 2.1.1 - Conditional classname utility
- `tailwind-merge` 3.4.0 - TailwindCSS class merging

**Backend Critical:**
- `supabase` 2.0.0+ - Python Supabase client
- `PyJWT` 2.0.0+ - JWT token handling
- `python-dotenv` 1.0.0+ - Environment variable loading

## Configuration

**Frontend Environment:**
- `apps/web/.env.local.example` - Template for local config
- Required vars:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (defaults to `http://localhost:8000`)

**Backend Environment:**
- `apps/api/.env.example` - Template for local config
- Required vars:
  - `SUPABASE_URL` - Supabase project URL
  - `SUPABASE_ANON_KEY` - Supabase anonymous key
  - `SUPABASE_JWT_SECRET` - JWT secret for token verification
  - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

**TypeScript Config:**
- `apps/web/tsconfig.json`
- Path alias: `@/*` maps to `./src/*`
- Target: ES2017
- Strict mode enabled
- Module resolution: bundler

**Next.js Config:**
- `apps/web/next.config.ts` - Minimal config (no custom options set)

**Python (Ruff) Config:**
- Defined in `apps/api/pyproject.toml`
- Test paths: `["tests"]`
- Python path: `["src"]`

## Build & Dev Commands

**Frontend (`apps/web/`):**
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

**Backend (`apps/api/`):**
```bash
python -m venv .venv                          # Create virtualenv
.venv\Scripts\activate                        # Activate (Windows)
source .venv/bin/activate                     # Activate (Unix)
pip install -e ".[dev]"                       # Install with dev deps
uvicorn app.main:app --reload --app-dir src   # Start dev server (localhost:8000)
pytest                                        # Run tests
ruff check .                                  # Lint
ruff format .                                 # Format
```

## Platform Requirements

**Development:**
- Node.js (LTS recommended)
- Python 3.11+
- npm package manager
- Supabase project (cloud or local)

**Production:**
- Frontend: Any platform supporting Next.js (Vercel recommended)
- Backend: Any platform supporting Python ASGI (uvicorn)
- Database: Supabase (PostgreSQL)

---

*Stack analysis: 2026-01-18*
