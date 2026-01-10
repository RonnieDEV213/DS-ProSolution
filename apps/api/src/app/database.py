import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


@lru_cache
def get_supabase() -> Client:
    """Get Supabase client with service role key (admin access, bypasses RLS)."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(url, key)


def get_supabase_for_user(access_token: str) -> Client:
    """
    Create Supabase client with user's access token for RLS enforcement.

    This ensures the user can only access data they're authorized to see
    based on the RLS policies defined in the database.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    return create_client(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {access_token}"}),
    )
