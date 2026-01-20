-- ============================================================
-- Migration 028: Automation Hub Tables (Simplified - No Codes)
-- ============================================================
-- Extension-initiated pairing with rate limiting.
-- Admin approves + assigns Account + Role directly.
-- No 6-digit codes, no device blocking.
-- ============================================================

-- ============================================================
-- Table: automation_accounts (Store accounts for agents)
-- ============================================================
-- Each account represents an eBay/Amazon store.
-- Agents are assigned to accounts during approval.
-- NOTE: Migration 029 drops this table and uses existing accounts table.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,                    -- e.g., "Store ABC", "Client XYZ"
  client_id UUID,                        -- Optional, for future profit tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_accounts TO service_role;

CREATE INDEX IF NOT EXISTS idx_automation_accounts_org
  ON public.automation_accounts(org_id);

-- ============================================================
-- Table: automation_devices (Persistent per-device rate limiting)
-- ============================================================
-- Source of truth for rate limiting. Backoff persists forever.
-- No device blocking - only rate limiting.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_devices (
  install_instance_id TEXT PRIMARY KEY,
  lifetime_request_count INT NOT NULL DEFAULT 0,
  next_allowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_devices ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_devices TO service_role;

-- Drop blocking columns if they exist (migration from old schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_devices' AND column_name = 'blocked_at'
  ) THEN
    ALTER TABLE public.automation_devices DROP COLUMN blocked_at;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_devices' AND column_name = 'blocked_reason'
  ) THEN
    ALTER TABLE public.automation_devices DROP COLUMN blocked_reason;
  END IF;
END $$;

-- ============================================================
-- Table: automation_pairing_requests (Request log + state)
-- ============================================================
-- Tracks pairing requests. No codes - admin assigns account+role directly.
-- Requests expire after 15 minutes.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_pairing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  install_instance_id TEXT NOT NULL,
  org_id UUID,           -- Set at approval time by admin
  account_id UUID,       -- Set at approval time by admin
  role TEXT,             -- Set at approval time: 'EBAY_AGENT' or 'AMAZON_AGENT'
  label TEXT,            -- Set at approval time by admin
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

  -- Approval details
  approved_by UUID,
  approved_at TIMESTAMPTZ,

  -- Rejection details
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Expiration (15 minutes from creation)
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes'),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_pairing_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_pairing_requests TO service_role;

-- Drop code-related columns if they exist (migration from old schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'code_hash'
  ) THEN
    ALTER TABLE public.automation_pairing_requests DROP COLUMN code_hash;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'code_salt'
  ) THEN
    ALTER TABLE public.automation_pairing_requests DROP COLUMN code_salt;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'code_plaintext'
  ) THEN
    ALTER TABLE public.automation_pairing_requests DROP COLUMN code_plaintext;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'code_expires_at'
  ) THEN
    ALTER TABLE public.automation_pairing_requests DROP COLUMN code_expires_at;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'redeemed_at'
  ) THEN
    ALTER TABLE public.automation_pairing_requests DROP COLUMN redeemed_at;
  END IF;
END $$;

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.automation_pairing_requests ADD COLUMN account_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.automation_pairing_requests ADD COLUMN role TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_pairing_requests' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.automation_pairing_requests ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes');
  END IF;
END $$;

-- Add foreign key to devices if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'automation_pairing_requests'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%install_instance_id%'
  ) THEN
    BEGIN
      ALTER TABLE public.automation_pairing_requests
        ADD CONSTRAINT fk_pairing_requests_device
        FOREIGN KEY (install_instance_id)
        REFERENCES public.automation_devices(install_instance_id)
        ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if already exists or data issues
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pairing_requests_pending
  ON public.automation_pairing_requests(status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pairing_requests_device
  ON public.automation_pairing_requests(install_instance_id, status);

-- Prevent duplicate pending requests per device (race safety)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pairing_requests_one_pending_per_device
  ON public.automation_pairing_requests(install_instance_id)
  WHERE status = 'pending';

-- ============================================================
-- Table: automation_events (Admin notification feed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,  -- 'PAIRING_REQUEST_CREATED', 'PAIRING_REQUEST_APPROVED', 'PAIRING_REQUEST_REJECTED', 'AGENT_REVOKED'
  request_id UUID,
  agent_id UUID,
  install_instance_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_automation_events_created
  ON public.automation_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_events_type
  ON public.automation_events(type, created_at DESC);

-- ============================================================
-- Table: automation_agents (Extension instances)
-- ============================================================
-- Each agent belongs to an account. Per-agent token_secret for JWT.
-- Only 1 active eBay agent per account (enforced by partial unique index).
-- Unlimited Amazon agents per account.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  account_id UUID,      -- References automation_accounts
  install_instance_id TEXT NOT NULL,
  role TEXT CHECK (role IN ('EBAY_AGENT', 'AMAZON_AGENT')),
  label TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked', 'offline')),
  token_secret TEXT NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_agents' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.automation_agents ADD COLUMN account_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_agents' AND column_name = 'token_secret'
  ) THEN
    ALTER TABLE public.automation_agents ADD COLUMN token_secret TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_agents' AND column_name = 'token_version'
  ) THEN
    ALTER TABLE public.automation_agents ADD COLUMN token_version INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill token_secret for any existing rows that have NULL
