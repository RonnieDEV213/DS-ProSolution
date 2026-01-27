# DS-ProSolution

In-house ecommerce automation application.

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

## Troubleshooting

### Excessive Node.js processes / high memory usage (Windows)

If you see dozens of `node.exe` processes in Task Manager after running the dev server, the `.next` build cache is likely corrupted. Delete it and restart:

```bash
# From apps/web:
rm -rf .next
npm run dev
```

After restart, you should see ~5 node processes max. The dev server uses Turbopack by default (Next.js 16+), which keeps a single stable PostCSS worker.

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed project context.
