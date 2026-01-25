import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    access_codes_router,
    accounts_router,
    admin_router,
    amazon_router,
    auth_router,
    automation_router,
    collection_router,
    export_router,
    import_router,
    presence_router,
    records_router,
    sellers_router,
    sync_router,
)
from app.background import (
    cleanup_worker,
    collection_startup_recovery,
    scheduler_shutdown,
    scheduler_startup,
)

_cleanup_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - start/stop background tasks."""
    global _cleanup_task
    # Startup
    _cleanup_task = asyncio.create_task(cleanup_worker())

    # Check for interrupted collection runs
    await collection_startup_recovery()

    # Start scheduler and load schedules
    await scheduler_startup()

    yield

    # Shutdown
    scheduler_shutdown()

    if _cleanup_task:
        _cleanup_task.cancel()
        try:
            await _cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="DS-ProSolution API", version="0.1.0", lifespan=lifespan)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(access_codes_router)
app.include_router(accounts_router)
app.include_router(admin_router)
app.include_router(amazon_router)
app.include_router(auth_router)
app.include_router(automation_router)
app.include_router(collection_router)
app.include_router(export_router)
app.include_router(import_router)
app.include_router(presence_router)
app.include_router(records_router)
app.include_router(sellers_router)
app.include_router(sync_router)


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/version")
async def version():
    return {"version": "0.1.0"}
