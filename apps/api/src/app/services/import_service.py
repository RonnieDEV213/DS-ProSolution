"""
Import service for data import with validation, column mapping, and batch tracking.

Provides:
- File parsing for CSV, JSON, Excel formats
- Smart column mapping using string similarity
- Row validation against RecordCreate model
- Batch tracking for rollback capability
- Rollback with modified record detection
"""

import io
import logging
import uuid
from datetime import date, datetime, timezone
from difflib import SequenceMatcher
from typing import Any, Optional

import pandas as pd

from app.models import (
    BookkeepingStatus,
    ImportFormat,
    ImportPreviewRow,
    ImportValidationError,
    ImportRollbackWarning,
)

logger = logging.getLogger(__name__)


# Expected database fields and their common aliases for column mapping
EXPECTED_FIELDS = {
    "ebay_order_id": [
        "ebay order",
        "order id",
        "ebay_order_id",
        "orderid",
        "ebay order id",
        "order_id",
    ],
    "sale_date": [
        "sale date",
        "date",
        "order date",
        "sale_date",
        "saledate",
        "sold date",
    ],
    "item_name": [
        "item",
        "item name",
        "product",
        "title",
        "item_name",
        "product name",
        "description",
    ],
    "qty": ["quantity", "qty", "amount", "count", "units"],
    "sale_price_cents": [
        "sale price",
        "price",
        "sale_price",
        "total",
        "sale_price_cents",
        "sale amount",
    ],
    "ebay_fees_cents": [
        "ebay fees",
        "fees",
        "ebay_fees_cents",
        "ebay fee",
        "platform fees",
    ],
    "amazon_price_cents": [
        "amazon price",
        "cost",
        "amazon_price_cents",
        "purchase price",
        "cogs",
    ],
    "amazon_tax_cents": [
        "amazon tax",
        "tax",
        "amazon_tax_cents",
        "sales tax",
    ],
    "amazon_shipping_cents": [
        "amazon shipping",
        "shipping",
        "amazon_shipping_cents",
        "shipping cost",
    ],
    "amazon_order_id": [
        "amazon order",
        "amazon_order_id",
        "amazon order id",
        "purchase order",
    ],
    "order_remark": [
        "order remark",
        "order_remark",
        "notes",
        "order notes",
        "remarks",
    ],
    "status": ["status", "state", "order status"],
}

# Required fields for validation
REQUIRED_FIELDS = ["ebay_order_id", "sale_date", "item_name", "sale_price_cents"]

# Valid status values
VALID_STATUSES = set(s.value for s in BookkeepingStatus)


def suggest_column_mapping(headers: list[str]) -> dict[str, str]:
    """
    Suggest column mappings based on header similarity.

    Uses difflib.SequenceMatcher for fuzzy matching with 70% threshold.

    Args:
        headers: List of column headers from uploaded file

    Returns:
        Dict mapping CSV header -> DB field name
    """
    mapping: dict[str, str] = {}

    for header in headers:
        header_lower = header.lower().strip()

        # Try exact match first
        matched = False
        for field, aliases in EXPECTED_FIELDS.items():
            if header_lower in [a.lower() for a in aliases]:
                mapping[header] = field
                matched = True
                break

        # Try fuzzy match if no exact match
        if not matched:
            best_match: Optional[str] = None
            best_score = 0.0

            for field, aliases in EXPECTED_FIELDS.items():
                for alias in aliases:
                    score = SequenceMatcher(None, header_lower, alias.lower()).ratio()
                    if score > best_score and score > 0.7:  # 70% threshold
                        best_score = score
                        best_match = field

            if best_match:
                mapping[header] = best_match

    return mapping


def validate_import_file(
    file_content: bytes, format: ImportFormat
) -> tuple[pd.DataFrame, int]:
    """
    Parse import file and return preview DataFrame with total row count.

    Args:
        file_content: Raw file bytes
        format: File format (csv, json, excel)

    Returns:
        Tuple of (preview DataFrame of first 100 rows, total row count)

    Raises:
        ValueError: If file cannot be parsed
    """
    try:
        if format == ImportFormat.CSV:
            # Try UTF-8 first, fallback to latin-1
            try:
                df_full = pd.read_csv(io.BytesIO(file_content), encoding="utf-8")
            except UnicodeDecodeError:
                df_full = pd.read_csv(io.BytesIO(file_content), encoding="latin-1")

        elif format == ImportFormat.JSON:
            df_full = pd.read_json(io.BytesIO(file_content))

        elif format == ImportFormat.EXCEL:
            df_full = pd.read_excel(io.BytesIO(file_content))

        else:
            raise ValueError(f"Unsupported format: {format}")

        total_rows = len(df_full)
        preview_df = df_full.head(100).copy()

        return preview_df, total_rows

    except pd.errors.EmptyDataError:
        raise ValueError("File is empty")
    except pd.errors.ParserError as e:
        raise ValueError(f"Failed to parse file: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error reading file: {str(e)}")