UPDATE public.automation_agents
SET token_secret = encode(gen_random_bytes(32), 'hex')
WHERE token_secret IS NULL;

-- Now set NOT NULL constraint (safe after backfill)
ALTER TABLE public.automation_agents ALTER COLUMN token_secret SET NOT NULL;

-- Update status enum if old values exist
UPDATE public.automation_agents SET status = 'active' WHERE status = 'online';
UPDATE public.automation_agents SET status = 'offline' WHERE status = 'error';

-- Only 1 active eBay agent per account (partial unique index)
DROP INDEX IF EXISTS unique_ebay_agent_per_account;
CREATE UNIQUE INDEX IF NOT EXISTS unique_ebay_agent_per_account
  ON public.automation_agents (account_id)
  WHERE role = 'EBAY_AGENT' AND status = 'active';

-- Keep org + install_instance unique for duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_agents_org_install
  ON public.automation_agents(org_id, install_instance_id)
  WHERE status = 'active';

ALTER TABLE public.automation_agents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_agents TO service_role;

CREATE INDEX IF NOT EXISTS idx_automation_agents_account
  ON public.automation_agents(account_id);

-- ============================================================
-- Table: automation_jobs (Task queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  account_id UUID,      -- Which account this job is for
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'CLAIMED', 'RUNNING', 'COMPLETED',
    'FAILED_RETRYABLE', 'FAILED_NEEDS_ATTENTION', 'EXPIRED'
  )),
  attempt_count INT DEFAULT 0,

  -- eBay data
  ebay_order_id TEXT NOT NULL,
  item_name TEXT,
  qty INT,
  sale_price_cents INT,
  ebay_fees_cents INT,
  sale_date DATE,
  auto_order_url TEXT NOT NULL,

  -- Amazon data (filled on complete)
  amazon_order_id TEXT,
  amazon_price_cents INT,
  amazon_tax_cents INT,
  amazon_shipping_cents INT,

  -- Tracking
  created_by_agent_id UUID,
  claimed_by_agent_id UUID,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  failure_details TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, ebay_order_id)
);

-- Add account_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_jobs' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.automation_jobs ADD COLUMN account_id UUID;
  END IF;
END $$;

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_jobs TO service_role;

CREATE INDEX IF NOT EXISTS idx_automation_jobs_claim
  ON public.automation_jobs(org_id, status, created_at)
  WHERE status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_automation_jobs_by_agent
  ON public.automation_jobs(claimed_by_agent_id, status);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_account
  ON public.automation_jobs(account_id);

-- ============================================================
-- Drop deprecated objects
-- ============================================================
DROP TABLE IF EXISTS public.automation_pairing_codes CASCADE;
DROP FUNCTION IF EXISTS public.rpc_pairing_redeem(TEXT, TEXT, TEXT);

