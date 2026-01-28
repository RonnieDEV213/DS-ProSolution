# Requirements Archive: v4 UI/Design System

**Archived:** 2026-01-27
**Status:** SHIPPED

This is the archived requirements specification for v4.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: DS-ProSolution v4

**Defined:** 2026-01-25
**Core Value:** Transform DS-ProSolution into a polished Modern SaaS application with custom UI components and preset themes -- while maintaining or improving performance.

## v4 Requirements

### Theme Foundation

- [x] **THEME-01**: Semantic CSS variable token system replaces all 172 hardcoded gray color references across 30+ files
- [x] **THEME-02**: `next-themes` ThemeProvider wraps app with anti-flash protection (inline blocking script, `suppressHydrationWarning`)
- [x] **THEME-03**: Hardcoded `className="dark"` removed from `<html>`, replaced by dynamic `data-theme` attribute
- [x] **THEME-04**: Application-level semantic tokens defined (`--app-bg`, `--app-sidebar`, `--scrollbar-*`, `--table-*`) and registered in `@theme inline`
- [x] **THEME-05**: `@custom-variant dark` migrated to `data-theme` attribute pattern for hydration safety

### Custom Scrollbars

- [x] **SCROLL-01**: Theme-aware scrollbar colors using CSS variables (replace hardcoded hex in `.scrollbar-thin`)
- [x] **SCROLL-02**: `scrollbar-gutter: stable` on all scrollable containers to prevent layout shift
- [x] **SCROLL-03**: Auto-hide scrollbars (appear on hover/scroll, fade out when idle)
- [x] **SCROLL-04**: Scrollbar hover expansion (track widens on hover for easier grabbing)
- [x] **SCROLL-05**: Standardized `scrollbar-color` + `scrollbar-width` as primary, `::-webkit-scrollbar` as progressive enhancement

### Typography

- [x] **TYPE-01**: Documented type scale with CSS variables for consistent heading/body/caption sizes
- [x] **TYPE-02**: Font weight conventions established (regular=body, medium=labels, semibold=headings)
- [x] **TYPE-03**: `font-mono` (Geist Mono) applied consistently to data values (order IDs, account numbers, monetary values)
- [x] **TYPE-04**: Text color hierarchy audited -- `text-foreground` for primary, `text-muted-foreground` for secondary

### Theme Presets

- [x] **PRESET-01**: Midnight theme (refined dark -- near-black with blue undertone, blue accent)
- [x] **PRESET-02**: Dawn theme (light mode -- clean white/warm gray, indigo accent)
- [x] **PRESET-03**: Slate theme (alternative dark -- warm dark gray with green undertone, teal accent)
- [x] **PRESET-04**: Carbon theme (high contrast dark -- true black, bright cyan accent, OLED-friendly)
- [x] **PRESET-05**: System preference detection (`prefers-color-scheme`) sets initial theme
- [x] **PRESET-06**: Theme persistence across sessions via localStorage (automatic with `next-themes`)

### Theme Switcher UI

- [x] **SWITCH-01**: Theme picker in ProfileSettingsDialog with visual theme previews (colored swatches showing sidebar + main area + accent)
- [x] **SWITCH-02**: Theme transition animation (smooth cross-fade when switching, not instant flash)
- [x] **SWITCH-03**: `::selection` highlight colors match current theme accent
- [x] **SWITCH-04**: Sonner toast notifications respect current theme colors
- [x] **SWITCH-05**: `accent-color: var(--primary)` on `:root` for native form control theming

### Layout & Navigation

- [x] **LAYOUT-01**: Unified `AppSidebar` component replaces three duplicate sidebar implementations (admin, VA, client) with role-based nav items prop
- [x] **LAYOUT-02**: All inline SVG sidebar icons replaced with Lucide React icons
- [x] **LAYOUT-03**: Consistent spacing conventions (page padding, card padding, section gaps, form field gaps)
- [x] **LAYOUT-04**: Breadcrumb navigation component wired to Next.js route segments
- [x] **LAYOUT-05**: Collapsible sidebar with Cmd+B keyboard shortcut and cookie-persisted state
- [x] **LAYOUT-06**: `PageHeader` component for consistent page titles across all dashboards
- [x] **LAYOUT-07**: Theme toggle added to sidebar footer for quick switching
- [x] **LAYOUT-08**: Admin, VA, and Client layouts all refactored to use shared layout primitives

### Color Migration

- [x] **MIGRATE-01**: All `src/app/**/page.tsx` files migrated from hardcoded grays to semantic tokens
- [x] **MIGRATE-02**: All `src/components/bookkeeping/*.tsx` migrated (~150 occurrences)
- [x] **MIGRATE-03**: All `src/components/admin/**/*.tsx` migrated (~300 occurrences)
- [x] **MIGRATE-04**: All `src/components/profile/*.tsx` migrated (~40 occurrences)
- [x] **MIGRATE-05**: All `src/components/data-management/*.tsx` migrated (~45 occurrences)
- [x] **MIGRATE-06**: All `src/components/auth/*.tsx`, `sync/*.tsx`, `va/*.tsx` migrated
- [x] **MIGRATE-07**: Visual parity verified in all 4 themes across all dashboards

### Polish & Micro-interactions

