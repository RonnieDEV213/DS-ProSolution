from .access_codes import router as access_codes_router
from .accounts import router as accounts_router
from .admin import router as admin_router
from .auth import router as auth_router
from .automation import router as automation_router
from .records import router as records_router

__all__ = [
    "access_codes_router",
    "accounts_router",
    "admin_router",
    "auth_router",
    "automation_router",
    "records_router",
]
