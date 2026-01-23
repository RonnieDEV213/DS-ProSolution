-- Migration: 035_access_codes.sql
-- Purpose: Create access codes schema for extension authentication
-- Phase: 01-access-code-foundation, Plan: 01

-- ============================================================
-- 1. access_codes table
-- ============================================================
-- Stores access codes for VA/Admin extension authentication.
-- prefix is globally unique for O(1) lookup.
-- hashed_secret uses Argon2id (hash is ~100 chars).
-- One code per user per org (user_org_unique constraint).

CREATE TABLE access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  prefix VARCHAR(4) NOT NULL,
  hashed_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  rotated_at TIMESTAMPTZ,

  CONSTRAINT access_codes_prefix_unique UNIQUE (prefix),
  CONSTRAINT access_codes_user_org_unique UNIQUE (user_id, org_id)
);

-- ============================================================
-- 2. access_code_attempts table (for rate limiting)
-- ============================================================
-- Tracks authentication attempts for rate limiting.
-- Used to enforce per-prefix and per-IP limits.

CREATE TABLE access_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix VARCHAR(4),
  ip_address INET NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_access_code_attempts_prefix_time
  ON access_code_attempts(prefix, attempted_at DESC);
CREATE INDEX idx_access_code_attempts_ip_time
  ON access_code_attempts(ip_address, attempted_at DESC);

-- ============================================================
-- 3. access_code_lockouts table (for progressive lockouts)
-- ============================================================
-- Tracks active lockouts by prefix or IP.
-- Progressive durations: 5 min -> 15 min -> 1 hour.

CREATE TABLE access_code_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix VARCHAR(4),
  ip_address INET,
  lockout_level INT NOT NULL DEFAULT 1,
  lockout_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT access_code_lockouts_prefix_unique UNIQUE (prefix),
  CONSTRAINT access_code_lockouts_ip_unique UNIQUE (ip_address)
);

-- ============================================================
-- 4. RPC function: check_access_code_rate_limit
-- ============================================================
-- Atomic check for rate limits before authentication attempt.
-- Returns: allowed (boolean), retry_after_seconds, lockout_level
-- Progressive lockout: 5 min (L1), 15 min (L2), 1 hour (L3+)

CREATE OR REPLACE FUNCTION check_access_code_rate_limit(
  p_prefix TEXT,
  p_ip INET,
  p_window_seconds INT DEFAULT 300,
  p_max_attempts INT DEFAULT 10
) RETURNS TABLE (
  allowed BOOLEAN,
  retry_after_seconds INT,
  lockout_level INT
) AS $$
DECLARE
  v_prefix_lockout RECORD;
  v_ip_lockout RECORD;
  v_prefix_attempts INT;
  v_ip_attempts INT;
  v_lockout_duration INT;
  v_new_lockout_level INT;
