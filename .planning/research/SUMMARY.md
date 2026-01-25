# Project Research Summary

**Project:** DS-ProSolution v4 UI/Design System
**Domain:** CSS-first theme system, custom UI components, Modern SaaS design
**Researched:** 2026-01-25
**Confidence:** HIGH

## Executive Summary

DS-ProSolution v4 transforms the application from a functional dark-only dashboard into a polished, themeable Modern SaaS experience. The research reveals an unusually favorable starting position: the codebase already runs Tailwind CSS v4 with `@theme inline`, OKLCH color variables in `globals.css`, and 18 shadcn/ui components that use semantic tokens correctly. The theme system infrastructure is essentially 80% built. The primary gap is that application-level code -- layouts, sidebars, bookkeeping tables, admin panels -- bypasses the existing theme system entirely, with 172+ hardcoded gray color classes across 30+ files. The root layout also hardcodes `className="dark"` with no runtime switching capability. Closing this gap is the milestone's critical path.

The recommended approach is CSS-first with a single new runtime dependency: `next-themes` (~2KB). Every other capability -- preset themes, scrollbar styling, form theming, color derivation -- is achieved through CSS custom properties, the existing Tailwind `@theme inline` directive, and OKLCH color math (`color-mix()`, relative color syntax). No CSS-in-JS, no theme UI libraries, no JS scrollbar replacements. The theme system changes a single `data-theme` attribute on `<html>`; all downstream styling cascades through CSS variables with zero React re-renders. The three duplicate sidebar implementations should be consolidated into a shared component using shadcn/ui's Sidebar primitive (already supported by existing `--sidebar-*` CSS variables in `globals.css`). The net performance impact is positive: work moves from JavaScript to CSS, the sidebar deduplication reduces bundle size, and `scrollbar-gutter: stable` eliminates existing layout shifts.

The key risks are well-understood and preventable. The hardcoded color migration (172 occurrences, 30 files) is the highest-effort task and must complete before theme switching can work -- partial migration creates a broken two-toned UI. Flash of unstyled content (FOUC) is eliminated by `next-themes`' blocking script. The critical architectural rule is that theme switching must NEVER trigger React re-renders -- CSS variable cascade handles everything. Scrollbar customization must be CSS-only to avoid breaking `react-window` virtualization. And global `transition: *` on theme change is strictly forbidden: it creates 1500+ simultaneous CSS transitions on data-dense pages, causing severe frame drops.

## Key Findings

### Recommended Stack

The stack recommendation is minimal by design. Only one new runtime dependency is needed.

**New dependency:**
- `next-themes` (^0.4.6): Theme switching, SSR hydration, localStorage persistence, system preference detection -- ~2KB gzipped, sets `data-theme` attribute via inline blocking script, zero runtime style computation. Confirmed compatible with React 19 + Next.js 16.

**shadcn/ui components to add (via CLI, no new npm packages):**
- `Sidebar` -- replaces three hand-rolled sidebar implementations; gains collapsible mode, Cmd+B shortcut, cookie-persisted state, mobile overlay
- `Sheet` -- required by Sidebar for mobile responsive behavior
- `Separator` -- visual dividers for sidebar sections
- `Scroll Area` -- Radix-based scrollable areas for sidebar navigation
- `Breadcrumb` -- navigation context for deep admin/VA/client views

**What NOT to add:**
- No CSS-in-JS (styled-components, Emotion) -- conflicts with CSS-first approach, adds runtime overhead
- No JS scrollbar libraries (SimpleBar, react-scrollbars-custom) -- breaks react-window virtualization
- No additional icon libraries -- Lucide React already installed with 562+ icons; sidebar inline SVGs should migrate to Lucide
- No tailwind-scrollbar plugin -- achievable with ~20 lines of CSS, unnecessary dependency
- No Radix Themes -- conflicts with shadcn/ui's own styling approach
- No Storybook, no published npm component package -- overhead exceeds benefit for internal tool

