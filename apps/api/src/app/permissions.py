"""
Permission keys for department roles system.

Used by dept role CRUD endpoints for validation.
Will be used by future orders/returns endpoints.
"""

# All valid permission keys for department roles
DEPT_ROLE_PERMISSION_KEYS = {
    "bookkeeping.read",
    "bookkeeping.write",
    "bookkeeping.export",
    "orders.read",
    "orders.write",
    "returns.read",
    "returns.write",
}

# Permissions that CANNOT be assigned to department roles
# (reserved for admin/client system roles)
FORBIDDEN_DEPT_ROLE_PERMISSIONS = {"payouts.read", "profit.read"}

# Mapping: legacy fields -> new permission keys
# Used by require_permission_key() for legacy fallback
LEGACY_TO_NEW_KEY = {
    # Bookkeeping
    "can_view_bookkeeping": "bookkeeping.read",
    "can_edit_bookkeeping": "bookkeeping.write",
    "can_export_bookkeeping": "bookkeeping.export",
    # Admin (for legacy fallback only - NOT assignable via dept roles)
    "can_manage_invites": "admin.invites",
    "can_manage_users": "admin.users",
    "can_manage_account_assignments": "admin.account_assign",
}

# Reverse mapping for backward compatibility
NEW_KEY_TO_LEGACY = {v: k for k, v in LEGACY_TO_NEW_KEY.items()}

# Human-readable labels for permission keys
PERMISSION_LABELS = {
    "bookkeeping.read": "View Bookkeeping",
    "bookkeeping.write": "Edit Bookkeeping",
    "bookkeeping.export": "Export Bookkeeping",
    "orders.read": "View Orders",
    "orders.write": "Edit Orders",
    "returns.read": "View Returns",
    "returns.write": "Edit Returns",
    "payouts.read": "View Payouts",
    "profit.read": "View Profit",
}