def _parse_date(value: Any) -> Optional[date]:
    """Parse a date value from various formats."""
    if pd.isna(value):
        return None

    if isinstance(value, date):
        return value

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, str):
        value = value.strip()
        # Try common date formats
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue

    return None


def _parse_cents(value: Any) -> Optional[int]:
    """Parse a monetary value to cents."""
    if pd.isna(value):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        # Assume it's dollars, convert to cents
        return int(round(value * 100))

    if isinstance(value, str):
        value = value.strip().replace("$", "").replace(",", "")
        try:
            # Try as cents first
            if "." not in value:
                return int(value)
            # Otherwise treat as dollars
            return int(round(float(value) * 100))
        except ValueError:
            return None

    return None


def _parse_status(value: Any) -> Optional[str]:
    """Parse and validate status value."""
    if pd.isna(value):
        return BookkeepingStatus.SUCCESSFUL.value  # Default

    if isinstance(value, str):
        value_upper = value.strip().upper()
        # Handle common variations
        if value_upper in VALID_STATUSES:
            return value_upper
        # Try mapping common names
        status_map = {
            "SUCCESS": "SUCCESSFUL",
            "OK": "SUCCESSFUL",
            "COMPLETED": "SUCCESSFUL",
            "RETURN": "RETURN_LABEL_PROVIDED",
            "REFUND": "REFUND_NO_RETURN",
            "CLOSED": "RETURN_CLOSED",
        }
        if value_upper in status_map:
            return status_map[value_upper]

    return None


def validate_rows(
    df: pd.DataFrame, mapping: dict[str, str]
) -> list[ImportPreviewRow]:
    """
    Validate rows against RecordCreate model.

    Args:
        df: DataFrame with data to validate
        mapping: Column mapping (CSV header -> DB field)

    Returns:
        List of ImportPreviewRow with validation results
    """
    results: list[ImportPreviewRow] = []
    reverse_mapping = {v: k for k, v in mapping.items()}

    for idx, row in df.iterrows():
        row_number = int(idx) + 2  # Excel row (1-indexed + header)
        errors: list[ImportValidationError] = []
        mapped_data: dict[str, Any] = {}

        # Map columns
        for csv_header, db_field in mapping.items():
            if csv_header in row:
                mapped_data[db_field] = row[csv_header]

        # Validate required fields
        for field in REQUIRED_FIELDS:
            if field not in mapped_data or pd.isna(mapped_data.get(field)):
                csv_col = reverse_mapping.get(field, field)
                errors.append(
                    ImportValidationError(
                        row=row_number,
                        field=field,
                        message=f"Required field '{csv_col}' is missing",
                    )
                )

        # Validate sale_date format
        if "sale_date" in mapped_data:
            parsed_date = _parse_date(mapped_data["sale_date"])
            if parsed_date is None and not pd.isna(mapped_data["sale_date"]):
                errors.append(
                    ImportValidationError(
                        row=row_number,
                        field="sale_date",
                        message="Invalid date format. Use YYYY-MM-DD",
                    )
                )
            else:
                mapped_data["sale_date"] = (
                    parsed_date.isoformat() if parsed_date else None
                )

        # Validate numeric fields (cents)
        for field in [
            "sale_price_cents",
            "ebay_fees_cents",
            "amazon_price_cents",
            "amazon_tax_cents",
            "amazon_shipping_cents",
        ]:
            if field in mapped_data and not pd.isna(mapped_data.get(field)):
                parsed_cents = _parse_cents(mapped_data[field])
                if parsed_cents is None:
                    errors.append(
                        ImportValidationError(
                            row=row_number,
                            field=field,
                            message=f"Invalid numeric value for {field}",
                        )
                    )
                elif parsed_cents < 0:
                    errors.append(
                        ImportValidationError(
                            row=row_number,
                            field=field,
                            message=f"{field} cannot be negative",
                        )
                    )
                else:
                    mapped_data[field] = parsed_cents

        # Validate qty
        if "qty" in mapped_data and not pd.isna(mapped_data.get("qty")):
            try:
                qty = int(mapped_data["qty"])
                if qty < 1:
                    errors.append(
                        ImportValidationError(
                            row=row_number,
                            field="qty",
                            message="Quantity must be at least 1",
                        )
                    )
                else:
                    mapped_data["qty"] = qty
            except (ValueError, TypeError):
                errors.append(
                    ImportValidationError(
                        row=row_number,
                        field="qty",
                        message="Invalid quantity value",
                    )
                )
        else:
            mapped_data["qty"] = 1  # Default

        # Validate status
        if "status" in mapped_data:
            parsed_status = _parse_status(mapped_data["status"])
            if parsed_status is None and not pd.isna(mapped_data.get("status")):
                errors.append(
                    ImportValidationError(
                        row=row_number,
                        field="status",
                        message=f"Invalid status. Use: {', '.join(VALID_STATUSES)}",
                    )
                )
            else:
                mapped_data["status"] = parsed_status or BookkeepingStatus.SUCCESSFUL.value
        else:
            mapped_data["status"] = BookkeepingStatus.SUCCESSFUL.value

        # Clean up NaN values in mapped_data for JSON serialization
        clean_data = {
            k: (None if pd.isna(v) else v) for k, v in mapped_data.items()
        }

        results.append(
            ImportPreviewRow(
                row_number=row_number,
                data=clean_data,
                is_valid=len(errors) == 0,
                errors=errors,
            )
        )

    return results


