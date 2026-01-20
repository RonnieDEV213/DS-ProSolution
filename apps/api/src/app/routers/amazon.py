"""Amazon Best Sellers API endpoints.

Provides:
- Category listing (departments and subcategories)
- Category preset CRUD (list, create, delete)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_permission_key
from app.database import get_supabase
from app.models import (
    AmazonCategoriesResponse,
    AmazonCategory,
    AmazonDepartment,
    CategoryPresetCreate,
    CategoryPresetListResponse,
    CategoryPresetResponse,
)
from app.services.scrapers import AmazonScraperService

router = APIRouter(prefix="/amazon", tags=["amazon"])
logger = logging.getLogger(__name__)


def get_scraper_service() -> AmazonScraperService:
    """Get scraper service for category data."""
    # Use base class for category loading (doesn't need credentials)
    from app.services.scrapers.base import AmazonScraperService as BaseService

    # Create a minimal instance just for get_categories
    class CategoryLoader(BaseService):
        async def fetch_bestsellers(self, category_node_id: str, page: int = 1):
            raise NotImplementedError("Use OxylabsAmazonScraper for actual fetching")

    return CategoryLoader()


# ============================================================
# Category Endpoints
# ============================================================


@router.get("/categories", response_model=AmazonCategoriesResponse)
async def get_categories(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Get all Amazon departments and categories.

    Returns hierarchical list of departments with their child categories.
    Categories include browse node IDs for API queries.

    Requires admin.automation permission.
    """
    service = get_scraper_service()
    raw_departments = service.get_categories()

    departments = [
        AmazonDepartment(
            id=dept["id"],
            name=dept["name"],
            node_id=dept["node_id"],
            categories=[
                AmazonCategory(
                    id=cat["id"],
                    name=cat["name"],
                    node_id=cat["node_id"],
                )
                for cat in dept.get("categories", [])
            ],
        )
        for dept in raw_departments
    ]

    return AmazonCategoriesResponse(departments=departments)


# ============================================================
# Preset Endpoints
# ============================================================


@router.get("/presets", response_model=CategoryPresetListResponse)
async def list_presets(
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Get all category presets for the organization.

    Returns both built-in presets (Select All) and custom user presets.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    supabase = get_supabase()

    result = (
        supabase.table("amazon_category_presets")
        .select("id, name, category_ids, is_builtin, created_at")
        .eq("org_id", org_id)
        .order("is_builtin", desc=True)  # Built-in first
        .order("name")
        .execute()
    )

    presets = [
        CategoryPresetResponse(
            id=p["id"],
            name=p["name"],
            category_ids=p["category_ids"],
            is_builtin=p["is_builtin"],
            created_at=p["created_at"],
        )
        for p in (result.data or [])
    ]

    return CategoryPresetListResponse(presets=presets)


@router.post("/presets", response_model=CategoryPresetResponse, status_code=201)
async def create_preset(
    data: CategoryPresetCreate,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Create a custom category preset.

    Saves the current category selection with a name for quick access.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    user_id = user["user_id"]
    supabase = get_supabase()

    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Preset name is required")

    if not data.category_ids:
        raise HTTPException(status_code=400, detail="At least one category required")

    # Check for duplicate name
    existing = (
        supabase.table("amazon_category_presets")
        .select("id")
        .eq("org_id", org_id)
        .eq("name", data.name.strip())
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=409, detail="Preset with this name already exists")

    preset_data = {
        "org_id": org_id,
        "name": data.name.strip(),
        "category_ids": data.category_ids,
        "is_builtin": False,
        "created_by": user_id,
    }

    result = supabase.table("amazon_category_presets").insert(preset_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create preset")

    preset = result.data[0]
    logger.info(f"Created category preset '{preset['name']}' for org {org_id}")

    return CategoryPresetResponse(
        id=preset["id"],
        name=preset["name"],
        category_ids=preset["category_ids"],
        is_builtin=preset["is_builtin"],
        created_at=preset["created_at"],
    )


@router.delete("/presets/{preset_id}", status_code=204)
async def delete_preset(
    preset_id: str,
    user: dict = Depends(require_permission_key("admin.automation")),
):
    """
    Delete a custom category preset.

    Built-in presets cannot be deleted.

    Requires admin.automation permission.
    """
    org_id = user["membership"]["org_id"]
    supabase = get_supabase()

    # Check if preset exists and is not builtin
    existing = (
        supabase.table("amazon_category_presets")
        .select("id, is_builtin")
        .eq("id", preset_id)
        .eq("org_id", org_id)
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Preset not found")

    if existing.data[0]["is_builtin"]:
        raise HTTPException(status_code=400, detail="Cannot delete built-in preset")

    supabase.table("amazon_category_presets").delete().eq("id", preset_id).execute()
    logger.info(f"Deleted category preset {preset_id}")
