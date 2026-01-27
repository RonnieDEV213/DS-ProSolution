# Roadmap: DS-ProSolution

## Milestones

- v1 Extension Auth & RBAC (Phases 1-7) - shipped 2026-01-20
- v2 SellerCollection (Phases 8-14) - shipped 2026-01-23
- v3 Storage & Rendering Infrastructure (Phases 15-21) - shipped 2026-01-25
- v4 UI/Design System (Phases 22-28) - shipped 2026-01-27

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

### v4 UI/Design System (COMPLETE)

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
- [x] **Phase 24: Layout Component Consolidation** - Unified sidebar, breadcrumbs, page headers, spacing conventions ✓ 2026-01-26
  **Plans:** 4 plans
  - [x] 24-01-PLAN.md -- Install shadcn/ui sidebar + breadcrumb primitives, NavItem types, navigation configs, spacing constants
  - [x] 24-02-PLAN.md -- Create AppSidebar, BreadcrumbNav, and PageHeader layout components
  - [x] 24-03-PLAN.md -- Refactor Admin/VA/Client layouts to use unified components, delete old sidebar
  - [x] 24-04-PLAN.md -- Human verification: all dashboards, navigation, RBAC, keyboard shortcuts
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
- [x] **Phase 26: Polish & Micro-interactions** - Transitions, skeletons, empty states, command palette, keyboard shortcuts ✓ 2026-01-27
  **Plans:** 9 plans
  - [x] 26-01-PLAN.md -- CSS micro-interactions (button press, card hover, shimmer keyframe, fade-in, reduced-motion)
  - [x] 26-02-PLAN.md -- Install cmdk + react-hotkeys-hook, create shortcuts registry + command items + Kbd component
  - [x] 26-03-PLAN.md -- Skeleton loading states (base primitive + dashboard/table/card-grid skeletons, shimmer upgrade)
  - [x] 26-04-PLAN.md -- Empty state components (4 variants with inline SVG illustrations + CTA buttons)
  - [x] 26-05-PLAN.md -- Command palette + keyboard shortcuts + shortcuts reference modal + layout integration
  - [x] 26-06-PLAN.md -- Human verification: all 10 POLISH items across all themes
  - [x] 26-07-PLAN.md -- Gap closure: card shadow, Ctrl+K toggle, scrollbar, vim role filtering, shortcuts modal styling
  - [x] 26-08-PLAN.md -- Gap closure: animate-fade-in on all pages + skeleton loading fallbacks
  - [x] 26-09-PLAN.md -- Gap closure: empty state component integration into all tables/lists
- [x] **Phase 27: Sidebar Folder Reorganization** - Reorganize sidebar into 3 collapsible section groups with role-based visibility, consolidate Access Profiles/Invites/Pairing Request into modals, clean up sidebar footer ✓ 2026-01-27
  **Plans:** 7 plans
  - [x] 27-01-PLAN.md -- Navigation config restructuring: SidebarSection type + grouped configs + getVisibleSections
  - [x] 27-02-PLAN.md -- Users page modal consolidation: AccessProfilesModal + InvitesModal + toolbar buttons
  - [x] 27-03-PLAN.md -- Accounts page: PairingRequestModal + agent expandable rows
  - [x] 27-04-PLAN.md -- Sync status move to Profile Settings dialog
  - [x] 27-05-PLAN.md -- AppSidebar collapsible sections + footer cleanup + layout integration
  - [x] 27-06-PLAN.md -- Breadcrumb + command palette + automation page rename (Extension Hub -> Automation Hub)
  - [x] 27-07-PLAN.md -- Human verification: all roles, sections, modals, naming
- [x] **Phase 28: Collection Storage & Rendering Infrastructure** - Wire v3 sync infrastructure (IndexedDB, incremental sync, TanStack Query, mutation hooks) into the collection SellersGrid, replacing direct fetch+useState with cache-first offline-capable architecture ✓ 2026-01-27
  **Plans:** 7 plans
  - [x] 28-01-PLAN.md -- Foundation: seller query keys, typed seller API functions, offline mutation dispatch
  - [x] 28-02-PLAN.md -- Server-side streaming CSV/JSON export endpoints for sellers
  - [x] 28-03-PLAN.md -- Sync hooks: useSyncSellers + seller mutation hooks (flag, update, delete)
  - [x] 28-04-PLAN.md -- SellersGrid data source migration: useSyncSellers replaces fetch+useState
  - [x] 28-05-PLAN.md -- SellersGrid mutation migration: all CRUD via hooks + IndexedDB, zero direct fetch, server-side export routing
  - [x] 28-06-PLAN.md -- Run history IndexedDB persistence + useCollectionPolling TanStack Query migration
  - [x] 28-07-PLAN.md -- Gap closure: add authenticated user RLS SELECT policy on sellers table
- [x] **Phase 28.1: v4 Tech Debt Cleanup** - Address 4 non-blocking tech debt items from v4 milestone audit: naming inconsistency, orphaned pages, dead exports, unused skeleton ✓ 2026-01-27
  **Plans:** 1 plan
  - [x] 28.1-01-PLAN.md -- Fix automation breadcrumb naming, delete orphaned pages + dead code (spacing.ts, CardGridSkeleton, deprecated nav exports)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7   | v1 | 12/12 | Complete | 2026-01-20 |
| 8-14  | v2 | 37/37 | Complete | 2026-01-23 |
| 15-21 | v3 | 23/23 | Complete | 2026-01-25 |
| 22 | v4 | 4/4 | Complete | 2026-01-25 |
| 23 | v4 | 4/4 | Complete | 2026-01-26 |
| 24 | v4 | 4/4 | Complete | 2026-01-26 |
| 25 | v4 | 8/8 | Complete | 2026-01-26 |
| 26 | v4 | 9/9 | Complete | 2026-01-27 |
| 27 | v4 | 7/7 | Complete | 2026-01-27 |
| 28 | v4 | 7/7 | Complete | 2026-01-27 |
| 28.1 | v4 | 1/1 | Complete | 2026-01-27 |

**Total:** 4 milestones, 28.1 phases, 108 plans shipped

---
*Roadmap created: 2026-01-17*
*Last updated: 2026-01-27 - Phase 28 complete: collection storage & rendering infrastructure shipped (7/7 plans including gap closure)*
