"""Import endpoints for data import with validation and rollback."""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.auth import require_permission_key
from app.database import get_supabase, get_supabase_for_user
from app.models import (
    ImportBatchListResponse,
    ImportBatchResponse,
    ImportCommitResponse,
    ImportFormat,
    ImportRollbackResponse,
    ImportValidationResponse,
)
from app.services.import_service import (
    check_rollback_eligibility,
    commit_import,
    parse_full_file,
    rollback_import,
    suggest_column_mapping,
    validate_import_file,
    validate_rows,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])


# =============================================================================
# Validation Endpoint
# =============================================================================


@router.post("/records/validate", response_model=ImportValidationResponse)
async def validate_import(
    file: UploadFile = File(...),
    format: ImportFormat = Query(ImportFormat.CSV, description="File format"),
    user: dict = Depends(require_permission_key("order_tracking.write")),
):
    """
    Validate import file and return preview with errors.

    **Does NOT commit data.** Use this to:
    1. Preview first 100 rows
    2. Review validation errors
    3. Get suggested column mapping
    4. Let user adjust mapping before commit

    **Supported formats:** CSV, JSON, Excel

    Returns:
    - preview: First 100 rows with validation status
    - errors: All validation errors from preview
    - total_rows: Total row count in file
    - valid_rows: Count of valid rows in preview
    - suggested_mapping: Auto-suggested column mapping
    """
    try:
        # Read file content
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        # Parse and get preview
        preview_df, total_rows = validate_import_file(content, format)

        # Get suggested column mapping
        headers = preview_df.columns.tolist()
        suggested_mapping = suggest_column_mapping(headers)

        # Validate rows with suggested mapping
        validated_rows = validate_rows(preview_df, suggested_mapping)

        # Collect all errors
        all_errors = []
        valid_count = 0
        for row in validated_rows:
            all_errors.extend(row.errors)
            if row.is_valid:
                valid_count += 1

        return ImportValidationResponse(
            preview=validated_rows,
            errors=all_errors,
            total_rows=total_rows,
            valid_rows=valid_count,
            suggested_mapping=suggested_mapping,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to validate import file")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


# =============================================================================
# Commit Endpoint
# =============================================================================


@router.post("/records/commit", response_model=ImportCommitResponse)
async def commit_import_records(
    file: UploadFile = File(...),
    account_id: str = Form(...),
    filename: str = Form(...),
    format: ImportFormat = Form(ImportFormat.CSV),
    column_mapping: str = Form(..., description="JSON string of column mapping"),
    user: dict = Depends(require_permission_key("order_tracking.write")),
):
    """
    Commit validated import data.

    **All-or-nothing:** If any row fails validation, entire import fails.

    **Request:**
    - file: The data file (same file used in validate)
    - account_id: Account to import records into
    - filename: Original filename for tracking
    - format: File format (csv, json, excel)
    - column_mapping: JSON string of confirmed column mapping

    **Returns:**
    - batch_id: ID for rollback/tracking
    - rows_imported: Number of records imported
    """
    try:
        # Parse column mapping from JSON string
        try:
            mapping = json.loads(column_mapping)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400, detail="Invalid column_mapping JSON format"
            )

        # Read file content
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        # Parse and validate full file
        valid_records, errors = parse_full_file(content, format, mapping)

        # Check for errors (all-or-nothing)
        if errors:
            error_summary = f"{len(errors)} validation error(s) found"
            first_errors = errors[:5]  # Show first 5 errors
            error_details = [
                f"Row {e.row}: {e.field} - {e.message}" for e in first_errors
            ]
            if len(errors) > 5:
                error_details.append(f"...and {len(errors) - 5} more errors")

            raise HTTPException(
                status_code=400,
                detail={
                    "message": error_summary,
                    "errors": error_details,
                },
            )

        if not valid_records:
            raise HTTPException(status_code=400, detail="No valid records to import")

        # Use service-role client for insert
        supabase = get_supabase()

        # Commit import
        batch_id = commit_import(
            supabase=supabase,
            account_id=account_id,
            user_id=user["user_id"],
            org_id=user["membership"]["org_id"],
            data=valid_records,
            filename=filename,
            format=format.value,
            mapping=mapping,
        )

        return ImportCommitResponse(
            batch_id=batch_id,
            rows_imported=len(valid_records),
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to commit import")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# =============================================================================
# Batch Listing Endpoints
# =============================================================================


@router.get("/batches", response_model=ImportBatchListResponse)
async def list_import_batches(
    account_id: Optional[str] = Query(None, description="Filter by account ID"),
    limit: int = Query(20, ge=1, le=100, description="Number of batches to return"),
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    List import batches for the user's organization.

    **Filters:**
    - account_id: Filter by specific account (optional)

    **Returns:**
    - batches: List of import batches, newest first
    """
    try:
        supabase = get_supabase_for_user(user["token"])

        query = (
            supabase.table("import_batches")
            .select("id, account_id, filename, row_count, format, created_at, can_rollback, rolled_back_at")
            .order("created_at", desc=True)
            .limit(limit)
        )

        if account_id:
            query = query.eq("account_id", account_id)

        result = query.execute()

        batches = [
            ImportBatchResponse(
                id=b["id"],
                account_id=b["account_id"],
                filename=b["filename"],
                row_count=b["row_count"],
                format=b["format"],
                created_at=b["created_at"],
                can_rollback=b["can_rollback"],
                rolled_back_at=b.get("rolled_back_at"),
            )
            for b in (result.data or [])
        ]

        return ImportBatchListResponse(batches=batches)

    except Exception as e:
        logger.exception("Failed to list import batches")
        raise HTTPException(status_code=500, detail="Failed to list import batches")


@router.get("/batches/{batch_id}", response_model=ImportBatchResponse)
async def get_import_batch(
    batch_id: str,
    user: dict = Depends(require_permission_key("order_tracking.read")),
):
    """
    Get details of a specific import batch.
    """
    try:
        supabase = get_supabase_for_user(user["token"])

        result = (
            supabase.table("import_batches")
            .select("id, account_id, filename, row_count, format, created_at, can_rollback, rolled_back_at")
            .eq("id", batch_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Import batch not found")

        b = result.data[0]
        return ImportBatchResponse(
            id=b["id"],
            account_id=b["account_id"],
            filename=b["filename"],
            row_count=b["row_count"],
            format=b["format"],
            created_at=b["created_at"],
            can_rollback=b["can_rollback"],
            rolled_back_at=b.get("rolled_back_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get import batch")
        raise HTTPException(status_code=500, detail="Failed to get import batch")


# =============================================================================
# Rollback Endpoints
# =============================================================================


@router.post("/batches/{batch_id}/rollback", response_model=ImportRollbackResponse)
async def rollback_import_batch(
    batch_id: str,
    force: bool = Query(False, description="Force rollback even if records were modified"),
    user: dict = Depends(require_permission_key("order_tracking.write")),
):
    """
    Rollback an import by soft-deleting all records in the batch.

    **Checks:**
    1. Batch must exist and not already rolled back
    2. Must be within 24-hour rollback window
    3. If records were modified since import, returns warning

    **Parameters:**
    - force: If True, rollback even if records were modified (requires confirmation)

    **Returns:**
    - success: Whether rollback succeeded
    - rows_deleted: Number of records soft-deleted
    - warning: Warning about modified records (if any)
    """
    try:
        supabase = get_supabase()

        # Check eligibility first
        can_rollback, warning = check_rollback_eligibility(supabase, batch_id)

        if not can_rollback:
            return ImportRollbackResponse(
                success=False,
                rows_deleted=0,
                warning=warning,
            )

        # If there's a warning about modified records and not forcing
        if warning and warning.requires_confirmation and not force:
            return ImportRollbackResponse(
                success=False,
                rows_deleted=0,
                warning=warning,
            )

        # Execute rollback
        rows_deleted = rollback_import(supabase, batch_id, force=force)

        return ImportRollbackResponse(
            success=True,
            rows_deleted=rows_deleted,
            warning=None,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to rollback import")
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")


@router.post("/batches/{batch_id}/disable-rollback")
async def disable_batch_rollback(
    batch_id: str,
    user: dict = Depends(require_permission_key("order_tracking.write")),
):
    """
    Manually disable rollback for a batch.

    Use this if you want to prevent accidental rollback after confirming
    the import is correct.
    """
    try:
        supabase = get_supabase_for_user(user["token"])

        result = (
            supabase.table("import_batches")
            .update({"can_rollback": False})
            .eq("id", batch_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Import batch not found")

        return {"ok": True, "message": "Rollback disabled for this batch"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to disable rollback")
        raise HTTPException(status_code=500, detail="Failed to disable rollback")
