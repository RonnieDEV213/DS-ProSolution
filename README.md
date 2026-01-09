# DS-ProSolution

In-house order tracking application.

## Structure

- `apps/web` - Next.js frontend
- `apps/api` - FastAPI backend

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+

### Frontend
```bash
cd apps/web
npm install
npm run dev
```
Open http://localhost:3000

### Backend
```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate  # Unix: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --app-dir src
```
Open http://localhost:8000/docs for API documentation.

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed project context.
