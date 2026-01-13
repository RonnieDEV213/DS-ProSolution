#!/usr/bin/env python3
"""Verify migration 013 cleanup via Supabase REST API probes."""

import os
import sys
from pathlib import Path

# Try to import requests, fall back to urllib if not available
try:
    import requests
    USE_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    import json
    USE_REQUESTS = False


def load_env_file(filepath: Path) -> dict:
    """Load environment variables from a file."""
    env = {}
    if not filepath.exists():
        return env

    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                # Remove quotes if present
                value = value.strip().strip('"').strip("'")
                env[key] = value
    return env


def find_service_key(env: dict) -> str | None:
    """Find service role key from environment."""
    # Try common variations
    for key in env:
        key_upper = key.upper()
        if "SERVICE" in key_upper and "KEY" in key_upper:
            return env[key]
        if key_upper == "SUPABASE_SERVICE_ROLE_KEY":
            return env[key]
    return None


def http_get(url: str, headers: dict) -> tuple[int, str]:
    """Make HTTP GET request, return (status_code, body)."""
    if USE_REQUESTS:
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            return resp.status_code, resp.text
        except Exception as e:
            return 0, str(e)
    else:
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8") if e.fp else str(e)
        except Exception as e:
            return 0, str(e)


def main():
    # Load env files
    project_root = Path(__file__).parent.parent
    api_env = load_env_file(project_root / "apps" / "api" / ".env")
    web_env = load_env_file(project_root / "apps" / "web" / ".env.local")

    # Merge (api takes precedence)
    env = {**web_env, **api_env}

    # Get Supabase URL
    supabase_url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")
    if not supabase_url:
        print("FAIL: SUPABASE_URL not found in env files")
        sys.exit(1)

    # Get service role key
    service_key = find_service_key(env)
    if not service_key:
        print("FAIL: Service role key not found in env files")
        print("  Looked for keys containing 'SERVICE' and 'KEY'")
        sys.exit(1)

    print(f"Using Supabase URL: {supabase_url}")
    print(f"Service key found: {service_key[:20]}...{service_key[-10:]}")
    print()

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }

    all_passed = True

    # A) invites has user_type column
    print("A) Check invites.user_type exists...")
    url = f"{supabase_url}/rest/v1/invites?select=user_type&limit=1"
    status, body = http_get(url, headers)
    if status == 200:
        print(f"   PASS: HTTP {status}")
    else:
        print(f"   FAIL: HTTP {status} - {body[:200]}")
        all_passed = False

    # B) invites does NOT have account_type column
    print("B) Check invites.account_type does NOT exist...")
    url = f"{supabase_url}/rest/v1/invites?select=account_type&limit=1"
    status, body = http_get(url, headers)
    if status != 200:
        print(f"   PASS: HTTP {status} (column not found as expected)")
    else:
        # If 200, check if it returned actual data or empty
        # If column doesn't exist, PostgREST returns 400, not 200
        print(f"   FAIL: HTTP {status} - account_type column still exists!")
        print(f"   Response: {body[:200]}")
        all_passed = False

    # C) memberships accepts 'suspended' filter
    print("C) Check memberships accepts status='suspended'...")
    url = f"{supabase_url}/rest/v1/memberships?status=eq.suspended&select=id&limit=1"
    status, body = http_get(url, headers)
    if status == 200:
        print(f"   PASS: HTTP {status}")
    else:
        print(f"   FAIL: HTTP {status} - 'suspended' not valid status value")
        print(f"   Response: {body[:200]}")
        all_passed = False

    # D) No rows remain with status='disabled'
    print("D) Check no memberships have status='disabled'...")
    url = f"{supabase_url}/rest/v1/memberships?status=eq.disabled&select=id&limit=1"
    status, body = http_get(url, headers)
    if status == 200:
        # Check if any rows returned
        if body.strip() == "[]":
            print(f"   PASS: HTTP {status}, 0 rows with 'disabled' status")
        else:
            print(f"   FAIL: HTTP {status} - rows still have 'disabled' status!")
            print(f"   Response: {body[:200]}")
            all_passed = False
    else:
        # Error could mean 'disabled' is not a valid value anymore (good)
        print(f"   PASS: HTTP {status} - 'disabled' value rejected (constraint working)")

    print()
    if all_passed:
        print("=" * 50)
        print("FINAL VERDICT: PASS")
        print("=" * 50)
        sys.exit(0)
    else:
        print("=" * 50)
        print("FINAL VERDICT: FAIL")
        print("=" * 50)
        sys.exit(1)


if __name__ == "__main__":
    main()
