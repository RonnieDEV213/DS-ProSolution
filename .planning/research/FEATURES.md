# Feature Landscape: UI/Design System

**Domain:** Modern SaaS design system (Linear, Notion, Vercel aesthetic)
**Researched:** 2026-01-25
**Overall Confidence:** HIGH

---

## Current State Analysis

Before mapping features, understanding what exists:

**Already in place:**
- shadcn/ui components (18 components: button, card, dialog, dropdown-menu, table, etc.)
- Tailwind CSS v4 with `@theme inline` directive
- OKLCH color variables in `globals.css` (`:root` + `.dark`)
- CSS custom properties for all semantic colors (background, foreground, primary, secondary, muted, accent, destructive, card, popover, border, input, ring, chart-1-5, sidebar-*)
- Hardcoded `className="dark"` on `<html>` element (no dynamic switching)
- Geist Sans + Geist Mono fonts via `next/font/google`
- Framer Motion installed (v12.25.0)
- `tw-animate-css` installed for animation utilities
- Basic `.scrollbar-thin` CSS class with hardcoded gray colors (not theme-aware)
- `class-variance-authority` (CVA) for component variants

**Key issues to address:**
- Layouts use hardcoded Tailwind gray classes (`bg-gray-950`, `bg-gray-900`, `border-gray-800`, `text-gray-300`) in 20+ files (142 occurrences) instead of semantic CSS variables
- Three separate sidebar implementations (admin, VA, client) with duplicated structure
- No theme provider or switching mechanism
- Scrollbar styles hardcoded to specific hex values, not theme-aware
- No consistent icon system (inline SVGs duplicated throughout sidebar components)

---

## Table Stakes (Must Have)

Features users expect from a polished modern SaaS product. Missing any of these makes the app feel unfinished or amateur compared to Linear, Notion, Vercel, etc.

### 1. Theme System Foundation

| Feature | Why Expected | Complexity | Performance | Notes |
|---------|--------------|------------|-------------|-------|
| CSS variable-based theme tokens | Every modern SaaS uses semantic tokens. Your existing shadcn setup already does this -- the problem is the 142 hardcoded color references that bypass the system. | Medium | Zero cost -- CSS variables are paint-time resolved by the browser | Must migrate all `bg-gray-*`, `text-gray-*`, `border-gray-*` to semantic tokens (`bg-background`, `bg-muted`, `text-foreground`, etc.) |
| Dark mode (functional) | Already hardcoded to dark. Need it working properly via `next-themes` + `ThemeProvider` so light mode is possible. | Low | Zero cost -- `next-themes` injects a script tag, no React render | shadcn/ui officially recommends `next-themes`. Anti-flash protection built in. |
| 3-4 preset themes | Modern SaaS expectation (Linear has dark/light + custom, Notion has light/dark/system, Vercel has dark/light). Users expect choice. | Medium | Zero cost -- each theme is just CSS variable overrides in `globals.css` | Define as `[data-theme="name"]` selectors. Each theme = ~40 OKLCH variable overrides. |
| Theme persistence | Theme choice must survive page reload and session. Users expect "set once, forget." | Low | Zero cost -- `localStorage` via `next-themes` | `next-themes` handles this automatically including SSR hydration. |
| System preference detection | `prefers-color-scheme` media query support. Users on dark OS expect dark app by default. | Low | Zero cost -- CSS media query | `next-themes` supports `system` option natively. |

### 2. Semantic Color Migration

| Feature | Why Expected | Complexity | Performance | Notes |
|---------|--------------|------------|-------------|-------|
| Replace hardcoded grays with CSS variables | Core prerequisite. If `bg-gray-950` stays, theme switching literally cannot work for those elements. | Medium-High | Positive -- reduces specificity conflicts | 20+ files, 142 occurrences. Bulk search-and-replace with review. The admin layout has `bg-gray-950` for main bg, sidebars use `bg-gray-900`, borders use `border-gray-800`. All must become `bg-background`, `bg-sidebar`, `border-border`, etc. |
| Sidebar semantic tokens | Sidebars already have dedicated CSS variables (`--sidebar`, `--sidebar-foreground`, etc.) but none of the three sidebar components use them. | Medium | Zero cost | Admin sidebar: `bg-gray-900` -> `bg-sidebar`, `border-gray-800` -> `border-sidebar-border`, `text-gray-300` -> `text-sidebar-foreground` |
| Active state semantic tokens | Nav items use `bg-blue-600` for active state. Should use `bg-sidebar-primary` (already defined in CSS). | Low | Zero cost | Simple class swap across three sidebar components |
| Chart/data visualization tokens | Chart colors exist (`--chart-1` through `--chart-5`) but may not be used. Ensure dashboards reference them. | Low | Zero cost | Verify existing dashboard pages use chart tokens |

