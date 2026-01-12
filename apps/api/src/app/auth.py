"""JWT authentication for Supabase tokens."""

import os
from typing import Any

from dotenv import load_dotenv
import jwt

load_dotenv()
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.database import get_supabase
from app.permissions import LEGACY_TO_NEW_KEY

# auto_error=False so we can return 401 (not 403) on missing header
security = HTTPBearer(auto_error=False)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Default org ID for single-org MVP
DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001"

# Permission fields that can be overridden
PERMISSION_FIELDS = [
    "can_view_bookkeeping",
    "can_edit_bookkeeping",
    "can_export_bookkeeping",
    "can_manage_invites",
    "can_manage_users",
    "can_manage_account_assignments",
]

# JWKS client for RS256/ES256 (lazy loaded)
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    """Get or create JWKS client for RS256/ES256 verification."""
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Validate Supabase JWT and extract user info.

    Supports both HS256 (with JWT secret) and RS256/ES256 (with JWKS).
    Returns dict with user_id and token for downstream use.
    """
    # Check for missing credentials
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        # Decode header to check algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        if alg == "HS256":
            # Verify with JWT secret
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=500, detail="JWT secret not configured"
                )
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=f"{SUPABASE_URL}/auth/v1",
            )
        else:
            # Verify with JWKS (RS256, ES256)
            jwks_client = get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience="authenticated",
                issuer=f"{SUPABASE_URL}/auth/v1",
            )

        return {"user_id": payload["sub"], "token": token}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def _get_dept_role_permissions(supabase, membership_id: str) -> set[str]:
    """
    Fetch all permission keys from assigned department roles.

    NOTE: Only called for VAs. Returns set for internal use;
    converted to sorted list before returning to API consumers.
    """
    result = supabase.rpc(
        "get_membership_permission_keys",
        {"p_membership_id": membership_id}
    ).execute()

    return set(row["permission_key"] for row in (result.data or []))


def _merge_permissions(
    role_perms: dict[str, Any] | None,
    dept_role_keys: set[str] | None = None,
) -> dict[str, bool]:
    """
    Merge permissions from role defaults and department role keys.

    Priority: dept_role > role_default

    NOTE: dept_role_keys only affects bookkeeping permissions.
    """
    result = {}
    dept_role_keys = dept_role_keys or set()

    for field in PERMISSION_FIELDS:
        # 1. Start with role default
        base = role_perms.get(field, False) if role_perms else False

        # 2. Check if dept roles grant this permission (bookkeeping only)
        new_key = LEGACY_TO_NEW_KEY.get(field)
        if new_key and new_key in dept_role_keys:
            base = True  # Dept role grants this permission

        result[field] = base

    return result


async def get_current_user_with_membership(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    """
    Enhanced auth dependency that validates user and loads membership + permissions.

    Returns:
        - user_id: UUID string
        - token: JWT token string
        - membership: {id, role, department, status, last_seen_at, org_id}
        - permissions: {merged role_permissions + dept_role_keys}
        - permission_keys: list of permission keys from department roles (VAs only)

    Raises:
        - 401 if no valid token
        - 403 if no membership for org
        - 403 if membership.status != 'active'
    """
    # First, validate JWT and get basic user info
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        # Decode header to check algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        if alg == "HS256":
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=500, detail="JWT secret not configured"
                )
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=f"{SUPABASE_URL}/auth/v1",
            )
        else:
            jwks_client = get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience="authenticated",
                issuer=f"{SUPABASE_URL}/auth/v1",
            )

        user_id = payload["sub"]

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    # Fetch membership for this user + org using service role
    supabase = get_supabase()

    membership_result = (
        supabase.table("memberships")
        .select("id, role, department, status, last_seen_at, org_id")
        .eq("user_id", user_id)
        .eq("org_id", DEFAULT_ORG_ID)
        .execute()
    )

    if not membership_result.data:
        raise HTTPException(
            status_code=403,
            detail="No membership found. Please complete account setup.",
        )

    membership = membership_result.data[0]

    # Check membership status
    if membership["status"] == "pending":
        raise HTTPException(
            status_code=403,
            detail="Account pending approval. Please wait for an administrator.",
        )
    if membership["status"] == "disabled":
        raise HTTPException(
            status_code=403,
            detail="Account disabled. Please contact an administrator.",
        )
    if membership["status"] != "active":
        raise HTTPException(
            status_code=403,
            detail=f"Invalid account status: {membership['status']}",
        )

    # Fetch role permissions
    role_perms_result = (
        supabase.table("role_permissions")
        .select("*")
        .eq("role", membership["role"])
        .execute()
    )
    role_perms = role_perms_result.data[0] if role_perms_result.data else None

    # Fetch department role permissions (only for VAs)
    dept_role_keys: set[str] = set()
    if membership["role"] == "va":
        dept_role_keys = _get_dept_role_permissions(supabase, membership["id"])

    # Merge role defaults with department role permissions
    permissions = _merge_permissions(role_perms, dept_role_keys)

    return {
        "user_id": user_id,
        "token": token,
        "membership": membership,
        "permissions": permissions,
        "permission_keys": sorted(dept_role_keys),  # JSON-safe list
    }


def require_permission_key(permission_key: str):
    """
    Dependency factory for permission key checks.

    Check order:
    1. Admin bypass (always allow)
    2. Dept role permission_keys

    Usage:
        @router.get("/bookkeeping")
        async def view_bookkeeping(
            user = Depends(require_permission_key("bookkeeping.read"))
        ):
            ...
    """

    async def check_permission(
        user: dict = Depends(get_current_user_with_membership),
    ) -> dict:
        # 1. Admin always has access
        if user["membership"]["role"] == "admin":
            return user

        # 2. Check dept role permission_keys
        if permission_key in user.get("permission_keys", []):
            return user

        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: {permission_key} required",
        )

    return check_permission