**CSS-only capabilities (zero new dependencies):**
- Preset theme system via CSS variables + `[data-theme="X"]` selectors
- Custom scrollbars via `scrollbar-width`, `scrollbar-color`, `::-webkit-scrollbar-*`
- Form control theming via `accent-color: var(--primary)`
- Color derivation via `color-mix()` and OKLCH relative color syntax
- Micro-interactions via CSS `transition` properties (compositor-thread, zero JS)

### Expected Features

**Must have (table stakes) -- users expect these from any polished SaaS:**

- CSS variable-based semantic token system (replace 172 hardcoded gray references)
- Functional dark/light mode via `next-themes` with anti-flash protection
- 3-4 preset themes (Midnight, Dawn, Slate, Carbon) as CSS variable overrides
- Theme persistence across sessions (automatic via `next-themes`)
- System preference detection (`prefers-color-scheme` support)
- Theme-aware scrollbar colors (replace hardcoded hex with CSS variables)
- Unified sidebar component (deduplicate three sidebar implementations)
- Consistent icon system (migrate inline SVGs to Lucide React)
- Typography system with documented type scale and weight conventions
- Monospace font for data values (order IDs, monetary amounts -- already loaded as Geist Mono)

**Should have (differentiators -- elevate from "works" to "feels like Linear"):**

- Micro-interactions: sidebar hover transitions (150ms), card hover elevation, button press scale(0.98)
- Skeleton loading states for dashboard cards, table rows, sidebar
- Empty state designs (search-no-results, first-time-empty, error-empty)
- Theme switcher UI in ProfileSettingsDialog with visual theme previews
- Page transitions (CSS `@starting-style` or minimal Framer Motion)
- Focus ring audit for consistent accessible focus indicators
- Selection highlight colors matching theme accent (`::selection`)
- Command palette (Cmd+K) using `cmdk` library -- lazy-loaded, ~15KB

**Anti-features (do NOT build):**

- Runtime theme generation from user color input (weeks of work for unconstrained palette)
- JS-based theme engine or CSS-in-JS migration
- Per-user-role color schemes (admin=blue, VA=green) -- creates confusion
- Animated backgrounds, parallax, Lottie animations -- inappropriate for productivity tool
- Theme-per-CSS-file lazy loading -- all 4 themes fit in ~2KB total, not worth code splitting
- Responsive sidebar hamburger collapse -- desktop-first internal tool
- Spring physics animations everywhere -- reserve Framer Motion for key moments only

### Architecture Approach

The architecture extends the existing CSS variable system rather than replacing it. The `globals.css` already defines ~40 OKLCH tokens for shadcn/ui components. New application-level tokens (`--app-bg`, `--app-sidebar`, `--app-nav-item-*`, `--scrollbar-*`, `--table-*`) are added alongside existing tokens and registered in `@theme inline` to become first-class Tailwind utilities. Theme presets are organized as separate CSS files (`styles/themes/dark.css`, `light.css`, etc.) imported into `globals.css`. The `@custom-variant dark` directive migrates from `(&:is(.dark *))` to `(&:where([data-theme="dark"], [data-theme="dark"] *))` for hydration safety and zero-specificity matching.

**Major architectural components:**

1. **Theme Provider Layer** -- `next-themes` ThemeProvider wrapping the app, managing `data-theme` attribute on `<html>`, handling SSR hydration, persistence, and system preference detection
2. **CSS Variable System** -- Extended semantic tokens in `globals.css` covering app shell, navigation, scrollbars, and tables, with per-theme overrides under `[data-theme="X"]` selectors
3. **Layout Primitives** -- `AppShell`, `AppSidebar`, `NavItem`, `SidebarHeader`, `SidebarFooter`, `PageHeader` components replacing three duplicate sidebar implementations with role-based nav items prop
4. **Theme-Aware Scrollbar** -- Pure CSS scrollbar styling using CSS variables, drop-in replacement for existing `.scrollbar-thin` class
5. **Component Migration Layer** -- Incremental replacement of 172 hardcoded gray classes with semantic tokens across 30+ files, preserving visual parity in dark mode while enabling theme switching

**Key architectural constraints:**

- Chrome extension keeps its own CSS variable system (different tech stack, no shared build)
- shadcn/ui `src/components/ui/` files are NOT modified (already using semantic tokens)
- Theme switching triggers zero React re-renders (CSS-only cascade)
- Framer Motion usage limited to 3-5 animated elements per page maximum

