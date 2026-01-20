"""Access code endpoints for extension authentication.

Endpoints:
- POST /access-codes: Generate access code for current user
- POST /access-codes/validate: Validate code and return JWT + user context
- POST /access-codes/rotate: Rotate (regenerate) access code secret
- GET /access-codes/me: Get current user's access code info (without secret)
- POST /access-codes/logout: Clear presence when logging out from extension
"""

import logging
import os
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError

from app.auth import get_current_user_with_membership
from app.database import get_supabase
from app.models import (
    AccessCodeErrorResponse,
    AccessCodeGenerateRequest,
    AccessCodeGenerateResponse,
    AccessCodeInfoResponse,
    AccessCodeRotateRequest,
    AccessCodeRotateResponse,
    AccessCodeUserContext,
    AccessCodeValidateRequest,
    AccessCodeValidateResponse,
    RoleResponse,
)
from app.services.access_code import (
    ACCESS_CODE_JWT_SECRET,
    calculate_expiry,
    generate_access_token,
    generate_prefix,
    generate_secret,
    hash_secret,
    parse_access_code,
    validate_custom_secret,
    verify_secret,
)

router = APIRouter(prefix="/access-codes", tags=["access-codes"])
logger = logging.getLogger(__name__)

# Maximum retries for prefix collision
MAX_PREFIX_RETRIES = 5

# Security for access code JWT authentication
access_code_security = HTTPBearer(auto_error=False)


