# Stack Research: UI/Design System

**Project:** DS-ProSolution
**Researched:** 2026-01-25
**Mode:** Ecosystem (Stack dimension for UI/Design System milestone)
**Overall Confidence:** HIGH

---

## Current Stack Snapshot

Before recommending additions, here is what already exists and MUST be preserved:

| Technology | Version | Role |
|---|---|---|
| Next.js | 16.1.1 | App framework (App Router, RSC) |
| React | 19.2.3 | UI library |
| Tailwind CSS | ^4 | Utility-first CSS (CSS-first config via `@theme`) |
| shadcn/ui | new-york style | Component library (Radix primitives + Tailwind) |
| class-variance-authority | 0.7.1 | Component variant management |
| tailwind-merge | 3.4.0 | Class conflict resolution |
| tw-animate-css | ^1.4.0 | Animations (Tailwind v4 compatible) |
| Framer Motion | ^12.25.0 | Complex/state-driven animations |
| Lucide React | ^0.562.0 | Icons |
| Radix UI | Various ^1.x-2.x | Accessible primitives (dialog, select, etc.) |

**Critical observation:** The project already uses Tailwind CSS v4 with `@theme inline` and OKLCH color space in `globals.css`. The `.dark` class variant is configured via `@custom-variant dark (&:is(.dark *))`. The root `<html>` element is currently hardcoded to `className="dark"`. No `ThemeProvider` or theme switching mechanism exists.

---

## Recommended Stack

### New Dependencies

| Technology | Version | Purpose | Performance Impact | Rationale |
|---|---|---|---|---|
| next-themes | ^0.4.6 | Theme switching (dark/light/system/presets) | **Neutral** -- ~2KB gzipped. Sets a data attribute on `<html>` via inline script (prevents FOUC). No runtime style computation. | Industry standard for Next.js theme management. Handles SSR hydration correctly, persists preference via cookie, supports system preference detection. Confirmed working with Next.js 16 + React 19 (v0.4.6 addresses earlier peer dependency issues). |

**That is the only new runtime dependency.** Everything else is achieved through CSS architecture and configuration of existing tools.

### shadcn/ui Components to Add (no new npm deps)

| Component | Command | Purpose | Why Add |
|---|---|---|---|
| Sidebar | `npx shadcn@latest add sidebar` | Dashboard navigation | Replaces hand-rolled sidebar. Gains collapsible mode, keyboard shortcuts (Cmd+B), cookie-persisted state, mobile sheet overlay. The `globals.css` already defines `--sidebar-*` CSS variables for this component. |
| Sheet | `npx shadcn@latest add sheet` | Mobile sidebar overlay | Required by Sidebar component for responsive behavior. |
| Separator | `npx shadcn@latest add separator` | Visual dividers | Used in sidebar sections and layout composition. |
| Scroll Area | `npx shadcn@latest add scroll-area` | Custom scroll containers | Radix-based scrollable areas with custom scrollbar styling. Used in long sidebar navigation and content panels. |
| Breadcrumb | `npx shadcn@latest add breadcrumb` | Navigation context | Dashboard breadcrumb trail for Admin/VA/Client views. |

These components are added via shadcn CLI (copy/paste model) and install their own Radix dependencies automatically. They add zero new top-level dependencies because they use Radix packages already in the project or add only the specific Radix primitives they need.

### No New Dependencies Required

