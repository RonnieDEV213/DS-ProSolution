"""Tests for records.py permission enforcement.

Uses FastAPI dependency_overrides for mocking auth.
Uses mock for Supabase to avoid network/db calls.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.auth import get_current_user_with_membership, require_permission_key


# =============================================================================
# Test Fixtures
# =============================================================================


def make_mock_user(role: str, permission_keys: list[str]):
    """Create a mock user dict matching get_current_user_with_membership output."""
    return {
        "user_id": "test-user-id",
        "token": "test-token",
        "membership": {"role": role, "id": "test-membership-id"},
        "permission_keys": permission_keys,
    }


def make_mock_supabase():
    """Create a mock Supabase client that returns empty/success for all calls."""
    mock = MagicMock()
    # Mock successful record lookup
    mock.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "test-record-id",
            "account_id": "test-account-id",
            "ebay_order_id": "123",
            "sale_date": "2024-01-01",
            "item_name": "Test Item",
            "qty": 1,
            "sale_price_cents": 1000,
            "status": "SUCCESSFUL",
            "ebay_fees_cents": None,
            "amazon_price_cents": None,
            "amazon_tax_cents": None,
            "amazon_shipping_cents": None,
            "amazon_order_id": None,
            "return_label_cost_cents": None,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
    ]
    # Mock successful update
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "test-record-id",
            "account_id": "test-account-id",
            "ebay_order_id": "123",
            "sale_date": "2024-01-01",
            "item_name": "Test Item",
            "qty": 1,
            "sale_price_cents": 1000,
            "status": "SUCCESSFUL",
            "ebay_fees_cents": None,
            "amazon_price_cents": None,
            "amazon_tax_cents": None,
            "amazon_shipping_cents": None,
            "amazon_order_id": None,
            "return_label_cost_cents": None,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
    ]
    return mock


@pytest.fixture
def client():
    """Create test client with Supabase mocked."""
    with patch(
        "app.routers.records.get_supabase_for_user", return_value=make_mock_supabase()
    ):
        yield TestClient(app)


# =============================================================================
# Test 1: User without group key cannot patch those fields (403)
# =============================================================================


def test_update_record_without_basic_fields_permission(client):
    """VA without basic_fields cannot edit item_name."""

    def override_auth():
        return make_mock_user("va", ["bookkeeping.write.order_fields"])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch("/records/test-id", json={"item_name": "New Name"})
        assert response.status_code == 403
        assert "basic fields" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_update_record_without_order_fields_permission(client):
    """VA without order_fields cannot edit amazon_price_cents."""

    def override_auth():
        return make_mock_user("va", ["bookkeeping.write.basic_fields"])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch("/records/test-id", json={"amazon_price_cents": 500})
        assert response.status_code == 403
        assert "order fields" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_update_record_without_service_fields_permission(client):
    """VA without service_fields cannot edit status."""

    def override_auth():
        return make_mock_user("va", ["bookkeeping.write.basic_fields"])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch("/records/test-id", json={"status": "RETURN_CLOSED"})
        assert response.status_code == 403
        assert "service fields" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


# =============================================================================
# Test 2: User cannot patch any field outside ALL_MUTABLE_FIELDS (400)
# =============================================================================


def test_update_record_unknown_field(client):
    """Patching unknown field returns 400."""

    def override_auth():
        return make_mock_user("admin", [])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch("/records/test-id", json={"foo_bar": "value"})
        assert response.status_code == 400
        assert "Unknown or forbidden fields: foo_bar" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_update_record_forbidden_field_id(client):
    """Patching 'id' returns 400."""

    def override_auth():
        return make_mock_user("admin", [])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch("/records/test-id", json={"id": "new-id"})
        assert response.status_code == 400
        assert "id" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


# =============================================================================
# Test 3: Admin can patch everything
# =============================================================================


def test_admin_can_patch_all_fields(client):
    """Admin bypasses all field-level checks."""

    def override_auth():
        return make_mock_user("admin", [])  # No permission_keys needed

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch(
            "/records/test-id",
            json={
                "item_name": "New Name",
                "amazon_price_cents": 500,
                "status": "RETURN_CLOSED",
            },
        )
        assert response.status_code == 200
    finally:
        app.dependency_overrides.clear()


# =============================================================================
# Test 4: VA with all permissions can patch everything
# =============================================================================


def test_va_with_all_permissions(client):
    """VA with all three group permissions can patch any mutable field."""

    def override_auth():
        return make_mock_user(
            "va",
            [
                "bookkeeping.write.basic_fields",
                "bookkeeping.write.order_fields",
                "bookkeeping.write.service_fields",
            ],
        )

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        response = client.patch(
            "/records/test-id",
            json={
                "item_name": "New Name",
                "amazon_price_cents": 500,
                "status": "RETURN_CLOSED",
            },
        )
        assert response.status_code == 200
    finally:
        app.dependency_overrides.clear()


# =============================================================================
# Test 5: Admin bypass in require_permission_key
# =============================================================================


def test_admin_bypass_delete_endpoint(client):
    """Admin passes require_permission_key('bookkeeping.delete') without explicit key."""

    def override_auth():
        return make_mock_user("admin", [])  # No permission_keys, but admin role

    # For delete, we need to override require_permission_key dependency
    app.dependency_overrides[
        require_permission_key("bookkeeping.delete")
    ] = override_auth
    try:
        # Mock delete to succeed
        with patch("app.routers.records.get_supabase_for_user") as mock_sb:
            mock_sb.return_value.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [
                {"id": "test-id"}
            ]
            response = client.delete("/records/test-id")
            assert response.status_code == 204
    finally:
        app.dependency_overrides.clear()


# =============================================================================
# Test 6: VA with specific permission can edit only their fields
# =============================================================================


def test_va_with_basic_fields_only(client):
    """VA with basic_fields can edit item_name but not status."""

    def override_auth():
        return make_mock_user("va", ["bookkeeping.write.basic_fields"])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        # Can edit basic field
        response = client.patch("/records/test-id", json={"item_name": "New Name"})
        assert response.status_code == 200

        # Cannot edit service field
        response = client.patch("/records/test-id", json={"status": "RETURN_CLOSED"})
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_va_with_service_fields_only(client):
    """VA with service_fields can edit status but not item_name."""

    def override_auth():
        return make_mock_user("va", ["bookkeeping.write.service_fields"])

    app.dependency_overrides[get_current_user_with_membership] = override_auth
    try:
        # Can edit service field
        response = client.patch("/records/test-id", json={"status": "RETURN_CLOSED"})
        assert response.status_code == 200

        # Cannot edit basic field
        response = client.patch("/records/test-id", json={"item_name": "New Name"})
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