async def get_access_code_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(access_code_security),
) -> dict:
    """Validate access code JWT and return user info.

    This is separate from Supabase auth - used for extension API calls.

    Returns:
        - user_id: UUID string
        - membership_id: UUID string
        - org_id: UUID string

    Raises:
        - 401 if no valid token or wrong token type
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            ACCESS_CODE_JWT_SECRET,
            algorithms=["HS256"],
        )

        # Verify this is an access code token (not Supabase token)
        if payload.get("type") != "access_code":
            raise HTTPException(status_code=401, detail="Invalid token type")

        return {
            "user_id": payload["sub"],
            "membership_id": payload["membership_id"],
            "org_id": payload["org_id"],
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    # Check X-Forwarded-For header first (for proxied requests)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # First IP in the list is the original client
        return forwarded.split(",")[0].strip()
    # Fall back to direct client IP
    return request.client.host if request.client else "0.0.0.0"


# ============================================================
# Generate Access Code (Authenticated)
# ============================================================


@router.post("", response_model=AccessCodeGenerateResponse)
async def generate_access_code(
    body: AccessCodeGenerateRequest = None,
    user: dict = Depends(get_current_user_with_membership),
):
    """
    Generate an access code for the current user.

    If user already has an access code, this replaces it.
    The full code (prefix-secret) is returned ONLY on generation.

    Requires authenticated user with admin or va role.
    """
    membership = user["membership"]
    role = membership.get("role")

    # Only admin and va can have access codes (not clients)
    if role not in ("admin", "va"):
        raise HTTPException(
            status_code=403,
            detail="Only Admin and VA users can generate access codes",
        )

    supabase = get_supabase()
    user_id = user["user_id"]
    org_id = membership["org_id"]

    # Validate custom secret if provided
    if body and body.custom_secret:
        errors = validate_custom_secret(body.custom_secret)
        if errors:
            raise HTTPException(status_code=400, detail={"errors": errors})
        secret = body.custom_secret
    else:
        secret = generate_secret()

    # Generate unique prefix with retry on collision
    prefix = None
    for _ in range(MAX_PREFIX_RETRIES):
        candidate = generate_prefix()
        # Check if prefix exists
        existing = (
            supabase.table("access_codes")
            .select("id")
            .eq("prefix", candidate)
            .execute()
        )
        if not existing.data:
            prefix = candidate
            break

    if prefix is None:
        logger.error("Failed to generate unique prefix after retries")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate access code. Please try again.",
        )

    # Hash the secret
    hashed_secret = hash_secret(secret)
    expires_at = calculate_expiry()

    # Delete existing code for this user (one code per user per org)
    supabase.table("access_codes").delete().eq("user_id", user_id).eq(
        "org_id", org_id
    ).execute()

    # Insert new code
    try:
        result = (
            supabase.table("access_codes")
            .insert(
                {
                    "user_id": user_id,
                    "org_id": org_id,
                    "prefix": prefix,
                    "hashed_secret": hashed_secret,
                    "expires_at": expires_at.isoformat(),
                }
            )
            .execute()
        )
    except APIError as e:
        logger.error(f"Failed to create access code: {e}")
        raise HTTPException(status_code=500, detail="Failed to create access code")

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create access code")

    # Return full code (only time user sees the secret)
    full_code = f"{prefix}-{secret}"

    logger.info(f"Generated access code for user {user_id}, prefix: {prefix}")

    return AccessCodeGenerateResponse(
        prefix=prefix,
        full_code=full_code,
        expires_at=expires_at,
    )


# ============================================================
# Rotate Access Code (Authenticated)
# ============================================================


@router.post("/rotate", response_model=AccessCodeRotateResponse)
async def rotate_access_code(
    body: AccessCodeRotateRequest = None,
    user: dict = Depends(get_current_user_with_membership),
):
    """
    Rotate (regenerate) the secret portion of the access code.

    The prefix remains the same. Only the secret is replaced.
    Returns the new full code.
    """
    supabase = get_supabase()
    user_id = user["user_id"]
    org_id = user["membership"]["org_id"]

    # Find existing code
    result = (
        supabase.table("access_codes")
        .select("*")
        .eq("user_id", user_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="No access code found. Generate one first.",
        )

    existing = result.data[0]
    prefix = existing["prefix"]

    # Validate custom secret if provided
    if body and body.custom_secret:
        errors = validate_custom_secret(body.custom_secret)
        if errors:
            raise HTTPException(status_code=400, detail={"errors": errors})
        secret = body.custom_secret
    else:
        secret = generate_secret()

    # Hash new secret
    hashed_secret = hash_secret(secret)
    now = datetime.now(timezone.utc)
    expires_at = calculate_expiry()

    # Update with new secret
    supabase.table("access_codes").update(
        {
            "hashed_secret": hashed_secret,
            "rotated_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        }
    ).eq("id", existing["id"]).execute()

    full_code = f"{prefix}-{secret}"

    logger.info(f"Rotated access code for user {user_id}, prefix: {prefix}")

    return AccessCodeRotateResponse(
        prefix=prefix,
        full_code=full_code,
        rotated_at=now,
        expires_at=expires_at,
    )


# ============================================================
# Get Access Code Info (Authenticated)
# ============================================================


@router.get("/me", response_model=AccessCodeInfoResponse)
async def get_my_access_code(
    user: dict = Depends(get_current_user_with_membership),
):
    """
    Get the current user's access code info (without the secret).

    Returns prefix and timestamps. Does not return the secret.
    """
    supabase = get_supabase()
    user_id = user["user_id"]
    org_id = user["membership"]["org_id"]

    result = (
        supabase.table("access_codes")
        .select("prefix, created_at, expires_at, rotated_at")
        .eq("user_id", user_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail="No access code found",
        )

    code = result.data[0]

    return AccessCodeInfoResponse(
        prefix=code["prefix"],
        created_at=code["created_at"],
        expires_at=code["expires_at"],
        rotated_at=code.get("rotated_at"),
    )


# ============================================================
# Validate Access Code (Public with Rate Limiting)
# ============================================================


@router.post("/validate", response_model=AccessCodeValidateResponse)
async def validate_access_code(
    body: AccessCodeValidateRequest,
    request: Request,
):
    """
    Validate an access code and return JWT + user context.

    Public endpoint with rate limiting:
    - 10 failed attempts triggers progressive lockout
    - Rate limited by both IP and prefix

    On success:
    - Returns short-lived JWT for extension API calls
    - Returns full user context and RBAC permissions
    """
    supabase = get_supabase()
    client_ip = get_client_ip(request)

    # Parse the code
    parsed = parse_access_code(body.code)
    if parsed is None:
        # Don't reveal that format was wrong
        logger.warning(f"Invalid code format from IP {client_ip}")
        raise HTTPException(
            status_code=401,
            detail=AccessCodeErrorResponse(
                error_code="INVALID_CODE",
                message="Invalid access code",
            ).model_dump(),
        )

    prefix, provided_secret = parsed

    # Check rate limit BEFORE validation (defense in depth)
    try:
        rate_result = supabase.rpc(
            "check_access_code_rate_limit",
            {"p_prefix": prefix, "p_ip": client_ip},
        ).execute()
    except APIError as e:
        logger.error(f"Rate limit check failed: {e}")
        # On error, allow the request (fail open for availability)
        rate_result = None

    if rate_result and rate_result.data:
        rate_data = rate_result.data[0]
        if not rate_data["allowed"]:
            logger.warning(
                f"Rate limited: prefix={prefix}, IP={client_ip}, "
                f"retry_after={rate_data['retry_after_seconds']}"
            )
            raise HTTPException(
                status_code=429,
                detail=AccessCodeErrorResponse(
                    error_code="RATE_LIMITED",
                    message="Too many failed attempts. Please try again later.",
                    retry_after=rate_data["retry_after_seconds"],
                ).model_dump(),
            )

    # Look up the code by prefix
    code_result = (
        supabase.table("access_codes")
        .select("*")
        .eq("prefix", prefix)
        .execute()
    )

    def record_failure():
        """Record failed attempt."""
        try:
            supabase.rpc(
                "record_access_code_attempt",
                {"p_prefix": prefix, "p_ip": client_ip, "p_success": False},
            ).execute()
        except APIError:
            pass  # Don't fail the request if recording fails

    # Check if code exists
    if not code_result.data:
        record_failure()
        logger.warning(f"Code not found: prefix={prefix}, IP={client_ip}")
        raise HTTPException(
            status_code=401,
            detail=AccessCodeErrorResponse(
                error_code="INVALID_CODE",
                message="Invalid access code",
            ).model_dump(),
        )

    code_record = code_result.data[0]

    # Check expiration
    expires_at = datetime.fromisoformat(code_record["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        record_failure()
        logger.warning(f"Code expired: prefix={prefix}")
        raise HTTPException(
            status_code=401,
            detail=AccessCodeErrorResponse(
                error_code="CODE_EXPIRED",
                message="Access code has expired. Please generate a new one.",
            ).model_dump(),
        )

    # Verify secret (timing-safe via Argon2)
    if not verify_secret(code_record["hashed_secret"], provided_secret):
        record_failure()
        logger.warning(f"Invalid secret for prefix={prefix}, IP={client_ip}")
        raise HTTPException(
            status_code=401,
            detail=AccessCodeErrorResponse(
                error_code="INVALID_CODE",
                message="Invalid access code",
            ).model_dump(),
        )

    # Code is valid! Record success (clears lockouts)
    try:
        supabase.rpc(
            "record_access_code_attempt",
            {"p_prefix": prefix, "p_ip": client_ip, "p_success": True},
        ).execute()
    except APIError:
        pass

    # Load user and membership
    user_id = code_record["user_id"]
    org_id = code_record["org_id"]

    # Get membership
    membership_result = (
        supabase.table("memberships")
        .select("id, role, status, org_id")
        .eq("user_id", user_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not membership_result.data:
        logger.error(f"No membership found for user {user_id}")
        raise HTTPException(
            status_code=401,
            detail=AccessCodeErrorResponse(
                error_code="ACCOUNT_DISABLED",
                message="Account not found or disabled.",
            ).model_dump(),
        )

    membership = membership_result.data[0]

    # Check if suspended
    if membership.get("status") == "suspended":
        logger.warning(f"Suspended user attempted validation: {user_id}")
        raise HTTPException(
            status_code=401,
            detail=AccessCodeErrorResponse(
                error_code="ACCOUNT_DISABLED",
                message="Account is suspended. Contact an administrator.",
            ).model_dump(),
        )

    # Get user profile
    profile_result = (
        supabase.table("profiles")
        .select("display_name, email")
        .eq("user_id", user_id)
        .execute()
    )

    profile = profile_result.data[0] if profile_result.data else {}

    # Build user context
    is_admin = membership["role"] == "admin"
    user_context = AccessCodeUserContext(
        id=user_id,
        name=profile.get("display_name"),
        email=profile.get("email", ""),
        user_type=membership["role"],
        org_id=org_id,
        is_admin=is_admin,
    )

    # Get roles and permissions
    roles = []
    permission_keys = set()

    if is_admin:
        # Admins have all permissions - no need to fetch roles
        # Get all permission keys from department_role_permissions for the org
        all_perms_result = (
            supabase.table("department_role_permissions")
            .select("permission_key, department_roles!inner(org_id)")
            .eq("department_roles.org_id", org_id)
            .execute()
        )
        for row in all_perms_result.data or []:
            permission_keys.add(row.get("permission_key"))
    else:
        # Get VA's assigned roles
        assigned_result = supabase.rpc(
            "get_membership_permission_keys",
            {"p_membership_id": membership["id"]},
        ).execute()

        for row in assigned_result.data or []:
            permission_keys.add(row["permission_key"])

        # Get role details with permissions
        roles_result = (
            supabase.table("membership_department_roles")
            .select("department_roles(id, name, position, department_role_permissions(permission_key))")
            .eq("membership_id", membership["id"])
            .execute()
        )

        for row in roles_result.data or []:
            dept_role = row.get("department_roles", {})
            if dept_role:
                # Extract permission keys from nested join
                role_perms = [
                    p["permission_key"]
                    for p in dept_role.get("department_role_permissions", [])
                ]
                roles.append(
                    RoleResponse(
                        id=dept_role["id"],
                        name=dept_role["name"],
                        priority=dept_role.get("position", 0),
                        permission_keys=role_perms,
                    )
                )

    # Get RBAC version (most recent department_role creation)
    rbac_result = (
        supabase.table("department_roles")
        .select("created_at")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    rbac_version = (
        rbac_result.data[0]["created_at"]
        if rbac_result.data
        else datetime.now(timezone.utc).isoformat()
    )

    # Generate JWT
    access_token, expires_in = generate_access_token(
        user_id=user_id,
        membership_id=membership["id"],
        org_id=org_id,
    )

    # Record presence if account_id provided (clock-in)
    if body.account_id:
        from app.services.presence import record_presence

        await record_presence(
            supabase,
            account_id=body.account_id,
            user_id=user_id,
            membership_id=membership["id"],
            org_id=org_id,
        )

    logger.info(f"Access code validated for user {user_id}, prefix={prefix}")

    return AccessCodeValidateResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=user_context,
        roles=roles,
        effective_permission_keys=sorted(permission_keys),
        rbac_version=rbac_version,
    )


# ============================================================
# Logout (Access Code JWT Authenticated)
# ============================================================


@router.post("/logout")
async def logout_access_code(
    user: dict = Depends(get_access_code_user),
):
    """Clear presence when user logs out from extension.

    Requires access code JWT authentication.
    Clears the user's presence from their current account.
    """
    from app.services.presence import clear_presence

    supabase = get_supabase()
    user_id = user["user_id"]
    org_id = user["org_id"]

    await clear_presence(supabase, user_id, org_id)

    logger.info(f"User logged out and presence cleared: {user_id}")

    return {"status": "logged_out"}
