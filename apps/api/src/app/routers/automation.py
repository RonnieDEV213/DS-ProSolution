"""Automation Hub endpoints for Chrome Extension agents.

Simplified pairing flow:
- Extension requests pairing
- Admin approves + assigns Account + Role
- Extension polls and auto-pairs

No codes, no device blocking.
"""

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
    AgentCheckinResponse,
    AgentListResponse,
    AgentResponse,
    AgentRole,
    AgentStatus,
    AgentStatusUpdate,
    AgentUpdate,
    ApprovalRequest,
    ApprovalResponse,
    ApprovalStatus,
    AvailableAccountListResponse,
    AvailableAccountResponse,
    AvailableEbayAgentListResponse,
    AvailableEbayAgentResponse,
    JobClaimResponse,
    JobComplete,
    JobCreate,
    JobCreateResponse,
    JobFail,
    JobFailResponse,
    JobListResponse,
    JobResponse,
    JobStatus,
    PairingPollResponse,
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
CHECKIN_DEADLINE_SECONDS = 300  # 5 minutes for replacement checkin

# Security for agent auth
agent_security = HTTPBearer(auto_error=False)

# Invalid identifier patterns (non-unique values)
INVALID_IDENTIFIERS = [
    "hello,",
    "sign in",
    "register",
    "hi there",
    "hi,",
    "welcome",
    "guest",
]


# ============================================================
# Helper Functions for Account Key Normalization
# ============================================================


def normalize_key(value: str | None) -> str | None:
    """Normalize account key: lowercase, trimmed."""
    if not value:
        return None
    return value.strip().lower()


def is_valid_identifier(value: str | None) -> bool:
    """Check if value is a valid, unique identifier (not a generic greeting)."""
    if not value:
        return False
    if len(value) < 3:
        return False
    lower = value.lower()
    for invalid in INVALID_IDENTIFIERS:
        if lower.startswith(invalid):
            return False
    return True


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

    # Check agent status
    if agent["status"] == "revoked":
        raise HTTPException(status_code=401, detail="Agent has been revoked")

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
        "account_id": agent.get("account_id"),
        "token_version": token_version,
    }


def require_agent_role(*allowed_roles: AgentRole):
    """Dependency factory for requiring specific agent roles."""

    async def check_role(agent: dict = Depends(get_current_agent)) -> dict:
        if agent["role"] is None:
            raise HTTPException(
                status_code=403,
                detail="Agent role not configured",
            )
        role_values = [r.value for r in allowed_roles]
        if agent["role"] not in role_values:
            raise HTTPException(
                status_code=403,
                detail=f"This endpoint requires one of: {role_values}",
            )
        return agent

    return check_role


# ============================================================
# Available Accounts Endpoint (from existing accounts table)
# ============================================================


@router.get("/available-accounts", response_model=AvailableAccountListResponse)
async def list_available_accounts(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List available accounts for agent assignment.

    Returns accounts from the existing accounts table (used for bookkeeping).
    These are the accounts that can be assigned to automation agents.

    Requires admin.automation permission.
    """
    supabase = get_supabase()

    # Fetch from existing accounts table
    result = (
        supabase.table("accounts")
        .select("id, account_code, name")
        .order("account_code", desc=False)
        .execute()
    )

    accounts = [
        AvailableAccountResponse(
            id=row["id"],
            account_code=row["account_code"],
            name=row.get("name"),
        )
        for row in (result.data or [])
    ]

    return AvailableAccountListResponse(accounts=accounts)


@router.get("/available-ebay-agents", response_model=AvailableEbayAgentListResponse)
async def list_available_ebay_agents(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List active eBay agents for Amazon agent assignment.

    Returns eBay agents with their account info so admins can choose
    which eBay agent to link an Amazon agent to.

    Requires admin.automation permission.
    """
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]

    # Fetch active, approved eBay agents with account info
    result = (
        supabase.table("automation_agents")
        .select("id, account_id, label, accounts(account_code, name)")
        .eq("org_id", org_id)
        .eq("role", "EBAY_AGENT")
        .eq("status", "active")
        .eq("approval_status", "approved")
        .order("created_at", desc=False)
        .execute()
    )

    ebay_agents = []
    for row in (result.data or []):
        account_data = row.get("accounts", {}) or {}
        if row.get("account_id"):  # Only include agents with valid account
            ebay_agents.append(AvailableEbayAgentResponse(
                id=row["id"],
                account_id=row["account_id"],
                account_code=account_data.get("account_code", "Unknown"),
                account_name=account_data.get("name"),
                label=row.get("label"),
            ))

    return AvailableEbayAgentListResponse(ebay_agents=ebay_agents)


