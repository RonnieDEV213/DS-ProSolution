"""Automation Hub endpoints for Chrome Extension agents.

Extension-initiated pairing flow with rate limiting, device blocking,
hashed codes, per-agent token secrets, and admin event feed.
"""

import hashlib
import logging
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError

from app.auth import require_permission_key
from app.database import get_supabase
from app.models import (
    AgentListResponse,
    AgentRedeemRequest,
    AgentRedeemResponse,
    AgentResponse,
    AgentRole,
    AgentRoleUpdate,
    AgentStatus,
    AgentStatusUpdate,
    ApprovalRequest,
    ApprovalResponse,
    BlockedDeviceCreate,
    BlockedDeviceListResponse,
    BlockedDeviceResponse,
    JobClaimResponse,
    JobComplete,
    JobCreate,
    JobCreateResponse,
    JobFail,
    JobFailResponse,
    JobListResponse,
    JobResponse,
    JobStatus,
    PairingRequestCreate,
    PairingRequestResponse,
    PendingRequestListResponse,
    PendingRequestResponse,
    RejectionRequest,
)

router = APIRouter(prefix="/automation", tags=["automation"])
logger = logging.getLogger(__name__)

# Constants
TOKEN_EXPIRY_DAYS = 60
MAX_ATTEMPTS = 3
CODE_EXPIRY_MINUTES = 15

# Security for agent auth
agent_security = HTTPBearer(auto_error=False)


# ============================================================
# IP Throttling (Simple in-memory rate limiter)
# ============================================================

class IPThrottler:
    """Simple in-memory IP throttler for pairing requests."""

    def __init__(self, requests_per_minute: int = 10):
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.lock = Lock()

    def is_allowed(self, ip: str) -> bool:
        """Check if IP is allowed to make a request."""
        now = time.time()
        window_start = now - 60  # 1 minute window

        with self.lock:
            # Clean old requests
            self.requests[ip] = [t for t in self.requests[ip] if t > window_start]

            if len(self.requests[ip]) >= self.requests_per_minute:
                return False

            self.requests[ip].append(now)
            return True


ip_throttler = IPThrottler(requests_per_minute=10)


def check_ip_throttle(request: Request):
    """Dependency to check IP throttle."""
    client_ip = request.client.host if request.client else "unknown"
    if not ip_throttler.is_allowed(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many requests from this IP. Please wait before trying again.",
        )


# ============================================================
# Agent Authentication (Per-agent token secrets, kid in header)
# ============================================================


def generate_agent_token(agent_id: str, org_id: str, token_secret: str, token_version: int) -> str:
    """Generate JWT for agent authentication with agent_id in header kid."""
    now = datetime.now(timezone.utc)
    payload = {
        "org_id": str(org_id),
        "token_version": token_version,
        "iat": now,
        "exp": now + timedelta(days=TOKEN_EXPIRY_DAYS),
    }
    # Put agent_id in JWT header as 'kid' (key id)
    headers = {"kid": str(agent_id)}
    return jwt.encode(payload, token_secret, algorithm="HS256", headers=headers)


