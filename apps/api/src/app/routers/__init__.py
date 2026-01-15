from .accounts import router as accounts_router
from .admin import router as admin_router
from .auth import router as auth_router
from .records import router as records_router

__all__ = ["accounts_router", "admin_router", "auth_router", "records_router"]
