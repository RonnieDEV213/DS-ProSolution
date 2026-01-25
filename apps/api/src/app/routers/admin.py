"""Admin endpoints for user management."""

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from postgrest.exceptions import APIError

from app.audit import write_audit_log
from app.auth import (
    require_permission_key,
    DEFAULT_ORG_ID,
    PERMISSION_FIELDS,
)
from app.database import get_supabase
from app.models import (
    AccountAssignmentCreate,
    AccountAssignmentResponse,
    AccountCreate,
    AccountUpdate,
    AdminAccountListResponse,
    AdminAccountResponse,
    DepartmentRoleAssignment,
    DepartmentRoleCreate,
    DepartmentRoleListResponse,
    DepartmentRoleResponse,
    DepartmentRoleUpdate,
    MembershipResponse,
    OrgResponse,
    ProfileResponse,
    TransferOwnershipRequest,
    UserListResponse,
    UserMembershipUpdate,
    UserResponse,
    UserRole,
)
from app.permissions import DEPT_ROLE_PERMISSION_KEYS, FORBIDDEN_DEPT_ROLE_PERMISSIONS

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

# Regex for safe search characters: alphanumeric, spaces, @, -, _, ., +, '
SAFE_SEARCH_PATTERN = re.compile(r"^[a-zA-Z0-9\s@._+'-]+$")


def _build_user_response(
    profile: dict,
    membership: dict,
    role_perms: dict | None,
    admin_remarks: str | None = None,
) -> UserResponse:
    """Build a UserResponse from database rows."""
    # Compute effective permissions from role defaults
    permissions = {}
    for field in PERMISSION_FIELDS:
        permissions[field] = role_perms.get(field, False) if role_perms else False

    return UserResponse(
        profile=ProfileResponse(
            user_id=profile["user_id"],
            email=profile["email"],
            display_name=profile.get("display_name"),
            created_at=profile.get("created_at"),
            admin_remarks=admin_remarks,
        ),
        membership=MembershipResponse(
            id=membership["id"],
            user_id=membership["user_id"],
            org_id=membership["org_id"],
            role=membership["role"],
            status=membership.get("status", "active"),
            last_seen_at=membership.get("last_seen_at"),
            created_at=membership.get("created_at"),
            updated_at=membership.get("updated_at"),
        ),
        permissions=permissions,
    )


