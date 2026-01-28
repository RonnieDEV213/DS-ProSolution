# Milestone v4: UI/Design System

**Status:** SHIPPED 2026-01-27
**Phases:** 22-28 (22-26 original scope + 27-28 bonus)
**Total Plans:** 30

## Overview

v4 UI/Design System transforms DS-ProSolution from a functional dark-only dashboard into a polished, themeable Modern SaaS experience with Linear/Notion/Vercel-level aesthetics. The roadmap follows a strict dependency chain: first establish the CSS variable token system and ThemeProvider infrastructure (Phase 22), then build preset themes and the switching UI (Phase 23), consolidate three duplicate sidebar implementations into shared layout primitives (Phase 24), migrate all remaining hardcoded colors to semantic tokens (Phase 25), and finish with micro-interactions and polish that elevate from "works" to "feels premium" (Phase 26). Two bonus phases added sidebar reorganization (Phase 27) and collection sync infrastructure (Phase 28). Every phase is CSS-first with zero runtime JS for theming. The single new runtime dependency is `next-themes` (~2KB). Net performance impact is positive.

## Critical Constraints

- **Performance-neutral minimum, performance-positive preferred** -- UI changes must not add compute cost
- **CSS-first approach** -- CSS variables for all theming, no runtime JS for theme application
- **No CSS-in-JS** -- no styled-components, no Emotion, no runtime style computation
- **No JS scrollbar libraries** -- CSS-only scrollbar styling to preserve react-window virtualization
- **Theme switching triggers ZERO React re-renders** -- CSS variable cascade only

## Phases

- [x] **Phase 22: Theme Foundation & Color Token Migration** - CSS variable token system, ThemeProvider, scrollbar theming, type scale
- [x] **Phase 23: Theme Presets & Switching** - 4 preset themes, switcher UI, persistence, system preference detection
- [x] **Phase 24: Layout Component Consolidation** - Unified sidebar, breadcrumbs, page headers, spacing conventions
- [x] **Phase 25: Component Color Migration** - All 30+ files migrated from hardcoded grays to semantic tokens
- [x] **Phase 26: Polish & Micro-interactions** - Transitions, skeletons, empty states, command palette, keyboard shortcuts
- [x] **Phase 27: Sidebar Folder Reorganization** (bonus) - 3 collapsible section groups, modal consolidation, Automation Hub rename
- [x] **Phase 28: Collection Storage & Rendering Infrastructure** (bonus) - V3 sync wired into collection SellersGrid
- [ ] **Phase 28.1: v4 Tech Debt Cleanup** - Fix 4 non-blocking tech debt items from milestone audit

## Phase Details

### Phase 22: Theme Foundation & Color Token Migration

**Goal**: Application has a complete semantic CSS variable token system with ThemeProvider infrastructure, enabling all downstream theming work
**Depends on**: Nothing (first phase of v4)
**Status**: PASSED (17/17 must-haves)
**Plans**: 3 plans (22-01, 22-02, 22-03 gap closure)

### Phase 23: Theme Presets & Switching

**Goal**: Users can choose from 4 distinct visual themes with their preference persisting across sessions
**Depends on**: Phase 22 (requires token system and ThemeProvider)
**Status**: PASSED (9/9 must-haves)
**Plans**: 4 plans (23-01 through 23-04)

### Phase 24: Layout Component Consolidation

**Goal**: Admin, VA, and Client dashboards share unified layout primitives with a collapsible sidebar, consistent navigation, and standardized page structure
**Depends on**: Phase 23 (layout components use semantic tokens from working theme system)
**Status**: PASSED (8/8 must-haves)
**Plans**: 4 plans (24-01 through 24-04)

### Phase 25: Component Color Migration

**Goal**: Every component file in the application uses semantic tokens, making theme switching visually complete across the entire UI
**Depends on**: Phase 24 (layout components establish the migration pattern; non-layout components follow)
**Status**: PASSED (5/5 must-haves)
**Plans**: 8 plans (25-01 through 25-08)

