# Roadmap: DS-ProSolution

## Milestones

- v1 Extension Auth & RBAC (Phases 1-7) - shipped 2026-01-20
- v2 SellerCollection (Phases 8-14) - shipped 2026-01-23
- v3 Storage & Rendering Infrastructure (Phases 15-21) - shipped 2026-01-25
- v4 UI/Design System (Phases 22-26) - in progress

## Phases

<details>
<summary>v1 Extension Auth & RBAC (Phases 1-7) - SHIPPED 2026-01-20</summary>

See: .planning/milestones/v1-ROADMAP.md

</details>

<details>
<summary>v2 SellerCollection (Phases 8-14) - SHIPPED 2026-01-23</summary>

See: .planning/milestones/v2-ROADMAP.md

</details>

<details>
<summary>v3 Storage & Rendering Infrastructure (Phases 15-21) - SHIPPED 2026-01-25</summary>

See: .planning/milestones/v3-ROADMAP.md

</details>

### v4 UI/Design System (In Progress)

**Milestone Goal:** Transform DS-ProSolution into a polished Modern SaaS application with custom UI components and preset themes -- CSS-first, zero-re-render theme switching, performance-neutral minimum.

See: .planning/milestones/v4-ROADMAP.md for full phase details.

- [x] **Phase 22: Theme Foundation & Color Token Migration** - CSS variable token system, ThemeProvider, scrollbar theming, type scale ✓ 2026-01-25
  **Plans:** 4 plans
  - [x] 22-01-PLAN.md -- CSS token system, dark theme selector migration, scrollbar styles, type scale
  - [x] 22-02-PLAN.md -- Install next-themes, create ThemeProvider, integrate into root layout
  - [x] 22-03-PLAN.md -- Gap closure: fix hardcoded colors, scrollbar class migration
  - [x] 22-04-PLAN.md -- Gap closure: dual class+attribute ThemeProvider for Turbopack compatibility
- [x] **Phase 23: Theme Presets & Switching** - 4 preset themes, switcher UI, persistence, system preference detection ✓ 2026-01-26
  **Plans:** 4 plans
  - [x] 23-01-PLAN.md -- CSS theme presets (Midnight/Dawn/Slate/Carbon), selection/accent-color styles, view transition CSS, theme metadata & utility modules
  - [x] 23-02-PLAN.md -- ThemeProvider multi-theme config, system preference mapping (OS dark->Carbon, light->Dawn), themed Sonner toasts
  - [x] 23-03-PLAN.md -- Theme picker component with preview cards, ProfileSettingsDialog Theme tab, sidebar footer popover toggle
  - [x] 23-04-PLAN.md -- Human verification: all themes, transitions, picker UI, persistence, system detection
- [ ] **Phase 24: Layout Component Consolidation** - Unified sidebar, breadcrumbs, page headers, spacing conventions
  **Plans:** 4 plans
  - [ ] 24-01-PLAN.md -- Install shadcn/ui sidebar + breadcrumb primitives, NavItem types, navigation configs, spacing constants
  - [ ] 24-02-PLAN.md -- Create AppSidebar, BreadcrumbNav, and PageHeader layout components
  - [ ] 24-03-PLAN.md -- Refactor Admin/VA/Client layouts to use unified components, delete old sidebar
  - [ ] 24-04-PLAN.md -- Human verification: all dashboards, navigation, RBAC, keyboard shortcuts
- [x] **Phase 25: Component Color Migration** - All 60+ files migrated from hardcoded grays to semantic tokens, monospace data formatting, theme verification ✓ 2026-01-26
  **Plans:** 8 plans
  - [x] 25-01-PLAN.md -- Bookkeeping components: semantic token migration + monospace data formatting (11 files, ~152 occurrences)
  - [x] 25-02-PLAN.md -- Data management components + UI primitives migration (11 files, ~51 occurrences)
  - [x] 25-03-PLAN.md -- Admin core tables + dialogs migration (10 files, ~157 occurrences)
  - [x] 25-04-PLAN.md -- Admin automation + collection workers/sellers migration (8 files, ~178 occurrences)
  - [x] 25-05-PLAN.md -- Admin collection history, metrics, config, progress migration (14 files, ~177 occurrences)
  - [x] 25-06-PLAN.md -- Profile, sync, VA components + all page.tsx files migration (23 files, ~100 occurrences)
  - [x] 25-07-PLAN.md -- Automated audit + human verification across all 4 themes
  - [x] 25-08-PLAN.md -- Gap closure: UAT fixes for status column, COGS pill, scrollbars, history spacing
- [ ] **Phase 26: Polish & Micro-interactions** - Transitions, skeletons, empty states, command palette, keyboard shortcuts
  **Plans:** 6 plans
  - [ ] 26-01-PLAN.md -- CSS micro-interactions (button press, card hover, shimmer keyframe, fade-in, reduced-motion)
  - [ ] 26-02-PLAN.md -- Install cmdk + react-hotkeys-hook, create shortcuts registry + command items + Kbd component
  - [ ] 26-03-PLAN.md -- Skeleton loading states (base primitive + dashboard/table/card-grid skeletons, shimmer upgrade)
  - [ ] 26-04-PLAN.md -- Empty state components (4 variants with inline SVG illustrations + CTA buttons)
  - [ ] 26-05-PLAN.md -- Command palette + keyboard shortcuts + shortcuts reference modal + layout integration
  - [ ] 26-06-PLAN.md -- Human verification: all 10 POLISH items across all themes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7   | v1 | 12/12 | Complete | 2026-01-20 |
| 8-14  | v2 | 37/37 | Complete | 2026-01-23 |
| 15-21 | v3 | 23/23 | Complete | 2026-01-25 |
| 22 | v4 | 4/4 | Complete | 2026-01-25 |
| 23 | v4 | 4/4 | Complete | 2026-01-26 |
| 24 | v4 | 0/4 | Not started | - |
| 25 | v4 | 8/8 | Complete | 2026-01-26 |
| 26 | v4 | 0/6 | Not started | - |

**Total:** 4 milestones, 26 phases, 88 plans (88 shipped)

---
*Roadmap created: 2026-01-17*
*Last updated: 2026-01-26 - Phase 25 complete (all 8 plans shipped, UAT gaps closed)*
