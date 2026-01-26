# Requirements: DS-ProSolution v4 UI/Design System

**Defined:** 2026-01-25
**Core Value:** Transform DS-ProSolution into a polished Modern SaaS application with custom UI components and preset themes -- while maintaining or improving performance.

## v4 Requirements

### Theme Foundation

- [x] **THEME-01**: Semantic CSS variable token system replaces all 172 hardcoded gray color references across 30+ files
- [x] **THEME-02**: `next-themes` ThemeProvider wraps app with anti-flash protection (inline blocking script, `suppressHydrationWarning`)
- [x] **THEME-03**: Hardcoded `className="dark"` removed from `<html>`, replaced by dynamic `data-theme` attribute
- [x] **THEME-04**: Application-level semantic tokens defined (`--app-bg`, `--app-sidebar`, `--scrollbar-*`, `--table-*`) and registered in `@theme inline`
- [x] **THEME-05**: `@custom-variant dark` migrated to `data-theme` attribute pattern for hydration safety

### Theme Presets

- [ ] **PRESET-01**: Midnight theme (refined dark -- near-black with blue undertone, blue accent)
- [ ] **PRESET-02**: Dawn theme (light mode -- clean white/warm gray, indigo accent)
- [ ] **PRESET-03**: Slate theme (alternative dark -- warm dark gray with green undertone, teal accent)
- [ ] **PRESET-04**: Carbon theme (high contrast dark -- true black, bright cyan accent, OLED-friendly)
- [ ] **PRESET-05**: System preference detection (`prefers-color-scheme`) sets initial theme
- [ ] **PRESET-06**: Theme persistence across sessions via localStorage (automatic with `next-themes`)

### Theme Switcher UI

- [ ] **SWITCH-01**: Theme picker in ProfileSettingsDialog with visual theme previews (colored swatches showing sidebar + main area + accent)
- [ ] **SWITCH-02**: Theme transition animation (smooth cross-fade when switching, not instant flash)
- [ ] **SWITCH-03**: `::selection` highlight colors match current theme accent
- [ ] **SWITCH-04**: Sonner toast notifications respect current theme colors
- [ ] **SWITCH-05**: `accent-color: var(--primary)` on `:root` for native form control theming

### Custom Scrollbars

- [x] **SCROLL-01**: Theme-aware scrollbar colors using CSS variables (replace hardcoded hex in `.scrollbar-thin`)
- [x] **SCROLL-02**: `scrollbar-gutter: stable` on all scrollable containers to prevent layout shift
- [x] **SCROLL-03**: Auto-hide scrollbars (appear on hover/scroll, fade out when idle)
- [x] **SCROLL-04**: Scrollbar hover expansion (track widens on hover for easier grabbing)
- [x] **SCROLL-05**: Standardized `scrollbar-color` + `scrollbar-width` as primary, `::-webkit-scrollbar` as progressive enhancement

### Layout & Navigation

- [ ] **LAYOUT-01**: Unified `AppSidebar` component replaces three duplicate sidebar implementations (admin, VA, client) with role-based nav items prop
- [ ] **LAYOUT-02**: All inline SVG sidebar icons replaced with Lucide React icons
- [ ] **LAYOUT-03**: Consistent spacing conventions (page padding, card padding, section gaps, form field gaps)
- [ ] **LAYOUT-04**: Breadcrumb navigation component wired to Next.js route segments
- [ ] **LAYOUT-05**: Collapsible sidebar with Cmd+B keyboard shortcut and cookie-persisted state
- [ ] **LAYOUT-06**: `PageHeader` component for consistent page titles across all dashboards
- [ ] **LAYOUT-07**: Theme toggle added to sidebar footer for quick switching
- [ ] **LAYOUT-08**: Admin, VA, and Client layouts all refactored to use shared layout primitives

### Typography

- [x] **TYPE-01**: Documented type scale with CSS variables for consistent heading/body/caption sizes
- [x] **TYPE-02**: Font weight conventions established (regular=body, medium=labels, semibold=headings)
- [ ] **TYPE-03**: `font-mono` (Geist Mono) applied consistently to data values (order IDs, account numbers, monetary values)
- [ ] **TYPE-04**: Text color hierarchy audited -- `text-foreground` for primary, `text-muted-foreground` for secondary

