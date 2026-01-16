-- ============================================================
-- Migration 028: Automation Hub Tables (Revised)
-- ============================================================
-- Extension-initiated pairing with rate limiting, device blocking,
-- hashed codes, per-agent token secrets, and admin event feed.
-- ============================================================

-- Enable pgcrypto for secure hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Table: automation_devices (Persistent per-device backoff state)
-- ============================================================
-- Source of truth for rate limiting. Backoff persists forever.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_devices (
  install_instance_id TEXT PRIMARY KEY,
  lifetime_request_count INT NOT NULL DEFAULT 0,
  next_allowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_request_at TIMESTAMPTZ,
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_devices ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_devices TO service_role;

-- ============================================================
-- Table: automation_pairing_requests (Request log + state)
-- ============================================================
-- Tracks pairing requests. Backoff comes from automation_devices.
-- Code is stored as hash + salt only; plaintext never persisted.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_pairing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  install_instance_id TEXT NOT NULL REFERENCES public.automation_devices(install_instance_id) ON DELETE CASCADE,
  org_id UUID,  -- Set at approval time by admin
  label TEXT,   -- Set at approval time by admin
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'redeemed')),

  -- Approval details
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  code_hash TEXT,      -- SHA256 hash of code+salt
  code_salt TEXT,      -- Random salt for this code
  code_expires_at TIMESTAMPTZ,

  -- Rejection details
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Redemption
  redeemed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_pairing_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_pairing_requests TO service_role;

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
-- Persists events for admin UI to poll/subscribe.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,  -- 'PAIRING_REQUEST_CREATED', 'PAIRING_REQUEST_APPROVED', 'PAIRING_REQUEST_REJECTED'
  request_id UUID REFERENCES public.automation_pairing_requests(id) ON DELETE SET NULL,
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
-- Table: automation_agents (Idempotent schema migration)
-- ============================================================
-- Per-agent token_secret for JWT signing. Role is nullable until
-- VA configures it after pairing.
-- ============================================================

-- Create table if not exists with base structure
CREATE TABLE IF NOT EXISTS public.automation_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  install_instance_id TEXT NOT NULL,
  role TEXT CHECK (role IS NULL OR role IN ('EBAY_AGENT', 'AMAZON_AGENT')),
  label TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'paused', 'error')),
  token_secret TEXT,  -- Will be set NOT NULL after backfill
  token_version INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (idempotent)
DO $$
BEGIN
  -- Add token_secret if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_agents' AND column_name = 'token_secret'
  ) THEN
    ALTER TABLE public.automation_agents ADD COLUMN token_secret TEXT;
  END IF;

  -- Add token_version if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_agents' AND column_name = 'token_version'
  ) THEN
    ALTER TABLE public.automation_agents ADD COLUMN token_version INT NOT NULL DEFAULT 0;
  END IF;

  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'automation_agents' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.automation_agents ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Backfill token_secret for any existing rows that have NULL
UPDATE public.automation_agents
SET token_secret = encode(gen_random_bytes(32), 'hex')
WHERE token_secret IS NULL;

-- Now set NOT NULL constraint (safe after backfill)
ALTER TABLE public.automation_agents ALTER COLUMN token_secret SET NOT NULL;

-- Make role nullable if it was NOT NULL before (guard for older schemas)
DO $$
BEGIN
  -- Only attempt DROP NOT NULL if the column exists and is currently NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'automation_agents'
      AND column_name = 'role'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.automation_agents ALTER COLUMN role DROP NOT NULL;
  END IF;
END $$;

-- Add unique constraint via index (idempotent by structure, not name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_agents_org_install
  ON public.automation_agents(org_id, install_instance_id);

ALTER TABLE public.automation_agents ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (token_secret is sensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'automation_agents'
      AND policyname = 'Service role full access'
  ) THEN
    EXECUTE 'CREATE POLICY "Service role full access" ON public.automation_agents FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_agents TO service_role;

-- ============================================================
-- Table: automation_jobs (Unchanged from original)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
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
  created_by_agent_id UUID REFERENCES public.automation_agents(id),
  claimed_by_agent_id UUID REFERENCES public.automation_agents(id),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  failure_details TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, ebay_order_id)
);

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_jobs TO service_role;

CREATE INDEX IF NOT EXISTS idx_automation_jobs_claim
  ON public.automation_jobs(org_id, status, created_at)
  WHERE status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_automation_jobs_by_agent
  ON public.automation_jobs(claimed_by_agent_id, status);

-- ============================================================
-- Drop deprecated table (if exists)
-- ============================================================
DROP TABLE IF EXISTS public.automation_pairing_codes CASCADE;

