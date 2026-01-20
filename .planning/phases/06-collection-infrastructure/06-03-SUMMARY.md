---
phase: "06"
plan: "03"
subsystem: "collection-api"
tags: ["sellers", "audit-log", "templates", "progress", "api", "fastapi"]
dependency-graph:
  requires: ["06-02"]
  provides: ["seller-crud-api", "audit-log-api", "run-templates-api", "enhanced-progress-api"]
  affects: ["07-01", "07-02"]
tech-stack:
  added: []
  patterns: ["audit-logging", "snapshot-diff", "run-templates"]
key-files:
  created:
    - apps/api/migrations/038_seller_audit_log.sql
    - apps/api/migrations/039_run_templates.sql
    - apps/api/migrations/040_enhanced_progress.sql
    - apps/api/src/app/routers/sellers.py
  modified:
    - apps/api/src/app/models.py
    - apps/api/src/app/services/collection.py
    - apps/api/src/app/routers/collection.py
    - apps/api/src/app/main.py
    - apps/api/src/app/routers/__init__.py
decisions:
  - key: "audit-log-replay"
    choice: "Reconstruct seller state by replaying log entries"
    rationale: "Simple implementation, handles edits correctly, no need for snapshots"
  - key: "service-role-rls"
    choice: "Service role bypass for new tables (consistent with 06-01)"
    rationale: "All API calls go through authenticated service layer"
metrics:
  duration: "4 min"
  completed: "2026-01-20"
---

# Phase 6 Plan 03: Seller Management & Audit Extensions Summary

**One-liner:** Full seller CRUD API with audit trail, diff calculation, run templates, and enhanced progress tracking

## What Was Built

### 1. Seller Audit Log Schema (Migration 038)
New table `seller_audit_log` tracking all seller changes:
- **Actions:** add, edit, remove
- **Sources:** manual, collection_run, auto_remove
- **State capture:** old_value and new_value JSONB for full history
- **Audit fields:** user_id, source_run_id, source_criteria
- **Bulk tracking:** affected_count for batch operations

### 2. Run Templates Schema (Migration 039)
New table `run_templates` for saving collection configurations:
- Template name and description
- Department selection (TEXT[] array)
- Concurrency setting (1-10)
- Default flag with unique partial index (one default per org)

### 3. Enhanced Progress Tracking (Migration 040)
New columns on `collection_runs` for detailed progress:
- Hierarchical: departments, categories, products, sellers
- Completion tracking: *_total vs *_completed/*_searched
- New seller count: sellers_new for unique additions
- Worker status: JSONB array for real-time per-worker display
- Template reference: template_id FK

### 4. Pydantic Models
Added 13 new models to `models.py`:
- **Seller:** SellerCreate, SellerUpdate, SellerResponse, SellerListResponse
- **Audit:** AuditLogEntry, AuditLogResponse
- **Diff:** SellerDiff, DiffRequest
- **Template:** RunTemplateCreate, RunTemplateUpdate, RunTemplateResponse, RunTemplateListResponse
- **Progress:** WorkerStatus, EnhancedProgress

### 5. CollectionService Extensions
Added 15 new methods to `collection.py`:
- **Seller CRUD:** get_sellers, add_seller, update_seller, remove_seller
- **Audit:** _log_seller_change, get_audit_log, get_sellers_at_log
- **Diff:** calculate_diff (set operations on seller lists)
- **Templates:** get_templates, create_template, update_template, delete_template
- **Progress:** get_enhanced_progress with cost_status calculation

### 6. Sellers Router (`/sellers`)
New router with 8 endpoints:
| Method | Path | Description |
|--------|------|-------------|
| GET | /sellers | List all sellers |
| POST | /sellers | Add seller manually |
| PATCH | /sellers/{id} | Update seller name |
| DELETE | /sellers/{id} | Remove seller |
| GET | /sellers/audit-log | Get change history |
| GET | /sellers/audit-log/{id}/sellers | Get sellers at log point |
| POST | /sellers/diff | Calculate diff between snapshots |
| GET | /sellers/export | Export as JSON/CSV/text |

### 7. Collection Router Extensions
Added 5 endpoints:
| Method | Path | Description |
|--------|------|-------------|
| GET | /collection/runs/{id}/progress | Enhanced progress with workers |
| GET | /collection/templates | List templates |
| POST | /collection/templates | Create template |
| PATCH | /collection/templates/{id} | Update template |
| DELETE | /collection/templates/{id} | Delete template |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cbdd30c | Seller audit log migration |
| 2 | 35aad20 | Run templates migration |
| 3 | 4a1ae7b | Enhanced progress migration |
| 4 | c42bd51 | Pydantic models |
| 5 | c016f5b | CollectionService extensions |
| 6 | 1d9cd79 | Sellers router |
| 7 | e6e8285 | Collection router extensions |
| 8 | 6dee2d0 | Router registration |

## Deviations from Plan

### Adaptation to Existing Patterns
**[Rule 3 - Blocking]** Adapted plan code to match existing codebase patterns:
- Used `display_name` / `normalized_name` (existing sellers table schema) instead of just `name`
- Used Supabase client pattern (sync calls) instead of raw SQL
- Added export to routers/__init__.py (required for import to work)

## Decisions Made

1. **Audit log replay for snapshots:** Reconstruct seller state by replaying add/edit/remove entries up to timestamp. Simple implementation without need for separate snapshot tables.

2. **Service role RLS:** Consistent with 06-01, all new tables use service_role bypass. API layer handles auth.

3. **Seller name normalization:** Reused existing pattern - lowercase, strip, collapse whitespace.

## Pending Migrations

Run in Supabase SQL editor:
- 038_seller_audit_log.sql
- 039_run_templates.sql
- 040_enhanced_progress.sql

## Next Phase Readiness

Phase 6 complete. Phase 7 (Scraping Integration) can now use:
- Full seller CRUD with audit trail
- Run templates for saved configurations
- Enhanced progress for detailed UI updates
- Diff calculation for comparing collection results

All backend infrastructure is in place for the Collections UI.
