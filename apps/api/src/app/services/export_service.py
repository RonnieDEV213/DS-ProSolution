"""
Export service with streaming generators for memory-efficient exports.

Provides CSV, JSON, and Excel export functionality using async generators
to stream data without loading the full dataset into memory.
"""

import csv
import io
import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from app.database import get_supabase, get_supabase_for_user
from app.models import (
    BookkeepingStatus,
    ExportFormat,
    ExportJobStatus,
    EXPORT_COLUMNS,
)
from app.pagination import decode_cursor, encode_cursor

logger = logging.getLogger(__name__)

# Batch size for cursor-paginated fetching
EXPORT_BATCH_SIZE = 100

# Default columns if none specified
DEFAULT_EXPORT_COLUMNS = [
    "id",
    "ebay_order_id",
    "sale_date",
    "item_name",
    "qty",
    "sale_price_cents",
    "ebay_fees_cents",
    "earnings_net_cents",
    "amazon_price_cents",
    "amazon_tax_cents",
    "amazon_shipping_cents",
    "cogs_total_cents",
    "amazon_order_id",
    "status",
    "return_label_cost_cents",
    "profit_cents",
]


def compute_record_fields(record: dict) -> dict:
    """
    Compute derived fields for a record.

    Same logic as RecordResponse.from_db for profit/earnings/COGS.
    Returns dict with all original fields plus computed fields.
    """
    status = record.get("status", "")

    # Extract values with defaults
    sale = record.get("sale_price_cents") or 0
    fees = record.get("ebay_fees_cents") or 0
    amazon_price = record.get("amazon_price_cents") or 0
    amazon_tax = record.get("amazon_tax_cents") or 0
    amazon_shipping = record.get("amazon_shipping_cents") or 0
    return_label = record.get("return_label_cost_cents") or 0

    # Compute earnings_net = sale - fees
    earnings_net = sale - fees

    # Compute cogs_total = amazon_price + amazon_tax + amazon_shipping
    cogs_total = amazon_price + amazon_tax + amazon_shipping

    # Compute profit based on status
    if status == "RETURN_CLOSED":
        profit = -return_label
    elif status == "SUCCESSFUL":
        profit = sale - fees - amazon_price - amazon_tax - amazon_shipping
    else:
        # Includes REFUND_NO_RETURN and any other non-successful statuses
        profit = sale - fees - amazon_price - amazon_tax - amazon_shipping - return_label

    # Return record with computed fields
    return {
        **record,
        "earnings_net_cents": earnings_net,
        "cogs_total_cents": cogs_total,
        "profit_cents": profit,
    }


def _apply_cursor_filter(query, cursor: Optional[str]):
    """
    Apply cursor filter for DESC ordering pagination.

    For ORDER BY updated_at DESC, id DESC, we want records where:
    (updated_at, id) < (cursor_updated_at, cursor_id)
    """
    if not cursor:
        return query

    cursor_updated_at, cursor_id = decode_cursor(cursor)

    # Compound cursor comparison for DESC ordering
    cursor_filter = (
        f"updated_at.lt.{cursor_updated_at.isoformat()},"
        f"and(updated_at.eq.{cursor_updated_at.isoformat()},id.lt.{cursor_id})"
    )
    return query.or_(cursor_filter)


