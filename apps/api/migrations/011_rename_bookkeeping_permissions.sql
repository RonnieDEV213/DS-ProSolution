BEGIN;

-- Delete legacy key first so it can't be renamed into garbage
DELETE FROM department_role_permissions
WHERE permission_key = 'bookkeeping.write';

-- Rename all bookkeeping.* keys to order_tracking.*
UPDATE department_role_permissions
SET permission_key = REPLACE(permission_key, 'bookkeeping.', 'order_tracking.')
WHERE permission_key LIKE 'bookkeeping.%';

-- Safety cleanup if any orphaned key exists
DELETE FROM department_role_permissions
WHERE permission_key = 'order_tracking.write';

COMMIT;
