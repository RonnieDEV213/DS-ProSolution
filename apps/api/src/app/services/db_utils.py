"""Database utility functions for optimized bulk operations.

Provides batched and concurrent database operations to handle
large datasets (millions of rows) efficiently.

Key optimizations:
- Batch size of 150 for queries (URL length limit)
- Batch size of 500 for inserts (Supabase optimal)
- Concurrent execution with max 15 parallel requests
- Connection pool aware to avoid exhaustion
"""

import concurrent.futures
from typing import Any, Callable, TypeVar

# URL can fit ~200 UUIDs safely (8000 chars / 37 chars per UUID)
# Using 150 for margin (other params, encoding, server limits)
QUERY_BATCH_SIZE = 150

# Supabase handles inserts well up to ~1000 rows
# Using 500 for safety margin
INSERT_BATCH_SIZE = 500

# Max parallel requests - limited by HTTP/2 stream multiplexing on single
# TCP connection. Values >5 cause SSL write errors ("EOF occurred in
# violation of protocol") under bulk operations (e.g. 4700-ID deletes).
MAX_CONCURRENT = 5

T = TypeVar('T')


def batch_list(items: list[T], batch_size: int) -> list[list[T]]:
    """Split a list into batches of specified size."""
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]


def execute_concurrent(
    func: Callable[[list[T]], Any],
    batches: list[list[T]],
    max_workers: int = MAX_CONCURRENT,
) -> list[Any]:
    """
    Execute a function concurrently across batches.

    Args:
        func: Function that takes a batch and returns a result
        batches: List of batches to process
        max_workers: Maximum concurrent executions

    Returns:
        List of results from each batch
    """
    if len(batches) == 0:
        return []

    if len(batches) == 1:
        # Single batch - no threading overhead needed
        return [func(batches[0])]

    # Multiple batches - run concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        return list(executor.map(func, batches))


def batched_query(
    supabase,
    table: str,
    select: str,
    filter_column: str,
    filter_values: list[str],
    extra_filters: dict[str, Any] | None = None,
) -> list[dict]:
    """
    Execute a SELECT query with batched IN clause for large value lists.

    Args:
        supabase: Supabase client
        table: Table name
        select: Columns to select
        filter_column: Column to filter with IN clause
        filter_values: Values for IN clause
        extra_filters: Additional eq() filters as {column: value}

    Returns:
        Combined results from all batches
    """
    if not filter_values:
        return []

    def query_batch(batch: list[str]) -> list[dict]:
        query = supabase.table(table).select(select).in_(filter_column, batch)
        if extra_filters:
            for col, val in extra_filters.items():
                query = query.eq(col, val)
        result = query.execute()
        return result.data or []

    batches = batch_list(filter_values, QUERY_BATCH_SIZE)
    results = execute_concurrent(query_batch, batches)

    # Flatten results
    return [item for batch_result in results for item in batch_result]


def batched_delete(
    supabase,
    table: str,
    filter_column: str,
    filter_values: list[str],
    extra_filters: dict[str, Any] | None = None,
) -> tuple[int, list[str]]:
    """
    Execute DELETE with batched IN clause for large value lists.

    Args:
        supabase: Supabase client
        table: Table name
        filter_column: Column to filter with IN clause
        filter_values: Values for IN clause
        extra_filters: Additional eq() filters as {column: value}

    Returns:
        Tuple of (success_count, error_messages)
    """
    if not filter_values:
        return 0, []

    total_success = 0
    all_errors: list[str] = []

    def delete_batch(batch: list[str]) -> tuple[int, list[str]]:
        try:
            query = supabase.table(table).delete().in_(filter_column, batch)
            if extra_filters:
                for col, val in extra_filters.items():
                    query = query.eq(col, val)
            query.execute()
            return len(batch), []
        except Exception as e:
            # If batch fails, try one by one to identify problem rows
            success = 0
            errors = []
            for val in batch:
                try:
                    q = supabase.table(table).delete().eq(filter_column, val)
                    if extra_filters:
                        for col, v in extra_filters.items():
                            q = q.eq(col, v)
                    q.execute()
                    success += 1
                except Exception as e2:
                    errors.append(f"{val}: {str(e2)}")
            return success, errors

    batches = batch_list(filter_values, QUERY_BATCH_SIZE)
    results = execute_concurrent(delete_batch, batches)

    for success, errors in results:
        total_success += success
        all_errors.extend(errors)

    return total_success, all_errors


