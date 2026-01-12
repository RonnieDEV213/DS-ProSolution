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
# Used by _merge_permissions() to check if dept roles grant permissions
LEGACY_TO_NEW_KEY = {
    # Bookkeeping
    "can_view_bookkeeping": "bookkeeping.read",
    "can_edit_bookkeeping": "bookkeeping.write",
    "can_export_bookkeeping": "bookkeeping.export",
    # Admin (NOT assignable via dept roles - admins get these by role)
    "can_manage_invites": "admin.invites",
    "can_manage_users": "admin.users",
    "can_manage_account_assignments": "admin.account_assign",
}

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