### Critical Pitfalls

1. **Hardcoded colors bypass theme system (CP-01, CRITICAL)** -- 172 occurrences of `bg-gray-*`, `text-gray-*`, `border-gray-*` across 30 files will not respond to CSS variable changes. These elements stay dark gray when theme switches, creating a broken two-toned UI. Prevention: Audit and replace ALL hardcoded colors as the very first task, before any theme definition work. Context-sensitive mapping required (not blind find-and-replace).

2. **Theme flash (FOUC) on page load (CP-02, CRITICAL)** -- Without a blocking script, users see a flash of the default theme before their preference applies. Prevention: Use `next-themes` which injects an inline `<script>` before React hydration. Remove hardcoded `className="dark"` from `<html>`. Add `suppressHydrationWarning`. Set `defaultTheme="dark"` to match current behavior.

3. **React re-render cascade on theme switch (CP-03, CRITICAL)** -- If theme state is passed via React Context/props to styled components, every theme switch re-renders the entire component tree. With react-window virtualized lists, SSE feeds, and complex forms, this causes visible jank and potential data loss. Prevention: CSS-only theming is non-negotiable. Components use CSS variables (`bg-background`), never JS theme values. Only the theme picker UI consumes `useTheme()`.

4. **Custom scrollbar breaks react-window virtualization (CP-04, CRITICAL)** -- JS-based scrollbar libraries intercept scroll events and wrap containers in extra DOM, breaking virtualization measurement, infinite scroll loading, and keyboard navigation. Prevention: CSS-only scrollbar styling (`scrollbar-width` + `scrollbar-color` + `::-webkit-scrollbar-*`). Accept limited customization as worthwhile tradeoff.

5. **Global `transition: *` on theme change (PP-05, HIGH)** -- Adding `* { transition: background-color 300ms, color 300ms }` creates 1500+ simultaneous CSS transitions on data-dense pages (500 elements x 3 properties), causing 200ms+ of jank. Prevention: Use `disableTransitionOnChange` from `next-themes`. If smooth transitions desired, use View Transitions API (single-element crossfade) or opacity fade on `<main>` container.

## Implications for Roadmap

### Phase 1: Theme Foundation and Color Token Migration

**Rationale:** Everything else depends on this. Theme switching cannot work while 172 hardcoded gray classes bypass the CSS variable system. This phase creates the infrastructure (ThemeProvider, expanded tokens) AND does the critical migration work. Grouping these together prevents the "it partially works" anti-pattern.

**Delivers:**
- `next-themes` installed and ThemeProvider added to root layout
- Hardcoded `className="dark"` removed, `suppressHydrationWarning` added
- Application-level CSS tokens defined (`--app-bg`, `--app-sidebar`, `--scrollbar-*`, `--table-*`)
- New tokens registered in `@theme inline`
- `@custom-variant dark` migrated to `data-theme` attribute pattern
- Scrollbar CSS migrated from hardcoded hex to CSS variables
- Universal selector `* {}` impact profiled on virtualized pages

**Addresses features:** Semantic token system, theme-aware scrollbars, `scrollbar-gutter: stable`
**Avoids pitfalls:** CP-01 (hardcoded colors), IP-01 (scrollbar hex), PP-01 (universal selector)
**Performance impact:** Positive (eliminates layout shift from scrollbar-gutter, reduces specificity conflicts)

### Phase 2: Theme Presets and Switching

**Rationale:** With tokens in place, theme definitions and switching UI can be built. This phase delivers the user-visible theme capability.

**Delivers:**
- 3-4 preset theme definitions (Midnight, Dawn, Slate, Carbon) as CSS variable sets
- Theme switcher UI in ProfileSettingsDialog with visual previews
- `theme-toggle.tsx` component for light/dark/system quick toggle
- System preference detection (`prefers-color-scheme`)
- Theme persistence via localStorage (automatic with `next-themes`)
- `accent-color: var(--primary)` on `:root` for native form controls
- `::selection` color matching theme accent
- Sonner toast theme integration