| Capability | Approach | Why No Library |
|---|---|---|
| Preset theme system | Pure CSS variables + `@layer base` selectors | Tailwind v4's `@theme inline` already maps CSS vars to utilities. Theme presets are just CSS variable overrides under `[data-theme="X"]` selectors. Zero JS runtime cost. |
| Custom scrollbars | Pure CSS (`scrollbar-width`, `scrollbar-color`, `::-webkit-scrollbar-*`) | Already partially implemented in `globals.css`. The standard CSS properties now have >95% browser support (Chrome 121+, Firefox 128+, Safari 16+). No library needed. |
| Custom form controls | CSS `accent-color` + existing Radix primitives + Tailwind | Radix already provides accessible form primitives (checkbox, switch, select, slider). Styling is Tailwind classes. `accent-color` handles native controls. |
| Custom modals/dialogs | Existing `@radix-ui/react-dialog` + `@radix-ui/react-alert-dialog` | Already installed at latest versions. Custom styling is Tailwind classes on shadcn/ui Dialog component. |
| Complex animations | Existing Framer Motion + tw-animate-css | tw-animate-css handles enter/exit CSS transitions for shadcn components. Framer Motion handles physics-based, state-driven animations. Both already installed. |
| Color derivation | CSS `color-mix()` + relative color syntax | Generate hover/active states from theme tokens in pure CSS. No JS color manipulation needed. Full cross-browser support since September 2024. |

---

## CSS Theming Approach

### Architecture: CSS Variables + `@theme inline` + `data-theme` Attribute

This is the recommended pattern for Tailwind CSS v4 multi-theme systems, confirmed by Tailwind maintainers (Adam Wathan) and the community in GitHub discussions #15600 and #16292.

**How it works:**

1. **`@theme inline` block** (already exists in `globals.css`) registers CSS variables with Tailwind so it generates utility classes like `bg-primary`, `text-muted-foreground`, etc.

2. **`:root` block** defines the default (light) theme values using OKLCH color space (already exists).

3. **`.dark` block** defines dark theme overrides (already exists -- will be migrated to `[data-theme="dark"]`).

4. **`[data-theme="X"]` selectors** define preset theme overrides -- these are NEW and provide the branded preset system.

5. **`next-themes`** manages which `data-theme` attribute is applied to `<html>`, handles SSR/hydration, persists user preference.

### Key Architecture Decision: `data-theme` Attribute Over `.dark` Class

The current setup uses `@custom-variant dark (&:is(.dark *))` which requires a `.dark` class. This should be migrated to:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

**Why this matters:**

- **Eliminates hydration mismatch:** The `.dark` class approach requires a `mounted` state check in components that render theme-dependent UI, causing a flash or layout shift on first render. The `data-theme` attribute approach avoids this entirely because the attribute is set by `next-themes`' inline script before React hydrates.
- **Unifies theme mechanism:** All theme switching (dark/light/presets) uses a single `data-theme` attribute rather than mixing classes and attributes.
- **`:where()` has zero specificity:** Using `:where()` instead of `:is()` prevents dark mode selectors from unexpectedly winning specificity battles with other styles.

### Theme Preset File Structure

Organize presets into separate CSS files for maintainability:

```
src/
  styles/
    themes/
      light.css        # :root / [data-theme="light"] variables
      dark.css         # [data-theme="dark"] variables
      ocean.css        # [data-theme="ocean"] variables
      brand.css        # [data-theme="brand"] variables
    scrollbar.css      # Theme-aware scrollbar styles
    forms.css          # accent-color + form control overrides
```

Import in `globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./styles/themes/light.css";
@import "./styles/themes/dark.css";
@import "./styles/themes/ocean.css";
@import "./styles/scrollbar.css";
@import "./styles/forms.css";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  /* existing @theme inline block -- unchanged */
}
```

### Why OKLCH (Confidence: HIGH)

The codebase already uses OKLCH. This is the correct choice because:

- **Perceptual uniformity:** Lightness channel is consistent across hues, so derived colors maintain expected contrast ratios. Critical for WCAG accessibility.
- **Wide gamut:** Supports Display P3 (50% more colors than sRGB). Future-proof.
- **Browser support:** >92% global support as of Q2 2025. Chrome 111+, Safari 15.4+, Firefox 113+. All above the Next.js 16 baseline.
- **Tailwind v4 default:** shadcn/ui converted all color tokens to OKLCH for Tailwind v4 compatibility.
- **Programmatic derivation:** CSS relative color syntax enables deriving hover/active states purely in CSS with zero JS.

### CSS color-mix() and Relative Color Syntax for Derived States

Instead of defining every hover/active/disabled state explicitly per theme, derive them from base tokens:

