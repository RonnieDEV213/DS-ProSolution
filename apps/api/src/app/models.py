from datetime import date, datetime
from enum import Enum
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


# ============================================================
# User Management Enums
# ============================================================


class UserRole(str, Enum):
    ADMIN = "admin"
    VA = "va"
    CLIENT = "client"


# ============================================================
# User Management Models
# ============================================================


class MembershipStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class UserMembershipUpdate(BaseModel):
    """Request body for updating a user's membership."""

    role: Optional[UserRole] = None
    status: Optional[MembershipStatus] = None
    admin_remarks: Optional[str] = None


class MembershipResponse(BaseModel):
    """Membership data in API responses."""

    id: str
    user_id: str
    org_id: str
    role: UserRole
    status: str = "active"
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProfileResponse(BaseModel):
    """Profile data in API responses."""

    user_id: str
    email: str
    display_name: Optional[str] = None
    created_at: Optional[datetime] = None
    admin_remarks: Optional[str] = None


class UserResponse(BaseModel):
    """Combined user data for admin API responses."""

    profile: ProfileResponse
    membership: MembershipResponse
    permissions: dict


class UserListResponse(BaseModel):
    """Paginated user list response."""

    users: list[UserResponse]
    total: int
    page: int
    page_size: int


class BootstrapResponse(BaseModel):
    """Response from bootstrap endpoint."""

    profile: ProfileResponse
    membership: MembershipResponse
    is_new: bool = False


# ============================================================
# Organization Models
# ============================================================


class OrgResponse(BaseModel):
    """Organization data in API responses."""

    id: str
    name: str
    owner_user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TransferOwnershipRequest(BaseModel):
    """Request body for transferring organization ownership."""

    new_owner_user_id: str
    confirm: Literal["TRANSFER"]


# ============================================================
# Department Roles Models
# ============================================================


class DepartmentRoleCreate(BaseModel):
    """Request body for creating a department role."""

    name: str
    permissions: list[str]  # permission keys
    admin_remarks: Optional[str] = None


class DepartmentRoleUpdate(BaseModel):
    """Request body for updating a department role."""

    name: Optional[str] = None
    permissions: Optional[list[str]] = None
    position: Optional[int] = None
    admin_remarks: Optional[str] = None


class DepartmentRoleResponse(BaseModel):
    """Department role data in API responses."""

    id: str
    org_id: str
    name: str
    position: int
    permissions: list[str]
    created_at: Optional[datetime] = None
    admin_remarks: Optional[str] = None


class DepartmentRoleListResponse(BaseModel):
    """List of department roles response."""

    roles: list[DepartmentRoleResponse]


class DepartmentRoleAssignment(BaseModel):
    """Request body for assigning a department role to a membership."""

    role_id: str


# ============================================================
# Bookkeeping Models
# ============================================================


class BookkeepingStatus(str, Enum):
    SUCCESSFUL = "SUCCESSFUL"
    RETURN_LABEL_PROVIDED = "RETURN_LABEL_PROVIDED"
    RETURN_CLOSED = "RETURN_CLOSED"
    REFUND_NO_RETURN = "REFUND_NO_RETURN"


# Account models
class AccountResponse(BaseModel):
    id: str
    account_code: str
    name: Optional[str] = None


# Record models
class RecordCreate(BaseModel):
    account_id: str
    ebay_order_id: str
    sale_date: date
    item_name: str
    qty: int = 1
    sale_price_cents: int
    ebay_fees_cents: Optional[int] = None
    amazon_price_cents: Optional[int] = None
    amazon_tax_cents: Optional[int] = None
    amazon_shipping_cents: Optional[int] = None
    amazon_order_id: Optional[str] = None
    order_remark: Optional[str] = None  # Stored separately in order_remarks table
    status: BookkeepingStatus = BookkeepingStatus.SUCCESSFUL
    # Note: return_label_cost_cents and service_remark not in create (service fields)

    @field_validator("qty")
    @classmethod
    def qty_must_be_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("qty must be at least 1")
        return v

    @field_validator(
        "sale_price_cents",
        "ebay_fees_cents",
        "amazon_price_cents",
        "amazon_tax_cents",
        "amazon_shipping_cents",
    )
    @classmethod
    def cents_must_be_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("cents values cannot be negative")
        return v


