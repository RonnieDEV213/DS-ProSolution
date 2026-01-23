"""Access code generation, hashing, and validation service.

This module handles:
- Cryptographically secure code generation (prefix + secret)
- Argon2id hashing of secrets
- Validation of access codes
- Custom secret validation
"""

import os
import secrets
import string
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Constants
ALPHABET = string.ascii_letters + string.digits  # A-Za-z0-9 (62 chars)
PREFIX_LENGTH = 4
SECRET_LENGTH = 12
CODE_EXPIRY_DAYS = 90
ACCESS_TOKEN_EXPIRY_MINUTES = 15

# Argon2 hasher with default (RFC 9106 LOW_MEMORY profile)
ph = PasswordHasher()

# JWT secret for access code tokens (separate from Supabase JWT secret)
ACCESS_CODE_JWT_SECRET = os.getenv("ACCESS_CODE_JWT_SECRET")


def generate_prefix() -> str:
    """Generate 4-character case-sensitive alphanumeric prefix."""
    return "".join(secrets.choice(ALPHABET) for _ in range(PREFIX_LENGTH))


def generate_secret() -> str:
    """Generate 12-character case-sensitive alphanumeric secret."""
    return "".join(secrets.choice(ALPHABET) for _ in range(SECRET_LENGTH))


def validate_custom_secret(secret: str) -> list[str]:
    """Validate custom secret meets requirements.

    Requirements:
    - At least 12 characters
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit

    Returns list of validation errors (empty if valid).
    """
    errors = []
    if len(secret) < SECRET_LENGTH:
        errors.append(f"Secret must be at least {SECRET_LENGTH} characters")
    if not any(c.isupper() for c in secret):
        errors.append("Secret must contain at least one uppercase letter")
    if not any(c.islower() for c in secret):
        errors.append("Secret must contain at least one lowercase letter")
    if not any(c.isdigit() for c in secret):
        errors.append("Secret must contain at least one number")
    return errors


def hash_secret(secret: str) -> str:
    """Hash secret with Argon2id.

    Returns hash string that includes algorithm parameters.
    """
    return ph.hash(secret)


def verify_secret(stored_hash: str, provided_secret: str) -> bool:
    """Verify secret against stored hash.

    Returns True if match, False otherwise.
    Handles all Argon2 verification exceptions internally.
    """
    try:
        ph.verify(stored_hash, provided_secret)
        return True
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def check_needs_rehash(stored_hash: str) -> bool:
    """Check if hash needs to be updated (after parameter changes)."""
    return ph.check_needs_rehash(stored_hash)


def parse_access_code(full_code: str) -> tuple[str, str] | None:
    """Parse access code into prefix and secret.

    Expected format: XXXX-XXXXXXXXXXXX (4 char prefix, hyphen, 12+ char secret)

    Returns (prefix, secret) tuple or None if invalid format.
    """
    if not full_code or "-" not in full_code:
        return None

    parts = full_code.split("-", 1)
    if len(parts) != 2:
        return None

    prefix, secret = parts
    if len(prefix) != PREFIX_LENGTH:
        return None
    if len(secret) < SECRET_LENGTH:
        return None

    return prefix, secret


def calculate_expiry() -> datetime:
    """Calculate expiry datetime (90 days from now)."""
    return datetime.now(timezone.utc) + timedelta(days=CODE_EXPIRY_DAYS)


def generate_access_token(
    user_id: str,
    membership_id: str,
    org_id: str,
) -> tuple[str, int]:
    """Generate JWT for access code authentication.

    Returns (token, expires_in_seconds) tuple.

    The token includes a 'type' claim to distinguish from Supabase tokens.
    """
    if not ACCESS_CODE_JWT_SECRET:
        raise ValueError("ACCESS_CODE_JWT_SECRET environment variable not set")

    now = datetime.now(timezone.utc)
    expires_in = ACCESS_TOKEN_EXPIRY_MINUTES * 60

    payload = {
        "sub": user_id,
        "membership_id": membership_id,
        "org_id": org_id,
        "type": "access_code",  # Distinguish from Supabase tokens
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRY_MINUTES),
    }

    token = jwt.encode(payload, ACCESS_CODE_JWT_SECRET, algorithm="HS256")
    return token, expires_in