def parse_full_file(
    file_content: bytes, format: ImportFormat, mapping: dict[str, str]
) -> tuple[list[dict[str, Any]], list[ImportValidationError]]:
    """
    Parse entire file and validate all rows.

    Args:
        file_content: Raw file bytes
        format: File format
        mapping: Column mapping

    Returns:
        Tuple of (list of valid mapped records, list of all errors)
    """
    try:
        if format == ImportFormat.CSV:
            try:
                df = pd.read_csv(io.BytesIO(file_content), encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(file_content), encoding="latin-1")
        elif format == ImportFormat.JSON:
            df = pd.read_json(io.BytesIO(file_content))
        elif format == ImportFormat.EXCEL:
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            raise ValueError(f"Unsupported format: {format}")

        validated_rows = validate_rows(df, mapping)
        all_errors = []
        valid_records = []

        for row in validated_rows:
            all_errors.extend(row.errors)
            if row.is_valid:
                valid_records.append(row.data)

        return valid_records, all_errors

    except Exception as e:
        raise ValueError(f"Error parsing file: {str(e)}")


def commit_import(
    supabase,
    account_id: str,
    user_id: str,
    org_id: str,
    data: list[dict[str, Any]],
    filename: str,
    format: str,
    mapping: dict[str, str],
) -> str:
    """
    Commit import data to database with batch tracking.

    All-or-nothing: if any row fails, entire import fails.

    Args:
        supabase: Supabase client
        account_id: Account to import into
        user_id: User performing import
        org_id: Organization ID
        data: List of validated record dicts
        filename: Original filename
        format: File format used
        mapping: Column mapping used

    Returns:
        batch_id on success

    Raises:
        ValueError: If import fails
    """
    batch_id = str(uuid.uuid4())

    # Create import_batch record
    batch_result = supabase.table("import_batches").insert(
        {
            "id": batch_id,
            "user_id": user_id,
            "org_id": org_id,
            "account_id": account_id,
            "filename": filename,
            "row_count": len(data),
            "format": format,
            "column_mapping": mapping,
        }
    ).execute()

    if not batch_result.data:
        raise ValueError("Failed to create import batch record")

    try:
        # Prepare records for insertion
        records_to_insert = []
        for record in data:
            # Build record dict with required fields
            db_record = {
                "account_id": account_id,
                "import_batch_id": batch_id,
                "ebay_order_id": record.get("ebay_order_id"),
                "sale_date": record.get("sale_date"),
                "item_name": record.get("item_name"),
                "qty": record.get("qty", 1),
                "sale_price_cents": record.get("sale_price_cents"),
                "status": record.get("status", BookkeepingStatus.SUCCESSFUL.value),
            }

            # Add optional fields
            for field in [
                "ebay_fees_cents",
                "amazon_price_cents",
                "amazon_tax_cents",
                "amazon_shipping_cents",
                "amazon_order_id",
            ]:
                if record.get(field) is not None:
                    db_record[field] = record[field]

            records_to_insert.append(db_record)

        # Insert all records
        insert_result = supabase.table("bookkeeping_records").insert(
            records_to_insert
        ).execute()

        if not insert_result.data:
            raise ValueError("Failed to insert records")

        logger.info(
            f"Import committed: batch_id={batch_id}, rows={len(records_to_insert)}"
        )
        return batch_id

    except Exception as e:
        # Rollback: delete the batch record
        logger.error(f"Import failed, rolling back: {e}")
        supabase.table("import_batches").delete().eq("id", batch_id).execute()
        raise ValueError(f"Import failed: {str(e)}")