class RecordUpdate(BaseModel):
    ebay_order_id: Optional[str] = None
    sale_date: Optional[date] = None
    item_name: Optional[str] = None
    qty: Optional[int] = None
    sale_price_cents: Optional[int] = None
    ebay_fees_cents: Optional[int] = None
    amazon_price_cents: Optional[int] = None
    amazon_tax_cents: Optional[int] = None
    amazon_shipping_cents: Optional[int] = None
    amazon_order_id: Optional[str] = None
    status: Optional[BookkeepingStatus] = None
    return_label_cost_cents: Optional[int] = None

    @field_validator("qty")
    @classmethod
    def qty_must_be_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("qty must be at least 1")
        return v

    @field_validator(
        "sale_price_cents",
        "ebay_fees_cents",
        "amazon_price_cents",
        "amazon_tax_cents",
        "amazon_shipping_cents",
        "return_label_cost_cents",
    )
    @classmethod
    def cents_must_be_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("cents values cannot be negative")
        return v


class RemarkUpdate(BaseModel):
    """Model for updating a remark (order or service)."""

    content: Optional[str] = None


class RecordResponse(BaseModel):
    id: str
    account_id: str
    ebay_order_id: str
    sale_date: date
    item_name: str
    qty: int
    sale_price_cents: int
    ebay_fees_cents: Optional[int] = None
    amazon_price_cents: Optional[int] = None
    amazon_tax_cents: Optional[int] = None
    amazon_shipping_cents: Optional[int] = None
    amazon_order_id: Optional[str] = None
    status: BookkeepingStatus
    return_label_cost_cents: Optional[int] = None
    # Computed fields
    earnings_net_cents: int
    cogs_total_cents: int
    profit_cents: int
    # Remarks (null if user doesn't have access)
    order_remark: Optional[str] = None
    service_remark: Optional[str] = None

    @classmethod
    def from_db(
        cls,
        data: dict,
        order_remark: Optional[str] = None,
        service_remark: Optional[str] = None,
    ) -> "RecordResponse":
        """Create RecordResponse from database row, computing derived fields."""
        status = data["status"]

        # Extract values with defaults
        sale = data["sale_price_cents"] or 0
        fees = data.get("ebay_fees_cents") or 0
        amazon_price = data.get("amazon_price_cents") or 0
        amazon_tax = data.get("amazon_tax_cents") or 0
        amazon_shipping = data.get("amazon_shipping_cents") or 0
        return_label = data.get("return_label_cost_cents") or 0

        # Compute earnings_net = sale - fees
        earnings_net = sale - fees

        # Compute cogs_total = amazon_price + amazon_tax + amazon_shipping
        cogs_total = amazon_price + amazon_tax + amazon_shipping

        # Compute profit based on status
        if status == "RETURN_CLOSED":
            # Profit should equal return label cost impact.
            # return_label_cost_cents is stored as a positive COST, so profit impact is negative.
            profit = -return_label
        elif status == "SUCCESSFUL":
            profit = sale - fees - amazon_price - amazon_tax - amazon_shipping
        else:
            # Includes REFUND_NO_RETURN and any other non-successful statuses
            profit = sale - fees - amazon_price - amazon_tax - amazon_shipping - return_label

        return cls(
            id=data["id"],
            account_id=data["account_id"],
            ebay_order_id=data["ebay_order_id"],
            sale_date=data["sale_date"],
            item_name=data["item_name"],
            qty=data["qty"],
            sale_price_cents=data["sale_price_cents"],
            ebay_fees_cents=data.get("ebay_fees_cents"),
            amazon_price_cents=data.get("amazon_price_cents"),
            amazon_tax_cents=data.get("amazon_tax_cents"),
            amazon_shipping_cents=data.get("amazon_shipping_cents"),
            amazon_order_id=data.get("amazon_order_id"),
            status=data["status"],
            return_label_cost_cents=data.get("return_label_cost_cents"),
            earnings_net_cents=earnings_net,
            cogs_total_cents=cogs_total,
            profit_cents=profit,
            order_remark=order_remark,
            service_remark=service_remark,
        )


# ============================================================
# Account Management Models
# ============================================================


class AccountCreate(BaseModel):
    """Request body for creating an account."""

    account_code: str
    name: Optional[str] = None
    client_user_id: Optional[UUID] = None
    admin_remarks: Optional[str] = None