```css
/* Derive hover state from primary -- pure CSS, zero JS */
.btn-primary:hover {
  background-color: oklch(from var(--primary) calc(l - 0.05) c h);
}

/* Subtle background tints from theme colors */
.subtle-primary-bg {
  background-color: color-mix(in oklch, var(--primary) 10%, var(--background));
}

/* Active/pressed state */
.btn-primary:active {
  background-color: oklch(from var(--primary) calc(l - 0.1) c h);
}
```

Both `color-mix()` and relative color syntax have full cross-browser support (Baseline since September 2024). This eliminates the need for runtime JS color manipulation libraries. When the theme changes, these derived values update automatically because they reference CSS variables.

---

## Custom Component Strategy

### Scrollbars (Pure CSS, Confidence: HIGH)

The codebase already has scrollbar styles in `globals.css` (lines 128-154) using hardcoded hex colors (`#4b5563`, `#1f2937`). These do not adapt to theme changes.

**Upgrade path:**

1. **Replace hardcoded colors with CSS variables** so scrollbars adapt to theme presets.
2. **Use both standard properties and WebKit fallback** for cross-browser support.
3. **No plugin or library needed** -- the `tailwind-scrollbar` npm plugin adds a dependency for zero performance benefit over pure CSS. Both approaches output identical static CSS.

**Theme-aware scrollbar pattern:**