-- ============================================================
-- Function: rpc_pairing_request (Atomic Pairing Request)
-- ============================================================
-- Extension requests pairing. Enforces rate limiting.
-- Returns status and cooldown info. Creates pending request if allowed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_pairing_request(
  p_install_instance_id TEXT
) RETURNS TABLE (
  device_status TEXT,        -- 'cooldown', 'pending', 'created'
  request_id UUID,
  status TEXT,
  lifetime_request_count INT,
  next_allowed_at TIMESTAMPTZ,
  cooldown_seconds INT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_device public.automation_devices;
  v_request public.automation_pairing_requests;
  v_cooldown_seconds INT;
  v_exp INT;
  v_base_time TIMESTAMPTZ;
  v_new_next_allowed TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_new_request_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Upsert device record (always increment count on every call)
  INSERT INTO public.automation_devices (install_instance_id, lifetime_request_count, last_request_at, created_at, updated_at)
  VALUES (p_install_instance_id, 1, v_now, v_now, v_now)
  ON CONFLICT (install_instance_id) DO UPDATE SET
    lifetime_request_count = public.automation_devices.lifetime_request_count + 1,
    last_request_at = v_now,
    updated_at = v_now
  RETURNING * INTO v_device;

  -- Calculate cooldown with clamped exponent to prevent overflow
  -- exp clamped to 7 max (2^7 = 128, 30*128 = 3840, capped to 3600)
  v_exp := LEAST(v_device.lifetime_request_count - 1, 7);
  v_cooldown_seconds := LEAST(3600, 30 * POWER(2, v_exp)::INT);

  -- Extend next_allowed_at from the greater of current next_allowed_at or now
  v_base_time := GREATEST(v_device.next_allowed_at, v_now);
  v_new_next_allowed := v_base_time + (v_cooldown_seconds || ' seconds')::INTERVAL;

  -- Update next_allowed_at
  UPDATE public.automation_devices
  SET next_allowed_at = v_new_next_allowed,
      updated_at = v_now
  WHERE install_instance_id = p_install_instance_id
  RETURNING * INTO v_device;

  -- Check if in cooldown (using original next_allowed_at before we extended it)
  IF v_now < v_base_time AND v_base_time != v_now THEN
    -- Return existing pending request if any
    SELECT * INTO v_request
    FROM public.automation_pairing_requests
    WHERE public.automation_pairing_requests.install_instance_id = p_install_instance_id
      AND public.automation_pairing_requests.status = 'pending'
      AND public.automation_pairing_requests.expires_at > v_now
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN QUERY SELECT
      'cooldown'::TEXT,
      v_request.id,
      v_request.status,
      v_device.lifetime_request_count,
      v_device.next_allowed_at,
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT),
      v_request.expires_at;
    RETURN;
  END IF;

  -- Check for existing pending request (not expired)
  SELECT * INTO v_request
  FROM public.automation_pairing_requests
  WHERE public.automation_pairing_requests.install_instance_id = p_install_instance_id
    AND public.automation_pairing_requests.status = 'pending'
    AND public.automation_pairing_requests.expires_at > v_now
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_request IS NOT NULL THEN
    -- Already have a pending request
    RETURN QUERY SELECT
      'pending'::TEXT,
      v_request.id,
      v_request.status,
      v_device.lifetime_request_count,
      v_device.next_allowed_at,
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT),
      v_request.expires_at;
    RETURN;
  END IF;

  -- Expire any old pending requests for this device
  UPDATE public.automation_pairing_requests
  SET status = 'expired', updated_at = v_now
  WHERE public.automation_pairing_requests.install_instance_id = p_install_instance_id
    AND public.automation_pairing_requests.status = 'pending'
    AND public.automation_pairing_requests.expires_at <= v_now;

  -- Create new pending request (expires in 15 minutes)
  v_new_request_id := gen_random_uuid();
  v_expires_at := v_now + INTERVAL '15 minutes';

  INSERT INTO public.automation_pairing_requests (id, install_instance_id, status, expires_at, created_at, updated_at)
  VALUES (v_new_request_id, p_install_instance_id, 'pending', v_expires_at, v_now, v_now)
  ON CONFLICT (install_instance_id) WHERE automation_pairing_requests.status = 'pending' DO NOTHING;

  -- Get the actual pending request (might be ours or existing one from race)
  SELECT * INTO v_request
  FROM public.automation_pairing_requests
  WHERE public.automation_pairing_requests.install_instance_id = p_install_instance_id
    AND public.automation_pairing_requests.status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Emit event only if we created the new request
  IF v_request.id = v_new_request_id THEN
    INSERT INTO public.automation_events (type, request_id, install_instance_id, payload, created_at)
    VALUES (
      'PAIRING_REQUEST_CREATED',
      v_request.id,
      p_install_instance_id,
      jsonb_build_object('lifetime_request_count', v_device.lifetime_request_count),
      v_now
    );

    RETURN QUERY SELECT
      'created'::TEXT,
      v_request.id,
      'pending'::TEXT,
      v_device.lifetime_request_count,
      v_device.next_allowed_at,
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT),
      v_request.expires_at;
  ELSE
    -- Concurrent request won, return pending status
    RETURN QUERY SELECT
      'pending'::TEXT,
      v_request.id,
      v_request.status,
      v_device.lifetime_request_count,
      v_device.next_allowed_at,
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT),
      v_request.expires_at;
  END IF;