### 3. Custom Scrollbars (Theme-Aware)

| Feature | Why Expected | Complexity | Performance | Notes |
|---------|--------------|------------|-------------|-------|
| Theme-aware scrollbar colors | Existing `.scrollbar-thin` uses hardcoded hex (`#4b5563`, `#1f2937`). Must use CSS variables so scrollbars change with theme. | Low | Zero cost -- pure CSS | Replace hex values with `var(--muted)` / `var(--muted-foreground)` equivalents. Use standardized `scrollbar-color` property as primary, `::-webkit-scrollbar` as progressive enhancement. |
| `scrollbar-gutter: stable` on scrollable containers | Prevents layout shift when content changes height and scrollbar appears/disappears. Standard since Dec 2024 in all browsers. | Low | Positive -- eliminates layout shift | Add to any container with `overflow-y: auto`. Particularly important for virtual scroll tables. |
| Scroll Area component adoption | shadcn/ui provides a `ScrollArea` component (Radix-based) for overlay scrollbars with native behavior. Not currently installed. | Low | Zero cost -- Radix ScrollArea is lightweight | Consider for specific containers (sidebar navigation, dropdown menus) rather than global application. |

### 4. Typography System

| Feature | Why Expected | Complexity | Performance | Notes |
|---------|--------------|------------|-------------|-------|
| Type scale with CSS variables | Consistent heading/body/caption sizes. Linear and Notion both use strict type scales. | Low | Zero cost | Define `--font-size-xs` through `--font-size-3xl` or use Tailwind's built-in scale consistently. Key: document which sizes map to which UI contexts. |
| Font weight tokens | Consistent use of font weights (regular for body, medium for labels, semibold for headings, bold for emphasis). | Low | Zero cost | Already using Geist which has excellent weight support. Establish conventions. |
| Monospace for data values | Order IDs, account numbers, monetary values should use `font-mono` (Geist Mono). Professional data display. | Low | Zero cost | Already loaded via `--font-geist-mono`. Apply consistently to data display components. |
| Text color hierarchy | `text-foreground` for primary text, `text-muted-foreground` for secondary, defined contrast ratios. | Low | Zero cost | Already have the tokens. Audit for consistency in usage across pages. |

### 5. Layout & Navigation Consistency

| Feature | Why Expected | Complexity | Performance | Notes |
|---------|--------------|------------|-------------|-------|
| Unified sidebar component | Three separate sidebar implementations (admin, VA, client) with duplicated code including ~100 lines of inline SVG icons each. Must extract shared `AppSidebar` component. | Medium | Positive -- less duplicated code in bundle | Single component with role-based nav items prop. Reuse icon rendering, profile settings, footer pattern. |
| Consistent icon system | Sidebar icons are inline SVGs. Rest of app uses `lucide-react` (installed). Icons should be unified. | Medium | Positive -- Lucide icons are tree-shaken, smaller than inline SVGs | Replace inline SVGs with Lucide equivalents. Already in `package.json`. |
| Consistent spacing | `p-8` on `<main>` across all layouts. Need consistent inner spacing scale for cards, sections, gaps. | Low | Zero cost | Define spacing conventions: page padding, card padding, section gaps, form field gaps. |
| Breadcrumb navigation | Users navigating deep into admin/accounts/[id]/edit need to know where they are. Secondary navigation expected in SaaS. | Low | Zero cost | shadcn has a Breadcrumb component. Wire to Next.js route segments. |

---

## Differentiators (Premium Feel)

Features that elevate the product from "works fine" to "feels like Linear." These create the emotional response that makes users prefer your tool.

### 1. Micro-Interactions & Transitions

