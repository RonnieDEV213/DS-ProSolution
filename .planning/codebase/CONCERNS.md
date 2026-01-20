# Codebase Concerns

**Analysis Date:** 2026-01-18

## Tech Debt

**Hardcoded Single-Org Architecture:**
- Issue: `DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001"` is hardcoded across multiple files instead of being configurable
- Files: `apps/web/src/middleware.ts`, `apps/api/src/app/auth.py`, `apps/api/src/app/routers/admin.py`, `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/app/admin/department-roles/page.tsx`
- Impact: Cannot support multi-tenant deployments without significant refactoring
- Fix approach: Move org_id to a configuration layer, derive from user session or subdomain

**Duplicate API_BASE Definitions:**
- Issue: `API_BASE` URL constant is defined in 9+ files with identical logic (`process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"`)
- Files: `apps/web/src/lib/api.ts`, `apps/web/src/components/admin/users-table.tsx`, `apps/web/src/components/admin/user-edit-dialog.tsx`, `apps/web/src/components/admin/accounts-table.tsx`, `apps/web/src/components/admin/transfer-ownership-dialog.tsx`, `apps/web/src/components/admin/department-roles-table.tsx`, `apps/web/src/components/admin/account-dialog.tsx`, `apps/web/src/components/admin/department-role-dialog.tsx`, `apps/web/src/app/auth/callback/route.ts`
- Impact: If API base needs changing, must update multiple files; increases risk of inconsistency
- Fix approach: Centralize to single export in `apps/web/src/lib/api.ts` and import elsewhere

**Large Monolithic Files:**
- Issue: Several files exceed 600+ lines and handle multiple responsibilities
- Files: `apps/api/src/app/routers/admin.py` (1740 lines), `apps/api/src/app/routers/automation.py` (1508 lines), `apps/web/src/components/bookkeeping/records-table.tsx` (759 lines), `apps/web/src/components/admin/account-dialog.tsx` (677 lines), `apps/web/src/components/admin/department-role-dialog.tsx` (646 lines), `apps/web/src/components/admin/user-edit-dialog.tsx` (621 lines)
- Impact: Hard to test, review, and maintain; increases merge conflict risk
- Fix approach: Split admin.py into separate user, org, department_role modules; extract reusable form logic from dialog components

**Debug Console Logging in Production Code:**
- Issue: `console.log` statements remain in middleware
- Files: `apps/web/src/middleware.ts:19` - has explicit `// DEBUG: Remove after confirming middleware runs` comment
- Impact: Leaks internal path info to browser console; performance overhead
- Fix approach: Remove debug statement or use proper logging infrastructure with levels

**Silent Exception Swallowing:**
- Issue: `pass # User doesn't have access` blocks silently swallow exceptions without distinguishing between "no access" vs "database error"
- Files: `apps/api/src/app/routers/records.py:78-79`, `apps/api/src/app/routers/records.py:91-92`, `apps/api/src/app/routers/records.py:236-237`
- Impact: Makes debugging permission issues difficult; may mask actual errors
- Fix approach: Catch specific exception types or log at debug level

## Known Bugs

**Extension API URL Not Production-Ready:**
- Symptoms: Chrome extension hardcodes localhost API URL
- Files: `packages/extension/service-worker.js:12`
- Trigger: Deploy extension to production without updating URL
- Workaround: Manual URL update before packaging extension

**TODO Comments Indicating Incomplete Features:**
- Symptoms: Selectors for Amazon/eBay extraction may not work
- Files: `packages/extension/content/extract-amazon.js:116`, `packages/extension/content/extract-ebay.js:73`, `packages/extension/content/extract-ebay.js:149`
- Trigger: Run automation against live Amazon/eBay pages
- Workaround: Manual verification of selectors against current page markup

## Security Considerations

**CORS Configuration:**
- Risk: CORS allows only localhost:3000, will break in production
- Files: `apps/api/src/app/main.py:34`
- Current mitigation: Development-only setting
- Recommendations: Configure from environment variable; add production domain whitelist

**JWT Secret Configuration:**
- Risk: Missing `SUPABASE_JWT_SECRET` causes 500 error instead of graceful failure
- Files: `apps/api/src/app/auth.py:74-77`
- Current mitigation: Error message returned
- Recommendations: Fail fast at startup if required env vars are missing

**In-Memory Rate Limiter:**
- Risk: IP throttler resets on server restart; not shared across instances
- Files: `apps/api/src/app/routers/automation.py:109-133`
- Current mitigation: Database-backed rate limiting via `rpc_pairing_request` for persistent state
- Recommendations: Consider Redis for distributed rate limiting when scaling