def batched_insert(
    supabase,
    table: str,
    rows: list[dict],
) -> tuple[int, list[str]]:
    """
    Execute INSERT with batched rows for large datasets.

    Args:
        supabase: Supabase client
        table: Table name
        rows: List of row dicts to insert

    Returns:
        Tuple of (success_count, error_messages)
    """
    if not rows:
        return 0, []

    total_success = 0
    all_errors: list[str] = []

    def insert_batch(batch: list[dict]) -> tuple[int, list[str]]:
        try:
            supabase.table(table).insert(batch).execute()
            return len(batch), []
        except Exception as e:
            # If batch fails, try one by one to identify problem rows
            success = 0
            errors = []
            for row in batch:
                try:
                    supabase.table(table).insert(row).execute()
                    success += 1
                except Exception as e2:
                    identifier = row.get("id") or row.get("display_name") or str(row)[:50]
                    errors.append(f"{identifier}: {str(e2)}")
            return success, errors

    batches = batch_list(rows, INSERT_BATCH_SIZE)
    results = execute_concurrent(insert_batch, batches)

    for success, errors in results:
        total_success += success
        all_errors.extend(errors)

    return total_success, all_errors


def batched_update(
    supabase,
    table: str,
    filter_column: str,
    filter_values: list[str],
    update_data: dict[str, Any],
    extra_filters: dict[str, Any] | None = None,
) -> tuple[int, list[str]]:
    """
    Execute UPDATE with batched IN clause for large value lists.

    Args:
        supabase: Supabase client
        table: Table name
        filter_column: Column to filter with IN clause
        filter_values: Values for IN clause
        update_data: Data to update
        extra_filters: Additional eq() filters as {column: value}

    Returns:
        Tuple of (success_count, error_messages)
    """
    if not filter_values:
        return 0, []

    total_success = 0
    all_errors: list[str] = []

    def update_batch(batch: list[str]) -> tuple[int, list[str]]:
        try:
            query = supabase.table(table).update(update_data).in_(filter_column, batch)
            if extra_filters:
                for col, val in extra_filters.items():
                    query = query.eq(col, val)
            query.execute()
            return len(batch), []
        except Exception as e:
            # If batch fails, try one by one
            success = 0
            errors = []
            for val in batch:
                try:
                    q = supabase.table(table).update(update_data).eq(filter_column, val)
                    if extra_filters:
                        for col, v in extra_filters.items():
                            q = q.eq(col, v)
                    q.execute()
                    success += 1
                except Exception as e2:
                    errors.append(f"{val}: {str(e2)}")
            return success, errors

    batches = batch_list(filter_values, QUERY_BATCH_SIZE)
    results = execute_concurrent(update_batch, batches)

    for success, errors in results:
        total_success += success
        all_errors.extend(errors)

    return total_success, all_errors


def paginated_fetch(
    supabase,
    table: str,
    select: str,
    filters: dict[str, Any],
    order_by: str | None = None,
    order_desc: bool = True,
    page_size: int = 1000,
    max_rows: int | None = None,
) -> list[dict]:
    """
    Fetch large datasets with pagination to avoid Supabase 1000 row limit.

    Args:
        supabase: Supabase client
        table: Table name
        select: Columns to select
        filters: eq() filters as {column: value}
        order_by: Column to order by
        order_desc: Whether to order descending
        page_size: Rows per page (max 1000)
        max_rows: Maximum total rows to fetch (None = all)

    Returns:
        Combined results from all pages
    """
    all_results: list[dict] = []
    offset = 0
    page_size = min(page_size, 1000)  # Supabase limit

    while True:
        query = supabase.table(table).select(select, count="exact")

        for col, val in filters.items():
            query = query.eq(col, val)

        if order_by:
            query = query.order(order_by, desc=order_desc)

        query = query.range(offset, offset + page_size - 1)
        result = query.execute()

        batch = result.data or []
        all_results.extend(batch)

        # Check if we've fetched all rows or hit max
        if len(batch) < page_size:
            break

        if max_rows and len(all_results) >= max_rows:
            all_results = all_results[:max_rows]
            break

        offset += page_size

    return all_results