class AccountUpdate(BaseModel):
    """Request body for updating an account."""

    name: Optional[str] = None
    client_user_id: Optional[UUID] = None
    admin_remarks: Optional[str] = None


class AccountAssignmentCreate(BaseModel):
    """Request body for creating an account assignment."""

    user_id: UUID


class AccountAssignmentResponse(BaseModel):
    """Account assignment data in API responses."""

    account_id: UUID
    user_id: UUID
    created_at: Optional[datetime] = None


class AdminAccountResponse(BaseModel):
    """Account data for admin API responses (IDs only - frontend maps to display names)."""

    id: UUID
    account_code: str
    name: Optional[str] = None
    client_user_id: Optional[UUID] = None
    assignment_count: int = 0
    created_at: Optional[datetime] = None
    admin_remarks: Optional[str] = None


class AdminAccountListResponse(BaseModel):
    """Paginated account list response."""

    accounts: list[AdminAccountResponse]
    total: int
    page: int
    page_size: int


# ============================================================
# Automation Hub Models
# ============================================================


class AgentRole(str, Enum):
    EBAY_AGENT = "EBAY_AGENT"
    AMAZON_AGENT = "AMAZON_AGENT"


class AgentStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    REVOKED = "revoked"
    OFFLINE = "offline"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVOKED = "revoked"
    REPLACING = "replacing"


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    CLAIMED = "CLAIMED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED_RETRYABLE = "FAILED_RETRYABLE"
    FAILED_NEEDS_ATTENTION = "FAILED_NEEDS_ATTENTION"
    EXPIRED = "EXPIRED"


# ============================================================
# Pairing Request Models (Extension-initiated flow)
# ============================================================


class PairingRequestCreate(BaseModel):
    """Request body for extension requesting pairing."""

    install_instance_id: str
    ebay_account_key: Optional[str] = None
    amazon_account_key: Optional[str] = None
    ebay_account_display: Optional[str] = None
    amazon_account_display: Optional[str] = None


class PairingRequestResponse(BaseModel):
    """Response from pairing request endpoint."""

    device_status: str  # 'cooldown', 'pending', 'created', 'auto_approved'
    request_id: Optional[UUID] = None
    status: Optional[str] = None
    next_allowed_at: Optional[datetime] = None
    cooldown_seconds: int = 0
    lifetime_request_count: int = 0
    expires_at: Optional[datetime] = None  # When request expires (15 min)
    # Auto-approve response fields
    agent_id: Optional[UUID] = None
    install_token: Optional[str] = None
    role: Optional[AgentRole] = None
    label: Optional[str] = None
    account_id: Optional[UUID] = None  # For presence tracking on clock-in
    account_name: Optional[str] = None
    requires_checkin: bool = False
    checkin_deadline_seconds: int = 0


class PendingRequestResponse(BaseModel):
    """Pending pairing request for admin view."""

    id: UUID
    install_instance_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None  # When request expires (15 min)
    lifetime_request_count: int  # From automation_devices
    # Detected account info
    ebay_account_key: Optional[str] = None
    amazon_account_key: Optional[str] = None
    ebay_account_display: Optional[str] = None
    amazon_account_display: Optional[str] = None
    detected_role: Optional[AgentRole] = None


class PendingRequestListResponse(BaseModel):
    """List of pending pairing requests."""

    requests: list[PendingRequestResponse]


class ApprovalRequest(BaseModel):
    """Request body for approving a pairing request."""

    account_id: Optional[UUID] = None  # Required for EBAY_AGENT (or auto-created)
    ebay_agent_id: Optional[UUID] = None  # Required for AMAZON_AGENT
    role: AgentRole
    label: Optional[str] = None


class ApprovalResponse(BaseModel):
    """Response from approving a pairing request."""

    agent_id: UUID
    message: str = "Request approved and agent created"


class RejectionRequest(BaseModel):
    """Request body for rejecting a pairing request."""

    reason: Optional[str] = None


# ============================================================
# Available Accounts for Automation (from existing accounts table)
# ============================================================


class AvailableAccountResponse(BaseModel):
    """Account available for agent assignment (from existing accounts table)."""

    id: UUID
    account_code: str
    name: Optional[str] = None


class AvailableAccountListResponse(BaseModel):
    """List of available accounts for automation agent assignment."""

    accounts: list[AvailableAccountResponse]


