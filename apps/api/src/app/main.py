from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import accounts_router, admin_router, auth_router, records_router

app = FastAPI(title="DS-ProSolution API", version="0.1.0")

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(accounts_router)
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(records_router)


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/version")
async def version():
    return {"version": "0.1.0"}
