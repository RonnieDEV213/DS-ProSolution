# Phase 22: Theme Foundation & Color Token Migration - Research

**Researched:** 2026-01-25
**Domain:** CSS theming, design tokens, scrollbar styling, typography systems
**Confidence:** HIGH

## Summary

Phase 22 establishes the foundation for v4's multi-theme system by migrating from hardcoded colors to semantic CSS variable tokens, implementing next-themes for theme management, and creating theme-aware custom scrollbars. The research confirms that Tailwind CSS v4's `@theme inline` directive combined with next-themes provides a zero-runtime-cost solution for theme switching through pure CSS variable cascade, meeting the project's performance-neutral constraint.

The standard approach involves three layers: (1) defining semantic tokens in `@theme inline` that reference CSS variables, (2) setting theme-specific values using `data-theme` attribute selectors in `@layer base`, and (3) wrapping the app with next-themes ThemeProvider to manage theme state and prevent FOUC through an inline blocking script. This architecture enables theme switching without React re-renders, as only CSS variables update at the document root.

Key findings indicate that the codebase currently has 844 occurrences of hardcoded grays across 83 files, uses Tailwind v4 with OKLCH colors, and has a hardcoded `className="dark"` on the root HTML element that must be replaced with dynamic `data-theme` attribute management.

**Primary recommendation:** Use next-themes (attribute="data-theme") + @theme inline + @custom-variant pattern for zero-JS theme switching. Migrate scrollbars to standard scrollbar-color/scrollbar-width with webkit fallback. Establish 6-level type scale with semantic naming.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | ^0.4.4 | Theme state management | De facto standard for Next.js theme switching, prevents FOUC with inline blocking script, ~3KB gzipped |
| Tailwind CSS | v4.x | CSS framework with theme system | Already in use, v4's `@theme` directive is the native way to define design tokens |
| CSS Variables | Native | Theme value storage | Zero runtime cost, browser-native cascade, works with SSR |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OKLCH colors | Native CSS | Color format | Already in use in codebase, better perceptual uniformity than HSL |
| Geist Sans/Mono | Next/font | Typography | Already loaded via Next.js font optimization |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-themes | React Context + localStorage manually | More code, manual FOUC prevention, no system preference detection |
| CSS Variables | CSS-in-JS (styled-components) | Violates project constraints (no CSS-in-JS), runtime overhead |
| Standard scrollbar-* | JS scrollbar library (OverlayScrollbars) | Violates project constraints (breaks react-window virtualization) |

**Installation:**
```bash
npm install next-themes
```

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/
├── app/
│   ├── globals.css          # @theme inline, semantic tokens, scrollbar styles
│   └── layout.tsx            # ThemeProvider wrapper
├── components/
│   └── theme-provider.tsx    # "use client" wrapper for next-themes
└── lib/
    └── theme-tokens.ts       # TypeScript types for theme tokens (optional)
```

### Pattern 1: Semantic Token System with @theme inline

**What:** Define semantic CSS variables in `@theme inline`, then override per theme using `data-theme` selectors
**When to use:** When theme values need to be accessible both in Tailwind utilities AND in custom CSS

**Example:**
```css
/* Source: https://tailwindcss.com/docs/theme + https://simonswiss.com/posts/tailwind-v4-multi-theme */

@import "tailwindcss";

/* Register semantic tokens that reference CSS variables */
@theme inline {
  --color-app-bg: var(--app-bg);
  --color-app-sidebar: var(--app-sidebar);
  --color-scrollbar-thumb: var(--scrollbar-thumb);
  --color-scrollbar-track: var(--scrollbar-track);
}

/* Define theme-specific values */
@layer base {
  :root {
    /* Default theme (light/dark via existing system) */
    --app-bg: oklch(0.145 0 0);
    --app-sidebar: oklch(0.205 0 0);
    --scrollbar-thumb: oklch(0.556 0 0);
    --scrollbar-track: oklch(0.269 0 0);
  }

  [data-theme="midnight"] {
    --app-bg: oklch(0.12 0.01 240);  /* Near-black with blue undertone */
    --app-sidebar: oklch(0.18 0.015 240);
    --scrollbar-thumb: oklch(0.45 0.05 240);
    --scrollbar-track: oklch(0.22 0.02 240);
  }
}
```

**Why `inline` matters:** Without `inline`, CSS variable resolution happens at definition time, not usage time, causing fallbacks to trigger incorrectly when variables are scoped under selectors.

### Pattern 2: next-themes FOUC Prevention

**What:** ThemeProvider with blocking script prevents flash of wrong theme on page load
**When to use:** Always, in root layout

**Example:**
```tsx
/* Source: https://ui.shadcn.com/docs/dark-mode/next */