class AvailableEbayAgentResponse(BaseModel):
    """eBay agent available for Amazon agent assignment."""

    id: UUID
    account_id: UUID
    account_code: str
    account_name: Optional[str] = None
    label: Optional[str] = None


class AvailableEbayAgentListResponse(BaseModel):
    """List of available eBay agents for Amazon agent assignment."""

    ebay_agents: list[AvailableEbayAgentResponse]


# ============================================================
# Pairing Status Poll Models (for extension)
# ============================================================


class PairingPollResponse(BaseModel):
    """Response from polling pairing status (extension)."""

    status: str  # 'pending', 'approved', 'rejected', 'expired', 'not_found'
    agent_id: Optional[UUID] = None
    install_token: Optional[str] = None
    role: Optional[AgentRole] = None
    label: Optional[str] = None
    account_id: Optional[UUID] = None  # For presence tracking on clock-in
    account_name: Optional[str] = None
    rejection_reason: Optional[str] = None
    expires_at: Optional[datetime] = None


# ============================================================
# Agent Models
# ============================================================


class AgentUpdate(BaseModel):
    """Request body for updating an agent."""

    label: Optional[str] = None
    status: Optional[AgentStatus] = None


class AgentStatusUpdate(BaseModel):
    """Request body for updating agent status (by agent itself)."""

    status: AgentStatus


class AgentResponse(BaseModel):
    """Agent data in API responses."""

    id: UUID
    org_id: UUID
    account_id: Optional[UUID] = None  # For eBay agents (links to accounts)
    account_code: Optional[str] = None  # From accounts table
    account_name: Optional[str] = None  # From accounts table (may be null)
    ebay_agent_id: Optional[UUID] = None  # For Amazon agents (links to eBay agent)
    role: Optional[AgentRole] = None
    label: Optional[str] = None
    install_instance_id: str
    status: AgentStatus
    approval_status: ApprovalStatus = ApprovalStatus.APPROVED
    ebay_account_key: Optional[str] = None
    amazon_account_key: Optional[str] = None
    ebay_account_display: Optional[str] = None
    amazon_account_display: Optional[str] = None
    replaced_by_id: Optional[UUID] = None
    replaced_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class AgentListResponse(BaseModel):
    """List of agents."""

    agents: list[AgentResponse]


# Job Models
class JobCreate(BaseModel):
    """Request body for creating a job (eBay agent)."""

    ebay_order_id: str
    item_name: Optional[str] = None
    qty: int = 1
    sale_price_cents: Optional[int] = None
    ebay_fees_cents: Optional[int] = None
    sale_date: Optional[date] = None
    auto_order_url: str

    @field_validator("qty")
    @classmethod
    def qty_must_be_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("qty must be at least 1")
        return v


class JobCreateResponse(BaseModel):
    """Response from creating a job."""

    job_id: UUID
    status: JobStatus


class JobClaimResponse(BaseModel):
    """Response from claiming a job."""

    job: Optional["JobResponse"] = None


class JobComplete(BaseModel):
    """Request body for completing a job."""

    amazon_order_id: str
    amazon_price_cents: int
    amazon_tax_cents: Optional[int] = None
    amazon_shipping_cents: Optional[int] = None

    @field_validator("amazon_price_cents")
    @classmethod
    def price_must_be_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("amazon_price_cents cannot be negative")
        return v


class JobFail(BaseModel):
    """Request body for reporting a job failure."""

    reason: str
    details: Optional[str] = None


class JobFailResponse(BaseModel):
    """Response from failing a job."""

    ok: bool
    requeued: bool
    status: JobStatus


class JobResponse(BaseModel):
    """Job data in API responses."""

    id: UUID
    org_id: UUID
    status: JobStatus
    attempt_count: int
    ebay_order_id: str
    item_name: Optional[str] = None
    qty: Optional[int] = None
    sale_price_cents: Optional[int] = None
    ebay_fees_cents: Optional[int] = None
    sale_date: Optional[date] = None
    auto_order_url: str
    amazon_order_id: Optional[str] = None
    amazon_price_cents: Optional[int] = None
    amazon_tax_cents: Optional[int] = None
    amazon_shipping_cents: Optional[int] = None
    created_by_agent_id: Optional[UUID] = None
    claimed_by_agent_id: Optional[UUID] = None
    claimed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    failure_details: Optional[str] = None
    created_at: Optional[datetime] = None


