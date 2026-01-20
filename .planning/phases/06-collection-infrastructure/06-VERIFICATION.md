# Phase 6: Collection Infrastructure - Verification

## Success Criteria

| # | Criteria | Status |
|---|----------|--------|
| 1 | Admin can trigger a collection run from the web app | |
| 2 | Collection run displays estimated API cost before starting | |
| 3 | Collection run aborts if budget cap would be exceeded | |
| 4 | Job state persists across API restarts (checkpointing) | |
| 5 | Admin can view/edit/add/remove sellers directly | |
| 6 | All seller changes are logged with full audit trail | |
| 7 | Admin can compare seller list snapshots (diff view) | |

---

## Claude Chrome Extension Audit Prompt

Copy and paste the following prompt into Claude to audit the Collections feature:

```
You are auditing a web application's "Collections" feature. Navigate to Admin > Extension Hub > Collections tab and verify each item below. For each item, mark PASS or FAIL and note any issues.

## Test Environment
- URL: http://localhost:3000/admin/automation
- Tab: Collections

## Verification Checklist

### 1. Sellers Grid
[ ] Grid is visible and displays sellers with numbers (1., 2., 3.)
[ ] ADD: Type a name in "Add seller..." input and press Enter - seller appears
[ ] EDIT: Click a seller cell - it becomes editable, type new name, press Enter
[ ] DELETE: Hover a seller cell, click X button - seller is removed
[ ] EXPORT: Click "Export" dropdown - verify 3 options appear (Download CSV, Copy JSON, Copy Raw Text)
[ ] EXPORT: Test each export option works without errors

### 2. Recent Activity Sidebar
[ ] Sidebar shows list of recent edit logs (add/edit/remove actions)
[ ] Each log shows action icon, seller name, and relative timestamp
[ ] Clicking header "Recent Activity" opens Log Detail modal

### 3. Log Detail Modal
[ ] Left panel shows "Sellers at this point" as a grid with numbers
[ ] Right panel shows "Full History" list
[ ] Clicking different logs updates left panel sellers list
[ ] Export dropdown on sellers panel works
[ ] CLOSE: Clicking outside modal closes it (no X button)

### 4. Compare Feature
[ ] Click "Compare" button - 2 most recent logs are pre-selected
[ ] Checkmarks appear on selected logs
[ ] Clicking selected log unselects it
[ ] Clicking unselected log selects it (max 2)
[ ] Shows "Select 2 logs to compare (X/2)" count
[ ] Compare button enabled only when exactly 2 selected
[ ] Click Compare - Diff modal opens

### 5. Diff Modal
[ ] Shows two columns: source and target snapshots
[ ] Shows "+X added" and "-X removed" summary
[ ] Added sellers highlighted green with "+" prefix
[ ] Removed sellers highlighted red with "-" prefix
[ ] Both lists show numbering
[ ] Modal width is reasonable (not too wide)

### 6. Run Configuration (if testable)
[ ] "Start Collection" button in sidebar opens config modal
[ ] Config modal shows department/category selection
[ ] Shows estimated cost
[ ] Has template save option

### 7. Progress Bar (if active run exists)
[ ] Progress bar appears at top when run is active
[ ] Shows: Cost (current/budget), Depts, Cats, Products, +New Sellers
[ ] Cost color: green=safe, yellow=warning, red=exceeded
[ ] Pause button (yellow) visible
[ ] Cancel button (red square) visible
[ ] Details button expands/shows more info
[ ] Progress bar hidden when no active run

## Summary
Total PASS: __/25
Total FAIL: __/25

Issues Found:
1.
2.
3.

Recommendations:
1.
2.
```

---

## Manual Testing Notes

### Prerequisites
1. Run migrations 038, 039, 040 in Supabase SQL editor
2. Start API: `cd apps/api && uvicorn app.main:app --reload --app-dir src`
3. Start web: `cd apps/web && npm run dev`
4. Navigate to http://localhost:3000/admin/automation
5. Click "Collections" tab

### Test Data Setup
- Add 3-5 test sellers manually
- Edit one seller name
- Delete one seller
- This creates audit log entries for testing

---

## Verification Date

**Verified by:** _______________
**Date:** _______________
**Result:** [ ] APPROVED / [ ] NEEDS FIXES

**Notes:**