| Feature | Value Proposition | Complexity | Performance | Notes |
|---------|-------------------|------------|-------------|-------|
| Sidebar hover/active transitions | Smooth background color transitions on nav items (150-200ms ease). Linear does this perfectly -- hover states feel responsive, not jarring. | Low | Zero cost -- CSS `transition` on existing elements | Add `transition-colors duration-150` to nav items. Already have `transition-colors` on some items. Ensure consistent. |
| Card hover elevation | Subtle shadow increase on card hover. Creates depth and interactivity cue. | Low | Zero cost -- CSS `transition-shadow` | `hover:shadow-md transition-shadow duration-200` on interactive cards. |
| Button press feedback | Subtle `scale(0.98)` on button active state. Gives tactile feedback. Linear, Vercel, and Stripe all do this. | Low | Zero cost -- CSS transform uses GPU compositor | `active:scale-[0.98] transition-transform duration-75`. Works with existing shadcn Button. |
| Page transitions | Fade-in on route change. Prevents jarring content swap. | Low-Medium | Near-zero if CSS-only; small cost if Framer Motion | CSS `@starting-style` (new baseline) or Framer Motion `AnimatePresence`. Already have Framer Motion installed. |
| Dialog/modal animations | Scale + fade on open/close. Radix dialogs support animation via CSS. | Low | Zero cost -- CSS animation on mount/unmount | `tw-animate-css` already installed. Apply `animate-in fade-in` / `animate-out fade-out` to dialog components. |

### 2. Polish Details

| Feature | Value Proposition | Complexity | Performance | Notes |
|---------|-------------------|------------|-------------|-------|
| Focus ring styling | Consistent, visible but not ugly focus indicators. shadcn already has `focus-visible:ring-ring/50 focus-visible:ring-[3px]` pattern. Ensure all interactive elements use it. | Low | Zero cost | Audit all custom interactive elements (sidebar links, profile button) to use consistent focus rings. Existing shadcn components already handle this. |
| Skeleton loading states | Content-shaped placeholders while data loads. Premium feel vs "Loading..." text. | Medium | Zero cost -- CSS animation on pseudo-elements | shadcn has a Skeleton component. Create skeleton variants for dashboard cards, table rows, sidebar. |
| Empty state designs | "No orders found" with illustration or icon + helpful action. Not just blank space. | Low-Medium | Zero cost | Design 3-4 empty state patterns: search-no-results, first-time-empty, error-empty, filtered-empty. |
| Toast notification styling | Already using Sonner (`richColors`, `closeButton`). Ensure toast colors respect theme tokens. | Low | Zero cost | Sonner supports `theme` prop. Wire to current theme. |
| Consistent border radius | shadcn's `--radius` variable (currently `0.625rem`). All custom elements should use `rounded-lg` / `rounded-md` from this base. | Low | Zero cost | Audit custom elements for consistent radius usage. |
| Selection/highlight colors | When users select text or rows, the highlight color should match theme accent. | Low | Zero cost -- CSS `::selection` pseudo-element | `::selection { background: oklch(from var(--primary) l c h / 30%); }` |

### 3. Theme Switcher UI

| Feature | Value Proposition | Complexity | Performance | Notes |
|---------|-------------------|------------|-------------|-------|
| Theme picker in settings/profile | Dropdown or visual grid showing theme previews. Linear uses colored circles, Notion uses a simple dropdown. | Medium | Zero cost at runtime | Place in existing `ProfileSettingsDialog`. Use `useTheme()` hook from `next-themes`. |
| Visual theme previews | Small preview swatches showing what each theme looks like. More engaging than text labels. | Low-Medium | Zero cost -- static SVG/CSS miniatures | 3-4 small rectangles showing sidebar + main area + accent color per theme. Pure CSS. |
| Theme transition animation | Smooth cross-fade when switching themes rather than instant flash. Premium detail. | Low | Near-zero -- CSS transition on `html` element | `html { transition: background-color 200ms ease, color 200ms ease; }` Note: cannot transition CSS variables directly, but transitioning the properties that use them works. |

### 4. Advanced Scrollbar Behavior

| Feature | Value Proposition | Complexity | Performance | Notes |
|---------|-------------------|------------|-------------|-------|
| Auto-hide scrollbars | Scrollbars appear on hover/scroll, fade out when idle. macOS-like behavior. Feels clean and modern. | Low | Zero cost -- CSS `:hover` + `opacity` transition | Use Radix ScrollArea or CSS-only approach with `scrollbar-width: thin` + overlay behavior. |
| Scrollbar hover expansion | Scrollbar track widens on hover for easier grabbing. Detail found in Linear, VS Code, Notion. | Low | Zero cost -- CSS `:hover` on scrollbar pseudo-elements | `::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar:hover { width: 10px; }` with transition. |

