"""JWT authentication for Supabase tokens."""

import os

from dotenv import load_dotenv
import jwt

load_dotenv()
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

# auto_error=False so we can return 401 (not 403) on missing header
security = HTTPBearer(auto_error=False)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# JWKS client for RS256/ES256 (lazy loaded)
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    """Get or create JWKS client for RS256/ES256 verification."""
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """
    Validate Supabase JWT and extract user info.

    Supports both HS256 (with JWT secret) and RS256/ES256 (with JWKS).
    Returns dict with user_id and token for downstream use.
    """
    # Check for missing credentials
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        # Decode header to check algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        if alg == "HS256":
            # Verify with JWT secret
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=500, detail="JWT secret not configured"
                )
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=f"{SUPABASE_URL}/auth/v1",
            )
        else:
            # Verify with JWKS (RS256, ES256)
            jwks_client = get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience="authenticated",
                issuer=f"{SUPABASE_URL}/auth/v1",
            )

        return {"user_id": payload["sub"], "token": token}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
