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
        "ebay order id",
        "ebay_order_id",
        "ebay order #",
        "ebay order number",
        "ebay #",
        "ebay id",
        "ebay number",
        "order id",
        "order_id",
        "orderid",
        "order #",
        "order number",
    ],
    "sale_date": [
        "sale date",
        "sale_date",
        "saledate",
        "date",
        "order date",
        "sold date",
        "transaction date",
        "sale-date",
        "saledt",
        "dt",
        "sold_date",
        "order_date",
        "date of sale",
        "date_of_sale",
    ],
    "item_name": [
        "item",
        "item name",
        "item_name",
        "product",
        "product name",
        "title",
        "description",
    ],
    "qty": [
        "qty",
        "quantity",
        "amount",
        "count",
        "units",
    ],
    "sale_price_cents": [
        "sale price",
        "sale price (cents)",
        "sale_price_cents",
        "sale_price",
        "price",
        "total",
        "sale amount",
    ],
    "ebay_fees_cents": [
        "ebay fees",
        "ebay fees (cents)",
        "ebay_fees_cents",
        "ebay fee",
        "fees",
        "platform fees",
    ],
    "amazon_price_cents": [
        "amazon price",
        "amazon price (cents)",
        "amazon_price_cents",
        "cost",
        "purchase price",
        "cogs",
        "cost of goods",
        "cost of goods sold",
        "item cost",
        "product cost",
    ],
    "amazon_tax_cents": [
        "amazon tax",
        "amazon tax (cents)",
        "amazon_tax_cents",
        "tax",
        "sales tax",
    ],
    "amazon_shipping_cents": [
        "amazon shipping",
        "amazon shipping (cents)",
        "amazon_shipping_cents",
        "shipping",
        "shipping cost",
    ],
    "amazon_order_id": [
        "amazon order",
        "amazon order id",
        "amazon_order_id",
        "amazon order #",
        "amazon order number",
        "amazon order no",
        "amazon purchase",
        "amazon purchase #",
        "amazon purchase id",
        "amazon purchase number",
        "amazon #",
        "amazon id",
        "amazon no",
        "purchase order",
        "purchase order id",
        "purchase order #",
    ],
    "order_remark": [
        "order remark",
        "order_remark",
        "notes",
        "order notes",
        "remarks",
    ],
    "status": [
        "status",
        "state",
        "order status",
    ],
}

# Required fields for validation
REQUIRED_FIELDS = ["ebay_order_id", "sale_date", "item_name", "sale_price_cents"]

# Valid status values
VALID_STATUSES = set(s.value for s in BookkeepingStatus)


