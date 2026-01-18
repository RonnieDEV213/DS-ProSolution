"""
Permission keys for department roles system.

Used by dept role CRUD endpoints for validation.
"""

# All valid permission keys for department roles
DEPT_ROLE_PERMISSION_KEYS = {
    # Order Tracking - page access
    "order_tracking.read",
    "order_tracking.export",
    "order_tracking.delete",
    # Order Tracking - field-level write access
    "order_tracking.write.basic_fields",
    "order_tracking.write.order_fields",
    "order_tracking.write.service_fields",
    # Order Tracking - remark access (granular)
    "order_tracking.read.order_remark",
    "order_tracking.write.order_remark",
    "order_tracking.read.service_remark",
    "order_tracking.write.service_remark",
    # Accounts - view only access
    "accounts.view",
}

# Permissions that CANNOT be assigned to department roles
# (reserved for admin/client system roles)
FORBIDDEN_DEPT_ROLE_PERMISSIONS = {"payouts.read", "profit.read"}

# Mapping: legacy fields -> new permission keys
# Used by _merge_permissions() to check if dept roles grant permissions
LEGACY_TO_NEW_KEY = {
    # Order Tracking (was Bookkeeping)
    "can_view_bookkeeping": "order_tracking.read",
    "can_export_bookkeeping": "order_tracking.export",
    # Admin (NOT assignable via dept roles - admins get these by role)
    "can_manage_invites": "admin.invites",
    "can_manage_users": "admin.users",
    "can_manage_account_assignments": "admin.account_assign",
}

# Alias mapping: bookkeeping.* -> order_tracking.* for backward compatibility
# Allows existing DB roles with old keys to work until migration is applied
PERMISSION_KEY_ALIASES = {
    "bookkeeping.read": "order_tracking.read",
    "bookkeeping.export": "order_tracking.export",
    "bookkeeping.delete": "order_tracking.delete",
    "bookkeeping.write.basic_fields": "order_tracking.write.basic_fields",
    "bookkeeping.write.order_fields": "order_tracking.write.order_fields",
    "bookkeeping.write.service_fields": "order_tracking.write.service_fields",
}

# Implied permissions: having X automatically grants Y
# Used to avoid bricking existing roles when new remark keys are added
IMPLIED_PERMISSIONS = {
    "order_tracking.read": {
        "order_tracking.read.order_remark",
        "order_tracking.read.service_remark",
    },
    "order_tracking.write.order_fields": {
        "order_tracking.write.order_remark",
    },
    "order_tracking.write.service_fields": {
        "order_tracking.write.service_remark",
    },
}

# Human-readable labels for permission keys
PERMISSION_LABELS = {
    "order_tracking.read": "View Order Tracking",
    "order_tracking.export": "Export Order Tracking",
    "order_tracking.delete": "Delete Records",
    "order_tracking.write.basic_fields": "Edit Basic Fields",
    "order_tracking.write.order_fields": "Edit Order Fields",
    "order_tracking.write.service_fields": "Edit Service Fields",
    "order_tracking.read.order_remark": "View Order Remarks",
    "order_tracking.write.order_remark": "Edit Order Remarks",
    "order_tracking.read.service_remark": "View Service Remarks",
    "order_tracking.write.service_remark": "Edit Service Remarks",
    "accounts.view": "View Assigned Accounts",
    "payouts.read": "View Payouts",
    "profit.read": "View Profit",
}
