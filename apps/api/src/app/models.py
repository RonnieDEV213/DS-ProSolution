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