```css
/* Add to each theme preset */
:root, [data-theme="light"] {
  --scrollbar-thumb: oklch(0.7 0 0);
  --scrollbar-thumb-hover: oklch(0.6 0 0);
  --scrollbar-track: oklch(0.95 0 0);
}

[data-theme="dark"] {
  --scrollbar-thumb: oklch(0.35 0 0);
  --scrollbar-thumb-hover: oklch(0.45 0 0);
  --scrollbar-track: oklch(0.15 0 0);
}

/* Universal scrollbar styles referencing theme vars */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.scrollbar-thin::-webkit-scrollbar { width: 8px; height: 8px; }
.scrollbar-thin::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

**Cross-browser note:** When both `scrollbar-color` and `::-webkit-scrollbar-*` are defined, Chromium 121+ prioritizes the standard properties. Safari uses the WebKit fallback. Firefox uses the standard properties. This means the same CSS works everywhere.

### Form Controls (CSS + Radix, Confidence: HIGH)

Three-layer approach:

1. **`accent-color` on `:root`** -- instantly themes native checkboxes, radios, range inputs, progress bars. Set to `var(--primary)`. Zero effort, full accessibility (browser auto-calculates contrast for check marks). Supported in all modern browsers.

2. **Radix primitives** (already installed) -- Checkbox, Switch, Select, Slider all support full custom styling via Tailwind classes. These are already in the shadcn/ui component library at `components/ui/`.

3. **CVA variants** (already installed as `class-variance-authority`) -- Define branded variant styles for form controls (e.g., size variants, color variants). No new library needed.

```css
/* Add to globals.css or forms.css */
:root {
  accent-color: var(--primary);
}
```

### Modals/Dialogs (Radix, Confidence: HIGH)

Already fully equipped:
- `@radix-ui/react-dialog` (^1.1.15) -- general modals
- `@radix-ui/react-alert-dialog` (^1.1.15) -- confirmation dialogs

Custom styling approach:
- Override shadcn/ui Dialog component styles with theme-aware CSS variables
- Add responsive variants (full-screen on mobile, centered on desktop) via Tailwind responsive utilities
- Use `tw-animate-css` for enter/exit animations (already configured)
- Use `motion-safe:` / `motion-reduce:` for reduced-motion accessibility
- Prevent layout shift with `scrollbar-gutter: stable` on body when modal opens

### Layout/Navigation (shadcn/ui Sidebar, Confidence: HIGH)

**Current state:** Hand-rolled sidebar in `components/admin/sidebar.tsx` with inline SVG icons (not Lucide -- despite Lucide being installed) and manual active-state logic. 213 lines of custom code including 7 inline SVG icon definitions.

**Recommendation:** Migrate to shadcn/ui's official Sidebar component:

```bash
npx shadcn@latest add sidebar
```

**What this gives over the current implementation:**

| Capability | Current Hand-Rolled | shadcn/ui Sidebar |
|---|---|---|
| Collapsible (icon-only mode) | No | Yes |
| Keyboard shortcut (Cmd+B) | No | Yes, built-in |
| Cookie-persisted state (SSR-safe) | No | Yes |
| Mobile responsive (sheet overlay) | No | Yes |
| Composable sections (header/footer/groups) | Manual divs | SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup |
| Icon system | Inline SVGs (7 hand-coded) | Lucide React icons (already installed) |
| Active state management | 15 lines of custom logic | SidebarMenuButton `isActive` prop |
| Theme integration | Hardcoded `bg-gray-900`, `border-gray-800` | Uses `--sidebar-*` CSS variables (already defined in globals.css) |

The existing `globals.css` already defines sidebar-specific CSS variables (`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`), confirming shadcn/ui Sidebar was intended but not yet adopted.

---

## What NOT to Add

| Library/Approach | Why Avoid | Performance Impact if Added |
|---|---|---|
| **styled-components / Emotion** | CSS-in-JS adds runtime overhead. Tailwind v4 is CSS-first by design. Adding a CSS-in-JS layer would create a dual styling system. | **Negative** -- runtime style injection, increased JS bundle, re-renders on theme change |
| **tailwind-scrollbar plugin** | Adds an npm dependency for something achievable with ~20 lines of CSS. The plugin generates utility classes at build time -- same output as hand-written CSS. Violates CLAUDE.md guardrail: "Don't add extra libraries unless necessary." | Neutral performance, unnecessary dependency |
| **Theme UI / Chakra UI / MUI** | Complete design systems that conflict with shadcn/ui. Would require rewriting all existing components. | **Negative** -- massive bundle increase, conflicting style systems |
| **CSS Modules** | Adds a parallel styling system alongside Tailwind. Fragments the approach, increases cognitive load. | Neutral performance, but architectural confusion |
| **Sass/SCSS** | Tailwind v4 uses PostCSS natively. OKLCH + CSS variables + `color-mix()` replace Sass color functions. `@layer` replaces Sass nesting for organization. | Neutral performance, unnecessary tooling layer |
| **Runtime theme libraries (theme-change, use-dark-mode)** | `next-themes` handles everything needed. Additional libraries would duplicate functionality. | **Negative** -- duplicate JS, conflicting theme state |
| **tailwind-variants** | CVA is already installed and deeply integrated into all 18 shadcn/ui components. Migrating would require rewriting every component's variant definitions. They solve the same problem. | Neutral performance, prohibitive migration cost |
| **Additional icon library (Heroicons, Phosphor, etc.)** | Lucide React is already installed with 562+ icons. Adding another icon set duplicates icons and increases bundle. Current sidebar uses inline SVGs instead of Lucide -- fix that, don't add another library. | **Negative** -- increased bundle size |
| **SimpleBar (JS scrollbar library)** | Replaces native scroll with JS-managed scroll. Violates the CSS-first constraint. Native CSS scrollbar styling covers all visual needs. | **Negative** -- JS overhead, potential scroll performance degradation |
| **Radix Themes** | A pre-built theme layer on top of Radix primitives. Would conflict with shadcn/ui's own styling approach. shadcn/ui IS the theme layer for Radix in this project. | **Negative** -- conflicting styles, doubled CSS |

---

## Integration Points

### How the Theme System Connects to the Existing Stack

```
next-themes (ThemeProvider)
    |
    | Sets attribute on mount (inline script prevents FOUC)
    v
<html data-theme="dark">
    |
    | CSS selector matching: [data-theme="dark"] { --primary: ...; }
    v
CSS Variables (:root / [data-theme="X"] overrides)
    |
    | @theme inline { --color-primary: var(--primary); }
    v
Tailwind CSS v4 utility class generation (bg-primary, text-foreground, etc.)
    |
    | cn() / cva() compose Tailwind classes
    v