-- ============================================================
-- Function: rpc_pairing_request (Atomic Pairing Request)
-- ============================================================
-- Extension requests pairing. Enforces persistent rate limiting.
-- Returns status and cooldown info. Creates pending request if allowed.
-- EVERY call increments lifetime_request_count (even during cooldown).
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_pairing_request(
  p_install_instance_id TEXT
) RETURNS TABLE (
  device_status TEXT,        -- 'blocked', 'cooldown', 'pending', 'created'
  request_id UUID,
  status TEXT,
  lifetime_request_count INT,
  next_allowed_at TIMESTAMPTZ,
  cooldown_seconds INT
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
BEGIN
  -- Upsert device record (always increment count on every call)
  INSERT INTO public.automation_devices (install_instance_id, lifetime_request_count, last_request_at, created_at, updated_at)
  VALUES (p_install_instance_id, 1, v_now, v_now, v_now)
  ON CONFLICT (install_instance_id) DO UPDATE SET
    lifetime_request_count = public.automation_devices.lifetime_request_count + 1,
    last_request_at = v_now,
    updated_at = v_now
  RETURNING * INTO v_device;

  -- Check if device is blocked
  IF v_device.blocked_at IS NOT NULL THEN
    RETURN QUERY SELECT
      'blocked'::TEXT,
      NULL::UUID,
      NULL::TEXT,
      v_device.lifetime_request_count,
      v_device.next_allowed_at,
      0;
    RETURN;
  END IF;

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
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN QUERY SELECT
      'cooldown'::TEXT,
      v_request.id,
      v_request.status,
      v_device.lifetime_request_count,
      v_device.next_allowed_at,
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT);
    RETURN;
  END IF;

  -- Check for existing pending request
  SELECT * INTO v_request
  FROM public.automation_pairing_requests
  WHERE public.automation_pairing_requests.install_instance_id = p_install_instance_id
    AND public.automation_pairing_requests.status = 'pending'
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
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT);
    RETURN;
  END IF;

  -- Create new pending request (with race-safe upsert)
  v_new_request_id := gen_random_uuid();
  INSERT INTO public.automation_pairing_requests (id, install_instance_id, status, created_at, updated_at)
  VALUES (v_new_request_id, p_install_instance_id, 'pending', v_now, v_now)
  ON CONFLICT (install_instance_id) WHERE status = 'pending' DO NOTHING;

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
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT);
  ELSE
    -- Concurrent request won, return pending status
    RETURN QUERY SELECT
      'pending'::TEXT,
      v_request.id,
      v_request.status,
      v_device.lifetime_request_count,
      v_device.next_allowed_at,
      GREATEST(0, EXTRACT(EPOCH FROM (v_device.next_allowed_at - v_now))::INT);
  END IF;
END;
$$;

-- Lock down execution privileges
REVOKE ALL ON FUNCTION public.rpc_pairing_request(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_pairing_request(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_pairing_request(TEXT) TO service_role;

-- ============================================================
-- Function: rpc_pairing_redeem (Atomic Code Redemption)
-- ============================================================
-- Extension redeems code. Validates hash, creates/updates agent.
-- Returns agent info for token generation (done in Python).
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_pairing_redeem(
  p_code TEXT,
  p_install_instance_id TEXT,
  p_token_secret TEXT  -- Generated by API for new agent
) RETURNS TABLE (
  agent_id UUID,
  org_id UUID,
  label TEXT,
  token_version INT,
  is_new BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_device public.automation_devices;
  v_request public.automation_pairing_requests;
  v_agent public.automation_agents;
  v_is_new BOOLEAN := FALSE;
  v_computed_hash TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Check device not blocked
  SELECT * INTO v_device
  FROM public.automation_devices
  WHERE public.automation_devices.install_instance_id = p_install_instance_id;

  IF v_device IS NULL THEN
    RAISE EXCEPTION 'DEVICE_NOT_FOUND';
  END IF;

  IF v_device.blocked_at IS NOT NULL THEN
    RAISE EXCEPTION 'DEVICE_BLOCKED';
  END IF;

  -- Find approved, unredeemed request for this device
  SELECT * INTO v_request
  FROM public.automation_pairing_requests
  WHERE public.automation_pairing_requests.install_instance_id = p_install_instance_id
    AND public.automation_pairing_requests.status = 'approved'
    AND public.automation_pairing_requests.code_expires_at > v_now
  ORDER BY approved_at DESC
  FOR UPDATE
  LIMIT 1;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_CODE';
  END IF;

  -- Fail fast if org_id was not set during approval
  IF v_request.org_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_APPROVED_WITH_ORG';
  END IF;

  -- Verify code hash using pgcrypto digest()
  v_computed_hash := encode(digest(convert_to(p_code || v_request.code_salt, 'utf8'), 'sha256'), 'hex');

  IF v_computed_hash != v_request.code_hash THEN
    RAISE EXCEPTION 'INVALID_OR_EXPIRED_CODE';
  END IF;

  -- Mark request as redeemed
  UPDATE public.automation_pairing_requests
  SET status = 'redeemed',
      redeemed_at = v_now,
      updated_at = v_now
  WHERE id = v_request.id;

  -- Check if agent already exists
  SELECT * INTO v_agent
  FROM public.automation_agents
  WHERE public.automation_agents.org_id = v_request.org_id
    AND public.automation_agents.install_instance_id = p_install_instance_id
  FOR UPDATE;

  IF v_agent IS NULL THEN
    -- Create new agent (role is NULL - VA sets later)
    INSERT INTO public.automation_agents (
      org_id, install_instance_id, label, token_secret, status, last_seen_at, created_at, updated_at
    )
    VALUES (
      v_request.org_id, p_install_instance_id, v_request.label,
      p_token_secret, 'online', v_now, v_now, v_now
    )
    RETURNING * INTO v_agent;
    v_is_new := TRUE;
  ELSE
    -- Re-auth: regenerate secret and increment version
    UPDATE public.automation_agents
    SET token_secret = p_token_secret,
        token_version = token_version + 1,
        label = COALESCE(v_request.label, public.automation_agents.label),
        status = 'online',
        last_seen_at = v_now,
        updated_at = v_now
    WHERE id = v_agent.id
    RETURNING * INTO v_agent;
  END IF;

  RETURN QUERY SELECT v_agent.id, v_agent.org_id, v_agent.label, v_agent.token_version, v_is_new;
END;
$$;

-- Lock down execution privileges
REVOKE ALL ON FUNCTION public.rpc_pairing_redeem(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_pairing_redeem(TEXT, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_pairing_redeem(TEXT, TEXT, TEXT) TO service_role;

-- ============================================================
-- Function: claim_next_automation_job (Unchanged logic)
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