**Addresses features:** Preset themes, theme persistence, system preference, theme switcher UI
**Avoids pitfalls:** CP-02 (FOUC), CP-03 (React re-renders), PP-04 (style recalculation), PP-05 (transition on *)
**Performance impact:** Neutral (~2KB CSS for 4 theme definitions, zero JS runtime cost)

### Phase 3: Layout Component Consolidation

**Rationale:** With themes working, the three duplicate sidebars become the most visible technical debt. Consolidation reduces bundle size, establishes the pattern for semantic token usage, and enables sidebar-specific features (collapsible, keyboard shortcut).

**Delivers:**
- `AppShell`, `AppSidebar`, `NavItem`, `SidebarHeader`, `SidebarFooter` layout primitives
- Admin, VA, and Client layouts refactored to use shared components
- Inline SVG icons replaced with Lucide React icons
- Theme toggle added to sidebar footer
- shadcn/ui Sidebar component adopted (collapsible, Cmd+B, cookie-persisted)
- `PageHeader` component for consistent page titles
- Breadcrumb navigation component

**Addresses features:** Unified sidebar, icon system, consistent spacing, breadcrumb navigation
**Avoids pitfalls:** IP-03 (virtualized list height -- test after layout changes), IP-04 (preserve Radix accessibility)
**Performance impact:** Positive (deduplicates ~400 lines of sidebar code, tree-shaken Lucide icons smaller than inline SVGs)

### Phase 4: Component Color Migration

**Rationale:** The bulk migration phase. With layout components already using semantic tokens (established in Phase 3), the pattern is proven. Migrating the remaining 30+ component files is high-effort but low-risk per file.

**Delivers:**
- All `src/app/**/page.tsx` files migrated
- All `src/components/bookkeeping/*.tsx` migrated (~150 occurrences)
- All `src/components/admin/**/*.tsx` migrated (~300 occurrences)
- All `src/components/profile/*.tsx` migrated (~40 occurrences)
- All `src/components/data-management/*.tsx` migrated (~45 occurrences)
- All `src/components/auth/*.tsx`, `sync/*.tsx`, `va/*.tsx` migrated
- Visual parity verified in both light and dark themes

**Addresses features:** Full theme switching across entire app, light mode support
**Avoids pitfalls:** CP-01 completion (all hardcoded colors eliminated)
**Performance impact:** Neutral (class name swap, no runtime change)

**Migration ordering within phase (lowest risk first):**
1. Auth and profile components (smallest, simplest)
2. Data management and sync components (medium complexity)
3. Bookkeeping components (highest complexity, virtualized list context)
4. Admin components (highest volume, ~300 references)

### Phase 5: Polish and Micro-Interactions

**Rationale:** With the full theme system working and all components migrated, this phase adds the premium feel that differentiates from "works fine" to "feels like Linear."

**Delivers:**
- Micro-interactions: sidebar hover transitions, card hover elevation, button press feedback
- Skeleton loading states for dashboard cards and table rows
- Empty state designs (3-4 patterns)
- Focus ring consistency audit
- Page transitions (CSS or minimal Framer Motion)
- Dialog/modal animation polish
- Command palette (Cmd+K) -- lazy-loaded
- Keyboard shortcut system for common actions
- Full app walkthrough in all themes verified
- Performance profiled against baseline

**Addresses features:** Micro-interactions, skeleton states, empty states, command palette
**Avoids pitfalls:** PP-02 (no backdrop-blur on overlays), PP-03 (prefer CSS over Framer Motion for new work), IP-02 (test theme switch during SSE streaming)
**Performance impact:** Neutral to positive (CSS transitions are compositor-thread; cmdk is lazy-loaded)

### Phase Ordering Rationale

1. **Strict dependency chain:** Tokens must exist before themes can reference them. Themes must work before sidebar consolidation makes sense (new components use semantic tokens). Component migration follows the pattern established by layout work. Polish comes last because it requires everything else to be stable.

2. **Risk frontloading:** The two highest-risk items -- the 172-file color migration (CP-01) and FOUC prevention (CP-02) -- are addressed in Phases 1-2. Getting these right early prevents cascading rework.

