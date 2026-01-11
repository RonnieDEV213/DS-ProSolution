from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator


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
            profit = 0
        elif status == "REFUND_NO_RETURN":
            # eBay fees refunded, return_label forced to 0 by trigger
            profit = -cogs_total
        else:
            # SUCCESSFUL or RETURN_LABEL_PROVIDED
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