# ============================================================
# Pairing Request Endpoints
# ============================================================


@router.post("/pairing/request", response_model=PairingRequestResponse)
async def create_pairing_request(
    body: PairingRequestCreate,
    _: None = Depends(check_ip_throttle),  # IP throttle
):
    """
    Extension requests pairing with auto-approve support.

    Public endpoint with rate limiting:
    - IP-based throttle (10 req/min)
    - Per-device persistent backoff (30s, 60s, 120s... up to 1hr)

    Auto-approve flow:
    - If extension provides account keys and they match an existing approved agent,
      creates a 'replacing' agent and returns credentials immediately.
    - Extension must call /agents/me/checkin to confirm replacement.
    - If no match found, creates pending pairing request for admin approval.
    """
    supabase = get_supabase()

    # 1. Normalize account keys
    ebay_key = normalize_key(body.ebay_account_key)
    amazon_key = normalize_key(body.amazon_account_key)

    # 2. Validate keys are unique identifiers (not generic greetings)
    if ebay_key and not is_valid_identifier(ebay_key):
        ebay_key = None
    if amazon_key and not is_valid_identifier(amazon_key):
        amazon_key = None

    # 3. Try auto-approve: find existing approved agent with matching key
    existing_agent = None

    if ebay_key:
        result = (
            supabase.table("automation_agents")
            .select("*, accounts(account_code, name)")
            .eq("ebay_account_key", ebay_key)
            .eq("approval_status", "approved")
            .execute()
        )
        if result.data:
            existing_agent = result.data[0]

    if not existing_agent and amazon_key:
        result = (
            supabase.table("automation_agents")
            .select("*, accounts(account_code, name)")
            .eq("amazon_account_key", amazon_key)
            .eq("approval_status", "approved")
            .execute()
        )
        if result.data:
            existing_agent = result.data[0]

    # 4. If found matching agent, auto-approve with replacement
    if existing_agent:
        now = datetime.now(timezone.utc)
        token_secret = secrets.token_hex(32)

        # Create new agent with approval_status='replacing'
        # Get account data - for Amazon agents, follow ebay_agent_id chain
        account_data = existing_agent.get("accounts", {}) or {}
        if not account_data and existing_agent.get("ebay_agent_id"):
            # Amazon agent: get account through eBay agent
            ebay_agent_result = (
                supabase.table("automation_agents")
                .select("accounts(account_code, name)")
                .eq("id", existing_agent["ebay_agent_id"])
                .execute()
            )
            if ebay_agent_result.data:
                account_data = ebay_agent_result.data[0].get("accounts", {}) or {}

        new_agent_data = {
            "org_id": existing_agent["org_id"],
            "install_instance_id": body.install_instance_id,
            "role": existing_agent["role"],
            "label": existing_agent.get("label"),
            "status": "active",
            "approval_status": "replacing",
            "token_secret": token_secret,
            "ebay_account_key": ebay_key,
            "amazon_account_key": amazon_key,
            "ebay_account_display": body.ebay_account_display,
            "amazon_account_display": body.amazon_account_display,
            "last_seen_at": now.isoformat(),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        # Preserve hierarchy links: account_id for eBay, ebay_agent_id for Amazon
        if existing_agent.get("account_id"):
            new_agent_data["account_id"] = existing_agent["account_id"]
        if existing_agent.get("ebay_agent_id"):
            new_agent_data["ebay_agent_id"] = existing_agent["ebay_agent_id"]

        # Revoke existing agent BEFORE inserting new one to avoid unique constraint violation
        # (unique_ebay_agent_per_account requires only one active eBay agent per account)
        supabase.table("automation_agents").update({
            "status": "revoked",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", existing_agent["id"]).execute()

        new_agent_result = supabase.table("automation_agents").insert(new_agent_data).execute()

        if not new_agent_result.data:
            raise HTTPException(status_code=500, detail="Failed to create replacement agent")

        new_agent = new_agent_result.data[0]

        # Generate install token
        install_token = generate_agent_token(
            agent_id=str(new_agent["id"]),
            org_id=str(new_agent["org_id"]),
            token_secret=token_secret,
            token_version=new_agent["token_version"],
        )

        logger.info(f"Auto-approved agent replacement: {new_agent['id']} replacing {existing_agent['id']}")

        return PairingRequestResponse(
            device_status="auto_approved",
            agent_id=new_agent["id"],
            install_token=install_token,
            role=new_agent["role"],
            label=new_agent.get("label"),
            account_name=account_data.get("name") or account_data.get("account_code"),
            requires_checkin=True,
            checkin_deadline_seconds=CHECKIN_DEADLINE_SECONDS,
        )

    # 6. No match → create pending request with rate limiting
    # Get org_id from any existing account (for auto-creating new accounts)
    org_result = supabase.table("accounts").select("org_id").limit(1).execute()
    org_id = org_result.data[0]["org_id"] if org_result.data else None

    # 7. Create pending request via RPC (handles rate limiting)
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

    # 8. Store detected info (account created at approval time, not here)
    if row.get("request_id"):
        # Determine detected role
        detected_role = None
        if ebay_key:
            detected_role = "EBAY_AGENT"
        elif amazon_key:
            detected_role = "AMAZON_AGENT"

        # Store detected info - account will be created when admin approves
        supabase.table("automation_pairing_requests").update({
            "org_id": org_id,
            "ebay_account_key": ebay_key,
            "amazon_account_key": amazon_key,
            "ebay_account_display": body.ebay_account_display,
            "amazon_account_display": body.amazon_account_display,
            "detected_role": detected_role,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", row["request_id"]).execute()

    return PairingRequestResponse(
        device_status=row["device_status"],
        request_id=row["request_id"],
        status=row["status"],
        next_allowed_at=row["next_allowed_at"],
        cooldown_seconds=row["cooldown_seconds"],
        lifetime_request_count=row["lifetime_request_count"],
        expires_at=row.get("expires_at"),
    )


@router.get("/pairing/status/{install_instance_id}", response_model=PairingPollResponse)
async def poll_pairing_status(
    install_instance_id: str,
):
    """
    Extension polls this to check if approved.

    Public endpoint (no auth required).
    Returns current status and agent info if approved.
    """
    supabase = get_supabase()

    try:
        result = supabase.rpc(
            "rpc_pairing_poll",
            {"p_install_instance_id": install_instance_id}
        ).execute()
    except APIError as e:
        logger.error(f"Pairing poll RPC failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to poll status")

    if not result.data:
        return PairingPollResponse(status="not_found")

    row = result.data[0]

    # If approved, generate JWT token from token_secret
    install_token = None
    if row["status"] == "approved" and row.get("install_token"):
        # install_token from RPC is actually token_secret
        # We need to get agent info to generate proper JWT
        agent_result = (
            supabase.table("automation_agents")
            .select("*")
            .eq("id", row["agent_id"])
            .execute()
        )
        if agent_result.data:
            agent = agent_result.data[0]
            install_token = generate_agent_token(
                agent_id=str(agent["id"]),
                org_id=str(agent["org_id"]),
                token_secret=agent["token_secret"],
                token_version=agent["token_version"],
            )

    return PairingPollResponse(
        status=row["status"],
        agent_id=row.get("agent_id"),
        install_token=install_token,
        role=row.get("role"),
        label=row.get("label"),
        account_name=row.get("account_name"),
        rejection_reason=row.get("rejection_reason"),
        expires_at=row.get("expires_at"),
    )


@router.get("/pairing/requests", response_model=PendingRequestListResponse)
async def list_pending_requests(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List pending pairing requests.

    Requires admin.automation permission.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Get pending requests that haven't expired
    result = (
        supabase.table("automation_pairing_requests")
        .select("*, automation_devices(lifetime_request_count)")
        .eq("status", "pending")
        .gt("expires_at", now)
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
            expires_at=row.get("expires_at"),
            lifetime_request_count=device_data.get("lifetime_request_count", 0),
            ebay_account_key=row.get("ebay_account_key"),
            amazon_account_key=row.get("amazon_account_key"),
            ebay_account_display=row.get("ebay_account_display"),
            amazon_account_display=row.get("amazon_account_display"),
            detected_role=row.get("detected_role"),
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
    Creates agent immediately with assigned account and role.
    For eBay agents: auto-revokes existing eBay agent on same account.
    """
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)

    # Find and validate the request
    result = (
        supabase.table("automation_pairing_requests")
        .select("*")
        .eq("id", request_id)
        .eq("status", "pending")
        .gt("expires_at", now.isoformat())
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Pending request not found or expired")

    request_row = result.data[0]

    # Determine account_id: use body.account_id if provided
    account_id = body.account_id
    ebay_agent_id = None  # For Amazon agents (links to eBay agent instead of account)

    # For eBay agents: auto-link to existing account or create new
    # For Amazon agents: no account (accounts represent eBay sellers only)
    if body.role == AgentRole.EBAY_AGENT:
        ebay_key = request_row.get("ebay_account_key")

        if not account_id and ebay_key:
            # Check if account with this ebay_account_key already exists
            existing_account = (
                supabase.table("accounts")
                .select("id, account_code")
                .eq("org_id", org_id)
                .eq("ebay_account_key", ebay_key)
                .execute()
            )
            if existing_account.data:
                account_id = existing_account.data[0]["id"]
                logger.info(f"Linked to existing account {existing_account.data[0]['account_code']} by ebay_account_key: {ebay_key}")

        if not account_id:
            # Create new account with ebay_account_key for future matching
            ebay_display = request_row.get("ebay_account_display") or ebay_key
            if ebay_display:
                # Count existing accounts for sequential code
                count_result = (
                    supabase.table("accounts")
                    .select("id", count="exact")
                    .eq("org_id", org_id)
                    .execute()
                )
                next_code = str((count_result.count or 0) + 1)

                # Create account with ebay_account_key for matching
                account_result = supabase.table("accounts").insert({
                    "org_id": org_id,
                    "account_code": next_code,
                    "name": ebay_key,  # Use eBay key as display name
                    "ebay_account_key": ebay_key,  # For future matching
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                }).execute()

                if account_result.data:
                    account_id = account_result.data[0]["id"]
                    logger.info(f"Created account {next_code} with ebay_account_key: {ebay_key}")

        if not account_id:
            raise HTTPException(status_code=400, detail="Account is required for eBay agents")

        # Validate account exists (for manually provided account_id)
        if body.account_id:
            account_result = (
                supabase.table("accounts")
                .select("id, account_code, name")
                .eq("id", str(account_id))
                .execute()
            )
            if not account_result.data:
                raise HTTPException(status_code=400, detail="Account not found")
    elif body.role == AgentRole.AMAZON_AGENT:
        # Amazon agents link to eBay agent (not directly to account)
        if body.ebay_agent_id:
            # Use the provided ebay_agent_id directly
            ebay_agent_result = (
                supabase.table("automation_agents")
                .select("id")
                .eq("id", str(body.ebay_agent_id))
                .eq("role", "EBAY_AGENT")
                .eq("status", "active")
                .eq("approval_status", "approved")
                .execute()
            )
            if not ebay_agent_result.data:
                raise HTTPException(
                    status_code=400,
                    detail="Selected eBay agent not found or is not active."
                )
            ebay_agent_id = body.ebay_agent_id
        else:
            # Fallback: find any active eBay agent
            ebay_agent_result = (
                supabase.table("automation_agents")
                .select("id")
                .eq("role", "EBAY_AGENT")
                .eq("status", "active")
                .eq("approval_status", "approved")
                .limit(1)
                .execute()
            )
            if not ebay_agent_result.data:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot create Amazon agent without an active eBay agent. Create an eBay agent first."
                )
            ebay_agent_id = ebay_agent_result.data[0]["id"]

        account_id = None  # Amazon agents don't link directly to accounts

    # For eBay agents: check if one already exists and auto-revoke
    if body.role == AgentRole.EBAY_AGENT and account_id:
        existing = (
            supabase.table("automation_agents")
            .select("id")
            .eq("account_id", str(account_id))
            .eq("role", "EBAY_AGENT")
            .eq("status", "active")
            .eq("approval_status", "approved")
            .execute()
        )
        if existing.data:
            # Auto-revoke existing eBay agent
            supabase.table("automation_agents").update({
                "status": "revoked",
                "approval_status": "revoked",
                "updated_at": now.isoformat(),
            }).eq("id", existing.data[0]["id"]).execute()

            # Emit revocation event
            supabase.table("automation_events").insert({
                "type": "AGENT_REVOKED",
                "agent_id": existing.data[0]["id"],
                "payload": {"reason": "replaced_by_new_agent", "replaced_by": request_row["install_instance_id"]},
            }).execute()

    # Generate token secret for new agent
    token_secret = secrets.token_hex(32)

    # Create agent with account keys from the request
    agent_data = {
        "org_id": org_id,
        "install_instance_id": request_row["install_instance_id"],
        "role": body.role.value,
        "label": body.label,
        "token_secret": token_secret,
        "status": "active",
        "approval_status": "approved",
        "ebay_account_key": request_row.get("ebay_account_key"),
        "amazon_account_key": request_row.get("amazon_account_key"),
        "ebay_account_display": request_row.get("ebay_account_display"),
        "amazon_account_display": request_row.get("amazon_account_display"),
        "last_seen_at": now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    # Only set account_id for eBay agents (Amazon agents have no account)
    if account_id:
        agent_data["account_id"] = str(account_id)
    # For Amazon agents, set ebay_agent_id instead
    if ebay_agent_id:
        agent_data["ebay_agent_id"] = str(ebay_agent_id)

    agent_result = supabase.table("automation_agents").insert(agent_data).execute()

    if not agent_result.data:
        raise HTTPException(status_code=500, detail="Failed to create agent")

    agent = agent_result.data[0]

    # Update request status
    request_update = {
        "status": "approved",
        "org_id": org_id,
        "role": body.role.value,
        "label": body.label,
        "approved_by": user_id,
        "approved_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    if account_id:
        request_update["account_id"] = str(account_id)

    supabase.table("automation_pairing_requests").update(request_update).eq("id", request_id).execute()

    # Emit event
    event_payload = {
        "approved_by": user_id,
        "role": body.role.value,
        "label": body.label,
    }
    if account_id:
        event_payload["account_id"] = str(account_id)

    supabase.table("automation_events").insert({
        "type": "PAIRING_REQUEST_APPROVED",
        "request_id": request_id,
        "agent_id": agent["id"],
        "install_instance_id": request_row["install_instance_id"],
        "payload": event_payload,
    }).execute()

    return ApprovalResponse(agent_id=agent["id"])


@router.post("/pairing/requests/{request_id}/reject")
async def reject_pairing_request(
    request_id: str,
    body: RejectionRequest,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Reject a pending pairing request.

    Requires admin.automation permission.
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

    # Emit event
    supabase.table("automation_events").insert({
        "type": "PAIRING_REQUEST_REJECTED",
        "request_id": request_id,
        "install_instance_id": request_row["install_instance_id"],
        "payload": {"rejected_by": user_id, "reason": body.reason},
    }).execute()

    return {"ok": True}


# ============================================================
# Agent Endpoints
# ============================================================


@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    account_id: str | None = Query(None, description="Filter by account"),
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    List all agents for the organization.

    Requires admin.automation permission.
    Optionally filter by account.
    """
    supabase = get_supabase()
    org_id = user["membership"]["org_id"]

    # Get agents with account info from existing accounts table
    # For Amazon agents, also fetch eBay agent info to get account through hierarchy
    query = (
        supabase.table("automation_agents")
        .select("*, accounts(account_code, name), ebay_agent:ebay_agent_id(account_id, accounts(account_code, name))")
        .eq("org_id", org_id)
    )

    if account_id:
        # Filter by account: include both direct account_id (eBay agents)
        # and agents whose eBay agent has this account (Amazon agents)
        query = query.or_(f"account_id.eq.{account_id},ebay_agent.account_id.eq.{account_id}")

    result = query.order("created_at", desc=True).execute()

    agents = []
    for row in (result.data or []):
        # Get account info: directly for eBay agents, via ebay_agent for Amazon agents
        account_data = row.get("accounts", {}) or {}
        ebay_agent_data = row.get("ebay_agent", {}) or {}

        # For Amazon agents, get account info from their linked eBay agent
        if not account_data and ebay_agent_data:
            account_data = ebay_agent_data.get("accounts", {}) or {}

        agents.append(AgentResponse(
            id=row["id"],
            org_id=row["org_id"],
            account_id=row.get("account_id"),
            account_code=account_data.get("account_code"),
            account_name=account_data.get("name"),
            ebay_agent_id=row.get("ebay_agent_id"),
            role=row["role"],
            label=row["label"],
            install_instance_id=row["install_instance_id"],
            status=row["status"],
            approval_status=row.get("approval_status", "approved"),
            ebay_account_key=row.get("ebay_account_key"),
            amazon_account_key=row.get("amazon_account_key"),
            ebay_account_display=row.get("ebay_account_display"),
            amazon_account_display=row.get("amazon_account_display"),
            replaced_by_id=row.get("replaced_by_id"),
            replaced_at=row.get("replaced_at"),
            last_seen_at=row["last_seen_at"],
            created_at=row["created_at"],
        ))

    return AgentListResponse(agents=agents)


@router.patch("/agents/{agent_id}")
async def update_agent(
    agent_id: str,
    body: AgentUpdate,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Update an agent (label, status).

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

    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.label is not None:
        update_data["label"] = body.label
    if body.status is not None:
        update_data["status"] = body.status.value

    supabase.table("automation_agents").update(update_data).eq("id", agent_id).execute()

    return {"ok": True}


@router.post("/agents/{agent_id}/revoke")
async def revoke_agent(
    agent_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Revoke an agent (force re-pair).

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

    now = datetime.now(timezone.utc).isoformat()

    # Revoke agent (both status and approval_status)
    supabase.table("automation_agents").update({
        "status": "revoked",
        "approval_status": "revoked",
        "updated_at": now,
    }).eq("id", agent_id).execute()

    # Emit event
    supabase.table("automation_events").insert({
        "type": "AGENT_REVOKED",
        "agent_id": agent_id,
        "payload": {"reason": "admin_revoked"},
    }).execute()

    return {"ok": True}


@router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Delete an agent.

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

    # Clear any replaced_by_id references to this agent (prevents FK constraint error)
    supabase.table("automation_agents").update({
        "replaced_by_id": None,
        "replaced_at": None,
    }).eq("replaced_by_id", agent_id).execute()

    # Delete agent (CASCADE will handle ebay_agent_id references from Amazon agents)
    supabase.table("automation_agents").delete().eq("id", agent_id).execute()

    return {"ok": True}


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


@router.post("/agents/me/checkin", response_model=AgentCheckinResponse)
async def agent_checkin(agent: dict = Depends(get_current_agent)):
    """
    Called by extension after auto-approve to confirm successful install.

    Two-phase replacement:
    - On checkin: new agent transitions from 'replacing' -> 'approved'
    - Old agent transitions from 'approved' -> 'revoked'

    This ensures old agent isn't lost if reinstall fails.
    """
    supabase = get_supabase()

    # Get full agent record
    agent_result = (
        supabase.table("automation_agents")
        .select("*")
        .eq("id", agent["agent_id"])
        .execute()
    )

    if not agent_result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent_record = agent_result.data[0]
    approval_status = agent_record.get("approval_status", "approved")

    # If not in 'replacing' status, nothing to do
    if approval_status != "replacing":
        return AgentCheckinResponse(
            ok=True,
            status=approval_status,
            message="Already confirmed",
        )

    now = datetime.now(timezone.utc)

    # Find the old agent we're replacing (same account key, approval_status='approved')
    old_agent = None
    ebay_key = agent_record.get("ebay_account_key")
    amazon_key = agent_record.get("amazon_account_key")

    if ebay_key:
        old_result = (
            supabase.table("automation_agents")
            .select("id")
            .eq("ebay_account_key", ebay_key)
            .eq("approval_status", "approved")
            .neq("id", agent["agent_id"])
            .execute()
        )
        if old_result.data:
            old_agent = old_result.data[0]

    if not old_agent and amazon_key:
        old_result = (
            supabase.table("automation_agents")
            .select("id")
            .eq("amazon_account_key", amazon_key)
            .eq("approval_status", "approved")
            .neq("id", agent["agent_id"])
            .execute()
        )
        if old_result.data:
            old_agent = old_result.data[0]

    # Activate new agent
    supabase.table("automation_agents").update({
        "approval_status": "approved",
        "updated_at": now.isoformat(),
    }).eq("id", agent["agent_id"]).execute()

    # Revoke old agent
    if old_agent:
        supabase.table("automation_agents").update({
            "approval_status": "revoked",
            "status": "revoked",
            "replaced_by_id": agent["agent_id"],
            "replaced_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }).eq("id", old_agent["id"]).execute()

        # Emit event
        supabase.table("automation_events").insert({
            "type": "AGENT_REVOKED",
            "agent_id": old_agent["id"],
            "payload": {
                "reason": "replaced_by_auto_reconnect",
                "replaced_by": agent["agent_id"],
            },
        }).execute()

        logger.info(f"Agent checkin: {agent['agent_id']} replaced {old_agent['id']}")

    return AgentCheckinResponse(
        ok=True,
        status=ApprovalStatus.APPROVED,
        message="Replacement confirmed",
    )


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
            "account_id": agent.get("account_id"),
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