@router.get("/users", response_model=UserListResponse)
async def list_users(
    search: Optional[str] = Query(None, description="Search by email or name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    List users with search and pagination.

    Requires can_manage_users permission.
    Returns profiles joined with memberships for the default org.
    """
    # Validate and sanitize search input
    sanitized_search: Optional[str] = None
    if search:
        search = search.strip()
        if len(search) == 0:
            search = None
        elif len(search) > 100:
            raise HTTPException(
                status_code=400,
                detail="Search term too long (max 100 characters)",
            )
        elif not SAFE_SEARCH_PATTERN.match(search):
            raise HTTPException(
                status_code=400,
                detail="Search contains invalid characters. Use letters, numbers, spaces, @, ., -, _, +, or '",
            )
        else:
            sanitized_search = search

    supabase = get_supabase()

    try:
        # Build query for memberships (with org_id filter)
        query = (
            supabase.table("memberships")
            .select("*, profiles!inner(*)", count="exact")
            .eq("org_id", DEFAULT_ORG_ID)
        )

        # Apply search filter (on profiles.email or profiles.display_name)
        if sanitized_search:
            # Use ilike for case-insensitive search with reference_table for joined table
            query = query.or_(
                f"email.ilike.%{sanitized_search}%,display_name.ilike.%{sanitized_search}%",
                reference_table="profiles"
            )

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        # Order by created_at desc
        query = query.order("created_at", desc=True)

        result = query.execute()

        if not result.data:
            return UserListResponse(users=[], total=0, page=page, page_size=page_size)

        # Fetch role permissions for all unique roles
        roles = list(set(row["role"] for row in result.data))
        role_perms_result = (
            supabase.table("role_permissions").select("*").in_("role", roles).execute()
        )
        role_perms_map = {row["role"]: row for row in (role_perms_result.data or [])}

        # Fetch admin notes in ONE bulk query (avoid N+1)
        user_ids = [row["user_id"] for row in result.data]
        notes_result = (
            supabase.table("profile_admin_notes")
            .select("user_id, admin_remarks")
            .in_("user_id", user_ids)
            .execute()
        )
        notes_map = {n["user_id"]: n["admin_remarks"] for n in (notes_result.data or [])}

        # Build response
        users = []
        for row in result.data:
            profile = row["profiles"]
            membership = {k: v for k, v in row.items() if k != "profiles"}
            role_perms = role_perms_map.get(row["role"])
            admin_remarks = notes_map.get(row["user_id"])

            users.append(_build_user_response(profile, membership, role_perms, admin_remarks))

        return UserListResponse(
            users=users,
            total=result.count or len(users),
            page=page,
            page_size=page_size,
        )
    except APIError as e:
        logger.exception("Database error in list_users: %s", e)
        raise HTTPException(status_code=500, detail={"code": "DB_ERROR", "message": "Failed to fetch users"})
    except Exception as e:
        logger.exception("Unexpected error in list_users: %s", e)
        raise HTTPException(status_code=500, detail={"code": "SERVER_ERROR", "message": "Failed to fetch users"})


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Get a single user's details.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()

    # Fetch membership
    membership_result = (
        supabase.table("memberships")
        .select("*")
        .eq("user_id", user_id)
        .eq("org_id", DEFAULT_ORG_ID)
        .execute()
    )

    if not membership_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    membership = membership_result.data[0]

    # Fetch profile
    profile_result = (
        supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    )

    if not profile_result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = profile_result.data[0]

    # Fetch role permissions
    role_perms_result = (
        supabase.table("role_permissions")
        .select("*")
        .eq("role", membership["role"])
        .execute()
    )
    role_perms = role_perms_result.data[0] if role_perms_result.data else None

    # Fetch admin notes
    notes_result = (
        supabase.table("profile_admin_notes")
        .select("admin_remarks")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    admin_remarks = notes_result.data.get("admin_remarks") if notes_result and notes_result.data else None

    return _build_user_response(profile, membership, role_perms, admin_remarks)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserMembershipUpdate,
    request: Request,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Update a user's membership (role).

    Requires can_manage_users permission.
    Writes to audit_logs with before/after state.

    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Fetch current membership
    membership_result = (
        supabase.table("memberships")
        .select("*")
        .eq("user_id", user_id)
        .eq("org_id", DEFAULT_ORG_ID)
        .execute()
    )

    if not membership_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    old_membership = membership_result.data[0]

    # Get provided fields (exclude_unset to distinguish missing vs explicit values)
    provided_fields = body.model_dump(exclude_unset=True)

    # ===== SELF-PROTECTION: Block self-demotion and self-suspension =====
    if str(actor_user_id) == user_id:
        if "role" in provided_fields and provided_fields["role"] != UserRole.ADMIN:
            raise HTTPException(
                status_code=403,
                detail={"code": "SELF_DEMOTION", "message": "Cannot demote yourself"},
            )
        if "status" in provided_fields and provided_fields["status"].value == "suspended":
            raise HTTPException(
                status_code=403,
                detail={"code": "SELF_SUSPENSION", "message": "Cannot suspend yourself"},
            )

    # ===== OWNER PROTECTION: Block modifying the org owner =====
    org_result = (
        supabase.table("orgs")
        .select("owner_user_id")
        .eq("id", old_membership["org_id"])
        .execute()
    )
    is_owner = org_result.data and org_result.data[0]["owner_user_id"] == user_id
    if is_owner:
        losing_privilege = False
        if "role" in provided_fields and provided_fields["role"] != UserRole.ADMIN:
            losing_privilege = True
        # Cannot suspend the owner
        if "status" in provided_fields and provided_fields["status"].value == "suspended":
            losing_privilege = True
        if losing_privilege:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "OWNER_PROTECTED",
                    "message": "Cannot modify the organization owner. Transfer ownership instead.",
                },
            )

    # ===== ORPHAN PREVENTION: Block removing/suspending last active admin =====
    target_is_admin = old_membership["role"] == "admin"
    target_is_active = old_membership.get("status", "active") == "active"

    if target_is_admin and target_is_active:
        losing_privilege = False
        if "role" in provided_fields and provided_fields["role"] != UserRole.ADMIN:
            losing_privilege = True
        # Suspending an admin also loses admin privilege effectively
        if "status" in provided_fields and provided_fields["status"].value == "suspended":
            losing_privilege = True

        if losing_privilege:
            # Count remaining active admins in this org (excluding target)
            count_result = (
                supabase.table("memberships")
                .select("user_id", count="exact")
                .eq("org_id", old_membership["org_id"])
                .eq("role", "admin")
                .eq("status", "active")
                .neq("user_id", user_id)
                .execute()
            )

            if (count_result.count or 0) < 1:
                raise HTTPException(
                    status_code=409,
                    detail={"code": "ADMIN_ORPHAN", "message": "Cannot remove or suspend the last active admin"},
                )

    # Build update data for membership (only include provided fields)
    membership_update = {}
    if body.role is not None:
        membership_update["role"] = body.role.value
    if body.status is not None:
        membership_update["status"] = body.status.value

    # Update membership if there are changes
    if membership_update:
        membership_update["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            membership_result = (
                supabase.table("memberships")
                .update(membership_update)
                .eq("id", old_membership["id"])
                .execute()
            )
        except APIError as e:
            # Safely extract SQLSTATE from error payload (DB constraint trigger)
            payload = e.args[0] if e.args else {}
            sqlstate = payload.get("code") if isinstance(payload, dict) else None
            if sqlstate is None:
                sqlstate = getattr(e, "code", None)

            if sqlstate == "23514":  # check_violation (from DB constraint trigger)
                # Check if it's owner protection or admin orphan
                msg = str(payload.get("message", "")) if isinstance(payload, dict) else ""
                if "OWNER_PROTECTED" in msg:
                    raise HTTPException(
                        status_code=403,
                        detail={
                            "code": "OWNER_PROTECTED",
                            "message": "Cannot modify the organization owner. Transfer ownership instead.",
                        },
                    )
                raise HTTPException(
                    status_code=409,
                    detail={"code": "ADMIN_ORPHAN", "message": "Cannot remove the last admin"},
                )
            raise

        if not membership_result.data:
            raise HTTPException(status_code=500, detail="Failed to update membership")

        new_membership = membership_result.data[0]

        # Write audit log for membership change
        await write_audit_log(
            supabase,
            actor_user_id=actor_user_id,
            action="membership.update",
            resource_type="membership",
            resource_id=old_membership["id"],
            before={
                "role": old_membership["role"],
                "status": old_membership.get("status", "active"),
            },
            after={
                "role": new_membership["role"],
                "status": new_membership.get("status", "active"),
            },
            request=request,
        )
    else:
        new_membership = old_membership

    # Upsert admin remarks if provided
    if body.admin_remarks is not None:
        supabase.table("profile_admin_notes").upsert({
            "user_id": user_id,
            "admin_remarks": body.admin_remarks,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # Fetch profile for response
    profile_result = (
        supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    )
    profile = profile_result.data[0] if profile_result.data else {"user_id": user_id, "email": ""}

    # Fetch role permissions for response
    role_perms_result = (
        supabase.table("role_permissions")
        .select("*")
        .eq("role", new_membership["role"])
        .execute()
    )
    role_perms = role_perms_result.data[0] if role_perms_result.data else None

    # Fetch admin notes for response
    notes_result = (
        supabase.table("profile_admin_notes")
        .select("admin_remarks")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    admin_remarks = notes_result.data.get("admin_remarks") if notes_result and notes_result.data else None

    return _build_user_response(profile, new_membership, role_perms, admin_remarks)


# ============================================================
# Organization Endpoints
# ============================================================


@router.get("/orgs/{org_id}", response_model=OrgResponse)
async def get_org(
    org_id: str,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Get organization details including owner.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()

    result = supabase.table("orgs").select("*").eq("id", org_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    return OrgResponse(**result.data[0])


@router.post("/orgs/{org_id}/transfer-ownership", response_model=OrgResponse)
async def transfer_ownership(
    org_id: str,
    body: TransferOwnershipRequest,
    request: Request,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Transfer organization ownership to another admin.

    Only the current owner can call this endpoint.
    New owner must be an admin in the organization.
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # 1. Fetch current org
    org_result = supabase.table("orgs").select("*").eq("id", org_id).execute()
    if not org_result.data:
        raise HTTPException(status_code=404, detail="Organization not found")
    org = org_result.data[0]

    # 2. Verify caller is the current owner
    if org["owner_user_id"] != actor_user_id:
        raise HTTPException(
            status_code=403,
            detail={"code": "NOT_OWNER", "message": "Only the owner can transfer ownership"},
        )

    # 3. Validate new owner is an admin member of this org
    membership_result = (
        supabase.table("memberships")
        .select("role")
        .eq("org_id", org_id)
        .eq("user_id", body.new_owner_user_id)
        .execute()
    )
    if not membership_result.data:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_TARGET",
                "message": "New owner must be a member of this organization",
            },
        )

    m = membership_result.data[0]
    if m["role"] != "admin":
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_TARGET", "message": "New owner must be an admin"},
        )

    # 4. Update org owner
    update_result = (
        supabase.table("orgs")
        .update({
            "owner_user_id": body.new_owner_user_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", org_id)
        .execute()
    )

    if not update_result.data:
        raise HTTPException(status_code=500, detail="Failed to transfer ownership")

    # 5. Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="org.transfer_ownership",
        resource_type="org",
        resource_id=org_id,
        before={"owner_user_id": org["owner_user_id"]},
        after={"owner_user_id": body.new_owner_user_id},
        request=request,
    )

    return OrgResponse(**update_result.data[0])


# ============================================================
# Department Roles Endpoints
# ============================================================


def _build_department_role_response(
    role: dict,
    permissions: list[str],
    admin_remarks: str | None = None,
) -> DepartmentRoleResponse:
    """Build a DepartmentRoleResponse from database rows."""
    return DepartmentRoleResponse(
        id=role["id"],
        org_id=role["org_id"],
        name=role["name"],
        position=role["position"],
        permissions=permissions,
        created_at=role.get("created_at"),
        admin_remarks=admin_remarks,
    )


@router.get("/orgs/{org_id}/department-roles", response_model=DepartmentRoleListResponse)
async def list_department_roles(
    org_id: str,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    List all department roles for an organization.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()

    # Fetch all roles for this org
    roles_result = (
        supabase.table("department_roles")
        .select("*")
        .eq("org_id", org_id)
        .order("position")
        .execute()
    )

    if not roles_result.data:
        return DepartmentRoleListResponse(roles=[])

    # Fetch all permissions for these roles
    role_ids = [r["id"] for r in roles_result.data]
    perms_result = (
        supabase.table("department_role_permissions")
        .select("role_id, permission_key")
        .in_("role_id", role_ids)
        .execute()
    )

    # Build permissions map
    perms_map: dict[str, list[str]] = {}
    for p in (perms_result.data or []):
        if p["role_id"] not in perms_map:
            perms_map[p["role_id"]] = []
        perms_map[p["role_id"]].append(p["permission_key"])

    # Fetch admin notes in ONE bulk query (avoid N+1)
    notes_result = (
        supabase.table("department_role_admin_notes")
        .select("department_role_id, admin_remarks")
        .in_("department_role_id", role_ids)
        .execute()
    )
    notes_map = {n["department_role_id"]: n["admin_remarks"] for n in (notes_result.data or [])}

    # Build response
    roles = [
        _build_department_role_response(r, perms_map.get(r["id"], []), notes_map.get(r["id"]))
        for r in roles_result.data
    ]

    return DepartmentRoleListResponse(roles=roles)


@router.post("/orgs/{org_id}/department-roles", response_model=DepartmentRoleResponse)
async def create_department_role(
    org_id: str,
    body: DepartmentRoleCreate,
    request: Request,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Create a new department role.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Validate permissions - VAs cannot get payouts/profit
    forbidden = set(body.permissions) & FORBIDDEN_DEPT_ROLE_PERMISSIONS
    if forbidden:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_PERMISSION",
                "message": f"These permissions cannot be granted to department roles: {', '.join(sorted(forbidden))}",
            },
        )

    # Validate all keys are known
    unknown = set(body.permissions) - DEPT_ROLE_PERMISSION_KEYS
    if unknown:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNKNOWN_PERMISSION",
                "message": f"Unknown permission keys: {', '.join(sorted(unknown))}",
            },
        )

    # Get the max position for this org
    max_pos_result = (
        supabase.table("department_roles")
        .select("position")
        .eq("org_id", org_id)
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    max_pos = max_pos_result.data[0]["position"] if max_pos_result.data else -1

    # Create the role
    try:
        role_result = (
            supabase.table("department_roles")
            .insert({
                "org_id": org_id,
                "name": body.name,
                "position": max_pos + 1,
            })
            .execute()
        )
    except APIError as e:
        payload = e.args[0] if e.args else {}
        # Check for duplicate name constraint violation
        if isinstance(payload, dict) and "duplicate key" in str(payload.get("message", "")):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "DUPLICATE_NAME",
                    "message": f"A role with name '{body.name}' already exists",
                },
            )
        raise

    if not role_result.data:
        raise HTTPException(status_code=500, detail="Failed to create department role")

    role = role_result.data[0]

    # Insert permissions
    if body.permissions:
        perms_data = [
            {"role_id": role["id"], "permission_key": perm}
            for perm in body.permissions
        ]
        supabase.table("department_role_permissions").insert(perms_data).execute()

    # Insert admin remarks if provided
    if body.admin_remarks is not None:
        supabase.table("department_role_admin_notes").upsert({
            "department_role_id": role["id"],
            "admin_remarks": body.admin_remarks,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="department_role.create",
        resource_type="department_role",
        resource_id=role["id"],
        before=None,
        after={"name": body.name, "permissions": body.permissions},
        request=request,
    )

    return _build_department_role_response(role, body.permissions, body.admin_remarks)


@router.patch("/orgs/{org_id}/department-roles/{role_id}", response_model=DepartmentRoleResponse)
async def update_department_role(
    org_id: str,
    role_id: str,
    body: DepartmentRoleUpdate,
    request: Request,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Update a department role (name, permissions, position).

    Requires can_manage_users permission.
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Fetch existing role
    role_result = (
        supabase.table("department_roles")
        .select("*")
        .eq("id", role_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not role_result.data:
        raise HTTPException(status_code=404, detail="Department role not found")

    old_role = role_result.data[0]

    # Fetch old permissions
    old_perms_result = (
        supabase.table("department_role_permissions")
        .select("permission_key")
        .eq("role_id", role_id)
        .execute()
    )
    old_permissions = [p["permission_key"] for p in (old_perms_result.data or [])]

    # Validate new permissions if provided
    if body.permissions is not None:
        forbidden = set(body.permissions) & FORBIDDEN_DEPT_ROLE_PERMISSIONS
        if forbidden:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_PERMISSION",
                    "message": f"These permissions cannot be granted to department roles: {', '.join(sorted(forbidden))}",
                },
            )

        unknown = set(body.permissions) - DEPT_ROLE_PERMISSION_KEYS
        if unknown:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "UNKNOWN_PERMISSION",
                    "message": f"Unknown permission keys: {', '.join(sorted(unknown))}",
                },
            )

    # Build role update
    role_update = {}
    if body.name is not None:
        role_update["name"] = body.name
    if body.position is not None:
        role_update["position"] = body.position

    # Update role if there are changes
    if role_update:
        try:
            role_result = (
                supabase.table("department_roles")
                .update(role_update)
                .eq("id", role_id)
                .execute()
            )
        except APIError as e:
            payload = e.args[0] if e.args else {}
            if isinstance(payload, dict) and "duplicate key" in str(payload.get("message", "")):
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "DUPLICATE_NAME",
                        "message": f"A role with name '{body.name}' already exists",
                    },
                )
            raise

        if not role_result.data:
            raise HTTPException(status_code=500, detail="Failed to update department role")
        new_role = role_result.data[0]
    else:
        new_role = old_role

    # Update permissions if provided
    if body.permissions is not None:
        # Delete old permissions
        supabase.table("department_role_permissions").delete().eq("role_id", role_id).execute()

        # Insert new permissions
        if body.permissions:
            perms_data = [
                {"role_id": role_id, "permission_key": perm}
                for perm in body.permissions
            ]
            supabase.table("department_role_permissions").insert(perms_data).execute()

        new_permissions = body.permissions
    else:
        new_permissions = old_permissions

    # Upsert admin remarks if provided
    if body.admin_remarks is not None:
        supabase.table("department_role_admin_notes").upsert({
            "department_role_id": role_id,
            "admin_remarks": body.admin_remarks,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # Fetch admin notes for response
    notes_result = (
        supabase.table("department_role_admin_notes")
        .select("admin_remarks")
        .eq("department_role_id", role_id)
        .maybe_single()
        .execute()
    )
    admin_remarks = notes_result.data.get("admin_remarks") if notes_result and notes_result.data else None

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="department_role.update",
        resource_type="department_role",
        resource_id=role_id,
        before={"name": old_role["name"], "position": old_role["position"], "permissions": old_permissions},
        after={"name": new_role["name"], "position": new_role["position"], "permissions": new_permissions},
        request=request,
    )

    return _build_department_role_response(new_role, new_permissions, admin_remarks)


@router.delete("/orgs/{org_id}/department-roles/{role_id}")
async def delete_department_role(
    org_id: str,
    role_id: str,
    request: Request,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Delete a department role.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Fetch existing role
    role_result = (
        supabase.table("department_roles")
        .select("*")
        .eq("id", role_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not role_result.data:
        raise HTTPException(status_code=404, detail="Department role not found")

    old_role = role_result.data[0]

    # Fetch old permissions for audit
    old_perms_result = (
        supabase.table("department_role_permissions")
        .select("permission_key")
        .eq("role_id", role_id)
        .execute()
    )
    old_permissions = [p["permission_key"] for p in (old_perms_result.data or [])]

    # Delete the role (permissions and assignments cascade)
    supabase.table("department_roles").delete().eq("id", role_id).execute()

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="department_role.delete",
        resource_type="department_role",
        resource_id=role_id,
        before={"name": old_role["name"], "position": old_role["position"], "permissions": old_permissions},
        after=None,
        request=request,
    )

    return {"status": "deleted"}


# ============================================================
# Department Role Assignment Endpoints
# ============================================================


@router.get("/orgs/{org_id}/memberships/{membership_id}/department-roles")
async def get_membership_department_roles(
    org_id: str,
    membership_id: str,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Get department roles assigned to a membership.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()

    # Verify membership exists and belongs to org
    membership_result = (
        supabase.table("memberships")
        .select("id, org_id, role")
        .eq("id", membership_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not membership_result.data:
        raise HTTPException(status_code=404, detail="Membership not found")

    # Fetch assigned role IDs
    assignments_result = (
        supabase.table("membership_department_roles")
        .select("role_id")
        .eq("membership_id", membership_id)
        .execute()
    )

    role_ids = [a["role_id"] for a in (assignments_result.data or [])]

    if not role_ids:
        return {"roles": []}

    # Fetch role details
    roles_result = (
        supabase.table("department_roles")
        .select("*")
        .in_("id", role_ids)
        .order("position")
        .execute()
    )

    # Fetch permissions for these roles
    perms_result = (
        supabase.table("department_role_permissions")
        .select("role_id, permission_key")
        .in_("role_id", role_ids)
        .execute()
    )

    # Build permissions map
    perms_map: dict[str, list[str]] = {}
    for p in (perms_result.data or []):
        if p["role_id"] not in perms_map:
            perms_map[p["role_id"]] = []
        perms_map[p["role_id"]].append(p["permission_key"])

    roles = [
        _build_department_role_response(r, perms_map.get(r["id"], []))
        for r in (roles_result.data or [])
    ]

    return {"roles": roles}


@router.post("/orgs/{org_id}/memberships/{membership_id}/department-roles")
async def assign_department_role(
    org_id: str,
    membership_id: str,
    body: DepartmentRoleAssignment,
    request: Request,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Assign an Access Profile (department role) to a VA membership.

    Only works for role='va'.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Verify membership exists, belongs to org, and is VA
    membership_result = (
        supabase.table("memberships")
        .select("id, org_id, role, user_id")
        .eq("id", membership_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not membership_result.data:
        raise HTTPException(status_code=404, detail="Membership not found")

    membership = membership_result.data[0]

    if membership["role"] != "va":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NOT_VA",
                "message": "Access Profiles can only be assigned to VA memberships",
            },
        )

    # Verify role exists and belongs to same org
    role_result = (
        supabase.table("department_roles")
        .select("id, org_id, name")
        .eq("id", body.role_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not role_result.data:
        raise HTTPException(status_code=404, detail="Department role not found")

    role = role_result.data[0]

    # Insert assignment (DB trigger will double-check constraints)
    try:
        supabase.table("membership_department_roles").insert({
            "membership_id": membership_id,
            "role_id": body.role_id,
        }).execute()
    except APIError as e:
        payload = e.args[0] if e.args else {}
        msg = str(payload.get("message", "")) if isinstance(payload, dict) else str(e)

        if "duplicate key" in msg.lower():
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "ALREADY_ASSIGNED",
                    "message": "This role is already assigned to this membership",
                },
            )
        if "NOT_VA" in msg:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "NOT_VA",
                    "message": "Access Profiles can only be assigned to VA memberships",
                },
            )
        if "ORG_MISMATCH" in msg:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "ORG_MISMATCH",
                    "message": "Membership and role must belong to the same organization",
                },
            )
        raise

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="membership_department_role.assign",
        resource_type="membership_department_role",
        resource_id=f"{membership_id}:{body.role_id}",
        before=None,
        after={"membership_id": membership_id, "role_id": body.role_id, "role_name": role["name"]},
        request=request,
    )

    return {"status": "assigned", "role_id": body.role_id, "role_name": role["name"]}


@router.delete("/orgs/{org_id}/memberships/{membership_id}/department-roles/{role_id}")
async def unassign_department_role(
    org_id: str,
    membership_id: str,
    role_id: str,
    request: Request,
    user: dict = Depends(require_permission_key("admin.users")),
):
    """
    Remove a department role from a VA membership.

    Requires can_manage_users permission.
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Verify membership exists and belongs to org
    membership_result = (
        supabase.table("memberships")
        .select("id, org_id, user_id")
        .eq("id", membership_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not membership_result.data:
        raise HTTPException(status_code=404, detail="Membership not found")

    # Fetch role name for audit
    role_result = (
        supabase.table("department_roles")
        .select("name")
        .eq("id", role_id)
        .execute()
    )
    role_name = role_result.data[0]["name"] if role_result.data else "unknown"

    # Delete assignment
    delete_result = (
        supabase.table("membership_department_roles")
        .delete()
        .eq("membership_id", membership_id)
        .eq("role_id", role_id)
        .execute()
    )

    if not delete_result.data:
        raise HTTPException(status_code=404, detail="Role assignment not found")

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="membership_department_role.unassign",
        resource_type="membership_department_role",
        resource_id=f"{membership_id}:{role_id}",
        before={"membership_id": membership_id, "role_id": role_id, "role_name": role_name},
        after=None,
        request=request,
    )

    return {"status": "unassigned"}


# ============================================================
# Account Management Endpoints
# ============================================================


@router.get("/accounts", response_model=AdminAccountListResponse)
async def list_accounts(
    q: Optional[str] = Query(None, description="Search by account_code or name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    List all accounts with pagination and search.

    Requires admin.accounts permission (admin role).
    Returns accounts with assignment counts.
    """
    supabase = get_supabase()

    # Build query
    query = supabase.table("accounts").select("*", count="exact")

    # Apply search filter
    if q:
        query = query.or_(f"account_code.ilike.%{q}%,name.ilike.%{q}%")

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    query = query.order("account_code")

    result = query.execute()

    if not result.data:
        return AdminAccountListResponse(
            accounts=[], total=0, page=page, page_size=page_size
        )

    # Get assignment counts for each account
    account_ids = [acc["id"] for acc in result.data]
    assignment_counts: dict[str, int] = {}

    if account_ids:
        # Single query for all assignment counts (avoids N+1)
        counts_result = (
            supabase.table("account_assignments")
            .select("account_id")
            .in_("account_id", account_ids)
            .execute()
        )
        for row in counts_result.data or []:
            acc_id = row["account_id"]
            assignment_counts[acc_id] = assignment_counts.get(acc_id, 0) + 1

    # Fetch admin notes in ONE bulk query (avoid N+1)
    notes_result = (
        supabase.table("account_admin_notes")
        .select("account_id, admin_remarks")
        .in_("account_id", account_ids)
        .execute()
    )
    notes_map = {n["account_id"]: n["admin_remarks"] for n in (notes_result.data or [])}

    # Build response
    accounts = [
        AdminAccountResponse(
            id=acc["id"],
            account_code=acc["account_code"],
            name=acc.get("name"),
            client_user_id=acc.get("client_user_id"),
            assignment_count=assignment_counts.get(acc["id"], 0),
            created_at=acc.get("created_at"),
            admin_remarks=notes_map.get(acc["id"]),
        )
        for acc in result.data
    ]

    return AdminAccountListResponse(
        accounts=accounts,
        total=result.count or len(accounts),
        page=page,
        page_size=page_size,
    )


@router.post("/accounts", response_model=AdminAccountResponse)
async def create_account(
    body: AccountCreate,
    request: Request,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    Create a new account.

    Requires admin.accounts permission (admin role).
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Build insert data
    insert_data = {
        "account_code": body.account_code,
    }
    if body.name is not None:
        insert_data["name"] = body.name
    if body.client_user_id is not None:
        insert_data["client_user_id"] = str(body.client_user_id)

    try:
        result = supabase.table("accounts").insert(insert_data).execute()
    except APIError as e:
        payload = e.args[0] if e.args else {}
        msg = str(payload.get("message", "")) if isinstance(payload, dict) else str(e)
        if "duplicate key" in msg.lower() or "unique" in msg.lower():
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "DUPLICATE_ACCOUNT_CODE",
                    "message": f"Account with code '{body.account_code}' already exists",
                },
            )
        raise

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create account")

    account = result.data[0]

    # Insert admin remarks if provided
    if body.admin_remarks is not None:
        supabase.table("account_admin_notes").upsert({
            "account_id": account["id"],
            "admin_remarks": body.admin_remarks,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="account.create",
        resource_type="account",
        resource_id=account["id"],
        before=None,
        after={"account_code": body.account_code, "name": body.name},
        request=request,
    )

    return AdminAccountResponse(
        id=account["id"],
        account_code=account["account_code"],
        name=account.get("name"),
        client_user_id=account.get("client_user_id"),
        assignment_count=0,
        created_at=account.get("created_at"),
        admin_remarks=body.admin_remarks,
    )


@router.get("/accounts/{account_id}", response_model=AdminAccountResponse)
async def get_account(
    account_id: str,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    Get a single account with assignment count.

    Requires admin.accounts permission (admin role).
    """
    supabase = get_supabase()

    result = supabase.table("accounts").select("*").eq("id", account_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Account not found")

    account = result.data[0]

    # Get assignment count
    count_result = (
        supabase.table("account_assignments")
        .select("account_id", count="exact")
        .eq("account_id", account_id)
        .execute()
    )

    # Fetch admin notes
    notes_result = (
        supabase.table("account_admin_notes")
        .select("admin_remarks")
        .eq("account_id", account_id)
        .maybe_single()
        .execute()
    )
    admin_remarks = notes_result.data.get("admin_remarks") if notes_result and notes_result.data else None

    return AdminAccountResponse(
        id=account["id"],
        account_code=account["account_code"],
        name=account.get("name"),
        client_user_id=account.get("client_user_id"),
        assignment_count=count_result.count or 0,
        created_at=account.get("created_at"),
        admin_remarks=admin_remarks,
    )


@router.patch("/accounts/{account_id}", response_model=AdminAccountResponse)
async def update_account(
    account_id: str,
    body: AccountUpdate,
    request: Request,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    Update an account (name, client_user_id).

    Requires admin.accounts permission (admin role).
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Fetch current account
    current_result = (
        supabase.table("accounts").select("*").eq("id", account_id).execute()
    )

    if not current_result.data:
        raise HTTPException(status_code=404, detail="Account not found")

    old_account = current_result.data[0]

    # Build update data (only include provided fields)
    update_data = {}
    provided = body.model_dump(exclude_unset=True)

    if "name" in provided:
        update_data["name"] = body.name
    if "client_user_id" in provided:
        update_data["client_user_id"] = str(body.client_user_id) if body.client_user_id else None

    # Check if admin_remarks should be updated (separate table)
    has_remarks_update = "admin_remarks" in provided

    if not update_data and not has_remarks_update:
        # No changes, return current state
        count_result = (
            supabase.table("account_assignments")
            .select("account_id", count="exact")
            .eq("account_id", account_id)
            .execute()
        )
        notes_result = (
            supabase.table("account_admin_notes")
            .select("admin_remarks")
            .eq("account_id", account_id)
            .maybe_single()
            .execute()
        )
        admin_remarks = notes_result.data.get("admin_remarks") if notes_result and notes_result.data else None
        return AdminAccountResponse(
            id=old_account["id"],
            account_code=old_account["account_code"],
            name=old_account.get("name"),
            client_user_id=old_account.get("client_user_id"),
            assignment_count=count_result.count or 0,
            created_at=old_account.get("created_at"),
            admin_remarks=admin_remarks,
        )

    # Update account if there are account-level changes
    if update_data:
        result = (
            supabase.table("accounts").update(update_data).eq("id", account_id).execute()
        )

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update account")

        new_account = result.data[0]

        # Audit log
        await write_audit_log(
            supabase,
            actor_user_id=actor_user_id,
            action="account.update",
            resource_type="account",
            resource_id=account_id,
            before={"name": old_account.get("name"), "client_user_id": old_account.get("client_user_id")},
            after={"name": new_account.get("name"), "client_user_id": new_account.get("client_user_id")},
            request=request,
        )
    else:
        new_account = old_account

    # Upsert admin remarks if provided
    if has_remarks_update:
        supabase.table("account_admin_notes").upsert({
            "account_id": account_id,
            "admin_remarks": body.admin_remarks,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

    # Get assignment count
    count_result = (
        supabase.table("account_assignments")
        .select("account_id", count="exact")
        .eq("account_id", account_id)
        .execute()
    )

    # Fetch admin notes for response
    notes_result = (
        supabase.table("account_admin_notes")
        .select("admin_remarks")
        .eq("account_id", account_id)
        .maybe_single()
        .execute()
    )
    admin_remarks = notes_result.data.get("admin_remarks") if notes_result and notes_result.data else None

    return AdminAccountResponse(
        id=new_account["id"],
        account_code=new_account["account_code"],
        name=new_account.get("name"),
        client_user_id=new_account.get("client_user_id"),
        assignment_count=count_result.count or 0,
        created_at=new_account.get("created_at"),
        admin_remarks=admin_remarks,
    )


@router.get("/accounts/{account_id}/records/count")
async def get_account_records_count(
    account_id: str,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    Get count of active bookkeeping records for an account.

    Used by frontend to show confirmation dialog before account deletion.
    """
    supabase = get_supabase()

    # Count active records (not soft-deleted)
    result = (
        supabase.table("bookkeeping_records")
        .select("id", count="exact")
        .eq("account_id", account_id)
        .is_("deleted_at", "null")
        .execute()
    )

    return {"count": result.count or 0}


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    request: Request,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    Delete an account and soft-delete associated bookkeeping records.

    Requires admin.accounts permission (admin role).
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Fetch current account for audit
    current_result = (
        supabase.table("accounts").select("*").eq("id", account_id).execute()
    )

    if not current_result.data:
        raise HTTPException(status_code=404, detail="Account not found")

    old_account = current_result.data[0]

    # Count active bookkeeping records before soft-delete
    count_result = (
        supabase.table("bookkeeping_records")
        .select("id", count="exact")
        .eq("account_id", account_id)
        .is_("deleted_at", "null")
        .execute()
    )
    records_count = count_result.count or 0

    # Soft-delete bookkeeping records (set deleted_at timestamp)
    if records_count > 0:
        from datetime import datetime, timezone
        supabase.table("bookkeeping_records").update(
            {"deleted_at": datetime.now(timezone.utc).isoformat()}
        ).eq("account_id", account_id).is_("deleted_at", "null").execute()

    # Delete account (assignments cascade via FK)
    supabase.table("accounts").delete().eq("id", account_id).execute()

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="account.delete",
        resource_type="account",
        resource_id=account_id,
        before={"account_code": old_account["account_code"], "name": old_account.get("name")},
        after=None,
        request=request,
    )

    return {"status": "deleted", "records_deleted": records_count}


@router.get("/accounts/{account_id}/assignments", response_model=list[AccountAssignmentResponse])
async def list_account_assignments(
    account_id: str,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    List all VA assignments for an account.

    Requires admin.accounts permission (admin role).
    """
    supabase = get_supabase()

    # Verify account exists
    account_result = (
        supabase.table("accounts").select("id").eq("id", account_id).execute()
    )

    if not account_result.data:
        raise HTTPException(status_code=404, detail="Account not found")

    # Fetch assignments
    result = (
        supabase.table("account_assignments")
        .select("*")
        .eq("account_id", account_id)
        .order("created_at")
        .execute()
    )

    return [
        AccountAssignmentResponse(
            account_id=a["account_id"],
            user_id=a["user_id"],
            created_at=a.get("created_at"),
        )
        for a in (result.data or [])
    ]


@router.post("/accounts/{account_id}/assignments", response_model=AccountAssignmentResponse)
async def create_account_assignment(
    account_id: str,
    body: AccountAssignmentCreate,
    request: Request,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    Assign a user (VA) to an account.

    Requires admin.accounts permission (admin role).
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Verify account exists
    account_result = (
        supabase.table("accounts").select("id, account_code").eq("id", account_id).execute()
    )

    if not account_result.data:
        raise HTTPException(status_code=404, detail="Account not found")

    # Insert assignment
    try:
        result = (
            supabase.table("account_assignments")
            .insert({
                "account_id": account_id,
                "user_id": str(body.user_id),
            })
            .execute()
        )
    except APIError as e:
        payload = e.args[0] if e.args else {}
        msg = str(payload.get("message", "")) if isinstance(payload, dict) else str(e)
        if "duplicate key" in msg.lower():
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "ALREADY_ASSIGNED",
                    "message": "This user is already assigned to this account",
                },
            )
        if "violates foreign key" in msg.lower():
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_USER",
                    "message": "User not found",
                },
            )
        raise

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create assignment")

    assignment = result.data[0]

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="account_assignment.create",
        resource_type="account_assignment",
        resource_id=f"{account_id}:{body.user_id}",
        before=None,
        after={"account_id": account_id, "user_id": str(body.user_id)},
        request=request,
    )

    return AccountAssignmentResponse(
        account_id=assignment["account_id"],
        user_id=assignment["user_id"],
        created_at=assignment.get("created_at"),
    )


@router.delete("/accounts/{account_id}/assignments/{user_id}")
async def delete_account_assignment(
    account_id: str,
    user_id: str,
    request: Request,
    user: dict = Depends(require_permission_key("admin.accounts")),
):
    """
    Remove a user assignment from an account.

    Requires admin.accounts permission (admin role).
    """
    supabase = get_supabase()
    actor_user_id = user["user_id"]

    # Fetch current assignment for audit
    current_result = (
        supabase.table("account_assignments")
        .select("*")
        .eq("account_id", account_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not current_result.data:
        raise HTTPException(status_code=404, detail="Assignment not found")

    old_assignment = current_result.data[0]

    # Delete assignment
    supabase.table("account_assignments").delete().eq("account_id", account_id).eq("user_id", user_id).execute()

    # Audit log
    await write_audit_log(
        supabase,
        actor_user_id=actor_user_id,
        action="account_assignment.delete",
        resource_type="account_assignment",
        resource_id=f"{account_id}:{user_id}",
        before={"account_id": account_id, "user_id": user_id},
        after=None,
        request=request,
    )

    return {"status": "deleted"}