shadcn/ui Components + CVA Variants
    |
    v
Rendered UI (all three dashboards: Admin, VA, Client)
```

### Integration Effort by Area

| Area | Effort | What Changes |
|---|---|---|
| Root layout (`app/layout.tsx`) | Low | Add `<ThemeProvider>` wrapper, remove `className="dark"`, add `suppressHydrationWarning` |
| `globals.css` | Medium | Restructure into theme preset files, update `@custom-variant`, add scrollbar/form CSS variable references |
| `@custom-variant` directive | Low | Change `(&:is(.dark *))` to `(&:where([data-theme="dark"], [data-theme="dark"] *))` |
| shadcn/ui components | None | Already use CSS variables. Theme changes propagate automatically to all 18 existing components. |
| Admin sidebar | Medium | Replace 213-line hand-rolled sidebar with shadcn/ui Sidebar component + Lucide icons |
| VA layout | Medium | Same sidebar migration pattern |
| Client layout | Medium | Same sidebar migration pattern |
| Framer Motion usage | None | Framer Motion animations are independent of theming |
| Form components | Low | Add `accent-color: var(--primary)` to `:root` |
| Existing hardcoded gray-* classes | Medium | Audit and replace `bg-gray-950`, `bg-gray-900`, `border-gray-800` etc. with semantic tokens (`bg-background`, `bg-sidebar`, `border-sidebar-border`) |

### next-themes Configuration

```tsx
// app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem
          themes={["light", "dark", "ocean", "brand"]}
          disableTransitionOnChange
        >
          <TooltipProvider>
            <DatabaseProvider>
              <QueryProvider>
                {children}
              </QueryProvider>
            </DatabaseProvider>
            <Toaster position="top-right" richColors duration={5000} closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Configuration notes:**

- `attribute="data-theme"` -- uses data attribute instead of class for hydration safety
- `defaultTheme="dark"` -- preserves current behavior (app is dark-mode-only today)
- `enableSystem` -- respects OS preference when user selects "system" theme
- `disableTransitionOnChange` -- prevents transition flash when switching themes (can be removed later if smooth transitions are desired)
- `themes` array -- declares all available preset themes

---

## Performance Assessment

| Change | Impact | Explanation |
|---|---|---|
| **next-themes** | **Neutral** | ~2KB gzipped. Inline script sets `data-theme` before first paint. Cookie persistence works with SSR. No runtime style computation. |
| **CSS variable theme presets** | **Positive** | CSS variables are resolved by the browser's style engine at near-zero cost. Theme switching changes one attribute; browser recalculates only properties that reference changed variables. No JS involved in style application. |
| **`data-theme` attribute over `.dark` class** | **Positive** | Eliminates hydration mismatch handling (no `mounted` state, no forced re-render after mount). Cleaner SSR path. |
| **OKLCH color space** | **Neutral** | Already in use. Browser-native color parsing. No polyfill needed. |
| **CSS `color-mix()` / relative colors** | **Positive** | Replaces what would otherwise be JS-computed hover/active color states. Moves color computation to the browser's CSS engine. |
| **Pure CSS scrollbars (variable-based)** | **Neutral** | Replacing hardcoded hex with CSS variable references has zero performance difference. Both are static CSS resolved at paint time. |
| **`accent-color` for forms** | **Positive** | Single CSS property replaces what would otherwise require JS-based form control theming. Browser handles contrast calculation automatically. |
| **shadcn/ui Sidebar replacing hand-rolled** | **Neutral** | Similar DOM structure. Gains cookie-persisted state (SSR-compatible) and keyboard shortcuts. Sheet overlay for mobile adds a Radix Portal -- negligible impact. |
| **Replacing hardcoded grays with semantic tokens** | **Positive** | No runtime difference, but enables all three dashboards to theme-switch without per-component changes. Reduces future maintenance JS/CSS. |

**Net assessment: Performance-positive.** The theme system moves work FROM JavaScript TO CSS, which is always a win for render performance. The only JS addition is `next-themes` at ~2KB, and it actually reduces JS complexity by eliminating the need for manual hydration handling and mounted-state checks.

