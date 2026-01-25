# Milestone v4: UI/Design System

**Status:** In Progress
**Phases:** 22-26
**Total Plans:** TBD

## Overview

v4 UI/Design System transforms DS-ProSolution from a functional dark-only dashboard into a polished, themeable Modern SaaS experience with Linear/Notion/Vercel-level aesthetics. The roadmap follows a strict dependency chain: first establish the CSS variable token system and ThemeProvider infrastructure (Phase 22), then build preset themes and the switching UI (Phase 23), consolidate three duplicate sidebar implementations into shared layout primitives (Phase 24), migrate all remaining hardcoded colors to semantic tokens (Phase 25), and finish with micro-interactions and polish that elevate from "works" to "feels premium" (Phase 26). Every phase is CSS-first with zero runtime JS for theming. The single new runtime dependency is `next-themes` (~2KB). Net performance impact is positive.

## Critical Constraints

- **Performance-neutral minimum, performance-positive preferred** -- UI changes must not add compute cost
- **CSS-first approach** -- CSS variables for all theming, no runtime JS for theme application
- **No CSS-in-JS** -- no styled-components, no Emotion, no runtime style computation
- **No JS scrollbar libraries** -- CSS-only scrollbar styling to preserve react-window virtualization
- **Theme switching triggers ZERO React re-renders** -- CSS variable cascade only

## Phases

- [ ] **Phase 22: Theme Foundation & Color Token Migration** - CSS variable token system, ThemeProvider, scrollbar theming, type scale
- [ ] **Phase 23: Theme Presets & Switching** - 4 preset themes, switcher UI, persistence, system preference detection
- [ ] **Phase 24: Layout Component Consolidation** - Unified sidebar, breadcrumbs, page headers, spacing conventions
- [ ] **Phase 25: Component Color Migration** - All 30+ files migrated from hardcoded grays to semantic tokens
- [ ] **Phase 26: Polish & Micro-interactions** - Transitions, skeletons, empty states, command palette, keyboard shortcuts

## Phase Details

### Phase 22: Theme Foundation & Color Token Migration

**Goal**: Application has a complete semantic CSS variable token system with ThemeProvider infrastructure, enabling all downstream theming work
**Depends on**: Nothing (first phase of v4)
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04, THEME-05, SCROLL-01, SCROLL-02, SCROLL-03, SCROLL-04, SCROLL-05, TYPE-01, TYPE-02
**Success Criteria** (what must be TRUE):
  1. All 172 hardcoded gray color references in `globals.css` and base styles are replaced with semantic CSS variable tokens (`--app-bg`, `--app-sidebar`, `--scrollbar-*`, `--table-*`) registered in `@theme inline`
  2. `next-themes` ThemeProvider wraps the application with no flash of unstyled content on page load (blocking inline script active, `suppressHydrationWarning` present, hardcoded `className="dark"` removed)
  3. Scrollbars across the application use CSS variable colors instead of hardcoded hex, with `scrollbar-gutter: stable` preventing layout shift on all scrollable containers
  4. A documented type scale exists as CSS variables with consistent heading/body/caption sizes, and font weight conventions (regular/medium/semibold) are applied
  5. Switching the `data-theme` attribute on `<html>` causes all token-aware elements to update their colors without any JavaScript execution or React re-renders
**Plans**: TBD

### Phase 23: Theme Presets & Switching

**Goal**: Users can choose from 4 distinct visual themes with their preference persisting across sessions
**Depends on**: Phase 22 (requires token system and ThemeProvider)
**Requirements**: PRESET-01, PRESET-02, PRESET-03, PRESET-04, PRESET-05, PRESET-06, SWITCH-01, SWITCH-02, SWITCH-03, SWITCH-04, SWITCH-05
**Success Criteria** (what must be TRUE):
  1. Four visually distinct themes are available: Midnight (blue-undertone dark), Dawn (clean light), Slate (warm gray-green dark), and Carbon (true-black OLED-friendly) -- each with its own accent color
  2. Theme picker in ProfileSettingsDialog shows visual previews (colored swatches) and switching between themes produces a smooth cross-fade transition (not an instant flash)
  3. User's theme preference persists across browser sessions via localStorage, and first-time visitors get a theme matching their OS `prefers-color-scheme` setting
  4. All application chrome respects the current theme: `::selection` highlights match the accent, Sonner toast notifications use theme colors, and native form controls inherit `accent-color`
**Plans**: TBD

### Phase 24: Layout Component Consolidation

**Goal**: Admin, VA, and Client dashboards share unified layout primitives with a collapsible sidebar, consistent navigation, and standardized page structure
**Depends on**: Phase 23 (layout components use semantic tokens from working theme system)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05, LAYOUT-06, LAYOUT-07, LAYOUT-08
**Success Criteria** (what must be TRUE):
  1. A single `AppSidebar` component renders the correct navigation items for Admin, VA, and Client roles -- replacing three duplicate sidebar implementations with zero behavioral regressions (including VA conditional nav filtering)
  2. All sidebar icons are Lucide React components (no inline SVGs), the sidebar is collapsible via Cmd+B with state persisted in a cookie, and a theme toggle in the sidebar footer allows quick theme switching
  3. Every page has a consistent `PageHeader` component and breadcrumb navigation reflecting the current route, with standardized spacing conventions (page padding, card padding, section gaps) applied across all dashboards
  4. All three dashboard layouts (Admin, VA, Client) use the shared layout primitives and render correctly in all 4 themes
**Plans**: TBD

### Phase 25: Component Color Migration