class JobListResponse(BaseModel):
    """Paginated list of jobs."""

    jobs: list[JobResponse]
    total: int
    page: int
    page_size: int


# Update forward reference
JobClaimResponse.model_rebuild()


# ============================================================
# Agent Checkin Models
# ============================================================


class AgentCheckinResponse(BaseModel):
    """Response from agent checkin endpoint."""

    ok: bool
    status: ApprovalStatus
    message: str = ""


# ============================================================
# Access Code Models
# ============================================================


class AccessCodeGenerateRequest(BaseModel):
    """Request body for generating an access code."""

    custom_secret: Optional[str] = None  # If provided, use instead of random


class AccessCodeGenerateResponse(BaseModel):
    """Response from generating an access code.

    Note: full_code is returned ONLY on generation. It cannot be retrieved later.
    """

    prefix: str  # 4-char prefix (always visible)
    full_code: str  # prefix-secret (shown once, then only prefix visible)
    expires_at: datetime


class AccessCodeRotateRequest(BaseModel):
    """Request body for rotating an access code secret."""

    custom_secret: Optional[str] = None  # If provided, use instead of random


class AccessCodeRotateResponse(BaseModel):
    """Response from rotating an access code."""

    prefix: str
    full_code: str
    rotated_at: datetime
    expires_at: datetime


class AccessCodeInfoResponse(BaseModel):
    """Access code info (without secret)."""

    prefix: str
    created_at: datetime
    expires_at: datetime
    rotated_at: Optional[datetime] = None


class RoleResponse(BaseModel):
    """Role data in access code validation response."""

    id: str
    name: str
    priority: int
    permission_keys: list[str]


class AccessCodeUserContext(BaseModel):
    """User context returned on successful validation."""

    id: str
    name: Optional[str] = None
    email: str
    user_type: str  # "admin" | "va"
    org_id: str
    is_admin: bool


class AccessCodeValidateRequest(BaseModel):
    """Request body for validating an access code."""

    code: str  # Full code: prefix-secret
    account_id: str | None = None  # Optional account to clock into (records presence)


class AccessCodeValidateResponse(BaseModel):
    """Response from successful access code validation."""

    access_token: str
    expires_in: int  # seconds
    user: AccessCodeUserContext
    roles: list[RoleResponse]
    effective_permission_keys: list[str]
    rbac_version: str  # ISO timestamp of last permission change


class AccessCodeErrorResponse(BaseModel):
    """Response for failed access code validation."""

    error_code: str  # "INVALID_CODE", "ACCOUNT_DISABLED", "RATE_LIMITED", "CODE_EXPIRED"
    message: str  # User-facing message
    retry_after: Optional[int] = None  # Seconds until retry allowed (for rate limit)


# ============================================================
# Collection Models
# ============================================================


class CollectionRunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CollectionSettingsResponse(BaseModel):
    """Current collection settings."""

    max_concurrent_runs: int


class CollectionSettingsUpdate(BaseModel):
    """Update collection settings."""

    max_concurrent_runs: Optional[int] = None


class CollectionRunCreate(BaseModel):
    """Create a new collection run."""

    name: Optional[str] = None  # Auto-generated if blank
    category_ids: list[str]


class CollectionRunResponse(BaseModel):
    """Collection run details."""

    id: str
    name: str
    status: CollectionRunStatus
    total_items: int
    processed_items: int
    failed_items: int
    category_ids: list[str]
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    paused_at: Optional[str] = None
    created_by: str
    created_at: str


class CollectionRunListResponse(BaseModel):
    """List of collection runs."""

    runs: list[CollectionRunResponse]
    total: int


# ============================================================
# Seller Management Models
# ============================================================


class SellerCreate(BaseModel):
    """Request body for creating a seller."""

    name: str


class SellerUpdate(BaseModel):
    """Request body for updating a seller."""

    name: str


class SellerResponse(BaseModel):
    """Seller data in API responses."""

    id: str
    display_name: str
    normalized_name: str
    platform: str
    platform_id: Optional[str] = None
    times_seen: int
    first_seen_run_id: Optional[str] = None
    last_seen_run_id: Optional[str] = None
    created_at: datetime


class SellerListResponse(BaseModel):
    """Paginated seller list response."""

    sellers: list[SellerResponse]
    total: int