async def get_current_agent(
    credentials: HTTPAuthorizationCredentials | None = Depends(agent_security),
) -> dict:
    """Validate agent install token using per-agent secret from kid header."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    # Get unverified headers to find agent_id (kid)
    try:
        unverified_header = jwt.get_unverified_header(token)
        agent_id = unverified_header.get("kid")
        alg = unverified_header.get("alg")
    except jwt.exceptions.DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token format")

    if not agent_id:
        raise HTTPException(status_code=401, detail="Token missing kid header")

    # Reject unexpected algorithms (security: prevent alg=none attacks)
    if alg != "HS256":
        raise HTTPException(status_code=401, detail="Invalid token algorithm")

    # Lookup agent to get their secret
    supabase = get_supabase()
    result = supabase.table("automation_agents").select("*").eq("id", agent_id).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Agent not found")

    agent = result.data[0]

    # Verify token with agent's secret (pinned to HS256)
    try:
        payload = jwt.decode(
            token,
            agent["token_secret"],
            algorithms=["HS256"],  # Only allow HS256
        )
        token_version = payload.get("token_version", 0)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Token version check (for revocation)
    if agent["token_version"] != token_version:
        raise HTTPException(status_code=401, detail="Token revoked")

    # Update last_seen_at
    supabase.table("automation_agents").update({
        "last_seen_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", agent_id).execute()

    return {
        "agent_id": agent_id,
        "role": agent["role"],
        "org_id": agent["org_id"],
        "token_version": token_version,
    }


def require_agent_role(*allowed_roles: AgentRole):
    """Dependency factory for requiring specific agent roles."""

    async def check_role(agent: dict = Depends(get_current_agent)) -> dict:
        if agent["role"] is None:
            raise HTTPException(
                status_code=403,
                detail="Agent role not configured. Set role via PATCH /agents/me/role first.",
            )
        role_values = [r.value for r in allowed_roles]
        if agent["role"] not in role_values:
            raise HTTPException(
                status_code=403,
                detail=f"This endpoint requires one of: {role_values}",
            )
        return agent

    return check_role


def generate_pairing_code() -> str:
    """Generate a 6-digit pairing code."""
    return "".join(secrets.choice("0123456789") for _ in range(6))


def hash_code(code: str, salt: str) -> str:
    """Hash a pairing code with salt using SHA256."""
    return hashlib.sha256((code + salt).encode()).hexdigest()


# ============================================================
# Pairing Request Endpoints (Extension-Initiated)
# ============================================================


@router.post("/pairing/request", response_model=PairingRequestResponse)
async def create_pairing_request(
    body: PairingRequestCreate,
    _: None = Depends(check_ip_throttle),  # IP throttle
):
    """
    Extension requests pairing.

    Public endpoint with rate limiting:
    - IP-based throttle (10 req/min)
    - Per-device persistent backoff (30s, 60s, 120s... up to 1hr)

    Returns request status and cooldown info.
    """
    supabase = get_supabase()

    try:
        result = supabase.rpc(
            "rpc_pairing_request",
            {"p_install_instance_id": body.install_instance_id}
        ).execute()
    except APIError as e:
        logger.error(f"Pairing request RPC failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to process pairing request")

    if not result.data:
        raise HTTPException(status_code=500, detail="No response from pairing request")

    row = result.data[0]

    # Check if blocked
    if row["device_status"] == "blocked":
        raise HTTPException(status_code=403, detail="Device is blocked from requesting pairing")

    return PairingRequestResponse(
        device_status=row["device_status"],
        request_id=row["request_id"],
        status=row["status"],
        next_allowed_at=row["next_allowed_at"],
        cooldown_seconds=row["cooldown_seconds"],
        lifetime_request_count=row["lifetime_request_count"],
    )


@router.get("/pairing/requests", response_model=PendingRequestListResponse)
async def list_pending_requests(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List pending pairing requests.

    Requires admin.automation permission.
    Admin polls this to show pending requests modal.
    """
    supabase = get_supabase()

    # Join with automation_devices to get lifetime_request_count
    result = (
        supabase.table("automation_pairing_requests")
        .select("*, automation_devices(lifetime_request_count)")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )

    requests = []
    for row in (result.data or []):
        device_data = row.get("automation_devices", {}) or {}
        requests.append(PendingRequestResponse(
            id=row["id"],
            install_instance_id=row["install_instance_id"],
            created_at=row["created_at"],
            updated_at=row.get("updated_at"),
            lifetime_request_count=device_data.get("lifetime_request_count", 0),
        ))

    return PendingRequestListResponse(requests=requests)