**Algorithm Validation:**
- Risk: JWT `alg=none` attack vector (already mitigated)
- Files: `apps/api/src/app/routers/automation.py:185-187`
- Current mitigation: Explicit algorithm check `if alg != "HS256"` with rejection
- Recommendations: Current implementation is correct

## Performance Bottlenecks

**Middleware Database Calls:**
- Problem: Every authenticated request hits database twice (membership lookup + potentially role permissions)
- Files: `apps/web/src/middleware.ts:28-33`, `apps/web/src/middleware.ts:53-58`
- Cause: No caching of membership/role data between requests
- Improvement path: Cache membership in session cookie or short-lived token; use ISR patterns

**N+1 Query Pattern (Mitigated):**
- Problem: Admin endpoints could have N+1 patterns for fetching related data
- Files: `apps/api/src/app/routers/admin.py:151-159`
- Cause: Fetching admin notes separately per user
- Improvement path: Already uses bulk query pattern (`in_("user_id", user_ids)`) - well implemented

## Fragile Areas

**Permission System Complexity:**
- Files: `apps/api/src/app/auth.py`, `apps/api/src/app/permissions.py`, `apps/api/src/app/routers/records.py`
- Why fragile: Multiple permission layers (role, department_role, field-level) with alias mappings and implied permissions
- Safe modification: Always add new permissions to both `PERMISSION_KEY_ALIASES` and `IMPLIED_PERMISSIONS` if needed
- Test coverage: `apps/api/tests/test_records_permissions.py` covers field-level permissions; unit tests for `_expand_permission_keys`

**Automation Pairing Flow:**
- Files: `apps/api/src/app/routers/automation.py:338-510`
- Why fragile: Complex state machine with auto-approve, replacement agents, and timeout handling
- Safe modification: Follow existing pattern of creating new agent with `approval_status='replacing'`; always set `requires_checkin=True` for auto-approved
- Test coverage: No test file found for automation endpoints

**Records Remarks System:**
- Files: `apps/api/src/app/routers/records.py:55-94`
- Why fragile: Separate tables (`order_remarks`, `service_remarks`) with RLS enforcement; silent exception handling
- Safe modification: Use `fetch_remarks_for_records` helper; never bypass RLS
- Test coverage: Limited - xfail tests indicate some edge cases not handled

## Scaling Limits

**Single Organization Design:**
- Current capacity: 1 organization
- Limit: Architecture assumes single org_id constant
- Scaling path: Derive org_id from user session; add org_id parameter to all relevant queries

**Extension Agent Pairing:**
- Current capacity: In-memory IP throttle limited to single server instance
- Limit: No distributed state sharing
- Scaling path: Move throttle state to Redis or database

## Dependencies at Risk

**Pydantic Model Validation:**
- Risk: `RecordUpdate` model silently ignores extra fields instead of rejecting them
- Impact: Unknown field attacks could pass through without validation
- Migration plan: Add `model_config = ConfigDict(extra='forbid')` to Pydantic models
- Evidence: Test file has `@pytest.mark.xfail(reason="Pydantic ignores extra fields; model needs extra='forbid'")`

## Missing Critical Features

**Extension Production Configuration:**
- Problem: No mechanism to configure extension API URL for production
- Blocks: Production deployment of Chrome extension

**Multi-Org Support:**
- Problem: Single org hardcoded throughout
- Blocks: SaaS multi-tenant deployment

## Test Coverage Gaps

**Automation Endpoints:**
- What's not tested: Pairing flow, agent authentication, job claiming, agent check-in
- Files: `apps/api/src/app/routers/automation.py`
- Risk: 1500+ line file with complex state machine untested
- Priority: High

**Admin User Management:**
- What's not tested: User listing, role updates, ownership transfer, department role CRUD
- Files: `apps/api/src/app/routers/admin.py`
- Risk: Permission escalation or privilege bypass bugs
- Priority: High

**Frontend Components:**
- What's not tested: No test files found for React components
- Files: All `apps/web/src/components/**/*.tsx`
- Risk: UI regressions, form validation issues
- Priority: Medium

**Integration Tests:**
- What's not tested: End-to-end flows (login -> create record -> view -> export)
- Files: N/A - no E2E test infrastructure
- Risk: Feature integration regressions
- Priority: Medium

---

*Concerns audit: 2026-01-18*
