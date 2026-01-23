-- 010_add_field_level_permissions.sql
-- Add field-level permission keys to existing Bookkeeping VA roles.
-- Idempotent - safe to re-run.

-- Add basic_fields permission to Bookkeeping VA roles
INSERT INTO department_role_permissions (role_id, permission_key)
SELECT dr.id, 'bookkeeping.write.basic_fields'
FROM department_roles dr
WHERE dr.name = 'Bookkeeping VA'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Add order_fields permission to Bookkeeping VA roles
INSERT INTO department_role_permissions (role_id, permission_key)
SELECT dr.id, 'bookkeeping.write.order_fields'
FROM department_roles dr
WHERE dr.name = 'Bookkeeping VA'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Add service_fields permission to Bookkeeping VA roles
INSERT INTO department_role_permissions (role_id, permission_key)
SELECT dr.id, 'bookkeeping.write.service_fields'
FROM department_roles dr
WHERE dr.name = 'Bookkeeping VA'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- NOTE: bookkeeping.delete is NOT granted to Bookkeeping VA by default.
-- Only admins can delete records unless explicitly granted via department roles UI.