BEGIN
  -- Check existing prefix lockout
  SELECT * INTO v_prefix_lockout
  FROM access_code_lockouts
  WHERE access_code_lockouts.prefix = p_prefix AND lockout_until > NOW();

  IF v_prefix_lockout IS NOT NULL THEN
    RETURN QUERY SELECT
      FALSE,
      EXTRACT(EPOCH FROM (v_prefix_lockout.lockout_until - NOW()))::INT,
      v_prefix_lockout.lockout_level;
    RETURN;
  END IF;

  -- Check existing IP lockout
  SELECT * INTO v_ip_lockout
  FROM access_code_lockouts
  WHERE access_code_lockouts.ip_address = p_ip AND lockout_until > NOW();

  IF v_ip_lockout IS NOT NULL THEN
    RETURN QUERY SELECT
      FALSE,
      EXTRACT(EPOCH FROM (v_ip_lockout.lockout_until - NOW()))::INT,
      v_ip_lockout.lockout_level;
    RETURN;
  END IF;

  -- Count recent failed attempts by prefix
  SELECT COUNT(*) INTO v_prefix_attempts
  FROM access_code_attempts
  WHERE access_code_attempts.prefix = p_prefix
    AND attempted_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL
    AND success = FALSE;

  -- Count recent failed attempts by IP
  SELECT COUNT(*) INTO v_ip_attempts
  FROM access_code_attempts
  WHERE access_code_attempts.ip_address = p_ip
    AND attempted_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL
    AND success = FALSE;

  -- Check if either limit exceeded
  IF v_prefix_attempts >= p_max_attempts THEN
    -- Get or create lockout level for prefix
    SELECT access_code_lockouts.lockout_level INTO v_new_lockout_level
    FROM access_code_lockouts WHERE access_code_lockouts.prefix = p_prefix;

    v_new_lockout_level := COALESCE(v_new_lockout_level, 0) + 1;

    -- Progressive lockout: 5min, 15min, 1hr
    v_lockout_duration := CASE
      WHEN v_new_lockout_level = 1 THEN 300
      WHEN v_new_lockout_level = 2 THEN 900
      ELSE 3600
    END;

    INSERT INTO access_code_lockouts (prefix, lockout_level, lockout_until, updated_at)
    VALUES (p_prefix, v_new_lockout_level, NOW() + (v_lockout_duration || ' seconds')::INTERVAL, NOW())
    ON CONFLICT (prefix) DO UPDATE SET
      lockout_level = v_new_lockout_level,
      lockout_until = NOW() + (v_lockout_duration || ' seconds')::INTERVAL,
      updated_at = NOW();

    RETURN QUERY SELECT FALSE, v_lockout_duration, v_new_lockout_level;
    RETURN;
  END IF;

  IF v_ip_attempts >= p_max_attempts THEN
    -- Similar logic for IP
    SELECT access_code_lockouts.lockout_level INTO v_new_lockout_level
    FROM access_code_lockouts WHERE access_code_lockouts.ip_address = p_ip;

    v_new_lockout_level := COALESCE(v_new_lockout_level, 0) + 1;

    v_lockout_duration := CASE
      WHEN v_new_lockout_level = 1 THEN 300
      WHEN v_new_lockout_level = 2 THEN 900
      ELSE 3600
    END;

    INSERT INTO access_code_lockouts (ip_address, lockout_level, lockout_until, updated_at)
    VALUES (p_ip, v_new_lockout_level, NOW() + (v_lockout_duration || ' seconds')::INTERVAL, NOW())
    ON CONFLICT (ip_address) DO UPDATE SET
      lockout_level = v_new_lockout_level,
      lockout_until = NOW() + (v_lockout_duration || ' seconds')::INTERVAL,
      updated_at = NOW();

    RETURN QUERY SELECT FALSE, v_lockout_duration, v_new_lockout_level;
    RETURN;
  END IF;

  -- Allowed
  RETURN QUERY SELECT TRUE, 0, 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. RPC function: record_access_code_attempt
-- ============================================================
-- Records an authentication attempt for rate limiting.
-- On success, clears lockouts for the prefix.

CREATE OR REPLACE FUNCTION record_access_code_attempt(
  p_prefix TEXT,
  p_ip INET,
  p_success BOOLEAN
) RETURNS VOID AS $$
BEGIN
  INSERT INTO access_code_attempts (prefix, ip_address, success)
  VALUES (p_prefix, p_ip, p_success);

  -- If success, clear lockouts for this prefix
  IF p_success THEN
    DELETE FROM access_code_lockouts WHERE prefix = p_prefix;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. Indexes on access_codes
-- ============================================================
-- Optimize lookups by user_id, prefix, and expiration.

CREATE INDEX idx_access_codes_user_id ON access_codes(user_id);
CREATE INDEX idx_access_codes_prefix ON access_codes(prefix);
CREATE INDEX idx_access_codes_expires_at ON access_codes(expires_at);

-- ============================================================
-- 7. RLS policies (service role only for now)
-- ============================================================
-- Access codes are managed by service role only.
-- Future plans may add user-facing policies for code rotation.

ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_code_lockouts ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_access_codes" ON access_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_access_code_attempts" ON access_code_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_access_code_lockouts" ON access_code_lockouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