class SellerExportItem(BaseModel):
    """Single seller in export format."""

    display_name: str
    platform: str
    feedback_score: Optional[int] = None
    times_seen: int
    discovered_at: datetime
    first_seen_run_id: Optional[str] = None


class SellerExportResponse(BaseModel):
    """JSON export format."""

    exported_at: datetime
    run_id: Optional[str] = None
    count: int
    sellers: list[SellerExportItem]


# ============================================================
# Seller Audit Log Models
# ============================================================


class AuditLogEntry(BaseModel):
    """Audit log entry for seller changes."""

    id: str
    action: Literal["add", "edit", "remove"]
    seller_name: str
    source: Literal["manual", "collection_run", "auto_remove"]
    source_run_id: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime
    affected_count: int


class AuditLogResponse(BaseModel):
    """Paginated audit log response."""

    entries: list[AuditLogEntry]
    total: int


# ============================================================
# Seller Diff Models
# ============================================================


class SellerDiff(BaseModel):
    """Diff between two seller snapshots."""

    added: list[str]  # Seller names added
    removed: list[str]  # Seller names removed
    added_count: int
    removed_count: int


class DiffRequest(BaseModel):
    """Request body for calculating diff between seller snapshots."""

    source: Literal["log", "current"]
    source_id: Optional[str] = None  # Log ID if source is "log"
    target: Literal["log", "current"]
    target_id: Optional[str] = None  # Log ID if target is "log"


# ============================================================
# Run Template Models
# ============================================================


class RunTemplateCreate(BaseModel):
    """Request body for creating a run template."""

    name: str
    description: Optional[str] = None
    department_ids: list[str] = []
    concurrency: int = 3
    is_default: bool = False


class RunTemplateUpdate(BaseModel):
    """Request body for updating a run template."""

    name: Optional[str] = None
    description: Optional[str] = None
    department_ids: Optional[list[str]] = None
    concurrency: Optional[int] = None
    is_default: Optional[bool] = None


class RunTemplateResponse(BaseModel):
    """Run template data in API responses."""

    id: str
    name: str
    description: Optional[str] = None
    department_ids: list[str]
    concurrency: int
    is_default: bool
    created_at: datetime


class RunTemplateListResponse(BaseModel):
    """List of run templates response."""

    templates: list[RunTemplateResponse]


# ============================================================
# Enhanced Progress Models
# ============================================================


class WorkerStatus(BaseModel):
    """Status of a single collection worker."""

    worker_id: int
    department: str
    category: str
    product: Optional[str] = None
    status: Literal["idle", "fetching", "searching", "complete"]


class EnhancedProgress(BaseModel):
    """Detailed progress for a collection run."""

    # Hierarchical counts
    departments_total: int
    departments_completed: int
    categories_total: int
    categories_completed: int
    products_total: int
    products_searched: int
    sellers_found: int
    sellers_new: int
    # Workers
    worker_status: list[WorkerStatus]


# ============================================================
# Amazon Category Presets
# ============================================================


class CategoryPresetCreate(BaseModel):
    """Request to create a category preset."""

    name: str
    category_ids: list[str]


class CategoryPresetResponse(BaseModel):
    """Category preset response."""

    id: str
    name: str
    category_ids: list[str]
    is_builtin: bool
    created_at: str


class CategoryPresetListResponse(BaseModel):
    """List of category presets."""

    presets: list[CategoryPresetResponse]


class AmazonCategory(BaseModel):
    """Single Amazon category."""

    id: str
    name: str
    node_id: str


class AmazonDepartment(BaseModel):
    """Amazon department with child categories."""

    id: str
    name: str
    node_id: str
    categories: list[AmazonCategory]


class AmazonCategoriesResponse(BaseModel):
    """Response containing all Amazon departments and categories."""

    departments: list[AmazonDepartment]


# ============================================================
# Collection History Models
# ============================================================


class CollectionHistoryEntry(BaseModel):
    """Single entry in collection history with full statistics."""

    id: str
    name: str
    status: CollectionRunStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    categories_count: int
    products_total: int
    products_searched: int
    sellers_found: int
    sellers_new: int
    cost_cents: int
    failed_items: int
    created_by: str


class CollectionHistoryResponse(BaseModel):
    """Paginated collection history response."""

    runs: list[CollectionHistoryEntry]
    total: int
