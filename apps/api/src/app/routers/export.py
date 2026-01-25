"""
Export endpoints with streaming for CSV, JSON, and Excel formats.

Provides memory-efficient streaming exports for small-medium datasets,
and background job processing for large exports (>10K rows).
"""

import logging
import os
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from app.auth import require_permission_key
from app.database import get_supabase, get_supabase_for_user
from app.models import (
    BookkeepingStatus,
    ExportFormat,
    ExportJobCreate,
    ExportJobListItem,
    ExportJobListResponse,
    ExportJobResponse,
    ExportJobStatus,
    EXPORT_COLUMNS,
)
from app.services.export_service import (
    count_export_records,
    generate_csv_stream,
    generate_excel_file,
    generate_json_stream,
    process_export_job,
)
from app.services.scheduler import scheduler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])

# Threshold for background export (10K rows)
BACKGROUND_EXPORT_THRESHOLD = 10000


def _parse_columns(columns_str: Optional[str]) -> Optional[list[str]]:
    """Parse comma-separated column string to list."""
    if not columns_str:
        return None
    columns = [c.strip() for c in columns_str.split(",") if c.strip()]
    invalid = [c for c in columns if c not in EXPORT_COLUMNS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid columns: {invalid}. Valid columns: {EXPORT_COLUMNS}",
        )
    return columns if columns else None


def _generate_filename(account_id: str, format_type: str) -> str:
    """Generate filename for export."""
    date_str = datetime.now().strftime("%Y%m%d")
    return f"records_{account_id[:8]}_{date_str}.{format_type}"


# =============================================================================
# Streaming Export Endpoints
# =============================================================================


