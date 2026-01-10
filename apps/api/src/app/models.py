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
    cogs_cents: Optional[int] = None
    tax_paid_cents: Optional[int] = None
    amazon_order_id: Optional[str] = None
    remarks: Optional[str] = None
    status: BookkeepingStatus = BookkeepingStatus.SUCCESSFUL
    return_label_cost_cents: Optional[int] = None


class RecordUpdate(BaseModel):
    ebay_order_id: Optional[str] = None
    sale_date: Optional[date] = None
    item_name: Optional[str] = None
    qty: Optional[int] = None
    sale_price_cents: Optional[int] = None
    ebay_fees_cents: Optional[int] = None
    cogs_cents: Optional[int] = None
    tax_paid_cents: Optional[int] = None
    amazon_order_id: Optional[str] = None
    remarks: Optional[str] = None
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
        "cogs_cents",
        "tax_paid_cents",
        "return_label_cost_cents",
    )
    @classmethod
    def cents_must_be_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("cents values cannot be negative")
        return v


class RecordResponse(BaseModel):
    id: str
    account_id: str
    ebay_order_id: str
    sale_date: date
    item_name: str
    qty: int
    sale_price_cents: int
    ebay_fees_cents: Optional[int] = None
    cogs_cents: Optional[int] = None
    tax_paid_cents: Optional[int] = None
    amazon_order_id: Optional[str] = None
    remarks: Optional[str] = None
    status: BookkeepingStatus
    return_label_cost_cents: Optional[int] = None
    profit_cents: int  # Computed field

    @classmethod
    def from_db(cls, data: dict) -> "RecordResponse":
        """Create RecordResponse from database row, computing profit."""
        status = data["status"]
        if status == "RETURN_CLOSED":
            profit = 0
        elif status == "REFUND_NO_RETURN":
            profit = -(
                (data.get("cogs_cents") or 0)
                + (data.get("tax_paid_cents") or 0)
                + (data.get("return_label_cost_cents") or 0)
            )
        else:
            profit = data["sale_price_cents"] - (
                (data.get("ebay_fees_cents") or 0)
                + (data.get("cogs_cents") or 0)
                + (data.get("tax_paid_cents") or 0)
                + (data.get("return_label_cost_cents") or 0)
            )
        return cls(
            id=data["id"],
            account_id=data["account_id"],
            ebay_order_id=data["ebay_order_id"],
            sale_date=data["sale_date"],
            item_name=data["item_name"],
            qty=data["qty"],
            sale_price_cents=data["sale_price_cents"],
            ebay_fees_cents=data.get("ebay_fees_cents"),
            cogs_cents=data.get("cogs_cents"),
            tax_paid_cents=data.get("tax_paid_cents"),
            amazon_order_id=data.get("amazon_order_id"),
            remarks=data.get("remarks"),
            status=data["status"],
            return_label_cost_cents=data.get("return_label_cost_cents"),
            profit_cents=profit,
        )
