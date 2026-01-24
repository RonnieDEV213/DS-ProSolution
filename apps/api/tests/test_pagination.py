"""Tests for cursor pagination utilities."""

import pytest
from datetime import datetime, timezone

from app.pagination import encode_cursor, decode_cursor


class TestCursorEncodeDecode:
    """Test cursor encoding and decoding."""

    def test_roundtrip_timezone_aware(self):
        """Cursor roundtrips with timezone-aware datetime."""
        dt = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        id = "550e8400-e29b-41d4-a716-446655440000"

        cursor = encode_cursor(dt, id)
        decoded_dt, decoded_id = decode_cursor(cursor)

        assert decoded_dt == dt
        assert decoded_id == id

    def test_roundtrip_naive_datetime_becomes_utc(self):
        """Naive datetime is treated as UTC."""
        dt = datetime(2024, 1, 15, 10, 30, 0)  # Naive
        id = "550e8400-e29b-41d4-a716-446655440000"

        cursor = encode_cursor(dt, id)
        decoded_dt, decoded_id = decode_cursor(cursor)

        # Should have UTC timezone after roundtrip
        assert decoded_dt.tzinfo is not None
        assert decoded_id == id

    def test_cursor_is_url_safe(self):
        """Cursor uses URL-safe characters only."""
        dt = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        id = "550e8400-e29b-41d4-a716-446655440000"

        cursor = encode_cursor(dt, id)

        # URL-safe base64 uses - and _ instead of + and /
        assert "+" not in cursor
        assert "/" not in cursor
        # Should not have padding (stripped)
        assert not cursor.endswith("=")

    def test_invalid_cursor_raises_valueerror(self):
        """Invalid cursor string raises ValueError."""
        with pytest.raises(ValueError, match="Invalid cursor"):
            decode_cursor("not-a-valid-cursor!!!")

    def test_malformed_json_raises_valueerror(self):
        """Malformed JSON in cursor raises ValueError."""
        import base64
        bad_cursor = base64.urlsafe_b64encode(b"not json").decode().rstrip("=")

        with pytest.raises(ValueError, match="Invalid cursor"):
            decode_cursor(bad_cursor)

    def test_missing_keys_raises_valueerror(self):
        """Cursor missing required keys raises ValueError."""
        import base64
        import json
        bad_cursor = base64.urlsafe_b64encode(
            json.dumps({"x": "y"}).encode()
        ).decode().rstrip("=")

        with pytest.raises(ValueError, match="Invalid cursor"):
            decode_cursor(bad_cursor)