---

## Version Pinning

| Package | Install Version | Pin Rationale |
|---|---|---|
| next-themes | `^0.4.6` | Latest stable as of Jan 2026. Supports React 19 + Next.js App Router + `data-theme` attribute mode. npm may show a peer dependency warning for React 19 -- this is safe to ignore (functional compatibility confirmed) or resolve with `--legacy-peer-deps`. |

No version changes to existing packages are required.

**Installation command:**

```bash
cd apps/web
npm install next-themes@^0.4.6
```

---

## Sources

### HIGH Confidence (Official Documentation / Verified)
- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme) -- official docs for `@theme` directive
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) -- official theming documentation, OKLCH + CSS variables
- [shadcn/ui Sidebar Component](https://ui.shadcn.com/docs/components/sidebar) -- official sidebar component docs
- [shadcn/ui Tailwind v4 Migration](https://ui.shadcn.com/docs/tailwind-v4) -- `tw-animate-css` as official replacement for `tailwindcss-animate`
- [MDN CSS scrollbar styling](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scrollbars_styling) -- standard scrollbar properties spec
- [MDN accent-color](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/accent-color) -- native form control theming
- [Chrome Scrollbar Styling Guide](https://developer.chrome.com/docs/css-ui/scrollbar-styling) -- cross-browser strategy, override behavior
- [MDN CSS Relative Colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Using_relative_colors) -- color derivation syntax
- [MDN color-mix()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix) -- color mixing function
- [next-themes npm](https://www.npmjs.com/package/next-themes) -- v0.4.6, latest stable
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- React 19 compatibility, 42 open issues
- [CVA Documentation](https://cva.style/docs) -- variant management, v0.7.1
- [Can I Use: CSS scrollbar styling](https://caniuse.com/css-scrollbar) -- >95% browser support

### MEDIUM Confidence (Verified Community Patterns, Multiple Sources Agree)
- [Tailwind v4 Multi-Theme Strategy (simonswiss)](https://simonswiss.com/posts/tailwind-v4-multi-theme) -- `data-theme` pattern for v4
- [Tailwind GitHub Discussion #16292](https://github.com/tailwindlabs/tailwindcss/discussions/16292) -- confirms `@theme` does NOT scope to `data-theme` (must override CSS vars directly)
- [Tailwind GitHub Discussion #15600](https://github.com/tailwindlabs/tailwindcss/discussions/15600) -- recommended CSS variable override pattern
- [Dark Mode with Tailwind v4 + Next.js](https://www.thingsaboutweb.dev/en/posts/dark-mode-with-tailwind-v4-nextjs) -- `data-theme` approach eliminates hydration mismatch
- [Dark Mode Next.js 15 + Tailwind v4 (sujalvanjare)](https://www.sujalvanjare.com/blog/dark-mode-nextjs15-tailwind-v4) -- `@custom-variant` with `data-theme`
- [next-themes React 19 Issue #296](https://github.com/pacocoursey/next-themes/issues/296) -- peer dependency status tracked
- [OKLCH Ultimate Guide](https://oklch.org/posts/ultimate-oklch-guide) -- perceptual uniformity advantages for theming
- [web.dev Color Themes with Baseline CSS](https://web.dev/articles/baseline-in-action-color-theme) -- CSS custom property theming patterns
- [Evil Martians OKLCH Guide](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) -- why OKLCH over HSL/RGB for design systems
- [tw-animate-css GitHub](https://github.com/Wombosvideo/tw-animate-css) -- v4-compatible animation replacement, 4.7M weekly npm downloads
- [Framer Motion vs CSS comparison (multiple sources)](https://theekshanachamodhya.medium.com/why-framer-motion-still-beats-css-animations-in-2025-16b3d74eccbd) -- use CSS for simple transitions, Framer Motion for complex state-driven animation

### LOW Confidence (Single Source / Unverified)
- None. All recommendations are verified through multiple official or authoritative sources.