@router.post("/pairing/requests/{request_id}/approve", response_model=ApprovalResponse)
async def approve_pairing_request(
    request_id: str,
    body: ApprovalRequest,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Approve a pending pairing request.

    Requires admin.automation permission.
    Generates a 6-digit code (returned only once), stores hash+salt.
    """
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]

    # Find and lock the request
    result = (
        supabase.table("automation_pairing_requests")
        .select("*")
        .eq("id", request_id)
        .eq("status", "pending")
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Pending request not found")

    request_row = result.data[0]

    # Generate code and hash
    code = generate_pairing_code()
    salt = secrets.token_hex(16)
    code_hash = hash_code(code, salt)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)

    # Update request with approval
    supabase.table("automation_pairing_requests").update({
        "status": "approved",
        "org_id": org_id,
        "label": body.label,
        "approved_by": user_id,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "code_hash": code_hash,
        "code_salt": salt,
        "code_expires_at": expires_at.isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", request_id).execute()

    # Emit event
    supabase.table("automation_events").insert({
        "type": "PAIRING_REQUEST_APPROVED",
        "request_id": request_id,
        "install_instance_id": request_row["install_instance_id"],
        "payload": {"approved_by": user_id, "label": body.label},
    }).execute()

    return ApprovalResponse(code=code, expires_at=expires_at)


@router.post("/pairing/requests/{request_id}/reject")
async def reject_pairing_request(
    request_id: str,
    body: RejectionRequest,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Reject a pending pairing request.

    Requires admin.automation permission.
    Optionally blocks the device from future requests.
    """
    supabase = get_supabase()
    user_id = user["user_id"]

    # Find the request
    result = (
        supabase.table("automation_pairing_requests")
        .select("*")
        .eq("id", request_id)
        .eq("status", "pending")
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Pending request not found")

    request_row = result.data[0]
    now = datetime.now(timezone.utc).isoformat()

    # Update request with rejection
    supabase.table("automation_pairing_requests").update({
        "status": "rejected",
        "rejected_by": user_id,
        "rejected_at": now,
        "rejection_reason": body.reason,
        "updated_at": now,
    }).eq("id", request_id).execute()

    # Block device if requested
    if body.block_device:
        supabase.table("automation_devices").update({
            "blocked_at": now,
            "blocked_reason": body.reason or "Blocked by admin",
            "updated_at": now,
        }).eq("install_instance_id", request_row["install_instance_id"]).execute()

    # Emit event
    supabase.table("automation_events").insert({
        "type": "PAIRING_REQUEST_REJECTED",
        "request_id": request_id,
        "install_instance_id": request_row["install_instance_id"],
        "payload": {"rejected_by": user_id, "reason": body.reason, "blocked": body.block_device},
    }).execute()

    return {"ok": True}


@router.post("/pairing/redeem", response_model=AgentRedeemResponse)
async def redeem_pairing_code(body: AgentRedeemRequest):
    """
    Exchange a pairing code for an agent token.

    Public endpoint (no auth required).
    Uses atomic RPC to prevent double-redeem race conditions.
    """
    supabase = get_supabase()

    # First check if device is blocked
    device_result = (
        supabase.table("automation_devices")
        .select("blocked_at")
        .eq("install_instance_id", body.install_instance_id)
        .execute()
    )

    if device_result.data and device_result.data[0].get("blocked_at"):
        raise HTTPException(status_code=403, detail="Device is blocked")

    # Find approved request for this device
    request_result = (
        supabase.table("automation_pairing_requests")
        .select("*")
        .eq("install_instance_id", body.install_instance_id)
        .eq("status", "approved")
        .gt("code_expires_at", datetime.now(timezone.utc).isoformat())
        .order("approved_at", desc=True)
        .limit(1)
        .execute()
    )

    if not request_result.data:
        raise HTTPException(status_code=400, detail="Invalid or expired pairing code")

    request_row = request_result.data[0]

    # Verify code hash
    computed_hash = hash_code(body.code, request_row["code_salt"])
    if computed_hash != request_row["code_hash"]:
        raise HTTPException(status_code=400, detail="Invalid or expired pairing code")

    # Generate new token secret for agent
    token_secret = secrets.token_hex(32)

    # Call RPC to atomically redeem and create/update agent
    try:
        result = supabase.rpc(
            "rpc_pairing_redeem",
            {
                "p_code": body.code,
                "p_install_instance_id": body.install_instance_id,
                "p_token_secret": token_secret,
            }
        ).execute()
    except APIError as e:
        msg = str(e)
        if "DEVICE_BLOCKED" in msg:
            raise HTTPException(status_code=403, detail="Device is blocked")
        if "INVALID_OR_EXPIRED_CODE" in msg:
            raise HTTPException(status_code=400, detail="Invalid or expired pairing code")
        if "DEVICE_NOT_FOUND" in msg:
            raise HTTPException(status_code=400, detail="Device not found")
        logger.error(f"Redeem RPC failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to redeem code")

    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid or expired pairing code")

    agent = result.data[0]

    # Generate JWT token with kid header
    token = generate_agent_token(
        agent_id=agent["agent_id"],
        org_id=agent["org_id"],
        token_secret=token_secret,
        token_version=agent["token_version"],
    )

    return AgentRedeemResponse(
        agent_id=agent["agent_id"],
        install_token=token,
        label=agent["label"],
        is_new=agent["is_new"],
    )


# ============================================================
# Blocked Device Endpoints (Admin)
# ============================================================


@router.get("/blocked-devices", response_model=BlockedDeviceListResponse)
async def list_blocked_devices(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List blocked devices.

    Requires admin.automation permission.
    """
    supabase = get_supabase()

    result = (
        supabase.table("automation_devices")
        .select("install_instance_id, blocked_at, blocked_reason")
        .not_.is_("blocked_at", "null")
        .order("blocked_at", desc=True)
        .execute()
    )

    devices = [
        BlockedDeviceResponse(
            install_instance_id=row["install_instance_id"],
            blocked_at=row["blocked_at"],
            blocked_reason=row["blocked_reason"],
        )
        for row in (result.data or [])
    ]

    return BlockedDeviceListResponse(devices=devices)


@router.post("/blocked-devices", response_model=BlockedDeviceResponse)
async def block_device(
    body: BlockedDeviceCreate,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Block a device from requesting pairing.

    Requires admin.automation permission.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Upsert device with blocked status
    result = supabase.table("automation_devices").upsert({
        "install_instance_id": body.install_instance_id,
        "blocked_at": now,
        "blocked_reason": body.reason,
        "updated_at": now,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to block device")

    row = result.data[0]
    return BlockedDeviceResponse(
        install_instance_id=row["install_instance_id"],
        blocked_at=row["blocked_at"],
        blocked_reason=row["blocked_reason"],
    )


@router.delete("/blocked-devices/{install_instance_id}")
async def unblock_device(
    install_instance_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Unblock a device.

    Requires admin.automation permission.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("automation_devices")
        .update({
            "blocked_at": None,
            "blocked_reason": None,
            "updated_at": now,
        })
        .eq("install_instance_id", install_instance_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Device not found")

    return {"ok": True}


# ============================================================
# Agent Endpoints
# ============================================================


@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List all agents for the organization.

    Requires admin.automation permission.
    """
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]

    result = (
        supabase.table("automation_agents")
        .select("id, org_id, role, label, install_instance_id, status, last_seen_at, created_at")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )

    agents = [
        AgentResponse(
            id=row["id"],
            org_id=row["org_id"],
            role=row["role"],
            label=row["label"],
            install_instance_id=row["install_instance_id"],
            status=row["status"],
            last_seen_at=row["last_seen_at"],
            created_at=row["created_at"],
        )
        for row in (result.data or [])
    ]

    return AgentListResponse(agents=agents)


@router.patch("/agents/me/role")
async def update_agent_role(
    body: AgentRoleUpdate,
    agent: dict = Depends(get_current_agent),
):
    """
    Set the current agent's role.

    Agent auth required. VA sets this after pairing.
    Role can only be set once (immutable after set).
    """
    supabase = get_supabase()

    # Check if role is already set
    result = (
        supabase.table("automation_agents")
        .select("role")
        .eq("id", agent["agent_id"])
        .execute()
    )

    if result.data and result.data[0].get("role") is not None:
        raise HTTPException(
            status_code=400,
            detail="Agent role is already set and cannot be changed",
        )

    # Update role
    supabase.table("automation_agents").update({
        "role": body.role.value,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", agent["agent_id"]).execute()

    return {"ok": True, "role": body.role.value}


@router.patch("/agents/me/status")
async def update_agent_status(
    body: AgentStatusUpdate,
    agent: dict = Depends(get_current_agent),
):
    """
    Update the current agent's status.

    Agent ID is derived from token, not URL.
    """
    supabase = get_supabase()

    supabase.table("automation_agents").update({
        "status": body.status.value,
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", agent["agent_id"]).execute()

    return {"ok": True, "status": body.status.value}


@router.post("/agents/me/heartbeat")
async def agent_heartbeat(agent: dict = Depends(get_current_agent)):
    """
    Update last_seen_at for the current agent.

    Called periodically by extension.
    Note: last_seen_at is already updated by get_current_agent,
    so this is mostly for explicit heartbeat tracking.
    """
    return {"ok": True}


@router.post("/agents/{agent_id}/revoke-tokens")
async def revoke_agent_tokens(
    agent_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Revoke all tokens for an agent by incrementing token_version.

    Requires admin.automation permission.
    """
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]

    # Verify agent exists and belongs to org
    result = (
        supabase.table("automation_agents")
        .select("*")
        .eq("id", agent_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = result.data[0]

    # Generate new secret and increment version
    new_secret = secrets.token_hex(32)
    supabase.table("automation_agents").update({
        "token_secret": new_secret,
        "token_version": agent["token_version"] + 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", agent_id).execute()

    return {"ok": True, "message": "All tokens revoked"}


# ============================================================
# Job Endpoints
# ============================================================


@router.post("/jobs", response_model=JobCreateResponse)
async def create_job(
    body: JobCreate,
    agent: dict = Depends(require_agent_role(AgentRole.EBAY_AGENT)),
):
    """
    Create a new automation job.

    Only eBay agents can create jobs.
    org_id and created_by_agent_id are derived from token.
    """
    supabase = get_supabase()

    try:
        result = supabase.table("automation_jobs").insert({
            "org_id": agent["org_id"],
            "ebay_order_id": body.ebay_order_id,
            "item_name": body.item_name,
            "qty": body.qty,
            "sale_price_cents": body.sale_price_cents,
            "ebay_fees_cents": body.ebay_fees_cents,
            "sale_date": body.sale_date.isoformat() if body.sale_date else None,
            "auto_order_url": body.auto_order_url,
            "created_by_agent_id": agent["agent_id"],
            "status": "QUEUED",
        }).execute()
    except APIError as e:
        msg = str(e)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            raise HTTPException(
                status_code=409,
                detail={"code": "DUPLICATE_ORDER", "message": f"Job for eBay order {body.ebay_order_id} already exists"},
            )
        raise

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create job")

    job = result.data[0]
    return JobCreateResponse(job_id=job["id"], status=job["status"])


@router.post("/jobs/claim", response_model=JobClaimResponse)
async def claim_job(
    agent: dict = Depends(require_agent_role(AgentRole.AMAZON_AGENT)),
):
    """
    Claim the next available job.

    Only Amazon agents can claim jobs.
    Uses atomic RPC to prevent race conditions.
    """
    supabase = get_supabase()

    result = supabase.rpc(
        "claim_next_automation_job",
        {
            "p_org_id": agent["org_id"],
            "p_agent_id": agent["agent_id"],
        }
    ).execute()

    if not result.data:
        return JobClaimResponse(job=None)

    job_data = result.data[0]

    # Fetch full job details
    job_result = (
        supabase.table("automation_jobs")
        .select("*")
        .eq("id", job_data["job_id"])
        .execute()
    )

    if not job_result.data:
        return JobClaimResponse(job=None)

    job = job_result.data[0]
    return JobClaimResponse(
        job=JobResponse(
            id=job["id"],
            org_id=job["org_id"],
            status=job["status"],
            attempt_count=job["attempt_count"],
            ebay_order_id=job["ebay_order_id"],
            item_name=job["item_name"],
            qty=job["qty"],
            sale_price_cents=job["sale_price_cents"],
            ebay_fees_cents=job["ebay_fees_cents"],
            sale_date=job["sale_date"],
            auto_order_url=job["auto_order_url"],
            amazon_order_id=job["amazon_order_id"],
            amazon_price_cents=job["amazon_price_cents"],
            amazon_tax_cents=job["amazon_tax_cents"],
            amazon_shipping_cents=job["amazon_shipping_cents"],
            created_by_agent_id=job["created_by_agent_id"],
            claimed_by_agent_id=job["claimed_by_agent_id"],
            claimed_at=job["claimed_at"],
            completed_at=job["completed_at"],
            failure_reason=job["failure_reason"],
            failure_details=job["failure_details"],
            created_at=job["created_at"],
        )
    )


@router.post("/jobs/{job_id}/complete")
async def complete_job(
    job_id: str,
    body: JobComplete,
    agent: dict = Depends(require_agent_role(AgentRole.AMAZON_AGENT)),
):
    """
    Mark a job as completed with Amazon order details.

    Only the agent that claimed the job can complete it.
    """
    supabase = get_supabase()

    # Fetch and verify ownership
    result = (
        supabase.table("automation_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("org_id", agent["org_id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data[0]

    # Verify status
    if job["status"] not in ("CLAIMED", "RUNNING"):
        raise HTTPException(
            status_code=400,
            detail=f"Job status is {job['status']}, cannot complete",
        )

    # Verify ownership
    if job["claimed_by_agent_id"] != agent["agent_id"]:
        raise HTTPException(
            status_code=403,
            detail="You do not own this job",
        )

    # Update job
    supabase.table("automation_jobs").update({
        "status": "COMPLETED",
        "amazon_order_id": body.amazon_order_id,
        "amazon_price_cents": body.amazon_price_cents,
        "amazon_tax_cents": body.amazon_tax_cents,
        "amazon_shipping_cents": body.amazon_shipping_cents,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()

    return {"ok": True}


@router.post("/jobs/{job_id}/fail", response_model=JobFailResponse)
async def fail_job(
    job_id: str,
    body: JobFail,
    agent: dict = Depends(require_agent_role(AgentRole.AMAZON_AGENT)),
):
    """
    Report a job failure.

    If retryable and under MAX_ATTEMPTS, requeues the job.
    Otherwise marks as FAILED_NEEDS_ATTENTION.
    """
    supabase = get_supabase()

    # Fetch and verify ownership
    result = (
        supabase.table("automation_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("org_id", agent["org_id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data[0]

    # Verify status
    if job["status"] not in ("CLAIMED", "RUNNING"):
        raise HTTPException(
            status_code=400,
            detail=f"Job status is {job['status']}, cannot fail",
        )

    # Verify ownership
    if job["claimed_by_agent_id"] != agent["agent_id"]:
        raise HTTPException(
            status_code=403,
            detail="You do not own this job",
        )

    # Determine if retryable
    # BLOCKER_* reasons are not retryable (need human intervention)
    is_retryable = not body.reason.startswith("BLOCKER_")
    can_retry = is_retryable and job["attempt_count"] < MAX_ATTEMPTS

    if can_retry:
        new_status = "QUEUED"
        requeued = True
    else:
        new_status = "FAILED_NEEDS_ATTENTION"
        requeued = False

    # Update job
    supabase.table("automation_jobs").update({
        "status": new_status,
        "failure_reason": body.reason,
        "failure_details": body.details,
        # Clear claim info if requeuing
        "claimed_by_agent_id": None if requeued else job["claimed_by_agent_id"],
        "claimed_at": None if requeued else job["claimed_at"],
    }).eq("id", job_id).execute()

    return JobFailResponse(ok=True, requeued=requeued, status=new_status)


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    status: JobStatus | None = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List jobs with optional filtering.

    Requires admin.automation permission.
    """
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]

    query = (
        supabase.table("automation_jobs")
        .select("*", count="exact")
        .eq("org_id", org_id)
    )

    if status:
        query = query.eq("status", status.value)

    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)
    query = query.order("created_at", desc=True)

    result = query.execute()

    jobs = [
        JobResponse(
            id=row["id"],
            org_id=row["org_id"],
            status=row["status"],
            attempt_count=row["attempt_count"],
            ebay_order_id=row["ebay_order_id"],
            item_name=row["item_name"],
            qty=row["qty"],
            sale_price_cents=row["sale_price_cents"],
            ebay_fees_cents=row["ebay_fees_cents"],
            sale_date=row["sale_date"],
            auto_order_url=row["auto_order_url"],
            amazon_order_id=row["amazon_order_id"],
            amazon_price_cents=row["amazon_price_cents"],
            amazon_tax_cents=row["amazon_tax_cents"],
            amazon_shipping_cents=row["amazon_shipping_cents"],
            created_by_agent_id=row["created_by_agent_id"],
            claimed_by_agent_id=row["claimed_by_agent_id"],
            claimed_at=row["claimed_at"],
            completed_at=row["completed_at"],
            failure_reason=row["failure_reason"],
            failure_details=row["failure_details"],
            created_at=row["created_at"],
        )
        for row in (result.data or [])
    ]

    return JobListResponse(
        jobs=jobs,
        total=result.count or len(jobs),
        page=page,
        page_size=page_size,
    )