def check_rollback_eligibility(
    supabase, batch_id: str
) -> tuple[bool, Optional[ImportRollbackWarning]]:
    """
    Check if a batch can be rolled back.

    Args:
        supabase: Supabase client
        batch_id: Import batch ID

    Returns:
        Tuple of (can_rollback, warning_if_modified)

    Raises:
        ValueError: If batch not found
    """
    # Fetch batch
    batch_result = (
        supabase.table("import_batches")
        .select("id, can_rollback, created_at, rolled_back_at")
        .eq("id", batch_id)
        .execute()
    )

    if not batch_result.data:
        raise ValueError("Import batch not found")

    batch = batch_result.data[0]

    # Check if already rolled back
    if batch.get("rolled_back_at"):
        return False, ImportRollbackWarning(
            warning="This batch has already been rolled back",
            modified_count=0,
            modified_record_ids=[],
            requires_confirmation=False,
        )

    # Check if can_rollback is False (disabled manually or > 24h old)
    if not batch.get("can_rollback"):
        return False, ImportRollbackWarning(
            warning="Rollback is no longer available for this batch (> 24 hours old or disabled)",
            modified_count=0,
            modified_record_ids=[],
            requires_confirmation=False,
        )

    # Check 24-hour window
    created_at = batch.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

    now = datetime.now(timezone.utc)
    age_hours = (now - created_at).total_seconds() / 3600

    if age_hours > 24:
        return False, ImportRollbackWarning(
            warning="Rollback window (24 hours) has expired",
            modified_count=0,
            modified_record_ids=[],
            requires_confirmation=False,
        )

    # Check for modified records
    records_result = (
        supabase.table("bookkeeping_records")
        .select("id, updated_at, created_at")
        .eq("import_batch_id", batch_id)
        .is_("deleted_at", "null")
        .execute()
    )

    records = records_result.data or []
    modified_records = []

    for record in records:
        updated_at = record.get("updated_at")
        created_at = record.get("created_at")

        # Compare timestamps - if updated_at > created_at, record was modified
        if updated_at and created_at:
            # Handle string timestamps
            if isinstance(updated_at, str):
                updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

            # Allow small difference (1 second) for database timestamp precision
            time_diff = (updated_at - created_at).total_seconds()
            if time_diff > 1:
                modified_records.append(record["id"])

    if modified_records:
        return True, ImportRollbackWarning(
            warning=f"{len(modified_records)} record(s) were modified since import",
            modified_count=len(modified_records),
            modified_record_ids=modified_records,
            requires_confirmation=True,
        )

    return True, None


def rollback_import(supabase, batch_id: str, force: bool = False) -> int:
    """
    Rollback an import by soft-deleting all records in the batch.

    Args:
        supabase: Supabase client
        batch_id: Import batch ID
        force: If True, rollback even if records were modified

    Returns:
        Number of records deleted

    Raises:
        ValueError: If rollback not allowed or batch not found
    """
    can_rollback, warning = check_rollback_eligibility(supabase, batch_id)

    if not can_rollback:
        raise ValueError(warning.warning if warning else "Rollback not allowed")

    if warning and warning.requires_confirmation and not force:
        raise ValueError(
            f"Rollback requires confirmation: {warning.warning}. "
            f"Modified record IDs: {warning.modified_record_ids}"
        )

    # Get records to delete
    records_result = (
        supabase.table("bookkeeping_records")
        .select("id")
        .eq("import_batch_id", batch_id)
        .is_("deleted_at", "null")
        .execute()
    )

    records = records_result.data or []
    record_count = len(records)

    if record_count == 0:
        logger.warning(f"No active records found for batch {batch_id}")
        return 0

    # Soft delete all records in batch
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("bookkeeping_records").update(
        {"deleted_at": now}
    ).eq("import_batch_id", batch_id).is_("deleted_at", "null").execute()

    # Mark batch as rolled back
    supabase.table("import_batches").update(
        {
            "can_rollback": False,
            "rolled_back_at": now,
        }
    ).eq("id", batch_id).execute()

    logger.info(f"Rollback completed: batch_id={batch_id}, records={record_count}")
    return record_count