### 5. Keyboard Navigation Enhancements

| Feature | Value Proposition | Complexity | Performance | Notes |
|---------|-------------------|------------|-------------|-------|
| Command palette (Cmd+K) | Power user feature. Jump to any page, search entities, execute actions. Linear's defining feature. | High | Low runtime cost -- lazy-loaded dialog | Use `cmdk` library (shadcn has a Command component based on it). Already have Radix Dialog installed. |
| Keyboard shortcuts for common actions | `N` for new order, `F` for filter, `E` for export. Power user productivity. | Medium | Zero cost -- event listeners | Define shortcut map, display in command palette. Avoid conflicts with browser shortcuts. |

---

## Anti-Features (Do NOT Build)

Features to deliberately avoid. These are common mistakes that kill performance, add complexity without value, or create maintenance burden.

### Heavy Animation Patterns

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| JS-computed animations for theme transitions | JavaScript-driven color transitions (e.g., GSAP color tweening) block the main thread and cause jank. | Use CSS transitions on computed properties. `transition: background-color 200ms` is GPU-accelerated and zero-JS. |
| Parallax scrolling effects | Performance-intensive, causes scroll jank on lower-end machines, vertigo for some users, adds no value to a productivity tool. | Static layouts. Save parallax for marketing pages, not dashboards. |
| Spring physics animations everywhere | Framer Motion spring animations are beautiful but each one adds JS execution time. 50+ simultaneous springs on a dashboard will cause frame drops. | Reserve Framer Motion for key moments: page transitions, modal open/close, one hero animation per page MAX. Use CSS transitions for everything else. |
| Animated backgrounds / particles | Canvas or WebGL backgrounds consume GPU continuously. A dashboard is open 8+ hours/day -- background animations drain laptop battery. | Solid background colors via CSS variables. If you want visual interest, use subtle CSS gradients (static, not animated). |
| Lottie/complex SVG animations | Large animation files, runtime overhead, maintenance burden. Not appropriate for a productivity tool. | Simple CSS animations (`animate-pulse`, `animate-spin`) for loading states. Lucide icons for static iconography. |

### Over-Engineered Theming

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Runtime theme generation from user color input | Linear's 3-variable theme generation is brilliant but complex. Building a custom OKLCH palette generator is weeks of work for a feature nobody asked for. | Ship 3-4 hand-crafted preset themes. Each is ~40 CSS variable definitions. Total effort: hours, not weeks. Can add user-customizable themes in a future milestone. |
| JS-based theme engine (styled-components, Emotion, CSS-in-JS) | Runtime style injection, FOUC risk, bundle size increase, hydration mismatches with SSR. Goes against the project's CSS-first principle. | CSS custom properties + `data-theme` attribute. Zero runtime cost. `next-themes` for the minimal JS needed (theme detection + localStorage). |
| Separate CSS files per theme (lazy-loaded) | Added complexity of code splitting CSS, flash of unstyled content during theme load, caching headaches. | All theme variables in single `globals.css`. Total size increase is ~2KB for 4 themes. Not worth splitting. |
| Theme-per-user-role (admin=blue, VA=green, client=purple) | Creates confusion: "Why does my screen look different from the tutorial?" Adds QA surface area (4 themes x 3 roles = 12 combinations). | One theme system, user chooses. Role indicated by sidebar label and available nav items, not color scheme. |
| Dynamic accent color picker | HSL/OKLCH color picker for custom accent. Sounds cool, creates accessibility nightmares (user picks yellow text on white background). | Preset themes with vetted accessible color combinations. Every preset passes WCAG AA contrast ratios. |

### Premature Complexity

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Design token system with Figma sync | Token Studio, Style Dictionary pipelines -- enterprise tooling for 50+ person design teams. DS-ProSolution is an internal tool. | CSS variables in `globals.css`. Human-readable, version-controlled, no build pipeline. |
| Component library package (published npm) | Extracting components into a separate package adds monorepo complexity, versioning, publishing. No consumers outside this app. | Components live in `src/components/ui/`. shadcn's copy-paste model is correct for single-app projects. |
| Storybook | Visual component testing tool. Valuable for large teams, overhead for a small team. Setup + maintenance time exceeds benefit. | Test components in the actual app. Use the `/admin`, `/va`, `/client` routes as your "storybook." |
| CSS Modules or CSS-in-JS migration | The codebase uses Tailwind. Mixing paradigms creates inconsistency and mental overhead. | Stay with Tailwind + CSS custom properties. One paradigm, one mental model. |
| Responsive sidebar collapse (hamburger menu) | This is a desktop-first internal tool. VAs and admins use desktop monitors. Mobile sidebar adds complexity for a use case that may not exist. | Fixed sidebar, always visible. If mobile is needed later, add it as a separate milestone with proper research. |