async def fetch_export_records_paginated(
    supabase,
    account_id: str,
    status_filter: Optional[BookkeepingStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    include_remarks: bool = True,
) -> AsyncGenerator[dict, None]:
    """
    Fetch records for export using cursor pagination.

    Yields one record at a time with computed fields.
    Uses cursor pagination to avoid loading full dataset into memory.
    """
    cursor = None

    while True:
        # Build query
        query = (
            supabase.table("bookkeeping_records")
            .select("*")
            .eq("account_id", account_id)
            .is_("deleted_at", "null")
            .order("updated_at", desc=True)
            .order("id", desc=True)
            .limit(EXPORT_BATCH_SIZE)
        )

        # Apply filters
        if status_filter:
            query = query.eq("status", status_filter.value)
        if date_from:
            query = query.gte("sale_date", date_from.isoformat())
        if date_to:
            query = query.lte("sale_date", date_to.isoformat())

        # Apply cursor
        query = _apply_cursor_filter(query, cursor)

        result = query.execute()
        records = result.data or []

        if not records:
            break

        # Fetch remarks for this batch if requested
        order_remarks: dict[str, str] = {}
        service_remarks: dict[str, str] = {}

        if include_remarks:
            record_ids = [r["id"] for r in records]

            try:
                order_result = (
                    supabase.table("order_remarks")
                    .select("record_id, content")
                    .in_("record_id", record_ids)
                    .execute()
                )
                for row in order_result.data or []:
                    order_remarks[row["record_id"]] = row["content"]
            except Exception:
                pass  # User doesn't have order_remark access

            try:
                service_result = (
                    supabase.table("service_remarks")
                    .select("record_id, content")
                    .in_("record_id", record_ids)
                    .execute()
                )
                for row in service_result.data or []:
                    service_remarks[row["record_id"]] = row["content"]
            except Exception:
                pass  # User doesn't have service_remark access

        # Yield each record with computed fields and remarks
        for record in records:
            enriched = compute_record_fields(record)
            enriched["order_remark"] = order_remarks.get(record["id"])
            enriched["service_remark"] = service_remarks.get(record["id"])
            yield enriched

        # Check for more pages
        if len(records) < EXPORT_BATCH_SIZE:
            break

        # Build cursor for next page
        last = records[-1]
        updated_at = last["updated_at"]
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        cursor = encode_cursor(updated_at, last["id"])


def filter_columns(record: dict, columns: list[str]) -> dict:
    """Filter record to only include specified columns."""
    return {k: v for k, v in record.items() if k in columns}


async def generate_csv_stream(
    supabase,
    account_id: str,
    columns: Optional[list[str]] = None,
    status_filter: Optional[BookkeepingStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> AsyncGenerator[str, None]:
    """
    Generate CSV export as a stream.

    Yields CSV text in chunks (header first, then batches of rows).
    """
    # Use default columns if none specified
    if columns is None:
        columns = DEFAULT_EXPORT_COLUMNS

    # Yield header row
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    # Yield data rows in batches
    batch_count = 0
    async for record in fetch_export_records_paginated(
        supabase, account_id, status_filter, date_from, date_to
    ):
        filtered = filter_columns(record, columns)

        # Format dates as strings for CSV
        if "sale_date" in filtered and filtered["sale_date"]:
            if hasattr(filtered["sale_date"], "isoformat"):
                filtered["sale_date"] = filtered["sale_date"].isoformat()

        writer.writerow(filtered)
        batch_count += 1

        # Yield every EXPORT_BATCH_SIZE rows to stream data
        if batch_count >= EXPORT_BATCH_SIZE:
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            batch_count = 0

    # Yield any remaining rows
    remaining = output.getvalue()
    if remaining:
        yield remaining


async def generate_json_stream(
    supabase,
    account_id: str,
    columns: Optional[list[str]] = None,
    status_filter: Optional[BookkeepingStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> AsyncGenerator[str, None]:
    """
    Generate JSON export as a stream.

    Yields JSON array elements one at a time.
    """
    # Use default columns if none specified
    if columns is None:
        columns = DEFAULT_EXPORT_COLUMNS

    # Start JSON array
    yield '{"records": ['

    first = True
    async for record in fetch_export_records_paginated(
        supabase, account_id, status_filter, date_from, date_to
    ):
        filtered = filter_columns(record, columns)

        # Format dates as ISO strings
        if "sale_date" in filtered and filtered["sale_date"]:
            if hasattr(filtered["sale_date"], "isoformat"):
                filtered["sale_date"] = filtered["sale_date"].isoformat()

        # Handle comma separator
        if first:
            first = False
        else:
            yield ","

        yield json.dumps(filtered, default=str)

    # Close JSON array
    yield "]}"


# =============================================================================
# Seller Export Stream Generators
# =============================================================================

# CSV headers for seller export (user-facing columns only)
SELLER_CSV_HEADERS = [
    "display_name",
    "normalized_name",
    "platform",
    "platform_id",
    "times_seen",
    "feedback_percent",
    "feedback_count",
    "flagged",
    "created_at",
]


def _extract_seller_row(seller: dict) -> dict:
    """Extract user-facing fields from a seller record for export."""
    return {
        "display_name": seller.get("display_name", ""),
        "normalized_name": seller.get("normalized_name", ""),
        "platform": seller.get("platform", ""),
        "platform_id": seller.get("platform_id", ""),
        "times_seen": seller.get("times_seen", 0),
        "feedback_percent": seller.get("feedback_percent"),
        "feedback_count": seller.get("feedback_count"),
        "flagged": seller.get("flagged", False),
        "created_at": seller.get("created_at", ""),
    }


async def generate_sellers_csv_stream(
    supabase,
    org_id: str,
    flagged: Optional[bool] = None,
) -> AsyncGenerator[str, None]:
    """
    Generate streaming CSV export of sellers.

    Yields CSV text in chunks (header first, then batches of rows).
    Uses cursor pagination to avoid loading all sellers into memory.
    Sellers are org-wide (not per-account).
    """
    # Yield header row
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=SELLER_CSV_HEADERS, extrasaction="ignore")
    writer.writeheader()
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    # Cursor-paginated fetch
    last_created_at = None
    last_id = None
    batch_count = 0

    while True:
        query = (
            supabase.table("collection_sellers")
            .select("*")
            .eq("org_id", org_id)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .order("id", desc=True)
            .limit(EXPORT_BATCH_SIZE)
        )

        if flagged is not None:
            query = query.eq("flagged", flagged)

        # Apply cursor for pagination
        if last_created_at is not None and last_id is not None:
            cursor_filter = (
                f"created_at.lt.{last_created_at},"
                f"and(created_at.eq.{last_created_at},id.lt.{last_id})"
            )
            query = query.or_(cursor_filter)

        result = query.execute()
        sellers = result.data or []

        if not sellers:
            break

        for seller in sellers:
            row = _extract_seller_row(seller)
            writer.writerow(row)
            batch_count += 1

            if batch_count >= EXPORT_BATCH_SIZE:
                yield output.getvalue()
                output.seek(0)
                output.truncate(0)
                batch_count = 0

        # Check for more pages
        if len(sellers) < EXPORT_BATCH_SIZE:
            # Yield remaining
            remaining = output.getvalue()
            if remaining:
                yield remaining
            break

        # Build cursor for next page
        last_seller = sellers[-1]
        last_created_at = last_seller["created_at"]
        last_id = last_seller["id"]

    # Yield any remaining rows from last full batch
    if batch_count > 0:
        remaining = output.getvalue()
        if remaining:
            yield remaining


async def generate_sellers_json_stream(
    supabase,
    org_id: str,
    flagged: Optional[bool] = None,
) -> AsyncGenerator[str, None]:
    """
    Generate streaming JSON export of sellers.

    Yields JSON object with "sellers" array. Each seller is streamed
    as an array element for memory efficiency.
    Uses cursor pagination to avoid loading all sellers into memory.
    Sellers are org-wide (not per-account).
    """
    # Start JSON object
    exported_at = datetime.now(timezone.utc).isoformat()
    yield f'{{"exported_at": "{exported_at}", "sellers": ['

    first = True
    last_created_at = None
    last_id = None

    while True:
        query = (
            supabase.table("collection_sellers")
            .select("*")
            .eq("org_id", org_id)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .order("id", desc=True)
            .limit(EXPORT_BATCH_SIZE)
        )

        if flagged is not None:
            query = query.eq("flagged", flagged)

        # Apply cursor for pagination
        if last_created_at is not None and last_id is not None:
            cursor_filter = (
                f"created_at.lt.{last_created_at},"
                f"and(created_at.eq.{last_created_at},id.lt.{last_id})"
            )
            query = query.or_(cursor_filter)

        result = query.execute()
        sellers = result.data or []

        if not sellers:
            break

        for seller in sellers:
            row = _extract_seller_row(seller)

            if first:
                first = False
            else:
                yield ","

            yield json.dumps(row, default=str)

        # Check for more pages
        if len(sellers) < EXPORT_BATCH_SIZE:
            break

        # Build cursor for next page
        last_seller = sellers[-1]
        last_created_at = last_seller["created_at"]
        last_id = last_seller["id"]

    # Close JSON array and object
    yield "]}"


async def generate_excel_file(
    supabase,
    account_id: str,
    columns: Optional[list[str]] = None,
    status_filter: Optional[BookkeepingStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> str:
    """
    Generate Excel file with streaming.

    Uses xlsxwriter with constant_memory mode for memory efficiency.
    Returns path to the generated temporary file.
    """
    import xlsxwriter

    # Use default columns if none specified
    if columns is None:
        columns = DEFAULT_EXPORT_COLUMNS

    # Create temp file
    fd, file_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)

    # Create workbook with constant_memory mode for large files
    workbook = xlsxwriter.Workbook(file_path, {"constant_memory": True})
    worksheet = workbook.add_worksheet("Records")

    # Formats
    header_format = workbook.add_format({"bold": True, "bg_color": "#D9D9D9"})
    currency_format = workbook.add_format({"num_format": "$#,##0.00"})
    date_format = workbook.add_format({"num_format": "yyyy-mm-dd"})

    # Currency columns (those ending in _cents)
    currency_columns = {
        col for col in columns if col.endswith("_cents")
    }

    # Write headers
    for col_idx, header in enumerate(columns):
        # Make header more readable
        display_header = header.replace("_", " ").title()
        if header.endswith("_cents"):
            display_header = display_header.replace(" Cents", "")
        worksheet.write(0, col_idx, display_header, header_format)

    # Freeze header row
    worksheet.freeze_panes(1, 0)

    # Write data rows
    row_idx = 1
    async for record in fetch_export_records_paginated(
        supabase, account_id, status_filter, date_from, date_to
    ):
        filtered = filter_columns(record, columns)

        for col_idx, col_name in enumerate(columns):
            value = filtered.get(col_name)

            if value is None:
                worksheet.write_blank(row_idx, col_idx, None)
            elif col_name in currency_columns and isinstance(value, (int, float)):
                # Convert cents to dollars for display
                worksheet.write_number(row_idx, col_idx, value / 100, currency_format)
            elif col_name == "sale_date":
                if hasattr(value, "isoformat"):
                    worksheet.write_string(row_idx, col_idx, value.isoformat())
                else:
                    worksheet.write_string(row_idx, col_idx, str(value))
            else:
                worksheet.write(row_idx, col_idx, value)

        row_idx += 1

    # Set column widths
    for col_idx, col_name in enumerate(columns):
        width = max(len(col_name), 12)  # Minimum width of 12
        worksheet.set_column(col_idx, col_idx, width)

    workbook.close()
    return file_path


async def count_export_records(
    supabase,
    account_id: str,
    status_filter: Optional[BookkeepingStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> int:
    """Count total records that would be exported."""
    query = (
        supabase.table("bookkeeping_records")
        .select("id", count="exact")
        .eq("account_id", account_id)
        .is_("deleted_at", "null")
    )

    if status_filter:
        query = query.eq("status", status_filter.value)
    if date_from:
        query = query.gte("sale_date", date_from.isoformat())
    if date_to:
        query = query.lte("sale_date", date_to.isoformat())

    result = query.execute()
    return result.count or 0


async def process_export_job(job_id: str):
    """
    Process a background export job.

    Loads job details, generates file, updates job status.
    For now, stores file locally. Can be extended to upload to Supabase Storage.
    """
    supabase = get_supabase()

    try:
        # Update status to processing
        supabase.table("export_jobs").update({
            "status": ExportJobStatus.PROCESSING.value
        }).eq("id", job_id).execute()

        # Fetch job details
        job_result = supabase.table("export_jobs").select("*").eq("id", job_id).execute()
        if not job_result.data:
            logger.error(f"Export job {job_id} not found")
            return

        job = job_result.data[0]
        account_id = job["account_id"]
        export_format = job["format"]
        columns = job.get("columns")
        status_filter = BookkeepingStatus(job["status_filter"]) if job.get("status_filter") else None
        date_from = datetime.fromisoformat(job["date_from"]) if job.get("date_from") else None
        date_to = datetime.fromisoformat(job["date_to"]) if job.get("date_to") else None

        # Count rows
        row_count = await count_export_records(
            supabase, account_id, status_filter, date_from, date_to
        )

        # Generate file based on format
        file_path = None
        if export_format == ExportFormat.EXCEL.value:
            file_path = await generate_excel_file(
                supabase, account_id, columns, status_filter, date_from, date_to
            )
        elif export_format == ExportFormat.CSV.value:
            # For CSV, write to temp file
            fd, file_path = tempfile.mkstemp(suffix=".csv")
            with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
                async for chunk in generate_csv_stream(
                    supabase, account_id, columns, status_filter, date_from, date_to
                ):
                    f.write(chunk)
        elif export_format == ExportFormat.JSON.value:
            # For JSON, write to temp file
            fd, file_path = tempfile.mkstemp(suffix=".json")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                async for chunk in generate_json_stream(
                    supabase, account_id, columns, status_filter, date_from, date_to
                ):
                    f.write(chunk)

        # For now, file_url is local path. In production, upload to Supabase Storage.
        file_url = file_path

        # Update job as completed
        supabase.table("export_jobs").update({
            "status": ExportJobStatus.COMPLETED.value,
            "row_count": row_count,
            "file_url": file_url,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()

        logger.info(f"Export job {job_id} completed: {row_count} rows")

    except Exception as e:
        logger.exception(f"Export job {job_id} failed")
        # Mark as failed
        supabase.table("export_jobs").update({
            "status": ExportJobStatus.FAILED.value,
            "error": str(e),
        }).eq("id", job_id).execute()