**Goal**: Every component file in the application uses semantic tokens, making theme switching visually complete across the entire UI
**Depends on**: Phase 24 (layout components establish the migration pattern; non-layout components follow)
**Requirements**: MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, MIGRATE-05, MIGRATE-06, MIGRATE-07, TYPE-03, TYPE-04
**Success Criteria** (what must be TRUE):
  1. All page files (`src/app/**/page.tsx`), bookkeeping components (~150 occurrences), admin components (~300 occurrences), profile components (~40 occurrences), data management components (~45 occurrences), and auth/sync/VA components have zero hardcoded gray color classes
  2. Monospace font (`font-mono` / Geist Mono) is consistently applied to data values: order IDs, account numbers, and monetary values across all views
  3. Text color hierarchy is audited and consistent: `text-foreground` for primary content, `text-muted-foreground` for secondary content, with no remaining `text-gray-*` classes
  4. Visual parity is verified across all 4 themes on every dashboard (Admin, VA, Client) -- no broken two-toned UI, no missing theme coverage
**Plans**: TBD

### Phase 26: Polish & Micro-interactions

**Goal**: The application feels premium with smooth transitions, informative loading states, and keyboard-driven power-user workflows
**Depends on**: Phase 25 (polish requires all components themed; interactions overlay on stable UI)
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06, POLISH-07, POLISH-08, POLISH-09, POLISH-10
**Success Criteria** (what must be TRUE):
  1. Interactive elements have consistent micro-interactions: sidebar nav items transition on hover/active (150ms), cards elevate subtly on hover, buttons scale on press (0.98), and dialogs/modals animate open/close with scale+fade
  2. Loading states use skeleton placeholders (dashboard cards, table rows, sidebar) instead of spinners or blank space, and page route changes produce a fade-in transition
  3. Empty states display contextual designs (search-no-results, first-time-empty, error-empty, filtered-empty) with clear calls to action instead of blank screens
  4. Focus rings are consistent across all interactive elements (buttons, inputs, links, checkboxes) for accessible keyboard navigation
  5. Command palette (Cmd+K) is available for searching pages, entities, and actions, and keyboard shortcuts (N=new, F=filter, E=export) work for common actions -- both lazy-loaded with zero impact on initial bundle
**Plans**: TBD

---

## Coverage

| Requirement | Phase | Category |
|-------------|-------|----------|
| THEME-01 | Phase 22 | Theme Foundation |
| THEME-02 | Phase 22 | Theme Foundation |
| THEME-03 | Phase 22 | Theme Foundation |
| THEME-04 | Phase 22 | Theme Foundation |
| THEME-05 | Phase 22 | Theme Foundation |
| SCROLL-01 | Phase 22 | Custom Scrollbars |
| SCROLL-02 | Phase 22 | Custom Scrollbars |
| SCROLL-03 | Phase 22 | Custom Scrollbars |
| SCROLL-04 | Phase 22 | Custom Scrollbars |
| SCROLL-05 | Phase 22 | Custom Scrollbars |
| TYPE-01 | Phase 22 | Typography |
| TYPE-02 | Phase 22 | Typography |
| PRESET-01 | Phase 23 | Theme Presets |
| PRESET-02 | Phase 23 | Theme Presets |
| PRESET-03 | Phase 23 | Theme Presets |
| PRESET-04 | Phase 23 | Theme Presets |
| PRESET-05 | Phase 23 | Theme Presets |
| PRESET-06 | Phase 23 | Theme Presets |
| SWITCH-01 | Phase 23 | Theme Switcher UI |
| SWITCH-02 | Phase 23 | Theme Switcher UI |
| SWITCH-03 | Phase 23 | Theme Switcher UI |
| SWITCH-04 | Phase 23 | Theme Switcher UI |
| SWITCH-05 | Phase 23 | Theme Switcher UI |
| LAYOUT-01 | Phase 24 | Layout & Navigation |
| LAYOUT-02 | Phase 24 | Layout & Navigation |
| LAYOUT-03 | Phase 24 | Layout & Navigation |
| LAYOUT-04 | Phase 24 | Layout & Navigation |
| LAYOUT-05 | Phase 24 | Layout & Navigation |
| LAYOUT-06 | Phase 24 | Layout & Navigation |
| LAYOUT-07 | Phase 24 | Layout & Navigation |
| LAYOUT-08 | Phase 24 | Layout & Navigation |
| MIGRATE-01 | Phase 25 | Color Migration |
| MIGRATE-02 | Phase 25 | Color Migration |
| MIGRATE-03 | Phase 25 | Color Migration |
| MIGRATE-04 | Phase 25 | Color Migration |
| MIGRATE-05 | Phase 25 | Color Migration |
| MIGRATE-06 | Phase 25 | Color Migration |
| MIGRATE-07 | Phase 25 | Color Migration |
| TYPE-03 | Phase 25 | Typography |
| TYPE-04 | Phase 25 | Typography |
| POLISH-01 | Phase 26 | Polish |
| POLISH-02 | Phase 26 | Polish |
| POLISH-03 | Phase 26 | Polish |
| POLISH-04 | Phase 26 | Polish |
| POLISH-05 | Phase 26 | Polish |
| POLISH-06 | Phase 26 | Polish |
| POLISH-07 | Phase 26 | Polish |
| POLISH-08 | Phase 26 | Polish |
| POLISH-09 | Phase 26 | Polish |
| POLISH-10 | Phase 26 | Polish |

**Total: 50 requirements mapped to 5 phases. 0 orphaned.**

---
*Roadmap created: 2026-01-25*
*For current project status, see .planning/ROADMAP.md*