// components/theme-provider.tsx
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Key config:**
- `suppressHydrationWarning` on `<html>` prevents mismatch warnings (server doesn't know theme, client applies via blocking script)
- `attribute="data-theme"` uses data attribute instead of class (better for hydration safety)
- `defaultTheme="system"` respects OS preference via `prefers-color-scheme`
- `disableTransitionOnChange` prevents jarring animations during theme switch

### Pattern 3: Custom Variant for data-theme

**What:** Use `@custom-variant` to enable theme-specific utilities in Tailwind
**When to use:** When migrating from `@custom-variant dark (&:is(.dark *))` to data-theme pattern

**Example:**
```css
/* Source: https://dev.to/vrauuss_softwares/-create-custom-themes-in-tailwind-css-v4-custom-variant-12-2nf0 */

/* OLD (hydration-unsafe, hardcoded class) */
@custom-variant dark (&:is(.dark *));

/* NEW (hydration-safe, dynamic attribute) */
@custom-variant dark (&:where([data-theme="dark"] *));
@custom-variant midnight (&:where([data-theme="midnight"] *));
```

**Usage in templates:**
```html
<div class="bg-background dark:bg-card midnight:bg-midnight-card">
  <!-- Background changes per theme -->
</div>
```

### Pattern 4: Modern Scrollbar Styling with Progressive Enhancement

**What:** Use standard `scrollbar-color` + `scrollbar-width` as primary, webkit pseudo-elements as fallback
**When to use:** All custom scrollbar styling to maximize browser support

**Example:**
```css
/* Source: https://developer.chrome.com/docs/css-ui/scrollbar-styling */

.scrollbar-thin {
  /* Standard properties (Chrome 121+, Firefox 64+, Safari 26.2+) */
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
  scrollbar-gutter: stable;  /* Prevent layout shift */
}

/* Progressive enhancement for older Chrome/Safari */
@supports selector(::-webkit-scrollbar) {
  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

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
}
```

**Browser support:**
- Standard properties: Chrome 121+ (Jan 2024), Firefox 64+ (2018), Safari 26.2+ (expected 2026)
- Webkit pseudo-elements: Chrome 2+, Safari 4+, Edge 79+

### Pattern 5: scrollbar-gutter for Layout Stability

**What:** Reserve scrollbar space to prevent layout shift when scrollbar appears/disappears
**When to use:** On all scrollable containers, especially modals and page containers

**Example:**
```css
/* Source: https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter */

html {
  scrollbar-gutter: stable;  /* Always reserve gutter space */
}

/* For centered content requiring symmetry */
.modal-content {
  scrollbar-gutter: stable both-edges;  /* Note: broken in Chrome, use with caution */
}

/* Progressive enhancement fallback */
@supports not (scrollbar-gutter: stable) {
  html {
    overflow-y: scroll;  /* Force scrollbar to always show */
  }
}
```

**Limitations:**
- Only works with classic scrollbars (not overlay scrollbars)
- `both-edges` is broken in Chrome (reserves space but scrollbar doesn't use it)
- Baseline 2024 Newly Available (may need fallback for older browsers)

### Pattern 6: Type Scale System

**What:** Define semantic type scale as CSS variables with ratio-based sizing
**When to use:** All typography to ensure consistency

**Example:**
```css
/* Source: https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns */

@theme inline {
  /* Base font sizes - 1.2 ratio (minor third scale) */
  --text-xs: 0.694rem;      /* ~11px */
  --text-sm: 0.833rem;      /* ~13px */
  --text-base: 1rem;        /* 16px */
  --text-lg: 1.2rem;        /* ~19px */
  --text-xl: 1.44rem;       /* ~23px */
  --text-2xl: 1.728rem;     /* ~28px */

  /* Semantic type tokens */
  --text-caption: var(--text-xs);
  --text-body: var(--text-base);
  --text-label: var(--text-sm);
  --text-heading-sm: var(--text-lg);
  --text-heading-md: var(--text-xl);
  --text-heading-lg: var(--text-2xl);

  /* Font weights */
  --font-weight-regular: 400;   /* Body text */
  --font-weight-medium: 500;    /* Labels, UI elements */
  --font-weight-semibold: 600;  /* Headings */
}
```

### Anti-Patterns to Avoid

- **Hardcoded theme in HTML:** Don't use `<html className="dark">` — prevents dynamic theme switching and causes hydration issues
- **Nesting @theme under selectors:** `[data-theme="x"] { @theme {...} }` doesn't work — @theme must be top-level, use CSS variables in @layer base instead
- **Runtime JS for theme application:** Don't use JS to add/remove classes for theme — violates zero-JS constraint, use CSS variable cascade
- **Mixing scrollbar approaches:** Don't combine standard properties without @supports guards — causes conflicts in Chrome 121+
- **Complex custom scrollbar JS:** Don't use libraries like SimpleBar — breaks react-window virtualization
- **Presentational token names:** Don't use `--color-blue-500` for semantic meanings — use `--color-primary` that can change per theme

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme state + FOUC prevention | Custom localStorage wrapper with inline script | next-themes | Handles edge cases (system preference changes, SSR hydration, localStorage sync across tabs), 3KB, battle-tested |
| Scrollbar auto-hide animations | Custom CSS transitions on ::-webkit-scrollbar | CSS `scrollbar-width: auto` + OS behavior | Cannot transition webkit scrollbar pseudo-elements reliably, better to let OS handle it |
| CSS variable type safety | Manual TypeScript definitions | Generated types from design tokens (future) | Easy to drift out of sync, error-prone |
| Theme token organization | Flat CSS variable list | Semantic hierarchy (primitives → aliases → components) | Scalability issues, naming conflicts, hard to maintain |

**Key insight:** Theme switching is deceptively complex due to SSR hydration, FOUC prevention, system preference detection, and localStorage sync. next-themes solves all of this in 3KB with an inline blocking script that runs before first paint.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch from Server/Client Theme Difference

**What goes wrong:** Server renders default theme, client applies saved theme from localStorage, React detects mismatch and throws warnings/errors
**Why it happens:** Server doesn't have access to localStorage during SSR, so it can't know user's theme preference
**How to avoid:** Use `suppressHydrationWarning` on `<html>` element AND use next-themes which injects blocking script before React hydration
**Warning signs:** Console warnings about "Text content did not match", visual flash of wrong theme on page load

### Pitfall 2: CSS Variable Resolution Timing with @theme

**What goes wrong:** Theme-scoped variables trigger fallbacks unexpectedly when using @theme without `inline` option
**Why it happens:** CSS variable resolution happens where variable is defined, not where it's used, so `var(--foo, fallback)` checks for `--foo` at definition scope
**How to avoid:** Always use `@theme inline` when theme variables reference other CSS variables
**Warning signs:** Fallback values showing up even though you set the variable, inconsistent theme application

### Pitfall 3: Hardcoded className="dark" Prevents Dynamic Themes

**What goes wrong:** Theme switching doesn't work because `dark` class is hardcoded in root layout
**Why it happens:** Legacy approach from before next-themes, developer assumed app would only have one dark theme
**How to avoid:** Remove hardcoded `className="dark"` from `<html>`, let next-themes manage `data-theme` attribute dynamically
**Warning signs:** Theme toggle appears to work but visuals don't change, data-theme attribute doesn't update in DOM inspector

### Pitfall 4: @custom-variant dark Still Using .dark Class

**What goes wrong:** Custom variant selector targets `.dark` class, but next-themes sets `data-theme` attribute
**Why it happens:** Migrated to next-themes but forgot to update custom variant selector
**How to avoid:** Migrate `@custom-variant dark (&:is(.dark *))` to `@custom-variant dark (&:where([data-theme="dark"] *))`
**Warning signs:** Dark mode utilities (e.g., `dark:bg-card`) don't apply, theme switching has no effect

### Pitfall 5: Mixing Standard and Webkit Scrollbar Properties Without Guards

**What goes wrong:** In Chrome 121+, both standard `scrollbar-color` and `::-webkit-scrollbar` apply, causing conflicts
**Why it happens:** Chrome now supports both standards, and without guards, both sets of rules execute
**How to avoid:** Use `@supports` queries to conditionally apply webkit fallback only in browsers that don't support standard properties
**Warning signs:** Scrollbar colors wrong in Chrome but correct in Firefox, scrollbar appears twice as thick

### Pitfall 6: scrollbar-gutter: stable both-edges in Chrome

**What goes wrong:** Space is reserved on both sides, but scrollbar only uses one side, creating asymmetric layout
**Why it happens:** Chrome implementation bug with `both-edges` value
**How to avoid:** Use `scrollbar-gutter: stable` (single side) unless you can verify Chrome fix landed in target browser version
**Warning signs:** Content appears off-center, extra whitespace on one side of scrollable container

### Pitfall 7: Assuming All Colors Need Migration

**What goes wrong:** Migrating already-semantic colors (from shadcn/ui) to new tokens, creating duplication
**Why it happens:** Grep search finds all colors, but some are already using CSS variables via Tailwind
**How to avoid:** Audit existing `globals.css` — only migrate hardcoded hex/oklch values, preserve references to `--foreground`, `--background`, etc.
**Warning signs:** Token system has duplicate names (`--app-bg` and `--background` both for same purpose), confusion about which to use

### Pitfall 8: Performance Regression from React Re-renders on Theme Change

**What goes wrong:** Every component re-renders when theme changes, causing performance degradation
**Why it happens:** Using React Context for theme state instead of CSS variables
**How to avoid:** Use next-themes with CSS variables — theme change only updates `:root` CSS variables, zero React re-renders
**Warning signs:** Profiler shows full app re-render on theme toggle, noticeable lag when switching themes, virtualized lists lose scroll position

## Code Examples

Verified patterns from official sources:

### Complete globals.css Theme Foundation

```css
/* Source: https://ui.shadcn.com/docs/tailwind-v4 + project constraints */

@import "tailwindcss";
@import "tw-animate-css";

/* Use data-theme attribute instead of .dark class for hydration safety */
@custom-variant dark (&:where([data-theme="dark"] *));

/* Register semantic tokens that reference CSS variables */
@theme inline {
  /* Existing shadcn tokens (preserve) */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* NEW: Application-level semantic tokens */
  --color-app-bg: var(--app-bg);
  --color-app-sidebar: var(--app-sidebar);
  --color-scrollbar-thumb: var(--scrollbar-thumb);
  --color-scrollbar-thumb-hover: var(--scrollbar-thumb-hover);
  --color-scrollbar-track: var(--scrollbar-track);
  --color-table-header-bg: var(--table-header-bg);
  --color-table-row-hover: var(--table-row-hover);

  /* Font tokens */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  /* Radius tokens (preserve existing) */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
}

/* Define theme-specific values */
@layer base {
  :root {
    --radius: 0.625rem;

    /* Existing light theme (preserve for backwards compatibility) */
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    /* ... rest of existing light theme tokens ... */

    /* NEW: Application semantic tokens (light) */
    --app-bg: oklch(0.98 0 0);
    --app-sidebar: oklch(0.96 0 0);
    --scrollbar-thumb: oklch(0.7 0 0);
    --scrollbar-thumb-hover: oklch(0.6 0 0);
    --scrollbar-track: oklch(0.92 0 0);
    --table-header-bg: oklch(0.95 0 0);
    --table-row-hover: oklch(0.97 0 0);
  }

  [data-theme="dark"] {
    /* Existing dark theme (preserve) */
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    /* ... rest of existing dark theme tokens ... */

    /* NEW: Application semantic tokens (dark) */
    --app-bg: oklch(0.145 0 0);
    --app-sidebar: oklch(0.205 0 0);
    --scrollbar-thumb: oklch(0.556 0 0);
    --scrollbar-thumb-hover: oklch(0.708 0 0);
    --scrollbar-track: oklch(0.269 0 0);
    --table-header-bg: oklch(0.18 0 0);
    --table-row-hover: oklch(0.22 0 0);
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Theme-aware scrollbar styles */
.scrollbar-thin {
  /* Modern standard approach */
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}

/* Progressive enhancement for older browsers */
@supports selector(::-webkit-scrollbar) {
  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

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

  .scrollbar-thin::-webkit-scrollbar-corner {
    background: var(--scrollbar-track);
  }
}
```

### Migration Pattern: Hardcoded Gray to Semantic Token

```tsx
/* BEFORE: Hardcoded grays */
<aside className="w-64 bg-gray-900 border-r border-gray-800">
  <div className="p-6 border-b border-gray-800">
    <h1 className="text-xl font-bold text-white">DS-ProSolution</h1>
    <p className="text-sm text-gray-400 mt-1">Admin Dashboard</p>
  </div>
</aside>

/* AFTER: Semantic tokens */
<aside className="w-64 bg-app-sidebar border-r border-border">
  <div className="p-6 border-b border-border">
    <h1 className="text-xl font-bold text-foreground">DS-ProSolution</h1>
    <p className="text-sm text-muted-foreground mt-1">Admin Dashboard</p>
  </div>
</aside>
```

**Migration strategy:**
1. `bg-gray-900` → `bg-app-sidebar` (semantic for sidebar backgrounds)
2. `border-gray-800` → `border-border` (already semantic in shadcn)
3. `text-white` → `text-foreground` (semantic for primary text)
4. `text-gray-400` → `text-muted-foreground` (semantic for secondary text)

### Type Scale Implementation

```css
/* Source: https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns */

@theme inline {
  /* Type scale - 1.2 ratio (minor third) */
  --text-xs: 0.694rem;      /* ~11px - captions, labels */
  --text-sm: 0.833rem;      /* ~13px - small body, form labels */
  --text-base: 1rem;        /* 16px - body text */
  --text-lg: 1.2rem;        /* ~19px - small headings */
  --text-xl: 1.44rem;       /* ~23px - medium headings */
  --text-2xl: 1.728rem;     /* ~28px - large headings */

  /* Font weight conventions */
  --font-weight-regular: 400;   /* Body text */
  --font-weight-medium: 500;    /* Labels, buttons, UI elements */
  --font-weight-semibold: 600;  /* Headings, emphasized text */
}
```

**Usage:**
```tsx
<h1 className="text-2xl font-semibold">Page Title</h1>
<p className="text-base font-regular">Body paragraph text</p>
<label className="text-sm font-medium">Form Label</label>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 JS config | Tailwind v4 CSS-first with @theme | Jan 2025 (v4.0 release) | Eliminates JS config, everything in CSS, better LSP support |
| HSL color format | OKLCH color format | Tailwind v4 | Better perceptual uniformity, more accurate gradients |
| ::-webkit-scrollbar only | scrollbar-color/scrollbar-width standard | Chrome 121 (Jan 2024) | Standards-based, simpler syntax, progressive enhancement needed |
| className-based theming | data-theme attribute | 2023-2024 (next-themes adoption) | Better hydration safety, clearer separation of concerns |
| React Context for theme | CSS variables only | Ongoing best practice | Zero re-renders on theme change, better performance |
| @custom-variant dark (&:is(.dark *)) | @custom-variant dark (&:where([data-theme="dark"] *)) | Tailwind v4 + next-themes | Hydration-safe, works with dynamic attributes |

**Deprecated/outdated:**
- **Hardcoded `className="dark"` on `<html>`**: Replaced by dynamic `data-theme` attribute managed by next-themes
- **`::-webkit-scrollbar` as primary approach**: Now fallback for older browsers, standard properties are primary
- **`@theme` without `inline` when referencing variables**: Causes resolution timing issues, always use `@theme inline`

## Open Questions

Things that couldn't be fully resolved:

1. **Auto-hide scrollbar animation techniques**
   - What we know: Webkit pseudo-elements don't support transitions, Firefox supports transition on `scrollbar-color`
   - What's unclear: Reliable cross-browser approach for smooth auto-hide animations
   - Recommendation: Defer auto-hide animations (SCROLL-03) to Phase 26 (Polish), use OS default behavior for now, revisit when browser support improves

2. **scrollbar-gutter: stable both-edges browser support**
   - What we know: Chrome has a bug where space is reserved but scrollbar doesn't use it
   - What's unclear: When Chrome fix will land, if it's worth using for centered layouts
   - Recommendation: Use `scrollbar-gutter: stable` (single side) only, avoid `both-edges` until Chrome fix is confirmed

3. **Exact count of 172 hardcoded gray references**
   - What we know: Grep shows 844 total matches across 83 files (includes hex, gray-*, and other patterns)
   - What's unclear: Whether "172" is a subset (e.g., only gray-* classes) or an older count
   - Recommendation: Perform filtered grep in planning phase to get accurate count of gray-* utility classes vs hex colors vs already-semantic tokens

4. **Migration order for 30+ files**
   - What we know: Requirements list specific file groups (bookkeeping ~150, admin ~300, profile ~40, etc.)
   - What's unclear: Optimal order to minimize visual regressions and facilitate testing
   - Recommendation: Start with globals.css (foundation), then smallest file groups (auth, profile), then larger groups (admin, bookkeeping), following dependency order

## Sources

### Primary (HIGH confidence)

- [Tailwind CSS v4 Theme Documentation](https://tailwindcss.com/docs/theme) - @theme directive, inline option, variable referencing
- [Tailwind CSS v4 Dark Mode Documentation](https://tailwindcss.com/docs/dark-mode) - data-theme attribute patterns
- [shadcn/ui Next.js Dark Mode Guide](https://ui.shadcn.com/docs/dark-mode/next) - next-themes setup for App Router
- [Chrome Scrollbar Styling Guide](https://developer.chrome.com/docs/css-ui/scrollbar-styling) - Standard scrollbar-color/scrollbar-width properties
- [MDN scrollbar-gutter](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter) - Layout shift prevention
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Official library documentation
- [next-themes npm](https://www.npmjs.com/package/next-themes) - Installation and API reference

### Secondary (MEDIUM confidence)

- [Simon Swiss: Tailwind v4 Multi-Theme Strategy](https://simonswiss.com/posts/tailwind-v4-multi-theme) - data-theme implementation patterns
- [GitHub Discussion: @theme with data-theme](https://github.com/tailwindlabs/tailwindcss/discussions/16292) - Adam Wathan's guidance on inline option
- [Not A Number: Fixing Dark Mode Flickering](https://notanumber.in/blog/fixing-react-dark-mode-flickering) - FOUC prevention techniques
- [Epic React: CSS Variables vs Context](https://www.epicreact.dev/css-variables) - Performance comparison
- [DEV: Create Custom Themes in Tailwind v4](https://dev.to/vrauuss_softwares/-create-custom-themes-in-tailwind-css-v4-custom-variant-12-2nf0) - @custom-variant examples
- [Frontend Tools: Tailwind Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) - Typography scale patterns
- [Smashing Magazine: Naming Best Practices](https://www.smashingmagazine.com/2024/05/naming-best-practices/) - Semantic token naming conventions
- [DEV: Preventing Layout Shifts](https://dev.to/rashidshamloo/preventing-the-layout-shift-caused-by-scrollbars-2flp) - scrollbar-gutter techniques

### Tertiary (LOW confidence)

- Various Medium articles on Tailwind v4 migration - General guidance, not authoritative
- CSS-Tricks scrollbar articles - Some content outdated (pre-standard properties era)
- GitHub issues/discussions - Community workarounds, not official solutions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - next-themes is de facto standard, Tailwind v4 is confirmed in use, scrollbar standards are well-documented
- Architecture: HIGH - Patterns verified from official docs (Tailwind, shadcn, Chrome, MDN) and confirmed working in production apps
- Pitfalls: MEDIUM-HIGH - Most derived from official discussions and real-world issues, some inferred from common mistakes in search results

**Research date:** 2026-01-25
**Valid until:** 2026-03-25 (60 days - stable technologies, but Tailwind v4 still evolving rapidly)

**Codebase context verified:**
- Current state: Tailwind v4, OKLCH colors, hardcoded `className="dark"`, 844 color references across 83 files
- Existing patterns: shadcn/ui components, Geist fonts via Next.js optimization, scrollbar-thin utility with hardcoded hex
- Migration scope: globals.css + 30+ component files, zero config file changes (no tailwind.config.js in v4)