---

## Feature Dependencies

Build order matters. This dependency graph shows what must be built first.

```
Phase 1: Foundation (must be first)
=========================================
Semantic color migration (replace hardcoded grays)
    |
    +---> Theme provider setup (next-themes + ThemeProvider)
    |       |
    |       +---> Preset theme definitions (CSS variable sets)
    |       |       |
    |       |       +---> Theme switcher UI (in ProfileSettingsDialog)
    |       |
    |       +---> System preference detection (automatic via next-themes)
    |       |
    |       +---> Theme persistence (automatic via next-themes)
    |
    +---> Theme-aware scrollbar (replace hardcoded hex)

Phase 2: Component Consolidation
=========================================
Unified sidebar component
    |
    +---> Lucide icon migration (replace inline SVGs)
    |
    +---> Breadcrumb navigation
    |
    +---> Consistent spacing audit

Phase 3: Polish & Differentiation
=========================================
Micro-interactions (hover, active, transitions)
    |
    +---> Skeleton loading states
    |
    +---> Empty state designs
    |
    +---> Focus ring audit
    |
    +---> Selection highlight colors

Phase 4: Power Features (optional this milestone)
=========================================
Command palette (Cmd+K)
    |
    +---> Keyboard shortcuts
```

**Critical path:** Semantic color migration MUST happen before theme switching can work. The 142 hardcoded gray class references will not respond to CSS variable changes. This is the highest-effort, highest-impact item.

---

## Performance Notes

### Zero-Cost Features (CSS-only, no runtime impact)

These features are implemented entirely in CSS and have zero JavaScript runtime cost:

- **Theme variable definitions** -- CSS custom properties are resolved at paint time by the browser engine. Adding 4 theme variants adds ~2KB to `globals.css`. No runtime parsing.
- **Scrollbar styling** -- `scrollbar-color` and `scrollbar-width` are CSS properties. Zero JS.
- **Micro-interactions** -- `transition-colors`, `transition-shadow`, `transition-transform` use the browser's compositor thread. They do not block the main thread.
- **Typography tokens** -- CSS variables for font sizes/weights. Zero cost.
- **Focus ring styling** -- CSS `:focus-visible` pseudo-class. No JS.
- **Selection highlight** -- CSS `::selection` pseudo-element. No JS.
- **`scrollbar-gutter: stable`** -- CSS property. Actually improves performance by preventing layout shift.

### Near-Zero Cost (Minimal JS, lazy-loaded)

- **`next-themes` ThemeProvider** -- Injects a ~1KB inline script before hydration. No React render cost. Reads/writes `localStorage` + sets `data-theme` attribute.
- **Toast theme integration** -- Sonner already renders. Passing `theme` prop is a string comparison, not a re-render.

### Low Cost (Small JS, measured impact)

- **Framer Motion page transitions** -- `AnimatePresence` adds ~5-8KB to the page bundle. One animation instance per route change. Acceptable if used sparingly.
- **Command palette (cmdk)** -- ~15KB gzipped. Should be lazy-loaded (`React.lazy`). Only mounts when opened via Cmd+K. Zero cost when closed.

### Potentially Harmful (Avoid or Measure)

- **Multiple simultaneous Framer Motion animations** -- Each `motion.div` creates a React component with animation state. 50+ on a dashboard page (e.g., animating every card mount) will cause measurable jank. Limit to 3-5 animated elements per page.
- **CSS `transition: all`** -- Transitions every property change, including layout properties. Use specific properties: `transition: background-color 200ms, color 200ms, border-color 200ms`.
- **Radix ScrollArea on every scrollable container** -- Each instance mounts a React component tree. Use native CSS scrollbar styling globally; reserve ScrollArea for specific containers where overlay behavior is needed.

### Performance Budget Recommendation

For this milestone, the performance budget should be:

| Metric | Budget | Current (estimated) | Impact of Design System |
|--------|--------|---------------------|------------------------|
| CSS bundle increase | < 3KB | ~15KB globals.css | +2KB for 4 themes |
| JS bundle increase | < 20KB | N/A | next-themes (~1KB), cmdk (~15KB lazy) |
| First Paint delta | < 50ms | N/A | Neutral (CSS-only changes) |
| Interaction delay | 0ms | N/A | Neutral (CSS transitions are compositor) |
| Layout shifts | Reduced | Some from scrollbar | scrollbar-gutter eliminates these |

---

## Preset Theme Recommendations

Based on research into modern SaaS aesthetics and the project's existing OKLCH color system:

### Theme 1: Midnight (current dark theme, refined)
- **Base:** Near-black with slight blue undertone (current `oklch(0.145 0 0)` is pure neutral -- consider `oklch(0.145 0.005 260)`)
- **Accent:** Blue (matches current sidebar active `bg-blue-600`)
- **Character:** Professional, focused. Default for productivity.

### Theme 2: Dawn (light mode)
- **Base:** Clean white / warm gray
- **Accent:** Indigo or blue
- **Character:** Bright, high contrast. Good for well-lit environments.

### Theme 3: Slate (alternative dark)
- **Base:** Warm dark gray with slight green undertone
- **Accent:** Teal or emerald
- **Character:** Softer on eyes for extended use. "Easy on the eyes" alternative.

### Theme 4: Carbon (high contrast dark)
- **Base:** True black (`oklch(0.05 0 0)`)
- **Accent:** Bright blue or cyan
- **Character:** OLED-friendly, maximum contrast. Accessibility-focused.

Each theme needs both light and dark variants initially? **No -- start with 2 dark themes, 1 light, 1 high-contrast.** The user base (VAs, admins) primarily uses dark mode. Light mode is table stakes but not the primary experience.

---

## Sources

### HIGH Confidence (Official Documentation)
- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming) -- CSS variable structure, `@theme inline` directive, color conventions
- [shadcn/ui Dark Mode for Next.js](https://ui.shadcn.com/docs/dark-mode/next) -- `next-themes` integration guide
- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme) -- `@theme` directive, CSS-first configuration
- [MDN: scrollbar-gutter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter) -- Browser support, property values
- [MDN: scrollbar-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-width) -- Standardized scrollbar styling
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- Multi-theme support, `data-theme` attribute, anti-flash protection

### MEDIUM Confidence (Verified with Multiple Sources)
- [Linear UI Redesign (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui) -- LCH theme generation, 3-variable approach, contrast system
- [web.dev: Color Themes with Baseline CSS](https://web.dev/articles/baseline-in-action-color-theme) -- `color-scheme`, `light-dark()` function, CSS-only theming
- [web.dev: scrollbar-gutter and scrollbar-width Baseline](https://web.dev/blog/baseline-scrollbar-props) -- Browser support confirmation (all major browsers since Dec 2024)
- [Chrome Developers: Scrollbar Styling](https://developer.chrome.com/docs/css-ui/scrollbar-styling) -- Standardized vs webkit approach, migration guidance
- [Evil Martians: OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) -- Why OKLCH over HSL/RGB for design systems
- [Frontend Masters: Modern CSS 2025](https://frontendmasters.com/blog/what-you-need-to-know-about-modern-css-2025-edition/) -- CSS custom properties best practices
- [tweakcn Theme Editor](https://tweakcn.com/) -- shadcn/ui theme preset generation tool
- [Pixel Free Studio: Micro-Interaction Best Practices](https://blog.pixelfreestudio.com/best-practices-for-animating-micro-interactions-with-css/) -- 150-300ms duration, easing function selection
- [Smashing Magazine: CSS linear() Easing Function](https://www.smashingmagazine.com/2023/09/path-css-easing-linear-function/) -- Advanced easing for spring-like CSS animations
- [Multi-Theme Implementation Blog](https://www.vaibhavt.com/blog/multi-theme) -- Next.js + shadcn/ui + next-themes multi-theme pattern

### LOW Confidence (Single Source / WebSearch Only -- Verify Before Implementing)
- Adobe study claiming 12% increase in click-through rates from subtle motion (cited in blog post, original study not independently verified)
- Gartner prediction that 75% of customer-facing apps will use micro-interactions by end of 2025 (analyst prediction, not empirical data)
- Claim that CSS `if()` function will be available in 2026 for conditional theming (spec proposal, not shipped)

---

*Research complete: 2026-01-25*
*Confidence: HIGH (core patterns verified with official documentation, existing codebase thoroughly analyzed, clear migration path identified)*
