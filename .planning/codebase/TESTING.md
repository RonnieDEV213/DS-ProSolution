# Testing Patterns

**Analysis Date:** 2025-01-18

## Test Framework

**Backend Runner:**
- Pytest >= 8.0.0
- Config: `apps/api/pyproject.toml`

**Frontend Runner:**
- Not configured (package.json: `"test": "echo \"No tests configured yet\" && exit 0"`)
- No Jest or Vitest config present

**Assertion Library:**
- Backend: pytest assertions (`assert response.status_code == 200`)

**Run Commands:**
```bash
# Backend tests
cd apps/api
pytest                           # Run all tests
pytest tests/test_health.py      # Run specific file
pytest -v                        # Verbose output
```

## Test File Organization

**Location:**
- Backend: Separate `tests/` directory at `apps/api/tests/`
- Frontend: No test files present

**Naming:**
- Backend: `test_*.py` prefix (pytest convention)
- Test functions: `test_*` prefix

**Structure:**
```
apps/api/
├── src/
│   └── app/
│       └── ...
└── tests/
    ├── __init__.py
    ├── test_health.py
    └── test_records_permissions.py
```

## Test Structure

**Suite Organization:**
```python
"""Tests for records.py permission enforcement.

Uses FastAPI dependency_overrides for mocking auth.
Uses mock for Supabase to avoid network/db calls.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.auth import get_current_user_with_membership


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def client():
    """Create test client with Supabase mocked."""
    with patch("app.routers.records.get_supabase_for_user", return_value=make_mock_supabase()):
        yield TestClient(app)


# =============================================================================
# Test 1: Descriptive section header
# =============================================================================

def test_update_record_without_basic_fields_permission(client):
    """VA without basic_fields cannot edit item_name."""
    # Arrange: override auth
    # Act: make request
    # Assert: check response
    pass
```

**Patterns:**
- Section comments with `# ===` separators for grouping related tests
- Docstrings describe test intent clearly
- Use `try/finally` to clean up dependency_overrides

## Mocking

**Framework:**
- `unittest.mock` (standard library)
- `patch` context manager for module-level mocking

**Patterns:**
```python
from unittest.mock import MagicMock, patch

def make_mock_supabase():
    """Create a mock Supabase client that returns empty/success for all calls."""
    mock = MagicMock()
    # Chain method calls
    mock.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "test-record-id", ...}
    ]
    return mock

# Patching at module level where imported
with patch("app.routers.records.get_supabase_for_user", return_value=make_mock_supabase()):
    # test code
```

**Auth Mocking with dependency_overrides:**
```python
def make_mock_user(role: str, permission_keys: list[str]):
    """Create a mock user dict matching get_current_user_with_membership output."""
    return {
        "user_id": "test-user-id",
        "token": "test-token",
        "membership": {"role": role, "id": "test-membership-id"},
        "permission_keys": permission_keys,
    }

# In test
def override_auth():
    return make_mock_user("va", ["order_tracking.write.order_fields"])

app.dependency_overrides[get_current_user_with_membership] = override_auth
try:
    response = client.patch("/records/test-id", json={"item_name": "New Name"})
    assert response.status_code == 403
finally:
    app.dependency_overrides.clear()
```

**What to Mock:**
- External services (Supabase database calls)
- Authentication/authorization dependencies
- Environment-dependent code

**What NOT to Mock:**
- FastAPI TestClient HTTP layer
- Pydantic validation
- Core business logic being tested

## Fixtures and Factories

**Test Data:**
```python
def make_mock_user(role: str, permission_keys: list[str]):
    """Factory for mock user objects."""
    return {
        "user_id": "test-user-id",
        "token": "test-token",
        "membership": {"role": role, "id": "test-membership-id"},
        "permission_keys": permission_keys,
    }

def make_mock_supabase():
    """Factory for mock Supabase client."""
    mock = MagicMock()
    # Configure default responses
    return mock
```

**Location:**
- Inline in test files
- No separate fixtures file (conftest.py not used in project)

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Install pytest-cov if needed
pip install pytest-cov
pytest --cov=app --cov-report=html
```

## Test Types

**Unit Tests:**
- Test individual functions in isolation
- Example: `test_expand_permission_keys_aliases()` in `test_records_permissions.py`
```python
def test_expand_permission_keys_aliases():
    """Unit test: _expand_permission_keys maps bookkeeping.* -> order_tracking.*"""
    raw_keys = {"bookkeeping.write.basic_fields", "bookkeeping.read"}
    expanded = _expand_permission_keys(raw_keys)
    assert "order_tracking.write.basic_fields" in expanded
```

**Integration Tests:**
- Test API endpoints with mocked external dependencies
- Use FastAPI TestClient
- Example: `test_update_record_without_basic_fields_permission(client)`

**E2E Tests:**
- Not implemented
- No Playwright, Cypress, or similar configured

## Common Patterns

**Async Testing:**
- Not used - tests are synchronous
- TestClient handles async endpoint testing transparently

**Error Testing:**
```python
def test_update_record_without_basic_fields_permission(client):
    """VA without basic_fields cannot edit item_name."""
    def override_auth():
        return make_mock_user("va", ["order_tracking.write.order_fields"])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch("/records/test-id", json={"item_name": "New Name"})
        assert response.status_code == 403
        assert "basic fields" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()
```

**Expected Failures:**
```python
@pytest.mark.xfail(reason="Pydantic ignores extra fields; model needs extra='forbid'")
def test_update_record_unknown_field(client):
    """Patching unknown field returns 400."""
    # Test documents known limitation
```

**Simple Health Check Tests:**
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
```

## Test Configuration

**pytest.ini_options (pyproject.toml):**
```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]
```

**Dependencies (dev):**
- pytest >= 8.0.0
- httpx >= 0.26.0 (for async HTTP in tests)

## Gaps and Recommendations

**Current Gaps:**
- No frontend tests
- No E2E tests
- No test coverage enforcement
- Limited integration test coverage

**Missing Test Areas:**
- `apps/web/` - All components and hooks untested
- `apps/api/src/app/routers/admin.py` - No tests
- `apps/api/src/app/routers/accounts.py` - No tests
- `apps/api/src/app/routers/automation.py` - No tests
- `apps/api/src/app/routers/auth.py` - No tests
- `apps/api/src/app/background.py` - No tests

**To Add Frontend Testing:**
1. Install Vitest: `npm install -D vitest @testing-library/react`
2. Create `vitest.config.ts` in `apps/web/`
3. Update package.json scripts

---

*Testing analysis: 2025-01-18*