3. **Incremental value delivery:** Phase 1 is invisible to users (infrastructure). Phase 2 delivers theme switching. Phase 3 delivers sidebar improvements. Phase 4 completes full-app theming. Phase 5 adds polish. Each phase ships standalone value.

4. **Parallelization opportunity:** Phase 4 (component migration) can begin partially in parallel with Phase 3 (layout consolidation) for non-layout components like auth, profile, and data management.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 3 (Layout Consolidation):** The VA layout has role-based conditional nav filtering (`hasAccessProfile`). Need to verify the shared `AppSidebar` component design handles all three dashboard variants correctly. Also need to validate `react-window` height calculations are stable after layout restructuring.
- **Phase 5 (Polish):** Command palette integration with app-specific entities (orders, accounts, settings) needs design work. Keyboard shortcut conflict avoidance with browser shortcuts needs mapping.

**Phases with standard, well-documented patterns (skip deep research):**
- **Phase 1 (Foundation):** `next-themes` setup is documented by shadcn/ui. Token expansion follows existing `@theme inline` pattern.
- **Phase 2 (Presets):** CSS variable overrides under `[data-theme]` selectors is a documented Tailwind v4 pattern with multiple community guides.
- **Phase 4 (Migration):** Mechanical class replacement following established mapping. No novel patterns.

## Performance Assessment

**Net performance impact of entire milestone: POSITIVE.**

| Category | Impact | Detail |
|----------|--------|--------|
| CSS bundle | +2KB | 4 theme definitions (~40 vars each). Negligible. |
| JS bundle | +2KB (next-themes) | Only new runtime JS. Inline blocking script, no React render cost. |
| JS bundle | -5-10KB estimated | Sidebar deduplication removes ~400 lines of duplicated code + inline SVGs |
| Layout shifts | Eliminated | `scrollbar-gutter: stable` prevents shifts when scrollbar appears/disappears |
| Theme switch | <50ms one-time | CSS variable cascade, no React re-renders. Instant. |
| First paint | Neutral | Blocking theme script runs before paint (<1ms). No FOUC. |
| Ongoing render | Neutral | CSS transitions use compositor thread. Zero main-thread cost. |
| Maintenance | Positive | Semantic tokens mean future color changes update once, propagate everywhere |

**Performance-critical constraints to enforce:**
- No `transition: *` or `transition: all` on `body` or universal selectors
- No `backdrop-blur` on full-screen overlays
- No JS scrollbar libraries (CSS-only for react-window compatibility)
- Framer Motion limited to 3-5 elements per page; prefer CSS transitions for new work
- Theme switching triggers zero React component re-renders

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Single new dependency (next-themes). All other capabilities from CSS and existing tools. Official docs verified for Tailwind v4, shadcn/ui, next-themes. |
| Features | HIGH | Codebase thoroughly analyzed. 172 hardcoded color occurrences counted. Three sidebar implementations diffed. Feature priorities grounded in existing state analysis, not speculation. |
| Architecture | HIGH | Extends the existing `@theme inline` + OKLCH + CSS variable pattern already working in the project. No architectural invention -- pure extension of established patterns. |
| Pitfalls | HIGH | All critical pitfalls verified against codebase files (`virtualized-records-list.tsx`, `globals.css`, `layout.tsx`, sidebar components). Performance claims cross-referenced with browser rendering documentation and GitHub issues. |

**Overall confidence:** HIGH

This is not novel technology. The patterns are well-established (CSS variables for theming, `next-themes` for SSR, shadcn/ui Sidebar for navigation), the codebase is already 80% there, and the pitfalls are documented with clear prevention strategies.

### Gaps to Address

