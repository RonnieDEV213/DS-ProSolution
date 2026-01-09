# DS-ProSolution API

FastAPI backend for DS-ProSolution.

## Setup

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate  # Unix: source .venv/bin/activate
pip install -e ".[dev]"
```

## Run

```bash
uvicorn app.main:app --reload --app-dir src
```

## Test

```bash
pytest
```

## Lint

```bash
ruff check src tests
ruff format src tests
```