def suggest_column_mapping(headers: list[str]) -> dict[str, str]:
    """
    Suggest column mappings based on header similarity.

    Uses difflib.SequenceMatcher for fuzzy matching with 70% threshold.
    All headers are included in the result - unmatched headers map to empty string.

    Args:
        headers: List of column headers from uploaded file

    Returns:
        Dict mapping CSV header -> DB field name (or empty string if no match)
    """
    mapping: dict[str, str] = {}

    for header in headers:
        # Clean header: strip whitespace, BOM, and normalize
        header_lower = header.lower().strip().lstrip("\ufeff")

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
            else:
                # Include unmatched headers with empty string
                mapping[header] = ""

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
        for fmt in [
            "%Y-%m-%d",      # 2026-01-24
            "%m/%d/%Y",      # 01/24/2026
            "%d/%m/%Y",      # 24/01/2026
            "%Y/%m/%d",      # 2026/01/24
            "%b %d, %Y",     # Jan 24, 2026
            "%B %d, %Y",     # January 24, 2026
            "%d %b %Y",      # 24 Jan 2026
            "%d %B %Y",      # 24 January 2026
            "%m-%d-%Y",      # 01-24-2026
            "%d-%m-%Y",      # 24-01-2026
        ]:
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

    # Convert to string for parsing
    value_str = str(value).strip()

    # Handle empty string
    if not value_str:
        return None

    # Remove various currency symbols and formatting
    # Includes regular $, unicode dollar signs, and other common symbols
    for char in ["$", "¢", "€", "£", "¥", "\u0024", "\uFF04", "\uFE69"]:
        value_str = value_str.replace(char, "")

    # Remove commas, spaces, and other formatting
    value_str = value_str.replace(",", "").replace(" ", "").strip()

    # Handle parentheses for negative numbers (accounting format)
    if value_str.startswith("(") and value_str.endswith(")"):
        value_str = "-" + value_str[1:-1]

    # Handle empty after stripping
    if not value_str:
        return None

    try:
        # Try as cents first (no decimal point)
        if "." not in value_str:
            return int(value_str)
        # Otherwise treat as dollars and convert to cents
        return int(round(float(value_str) * 100))
    except ValueError:
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

        # Map columns (skip empty/skipped mappings)
        for csv_header, db_field in mapping.items():
            if db_field and db_field != "__skip__" and csv_header in row:
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
                raw_value = mapped_data[field]
                parsed_cents = _parse_cents(raw_value)
                if parsed_cents is None:
                    # Show the actual value and type for debugging
                    errors.append(
                        ImportValidationError(
                            row=row_number,
                            field=field,
                            message=f"Invalid numeric value: '{raw_value}' (type: {type(raw_value).__name__})",
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
        # Prepare records for insertion, deduplicating by ebay_order_id
        # (last occurrence wins if duplicates exist in import file)
        records_by_ebay_id: dict[str, dict] = {}
        remarks_by_ebay_id: dict[str, str] = {}  # Track order_remark separately
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

            # Deduplicate by ebay_order_id (last occurrence wins)
            ebay_id = record.get("ebay_order_id")
            if ebay_id:
                records_by_ebay_id[ebay_id] = db_record
                # Track order_remark for later insertion
                if record.get("order_remark"):
                    remarks_by_ebay_id[ebay_id] = record["order_remark"]

        records_to_process = list(records_by_ebay_id.values())

        # Prepare records for RPC (strip account_id and import_batch_id - RPC adds them)
        rpc_records = []
        for record in records_to_process:
            rpc_record = {k: v for k, v in record.items() if k not in ("account_id", "import_batch_id")}
            rpc_records.append(rpc_record)

        # Single RPC call does all upserts (~50-100x faster than sequential HTTP calls)
        rpc_result = supabase.rpc(
            "bulk_upsert_records",
            {
                "p_account_id": account_id,
                "p_batch_id": batch_id,
                "p_records": rpc_records,
            }
        ).execute()

        if not rpc_result.data:
            raise ValueError("Bulk upsert RPC returned no data")

        result = rpc_result.data[0]
        inserted_count = result["inserted_count"]
        updated_count = result["updated_count"]
        record_ids = result["record_ids"]  # Array of {ebay_order_id, id}

        logger.info(f"Bulk upsert: inserted={inserted_count}, updated={updated_count}")

        # Upsert order_remarks for records that have them
        if remarks_by_ebay_id:
            # Build lookup from ebay_order_id -> record_id
            id_map = {r["ebay_order_id"]: r["id"] for r in record_ids}
            remarks_to_upsert = [
                {"record_id": id_map[ebay_id], "content": content}
                for ebay_id, content in remarks_by_ebay_id.items()
                if ebay_id in id_map
            ]
            if remarks_to_upsert:
                # record_id is primary key, so upsert will update existing remarks
                supabase.table("order_remarks").upsert(
                    remarks_to_upsert,
                    on_conflict="record_id"
                ).execute()
                logger.info(f"Upserted {len(remarks_to_upsert)} order remarks")

        logger.info(
            f"Import committed: batch_id={batch_id}, "
            f"inserted={inserted_count}, updated={updated_count}"
        )
        return batch_id

    except Exception as e:
        # Rollback: clean up records then delete the batch
        logger.error(f"Import failed, rolling back: {e}")
        try:
            # Delete any newly inserted records with this batch_id
            supabase.table("bookkeeping_records").delete().eq(
                "import_batch_id", batch_id
            ).execute()
            # Now safe to delete the batch record
            supabase.table("import_batches").delete().eq("id", batch_id).execute()
        except Exception as rollback_error:
            logger.error(f"Rollback cleanup failed: {rollback_error}")
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