END;
$$;

-- Lock down execution privileges
REVOKE ALL ON FUNCTION public.rpc_pairing_request(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_pairing_request(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_pairing_request(TEXT) TO service_role;

-- ============================================================
-- Function: rpc_pairing_poll (Check status for extension)
-- ============================================================
-- Extension polls this to check if approved.
-- Returns current status and agent info if approved.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_pairing_poll(
  p_install_instance_id TEXT
) RETURNS TABLE (
  status TEXT,           -- 'pending', 'approved', 'rejected', 'expired', 'not_found'
  agent_id UUID,
  install_token TEXT,
  role TEXT,
  label TEXT,
  account_name TEXT,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.automation_pairing_requests;
  v_agent public.automation_agents;
  v_account public.automation_accounts;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Find most recent request for this device
  SELECT * INTO v_request
  FROM public.automation_pairing_requests
  WHERE public.automation_pairing_requests.install_instance_id = p_install_instance_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_request IS NULL THEN
    RETURN QUERY SELECT
      'not_found'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Check if expired (pending request past expiration)
  IF v_request.status = 'pending' AND v_request.expires_at <= v_now THEN
    -- Auto-expire it
    UPDATE public.automation_pairing_requests
    SET status = 'expired', updated_at = v_now
    WHERE id = v_request.id;

    RETURN QUERY SELECT
      'expired'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_request.expires_at;
    RETURN;
  END IF;

  -- Handle different statuses
  IF v_request.status = 'pending' THEN
    RETURN QUERY SELECT
      'pending'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_request.expires_at;
    RETURN;

  ELSIF v_request.status = 'rejected' THEN
    RETURN QUERY SELECT
      'rejected'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_request.rejection_reason, NULL::TIMESTAMPTZ;
    RETURN;

  ELSIF v_request.status = 'expired' THEN
    RETURN QUERY SELECT
      'expired'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_request.expires_at;
    RETURN;

  ELSIF v_request.status = 'approved' THEN
    -- Find the agent created for this request
    SELECT * INTO v_agent
    FROM public.automation_agents
    WHERE public.automation_agents.install_instance_id = p_install_instance_id
      AND public.automation_agents.status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_agent IS NULL THEN
      -- Agent not found (shouldn't happen)
      RETURN QUERY SELECT
        'pending'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_request.expires_at;
      RETURN;
    END IF;

    -- Get account name
    SELECT * INTO v_account
    FROM public.automation_accounts
    WHERE id = v_agent.account_id;

    -- Update last_seen_at
    UPDATE public.automation_agents
    SET last_seen_at = v_now
    WHERE id = v_agent.id;

    -- Return agent info (token generated by API layer with token_secret)
    RETURN QUERY SELECT
      'approved'::TEXT,
      v_agent.id,
      v_agent.token_secret,  -- API will use this to generate JWT
      v_agent.role,
      v_agent.label,
      v_account.name,
      NULL::TEXT,
      NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Fallback
  RETURN QUERY SELECT
    v_request.status, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_request.expires_at;
END;
$$;

-- Lock down execution privileges
REVOKE ALL ON FUNCTION public.rpc_pairing_poll(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_pairing_poll(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_pairing_poll(TEXT) TO service_role;

-- ============================================================
-- Function: claim_next_automation_job
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_automation_job(
  p_org_id UUID,
  p_agent_id UUID
) RETURNS TABLE (
  job_id UUID,
  ebay_order_id TEXT,
  item_name TEXT,
  qty INT,
  auto_order_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.automation_jobs;
BEGIN
  SELECT * INTO v_job
  FROM public.automation_jobs
  WHERE public.automation_jobs.org_id = p_org_id
    AND status = 'QUEUED'
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.automation_jobs
  SET status = 'CLAIMED',
      claimed_by_agent_id = p_agent_id,
      claimed_at = NOW(),
      attempt_count = attempt_count + 1
  WHERE id = v_job.id;

  RETURN QUERY SELECT v_job.id, v_job.ebay_order_id, v_job.item_name, v_job.qty, v_job.auto_order_url;
END;
$$;

-- Lock down execution privileges
REVOKE ALL ON FUNCTION public.claim_next_automation_job(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_next_automation_job(UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_automation_job(UUID, UUID) TO service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
