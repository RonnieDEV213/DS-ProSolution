"""Cursor-based pagination utilities for sync endpoints."""

import base64
import json
from datetime import datetime, timezone


def encode_cursor(updated_at: datetime, id: str) -> str:
    """
    Encode pagination position as opaque cursor.

    Args:
        updated_at: Timestamp of last record (must be timezone-aware)
        id: UUID of last record

    Returns:
        URL-safe base64 encoded cursor string (no padding)
    """
    # Ensure timezone-aware for consistency
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)

    payload = {
        "u": updated_at.isoformat(),  # updated_at
        "i": id,                       # id
    }
    return base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    """
    Decode cursor to pagination position.

    Args:
        cursor: Opaque cursor string from previous response

    Returns:
        Tuple of (updated_at datetime, id string)

    Raises:
        ValueError: If cursor is invalid or malformed
    """
    # Add back base64 padding
    padding = 4 - (len(cursor) % 4)
    if padding != 4:
        cursor += "=" * padding

    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor))
        updated_at = datetime.fromisoformat(payload["u"])
        id = payload["i"]
        return updated_at, id
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        raise ValueError("Invalid cursor") from e