### Phase 26: Polish & Micro-interactions

**Goal**: The application feels premium with smooth transitions, informative loading states, and keyboard-driven power-user workflows
**Depends on**: Phase 25 (polish requires all components themed; interactions overlay on stable UI)
**Status**: PASSED (35/35 must-haves)
**Plans**: 9 plans (26-01 through 26-09)

### Phase 27: Sidebar Folder Reorganization (Bonus)

**Goal**: Reorganize sidebar into 3 collapsible section groups with role-based visibility, consolidate Access Profiles/Invites/Pairing Request into modals
**Depends on**: Phase 24 (requires unified sidebar infrastructure)
**Status**: PASSED (6/6 must-haves, after audit gap fix)
**Plans**: 7 plans (27-01 through 27-07)

### Phase 28: Collection Storage & Rendering Infrastructure (Bonus)

**Goal**: Wire v3 sync infrastructure into collection SellersGrid, replacing direct fetch+useState with cache-first offline-capable architecture
**Depends on**: Phase 18 (v3 IndexedDB/sync infrastructure)
**Status**: PASSED (14/14 must-haves)
**Plans**: 7 plans (28-01 through 28-07)

### Phase 28.1: v4 Tech Debt Cleanup

**Goal**: Address 4 non-blocking tech debt items identified in the v4 milestone audit
**Depends on**: Phase 27, Phase 24, Phase 26 (items originate from these phases)
**Status**: Pending
**Tech Debt Items**:
  1. **TD-1 (Phase 27)**: Naming inconsistency — `/admin/automation` breadcrumb says "Collection" but PageHeader says "Automation Hub". Align to one name.
  2. **TD-2 (Phase 27)**: Stale standalone pages — `/admin/department-roles` and `/admin/invites` still exist as routable pages despite modal consolidation to `/admin/users`. Remove or redirect.
  3. **TD-3 (Phase 24)**: Dead export — `SPACING` and `GAPS` constants in `lib/spacing.ts` exported but never imported. Remove dead code.
  4. **TD-4 (Phase 26)**: Unused component — `CardGridSkeleton` created but no page uses it. Wire into a page or remove.
**Plans**: TBD

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01..05 | Phase 22 | Complete |
| SCROLL-01..05 | Phase 22 | Complete |
| TYPE-01..02 | Phase 22 | Complete |
| PRESET-01..06 | Phase 23 | Complete |
| SWITCH-01..05 | Phase 23 | Complete |
| LAYOUT-01..08 | Phase 24 | Complete |
| MIGRATE-01..07 | Phase 25 | Complete |
| TYPE-03..04 | Phase 25 | Complete |
| POLISH-01..10 | Phase 26 | Complete |

**Total: 50 requirements shipped across 5 original phases + 2 bonus phases. 0 orphaned.**

---

## Milestone Summary

**Key Decisions:**

| Decision | Rationale |
|----------|-----------|
| CSS variables + data-theme attribute | Zero-rerender theme switching |
| next-themes for ThemeProvider | Tiny library (~2KB), handles SSR + flash prevention |
| oklch color space for theme tokens | Modern, perceptually uniform, wide gamut |
| View Transitions API for theme switching | Native browser API, progressive enhancement fallback |
| shadcn/ui sidebar primitives | Consistent with existing component library |
| cmdk + react-hotkeys-hook | Lightweight, well-maintained, lazy-loadable |
| CSS shimmer animation for skeletons | Theme-aware, no JS animation overhead |
| Inline SVG for empty state illustrations | No external deps, theme-aware via currentColor |

**Issues Resolved:**
- Dark-only UI with no theme support
- Three duplicate sidebar implementations
- 172+ hardcoded gray color references
- No keyboard shortcuts or command palette
- "Loading..." text instead of skeleton states
- No empty state designs
- No unified layout primitives
- Collection page used direct fetch+useState

**Technical Debt Incurred:** None

---
*Roadmap created: 2026-01-25*
*Shipped: 2026-01-27*
