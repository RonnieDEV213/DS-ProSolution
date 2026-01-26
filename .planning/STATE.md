# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-25)

**Core value:** Automate repetitive eBay operations so the business can scale without proportional headcount growth
**Current focus:** v4 UI/Design System - Phase 23 complete, next: Phase 24 Layout Component Consolidation

## Current Position

Phase: 25 of 26 (Component Color Migration)
Plan: 1 of 7
Status: In progress — bookkeeping components migrated to semantic tokens
Last activity: 2026-01-26 — Completed 25-01-PLAN.md

Progress: [██████░░░░] 69% (v4 milestone, 12 of ~17 plans estimated)

## Shipped Milestones

- **v3 Storage & Rendering Infrastructure** (2026-01-25) - 7 phases, 23 plans
  - See: .planning/milestones/v3-ROADMAP.md

- **v2 SellerCollection** (2026-01-23) - 9 phases, 37 plans
  - See: .planning/milestones/v2-ROADMAP.md

- **v1 Extension Auth & RBAC** (2026-01-20) - 7 phases, 12 plans
  - See: .planning/milestones/v1-ROADMAP.md

## Performance Metrics

**Historical:**
- v3: 23 plans in 2 days
- v2: 37 plans in 4 days
- v1: 12 plans in 3 days

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table.

Phase 23 decisions:
- Used oklch() color space consistently across all 4 theme presets
- True #000000 black in Carbon theme for OLED battery savings with near-white text (oklch 0.97) to reduce halation
- Hardcoded hex preview colors in theme metadata for preview cards (not CSS variables)
- View Transitions API with progressive enhancement (instant fallback on unsupported browsers)
- SystemThemeMapper manipulates DOM attributes directly (not setTheme) to preserve "system" in localStorage
- Each theme has unique accent hue: Midnight=blue(250), Dawn=indigo(264), Slate=teal(175), Carbon=purple(300)

Phase 24 decisions:
- Manually created shadcn/ui components (sidebar, breadcrumb) due to Windows CLI prompt issues
- Cookie persistence for sidebar state with 7-day max age (cookie: "sidebar:state")
- Cmd+B/Ctrl+B keyboard shortcut for sidebar toggle
- Lucide icon names stored as PascalCase strings in navigation configs
- Fragment wrapper for AppSidebar to render ProfileSettingsDialog as sibling (dialog outside sidebar DOM)
- Semantic color tokens replacing hardcoded gray-* classes for theme compatibility
- Dynamic icon rendering: LucideIcons[iconName as keyof typeof LucideIcons] pattern
- PageHeader is server-compatible (no "use client") for RSC and client component use
- Made layouts "use client" components because SidebarProvider requires client context
- Placed BreadcrumbNav inside main content area rather than in sidebar

Phase 25 decisions:
- Monospace pill pattern: Data values use font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10
- Table data column headers use font-mono for visual alignment with cell data
- Strikethrough text uses text-muted-foreground/70 for theme-aware disabled appearance
- SelectContent pattern: bg-popover border-border with hover:bg-accent on items

### Pending Todos

None.

### Blockers/Concerns

**v4 constraint:** Performance-neutral minimum, performance-positive preferred. All UI changes must use CSS-first approach to avoid compute overhead.
**v4 constraint:** Theme switching must trigger ZERO React re-renders -- CSS variable cascade only.
**v4 constraint:** No CSS-in-JS, no JS scrollbar libraries. Scrollbar styling must be CSS-only to preserve react-window virtualization.

## Session Continuity

Last session: 2026-01-26 11:48 UTC
Stopped at: Completed 25-01-PLAN.md (Bookkeeping Component Color Migration)
Resume file: None
Next action: Continue Phase 25 plans 02-07 (remaining component directories)
