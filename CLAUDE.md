# CLAUDE.md - DS-ProSolution

## Project Goal

DS-ProSolution is an in-house order tracking application for bookkeeping and order management.

## Tech Stack

### Frontend (apps/web)
- Next.js 14+ with App Router
- TypeScript
- TailwindCSS
- shadcn/ui components
- Framer Motion for animations

### Backend (apps/api)
- FastAPI
- Python 3.11+
- Ruff for linting/formatting
- Pytest for testing

## Running Locally

### Web App
```bash
cd apps/web
npm install
npm run dev
```
Opens at http://localhost:3000

### API
```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate  # On Unix: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --app-dir src
```
Opens at http://localhost:8000 (API docs at /docs)

## Guardrails

- **Small diffs**: Keep changes minimal and focused
- **Don't delete files** unless explicitly asked
- **Don't add CI/deployment** unless explicitly asked
- **Don't add extra libraries** unless necessary for the task
