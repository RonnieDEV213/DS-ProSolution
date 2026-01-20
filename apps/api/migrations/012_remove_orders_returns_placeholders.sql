BEGIN;

DELETE FROM public.department_role_permissions
WHERE permission_key IN ('orders.read','orders.write','returns.read','returns.write');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'no_placeholder_orders_returns'
      AND t.relname = 'department_role_permissions'
      AND n.nspname = 'public'
  ) THEN
    BEGIN
      ALTER TABLE public.department_role_permissions
      ADD CONSTRAINT no_placeholder_orders_returns
      CHECK (permission_key NOT IN ('orders.read','orders.write','returns.read','returns.write'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

COMMIT;