@router.get("/records/csv")
async def export_records_csv(
    account_id: str = Query(..., description="Account ID to export records for"),
    columns: Optional[str] = Query(None, description="Comma-separated columns to include"),
    status: Optional[BookkeepingStatus] = Query(None, description="Filter by status"),
    date_from: Optional[date] = Query(None, description="Filter by sale date (from)"),
    date_to: Optional[date] = Query(None, description="Filter by sale date (to)"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Stream CSV export of records.

    Uses async generator to stream data row by row without loading
    the full dataset into memory.

    **Columns:** If not specified, includes default columns (id, order info,
    financials, status). Computed fields (profit, earnings, COGS) are included.
    """
    supabase = get_supabase_for_user(user["token"])
    parsed_columns = _parse_columns(columns)
    filename = _generate_filename(account_id, "csv")

    return StreamingResponse(
        generate_csv_stream(
            supabase,
            account_id,
            columns=parsed_columns,
            status_filter=status,
            date_from=date_from,
            date_to=date_to,
        ),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/records/json")
async def export_records_json(
    account_id: str = Query(..., description="Account ID to export records for"),
    columns: Optional[str] = Query(None, description="Comma-separated columns to include"),
    status: Optional[BookkeepingStatus] = Query(None, description="Filter by status"),
    date_from: Optional[date] = Query(None, description="Filter by sale date (from)"),
    date_to: Optional[date] = Query(None, description="Filter by sale date (to)"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Stream JSON export of records.

    Returns a JSON object with a "records" array. Each record is streamed
    as an array element for memory efficiency.
    """
    supabase = get_supabase_for_user(user["token"])
    parsed_columns = _parse_columns(columns)
    filename = _generate_filename(account_id, "json")

    return StreamingResponse(
        generate_json_stream(
            supabase,
            account_id,
            columns=parsed_columns,
            status_filter=status,
            date_from=date_from,
            date_to=date_to,
        ),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/records/excel")
async def export_records_excel(
    account_id: str = Query(..., description="Account ID to export records for"),
    columns: Optional[str] = Query(None, description="Comma-separated columns to include"),
    status: Optional[BookkeepingStatus] = Query(None, description="Filter by status"),
    date_from: Optional[date] = Query(None, description="Filter by sale date (from)"),
    date_to: Optional[date] = Query(None, description="Filter by sale date (to)"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Generate and return Excel export of records.

    Uses xlsxwriter with constant_memory mode for memory-efficient
    large file generation. Includes formatting:
    - Frozen header row
    - Currency formatting for cent columns (converted to dollars)
    - Bold headers with background color
    """
    supabase = get_supabase_for_user(user["token"])
    parsed_columns = _parse_columns(columns)
    filename = _generate_filename(account_id, "xlsx")

    # Generate Excel file
    file_path = await generate_excel_file(
        supabase,
        account_id,
        columns=parsed_columns,
        status_filter=status,
        date_from=date_from,
        date_to=date_to,
    )

    # Return file and schedule cleanup
    def cleanup_file():
        try:
            os.unlink(file_path)
        except Exception:
            pass

    response = FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
        background=cleanup_file,
    )
    return response


# =============================================================================
# Background Export Endpoints
# =============================================================================


@router.post("/records/background", response_model=ExportJobResponse)
async def create_background_export(
    request: ExportJobCreate,
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Create a background export job for large datasets.

    Background exports are required for datasets exceeding 10K rows.
    For smaller datasets, use the streaming endpoints instead.

    Returns a job ID that can be polled for status.
    """
    supabase = get_supabase_for_user(user["token"])

    # Count records to check if background export is needed
    record_count = await count_export_records(
        supabase,
        request.account_id,
        status_filter=request.status,
        date_from=request.date_from,
        date_to=request.date_to,
    )

    if record_count < BACKGROUND_EXPORT_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "USE_STREAMING",
                "message": f"Dataset has {record_count} rows (under {BACKGROUND_EXPORT_THRESHOLD:,}). "
                "Use streaming endpoints instead: /export/records/csv, /export/records/json, or /export/records/excel",
                "row_count": record_count,
            },
        )

    # Create job record
    job_id = str(uuid.uuid4())
    admin_supabase = get_supabase()

    job_data = {
        "id": job_id,
        "user_id": user["user_id"],
        "org_id": user["membership"]["org_id"],
        "account_id": request.account_id,
        "format": request.format.value,
        "columns": request.columns,
        "status_filter": request.status.value if request.status else None,
        "date_from": request.date_from.isoformat() if request.date_from else None,
        "date_to": request.date_to.isoformat() if request.date_to else None,
        "status": ExportJobStatus.PENDING.value,
    }

    admin_supabase.table("export_jobs").insert(job_data).execute()

    # Schedule job with APScheduler
    scheduler.add_job(
        process_export_job,
        args=[job_id],
        id=f"export_{job_id}",
        replace_existing=True,
    )

    logger.info(f"Created background export job {job_id} for {record_count} rows")

    return ExportJobResponse(
        job_id=job_id,
        status=ExportJobStatus.PENDING,
        created_at=datetime.now(timezone.utc),
    )


@router.get("/jobs/{job_id}", response_model=ExportJobResponse)
async def get_export_job_status(
    job_id: str,
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Get the status of an export job.

    When status is COMPLETED, file_url will contain the download URL.
    """
    supabase = get_supabase()

    result = (
        supabase.table("export_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Export job not found")

    job = result.data[0]

    return ExportJobResponse(
        job_id=job["id"],
        status=ExportJobStatus(job["status"]),
        row_count=job.get("row_count"),
        file_url=job.get("file_url"),
        error=job.get("error"),
        created_at=job["created_at"],
        completed_at=job.get("completed_at"),
    )


@router.get("/jobs", response_model=ExportJobListResponse)
async def list_export_jobs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    List user's export jobs.

    Returns paginated list ordered by created_at DESC (newest first).
    """
    supabase = get_supabase()

    # Get total count
    count_result = (
        supabase.table("export_jobs")
        .select("id", count="exact")
        .eq("user_id", user["user_id"])
        .execute()
    )
    total = count_result.count or 0

    # Get paginated results
    offset = (page - 1) * page_size
    result = (
        supabase.table("export_jobs")
        .select("id, account_id, format, status, row_count, created_at, completed_at")
        .eq("user_id", user["user_id"])
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    jobs = [
        ExportJobListItem(
            job_id=job["id"],
            account_id=job["account_id"],
            format=ExportFormat(job["format"]),
            status=ExportJobStatus(job["status"]),
            row_count=job.get("row_count"),
            created_at=job["created_at"],
            completed_at=job.get("completed_at"),
        )
        for job in (result.data or [])
    ]

    return ExportJobListResponse(
        jobs=jobs,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/jobs/{job_id}/download")
async def download_export_file(
    job_id: str,
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Download the completed export file.

    Only available for jobs with status COMPLETED.
    """
    supabase = get_supabase()

    result = (
        supabase.table("export_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", user["user_id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Export job not found")

    job = result.data[0]

    if job["status"] != ExportJobStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Export job is not complete. Status: {job['status']}",
        )

    file_path = job.get("file_url")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="Export file not found. It may have been cleaned up.",
        )

    # Determine filename and media type
    format_type = job["format"]
    account_id = job["account_id"]

    if format_type == "csv":
        media_type = "text/csv"
        filename = _generate_filename(account_id, "csv")
    elif format_type == "json":
        media_type = "application/json"
        filename = _generate_filename(account_id, "json")
    else:  # excel
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = _generate_filename(account_id, "xlsx")

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename,
    )