- **Color mapping requires judgment, not automation:** The `bg-gray-800` in a sidebar means something different than `bg-gray-800` in a table header. The 172-reference migration cannot be a blind find-and-replace. A mapping reference should be created during Phase 1, but each file needs contextual review.
- **VA layout conditional navigation:** The VA sidebar conditionally shows/hides nav items based on `hasAccessProfile`. The shared `AppSidebar` component design must preserve this logic. Verify during Phase 3 planning.
- **OKLCH compatibility edge cases:** OKLCH has 92%+ browser support but may cause issues with PDF export tools or html2canvas. If the app adds screenshot/PDF features, provide hex fallbacks. Low-priority concern for an internal tool.
- **Universal selector audit:** `* { @apply border-border outline-ring/50; }` in `globals.css` applies CSS variable resolution to every DOM element. On pages with 500+ virtualized elements, this may cause measurable style recalculation cost. Profile during Phase 1 and narrow selector if needed.
- **Chrome extension color alignment:** The extension has its own CSS variable system (`sidepanel.css`) with different color values. Document the OKLCH-to-hex mapping for manual alignment. Do not attempt to share CSS between the web app and extension.

## Sources

### HIGH Confidence (Official Documentation)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) -- CSS variable structure, OKLCH conventions
- [shadcn/ui Dark Mode for Next.js](https://ui.shadcn.com/docs/dark-mode/next) -- next-themes integration
- [shadcn/ui Sidebar Component](https://ui.shadcn.com/docs/components/sidebar) -- official sidebar docs
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- `@theme inline`, `@custom-variant`, `tw-animate-css`
- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme) -- `@theme` directive
- [Tailwind CSS v4 Dark Mode](https://tailwindcss.com/docs/dark-mode) -- dark mode configuration
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- multi-theme, data-attribute, FOUC prevention
- [MDN: scrollbar-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width) -- standardized scrollbar
- [MDN: scrollbar-gutter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter) -- layout shift prevention
- [MDN: accent-color](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/accent-color) -- native form theming
- [MDN: color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix) -- CSS color mixing
- [MDN: CSS Relative Colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Using_relative_colors) -- color derivation
- [Chrome Scrollbar Styling Guide](https://developer.chrome.com/docs/css-ui/scrollbar-styling) -- cross-browser strategy
- [Vercel Academy: Extending shadcn/ui](https://vercel.com/academy/shadcn-ui/extending-shadcn-ui-with-custom-components) -- component customization

### MEDIUM Confidence (Verified Community Patterns)
- [Tailwind v4 Multi-Theme Strategy (simonswiss)](https://simonswiss.com/posts/tailwind-v4-multi-theme) -- data-theme pattern
- [Tailwind GitHub Discussion #16292](https://github.com/tailwindlabs/tailwindcss/discussions/16292) -- `@theme` scoping behavior
- [Tailwind GitHub Discussion #15600](https://github.com/tailwindlabs/tailwindcss/discussions/15600) -- CSS variable override pattern
- [Multi-Theme Next.js + shadcn/ui](https://www.vaibhavt.com/blog/multi-theme) -- implementation walkthrough
- [Linear UI Redesign (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui) -- LCH theme generation approach
- [Evil Martians: OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) -- OKLCH advantages for design systems
- [web.dev: Color Themes with Baseline CSS](https://web.dev/articles/baseline-in-action-color-theme) -- CSS-only theming patterns
- [OKLCH Ultimate Guide](https://oklch.org/posts/ultimate-oklch-guide) -- perceptual uniformity
- [tweakcn Theme Editor](https://tweakcn.com/) -- shadcn/ui theme preset generation tool

### Codebase Analysis (HIGH Confidence)
- `globals.css`: OKLCH variables, `@theme inline`, `@custom-variant dark`, hardcoded scrollbar hex, universal selector
- `layout.tsx`: hardcoded `className="dark"`, provider structure, Geist fonts
- `app/admin/layout.tsx`: 213-line sidebar with hardcoded grays + inline SVGs
- `app/va/layout.tsx`: 153-line duplicate sidebar with conditional nav
- `app/client/layout.tsx`: 95-line duplicate sidebar
- `virtualized-records-list.tsx`: react-window List with height prop, keyboard nav
- `sellers-grid.tsx`: react-window Grid with calculated dimensions
- `components/ui/dialog.tsx`: Radix Dialog with `bg-black/80` overlay (no blur -- correct)
- `components.json`: shadcn/ui new-york style, CSS variables enabled, Tailwind v4
- 30+ files with 172 hardcoded gray color class occurrences

---
*Research completed: 2026-01-25*
*Ready for roadmap: yes*