- [x] **POLISH-01**: Sidebar nav item hover/active transitions (150ms ease)
- [x] **POLISH-02**: Card hover elevation (subtle shadow increase)
- [x] **POLISH-03**: Button press feedback (scale 0.98 on active)
- [x] **POLISH-04**: Page transitions (fade-in on route change)
- [x] **POLISH-05**: Dialog/modal open/close animations (scale + fade)
- [x] **POLISH-06**: Skeleton loading states for dashboard cards, table rows, sidebar
- [x] **POLISH-07**: Empty state designs (search-no-results, first-time-empty, error-empty, filtered-empty)
- [x] **POLISH-08**: Focus ring consistency audit across all interactive elements
- [x] **POLISH-09**: Command palette (Cmd+K) -- lazy-loaded, search pages/entities/actions
- [x] **POLISH-10**: Keyboard shortcuts for common actions (N=new, F=filter, E=export)

## Future Requirements

### Deferred from v4

- **THEME-CUSTOM-01**: User-customizable accent color picker (accessibility concerns -- need vetted palette)
- **THEME-CUSTOM-02**: Runtime theme generation from user color input (Linear-style 3-variable approach)
- **LAYOUT-RESPONSIVE-01**: Responsive sidebar collapse for mobile/tablet (desktop-first tool)
- **DENSE-01**: Data-dense dashboard layout option (configurable in settings)
- **DENSE-02**: Compact table mode with reduced padding/font for high-density views

### Deferred from v3

- PAGI-08: Filter presets with backend persistence
- PDF export

## Out of Scope

| Feature | Reason |
|---------|--------|
| CSS-in-JS migration (styled-components, Emotion) | Conflicts with CSS-first performance constraint |
| JS scrollbar libraries (SimpleBar, react-scrollbars-custom) | Breaks react-window virtualization |
| Theme-per-user-role (admin=blue, VA=green) | Creates confusion, multiplies QA surface |
| Animated backgrounds / particles / parallax | Battery drain for 8+ hour sessions, no value for productivity tool |
| Design token pipeline (Figma sync, Style Dictionary) | Enterprise tooling overhead for internal app |
| Storybook | Setup/maintenance exceeds benefit for small team |
| Published npm component library | No consumers outside this app |
| Chrome extension theme sync | Different tech stack, separate CSS variable system |
| Responsive sidebar hamburger | Desktop-first internal tool |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 22 | Complete |
| THEME-02 | Phase 22 | Complete |
| THEME-03 | Phase 22 | Complete |
| THEME-04 | Phase 22 | Complete |
| THEME-05 | Phase 22 | Complete |
| SCROLL-01 | Phase 22 | Complete |
| SCROLL-02 | Phase 22 | Complete |
| SCROLL-03 | Phase 22 | Complete |
| SCROLL-04 | Phase 22 | Complete |
| SCROLL-05 | Phase 22 | Complete |
| TYPE-01 | Phase 22 | Complete |
| TYPE-02 | Phase 22 | Complete |
| PRESET-01 | Phase 23 | Complete |
| PRESET-02 | Phase 23 | Complete |
| PRESET-03 | Phase 23 | Complete |
| PRESET-04 | Phase 23 | Complete |
| PRESET-05 | Phase 23 | Complete |
| PRESET-06 | Phase 23 | Complete |
| SWITCH-01 | Phase 23 | Complete |
| SWITCH-02 | Phase 23 | Complete |
| SWITCH-03 | Phase 23 | Complete |
| SWITCH-04 | Phase 23 | Complete |
| SWITCH-05 | Phase 23 | Complete |
| LAYOUT-01 | Phase 24 | Complete |
| LAYOUT-02 | Phase 24 | Complete |
| LAYOUT-03 | Phase 24 | Complete |
| LAYOUT-04 | Phase 24 | Complete |
| LAYOUT-05 | Phase 24 | Complete |
| LAYOUT-06 | Phase 24 | Complete |
| LAYOUT-07 | Phase 24 | Complete |
| LAYOUT-08 | Phase 24 | Complete |
| MIGRATE-01 | Phase 25 | Complete |
| MIGRATE-02 | Phase 25 | Complete |
| MIGRATE-03 | Phase 25 | Complete |
| MIGRATE-04 | Phase 25 | Complete |
| MIGRATE-05 | Phase 25 | Complete |
| MIGRATE-06 | Phase 25 | Complete |
| MIGRATE-07 | Phase 25 | Complete |
| TYPE-03 | Phase 25 | Complete |
| TYPE-04 | Phase 25 | Complete |
| POLISH-01 | Phase 26 | Complete |
| POLISH-02 | Phase 26 | Complete |
| POLISH-03 | Phase 26 | Complete |
| POLISH-04 | Phase 26 | Complete |
| POLISH-05 | Phase 26 | Complete |
| POLISH-06 | Phase 26 | Complete |
| POLISH-07 | Phase 26 | Complete |
| POLISH-08 | Phase 26 | Complete |
| POLISH-09 | Phase 26 | Complete |
| POLISH-10 | Phase 26 | Complete |

**Coverage:**
- v4 requirements: 50 total
- Shipped: 50
- Unmapped: 0

### Bonus Phases (Beyond Original Scope)

| Phase | Goal | Status |
|-------|------|--------|
| 27 | Sidebar Folder Reorganization | Complete |
| 28 | Collection Storage & Rendering Infrastructure | Complete |

---

## Milestone Summary

**Shipped:** 50 of 50 v4 requirements + 2 bonus phases

**Adjusted:** None

**Dropped:** None

---
*Archived: 2026-01-27 as part of v4 milestone completion*