### Color Migration

- [ ] **MIGRATE-01**: All `src/app/**/page.tsx` files migrated from hardcoded grays to semantic tokens
- [ ] **MIGRATE-02**: All `src/components/bookkeeping/*.tsx` migrated (~150 occurrences)
- [ ] **MIGRATE-03**: All `src/components/admin/**/*.tsx` migrated (~300 occurrences)
- [ ] **MIGRATE-04**: All `src/components/profile/*.tsx` migrated (~40 occurrences)
- [ ] **MIGRATE-05**: All `src/components/data-management/*.tsx` migrated (~45 occurrences)
- [ ] **MIGRATE-06**: All `src/components/auth/*.tsx`, `sync/*.tsx`, `va/*.tsx` migrated
- [ ] **MIGRATE-07**: Visual parity verified in all 4 themes across all dashboards

### Polish & Micro-interactions

- [ ] **POLISH-01**: Sidebar nav item hover/active transitions (150ms ease)
- [ ] **POLISH-02**: Card hover elevation (subtle shadow increase)
- [ ] **POLISH-03**: Button press feedback (scale 0.98 on active)
- [ ] **POLISH-04**: Page transitions (fade-in on route change)
- [ ] **POLISH-05**: Dialog/modal open/close animations (scale + fade)
- [ ] **POLISH-06**: Skeleton loading states for dashboard cards, table rows, sidebar
- [ ] **POLISH-07**: Empty state designs (search-no-results, first-time-empty, error-empty, filtered-empty)
- [ ] **POLISH-08**: Focus ring consistency audit across all interactive elements
- [ ] **POLISH-09**: Command palette (Cmd+K) -- lazy-loaded, search pages/entities/actions
- [ ] **POLISH-10**: Keyboard shortcuts for common actions (N=new, F=filter, E=export)

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
| PRESET-01 | Phase 23 | Pending |
| PRESET-02 | Phase 23 | Pending |
| PRESET-03 | Phase 23 | Pending |
| PRESET-04 | Phase 23 | Pending |
| PRESET-05 | Phase 23 | Pending |
| PRESET-06 | Phase 23 | Pending |
| SWITCH-01 | Phase 23 | Pending |
| SWITCH-02 | Phase 23 | Pending |
| SWITCH-03 | Phase 23 | Pending |
| SWITCH-04 | Phase 23 | Pending |
| SWITCH-05 | Phase 23 | Pending |
| LAYOUT-01 | Phase 24 | Pending |
| LAYOUT-02 | Phase 24 | Pending |
| LAYOUT-03 | Phase 24 | Pending |
| LAYOUT-04 | Phase 24 | Pending |
| LAYOUT-05 | Phase 24 | Pending |
| LAYOUT-06 | Phase 24 | Pending |
| LAYOUT-07 | Phase 24 | Pending |
| LAYOUT-08 | Phase 24 | Pending |
| MIGRATE-01 | Phase 25 | Pending |
| MIGRATE-02 | Phase 25 | Pending |
| MIGRATE-03 | Phase 25 | Pending |
| MIGRATE-04 | Phase 25 | Pending |
| MIGRATE-05 | Phase 25 | Pending |
| MIGRATE-06 | Phase 25 | Pending |
| MIGRATE-07 | Phase 25 | Pending |
| TYPE-03 | Phase 25 | Pending |
| TYPE-04 | Phase 25 | Pending |
| POLISH-01 | Phase 26 | Pending |
| POLISH-02 | Phase 26 | Pending |
| POLISH-03 | Phase 26 | Pending |
| POLISH-04 | Phase 26 | Pending |
| POLISH-05 | Phase 26 | Pending |
| POLISH-06 | Phase 26 | Pending |
| POLISH-07 | Phase 26 | Pending |
| POLISH-08 | Phase 26 | Pending |
| POLISH-09 | Phase 26 | Pending |
| POLISH-10 | Phase 26 | Pending |

**Coverage:**
- v4 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-01-25 after roadmap creation (phase assignments finalized)*
