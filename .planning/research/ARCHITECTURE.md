# Architecture Research: UI/Design System

**Domain:** CSS-first theme system and custom UI component layer for Next.js 14+ / TailwindCSS v4 / shadcn/ui
**Researched:** 2026-01-25
**Milestone:** v4 (UI/Design System)
**Overall confidence:** HIGH

---

## Integration Overview

DS-ProSolution's existing UI layer is built on three foundations:

1. **TailwindCSS v4** with CSS-first configuration (`@theme inline` directive in `globals.css`)
2. **shadcn/ui** components (18 components copied into `src/components/ui/`)
3. **Hardcoded gray-scale colors** scattered across 82 files (~800 occurrences of `bg-gray-9XX`, `text-gray-XXX`, `border-gray-XXX`)

The current setup is already 80% of the way to a proper theme system. The `globals.css` already defines CSS variables in `:root` and `.dark` selectors using OKLCH color space, and the `@theme inline` block maps them to Tailwind color utilities. The shadcn/ui components already reference these variables (`bg-background`, `text-foreground`, `bg-primary`, etc.).

**The gap:** Application-level components (layouts, sidebars, pages, bookkeeping tables, admin panels) bypass the theme system entirely and use hardcoded Tailwind gray classes (`bg-gray-950`, `bg-gray-900`, `border-gray-800`, `text-gray-400`). The root layout also hardcodes `className="dark"` on the `<html>` element, meaning there is no runtime theme switching capability.

**The strategy:** Extend the existing CSS variable system with application-level semantic tokens, introduce `next-themes` for runtime theme switching, and migrate hardcoded colors to semantic tokens incrementally. This is purely additive -- no existing shadcn/ui components need to change.

---

## Theme Architecture

### CSS Variable Strategy

The project already uses the TailwindCSS v4 pattern: CSS variables in `:root`/`.dark` selectors mapped via `@theme inline`. This is the correct, modern approach. We extend it, not replace it.

**Current state (already working):**
```css
/* globals.css */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... 30+ semantic color tokens */
}

:root {
  --background: oklch(1 0 0);
  --primary: oklch(0.205 0 0);
  /* ... light theme values */
}

.dark {
  --background: oklch(0.145 0 0);
  --primary: oklch(0.922 0 0);
  /* ... dark theme values */
}
```

**What to add -- application-level tokens:**

The existing tokens cover shadcn/ui component needs (card, popover, muted, accent, etc.) but NOT the application shell. The admin sidebar uses `bg-gray-900`, the main content area uses `bg-gray-950`, nav items use `text-gray-300` -- none of these map to existing CSS variables.

New semantic tokens needed:

```css
:root {
  /* Existing tokens remain unchanged */

  /* NEW: Application shell tokens */
  --app-bg: oklch(0.985 0 0);              /* Main content area */
  --app-sidebar: oklch(0.97 0 0);          /* Sidebar background */
  --app-sidebar-border: oklch(0.922 0 0);  /* Sidebar border */
  --app-nav-item: oklch(0.4 0 0);          /* Nav link text */
  --app-nav-item-hover: oklch(0.15 0 0);   /* Nav link hover text */
  --app-nav-item-hover-bg: oklch(0.95 0 0);/* Nav link hover bg */
  --app-nav-item-active: oklch(1 0 0);     /* Active nav link text */
  --app-nav-item-active-bg: oklch(0.47 0.17 260); /* Active nav bg (blue) */
  --app-heading: oklch(0.15 0 0);          /* Page headings */
  --app-subtext: oklch(0.45 0 0);          /* Subtitle/description text */

  /* NEW: Scrollbar tokens */
  --scrollbar-thumb: oklch(0.65 0 0);
  --scrollbar-track: oklch(0.92 0 0);
  --scrollbar-thumb-hover: oklch(0.55 0 0);

  /* NEW: Table-specific tokens */
  --table-header-bg: oklch(0.97 0 0);
  --table-row-hover: oklch(0.97 0 0);
  --table-row-selected: oklch(0.95 0 0);
  --table-border: oklch(0.92 0 0);
}

.dark {
  /* Existing dark tokens remain unchanged */

  /* NEW: Application shell tokens (dark) */
  --app-bg: oklch(0.13 0 0);
  --app-sidebar: oklch(0.16 0 0);
  --app-sidebar-border: oklch(0.22 0 0);
  --app-nav-item: oklch(0.72 0 0);
  --app-nav-item-hover: oklch(0.98 0 0);
  --app-nav-item-hover-bg: oklch(0.22 0 0);
  --app-nav-item-active: oklch(1 0 0);
  --app-nav-item-active-bg: oklch(0.47 0.17 260);
  --app-heading: oklch(0.98 0 0);
  --app-subtext: oklch(0.55 0 0);

  /* NEW: Scrollbar tokens (dark) */
  --scrollbar-thumb: oklch(0.38 0 0);
  --scrollbar-track: oklch(0.22 0 0);
  --scrollbar-thumb-hover: oklch(0.48 0 0);

  /* NEW: Table-specific tokens (dark) */
  --table-header-bg: oklch(0.18 0 0);
  --table-row-hover: oklch(0.20 0 0);
  --table-row-selected: oklch(0.22 0 0);
  --table-border: oklch(0.25 0 0);
}
```

These must also be registered in `@theme inline`:

```css
@theme inline {
  /* Existing mappings unchanged */

  /* NEW */
  --color-app-bg: var(--app-bg);
  --color-app-sidebar: var(--app-sidebar);
  --color-app-sidebar-border: var(--app-sidebar-border);
  --color-app-nav-item: var(--app-nav-item);
  --color-app-nav-item-hover: var(--app-nav-item-hover);
  --color-app-nav-item-hover-bg: var(--app-nav-item-hover-bg);
  --color-app-nav-item-active: var(--app-nav-item-active);
  --color-app-nav-item-active-bg: var(--app-nav-item-active-bg);
  --color-app-heading: var(--app-heading);
  --color-app-subtext: var(--app-subtext);
  --color-scrollbar-thumb: var(--scrollbar-thumb);
  --color-scrollbar-track: var(--scrollbar-track);
  --color-scrollbar-thumb-hover: var(--scrollbar-thumb-hover);
  --color-table-header-bg: var(--table-header-bg);
  --color-table-row-hover: var(--table-row-hover);
  --color-table-row-selected: var(--table-row-selected);
  --color-table-border: var(--table-border);
}
```

Once registered, these become first-class Tailwind utilities: `bg-app-bg`, `text-app-heading`, `border-app-sidebar-border`, etc.

**Confidence:** HIGH -- This is exactly how TailwindCSS v4's `@theme inline` directive works, as verified by the existing `globals.css` in the project and the official shadcn/ui Tailwind v4 documentation.

### Theme Provider Pattern

The app currently hardcodes `className="dark"` on the `<html>` element in `layout.tsx`. To support runtime theme switching, introduce `next-themes`.

**Install:** `npm install next-themes`

**Architecture:**

```
layout.tsx (root)
  <html suppressHydrationWarning>
    <body>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <DatabaseProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </DatabaseProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </body>
  </html>
```

Key decisions:
- **`attribute="class"`** -- Uses the `.dark` class on `<html>`, which is exactly what the existing `@custom-variant dark (&:is(.dark *))` in `globals.css` expects. Zero CSS changes needed.
- **`defaultTheme="dark"`** -- Matches current behavior (always dark). No visual change on day one.
- **`enableSystem`** -- Allows future "system" option for users who want to match OS preference.
- **`disableTransitionOnChange`** -- Recommended to prevent flash of colors transitioning when toggling themes.

**The ThemeProvider must be a `"use client"` wrapper component** because `next-themes` uses React context:

```typescript
// src/components/providers/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

**Confidence:** HIGH -- This is the exact pattern recommended by shadcn/ui's official dark mode documentation and the `next-themes` GitHub repository. The `@custom-variant dark (&:is(.dark *))` already in `globals.css` is the TailwindCSS v4 equivalent of `darkMode: "class"` in v3.

### Theme Persistence

`next-themes` handles persistence automatically:
- Stores user preference in `localStorage` (key: `theme`)
- Injects a `<script>` before hydration to prevent FOUC (flash of unstyled content)
- Falls back to `defaultTheme` when no preference is stored

No additional persistence logic is needed. The existing app will default to dark mode (matching current behavior) and users who toggle to light mode will have that preference remembered across sessions.

### TailwindCSS Integration

The integration is seamless because:

1. **Existing shadcn/ui components** already use semantic tokens (`bg-background`, `text-foreground`, etc.) that resolve via CSS variables. They will automatically respond to theme changes.
2. **New application tokens** follow the same pattern and are registered in `@theme inline`.
3. **The `dark:` variant** works via `@custom-variant dark (&:is(.dark *))` which checks for the `.dark` class on any ancestor -- exactly what `next-themes` sets on `<html>`.

**No changes to tailwind configuration files or postcss config needed.**

---

## Component Architecture

### Custom Scrollbar Approach

**Current state:** Hardcoded hex colors in `globals.css`:
```css
.scrollbar-thin {
  scrollbar-color: #4b5563 #1f2937;  /* hardcoded dark-only */
}
```

**Target state:** Theme-aware scrollbar using CSS variables:
```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

This is a drop-in replacement. The `.scrollbar-thin` class is already used throughout the app. By changing the CSS definition to use variables, all existing usages automatically become theme-aware.

**Confidence:** HIGH -- Standard CSS variables in scrollbar styles. The `scrollbar-color` property with CSS variables is well-supported in modern browsers.

### Form Control Customization

The existing shadcn/ui form controls (Input, Select, Textarea, Checkbox, Switch, Slider) already use semantic tokens and do NOT need modification. They reference `bg-background`, `border-input`, `text-foreground`, etc.

**What needs attention:** Some form controls in the bookkeeping area use inline hardcoded colors. For example, `add-record-form.tsx` has 26 occurrences of hardcoded gray classes. These need to be migrated to semantic tokens.

**Strategy:** Do not modify the `src/components/ui/` files. They are already correct. Focus migration effort on:
- `src/components/bookkeeping/` (heaviest usage: ~150 hardcoded color references)
- `src/components/admin/` (~300 hardcoded color references)
- `src/app/` layouts and pages (~100 hardcoded color references)
- `src/components/profile/` (~40 hardcoded color references)
- `src/components/data-management/` (~45 hardcoded color references)

### Modal/Dialog System

The Dialog component (`src/components/ui/dialog.tsx`) already uses semantic tokens (`bg-background`, `border`, animation classes). No modification needed.

However, the `DialogContent` has a custom `hideCloseButton` prop already added by the team -- this is a good pattern. Any future design system customizations to dialogs should follow the same approach: extend the existing shadcn/ui component with additional props rather than creating parallel components.

**Pattern to follow:**
```typescript
// GOOD: Extend shadcn component with additional variants
const DialogContent = React.forwardRef<...>(
  ({ className, hideCloseButton, size = "default", ...props }, ref) => (
    // Use data-slot attributes (already present in newer shadcn components)
    // Add size variants via CVA if needed
  )
);

// BAD: Create parallel MyDialog component that duplicates logic
```

### Layout Component Hierarchy

**Current state:** Three separate layout files with duplicated sidebar code:

| Layout | File | Duplicated Code |
|--------|------|-----------------|
| Admin | `app/admin/layout.tsx` | Sidebar structure, nav items, SVG icons |
| VA | `app/va/layout.tsx` | Same sidebar structure, different nav items |
| Client | `app/client/layout.tsx` | Same sidebar structure, minimal nav items |

All three share:
- Same `bg-gray-950` main background
- Same `bg-gray-900` sidebar background
- Same `border-gray-800` borders
- Same nav item styling (active: `bg-blue-600 text-white`, inactive: `text-gray-300 hover:bg-gray-800`)
- Same profile settings button at bottom
- Same inline SVG icon pattern (no icon component abstraction)

**Target architecture:** Extract shared layout primitives:

```
src/components/layout/
  app-shell.tsx        # Flex container with sidebar + main content
  app-sidebar.tsx      # Sidebar with header, nav, footer slots
  nav-item.tsx         # Single nav link with icon + label + active state
  sidebar-header.tsx   # Brand name + subtitle
  sidebar-footer.tsx   # Profile settings button + sync indicator
  page-header.tsx      # Page title + description + actions slot

src/components/icons/
  index.tsx            # Centralized icon exports (from lucide-react)
```

**Key design decisions:**

1. **AppShell as the outermost layout primitive:**
   ```tsx
   <AppShell>
     <AppSidebar header={...} nav={...} footer={...} />
     <main className="flex-1 p-8">{children}</main>
   </AppShell>
   ```

2. **NavItem replaces 150+ lines of duplicated SVG icons:**
   ```tsx
   <NavItem href="/admin/users" icon={UsersIcon} label="Users" />
   ```
   Uses `lucide-react` (already installed) instead of inline SVG paths. The existing codebase already imports from `lucide-react` in many components but the sidebar manually renders SVG paths.

3. **All layout components use semantic tokens:**
   ```tsx
   // AppShell
   <div className="flex min-h-screen bg-app-bg">

   // AppSidebar
   <aside className="w-64 bg-app-sidebar border-r border-app-sidebar-border flex flex-col">

   // NavItem (inactive)
   <Link className="text-app-nav-item hover:bg-app-nav-item-hover-bg hover:text-app-nav-item-hover">

   // NavItem (active)
   <Link className="bg-app-nav-item-active-bg text-app-nav-item-active">
   ```

**Confidence:** HIGH -- This is standard React component extraction. The three layout files contain clearly duplicated patterns with only the nav items and header subtitle differing.

---

## File Structure

### New Files to Create

```
src/
  components/
    providers/
      theme-provider.tsx              # NEW: next-themes wrapper

    layout/
      app-shell.tsx                   # NEW: Main layout container
      app-sidebar.tsx                 # NEW: Reusable sidebar
      nav-item.tsx                    # NEW: Navigation link component
      sidebar-header.tsx              # NEW: Brand header
      sidebar-footer.tsx              # NEW: Profile + sync footer
      page-header.tsx                 # NEW: Page title bar

    theme/
      theme-toggle.tsx                # NEW: Light/dark/system toggle button
      theme-customizer.tsx            # NEW: (Optional, dev-only) live theme preview

  lib/
    theme.ts                          # NEW: Theme constants, type definitions
```

### Files to Modify

```
src/app/globals.css                   # MODIFY: Add app-level semantic tokens + scrollbar variables
src/app/layout.tsx                    # MODIFY: Add ThemeProvider, remove hardcoded "dark" class

src/app/admin/layout.tsx              # MODIFY: Use AppShell + AppSidebar
src/app/va/layout.tsx                 # MODIFY: Use AppShell + AppSidebar
src/app/client/layout.tsx             # MODIFY: Use AppShell + AppSidebar
src/components/admin/sidebar.tsx      # MODIFY: Refactor to use NavItem + semantic tokens

# Hardcoded color migration (82 files, ~800 occurrences):
src/components/bookkeeping/*.tsx      # MIGRATE: gray-XXX -> semantic tokens
src/components/admin/**/*.tsx         # MIGRATE: gray-XXX -> semantic tokens
src/components/profile/*.tsx          # MIGRATE: gray-XXX -> semantic tokens
src/components/data-management/*.tsx  # MIGRATE: gray-XXX -> semantic tokens
src/components/sync/*.tsx             # MIGRATE: gray-XXX -> semantic tokens
src/components/auth/*.tsx             # MIGRATE: gray-XXX -> semantic tokens
src/app/**/page.tsx                   # MIGRATE: gray-XXX -> semantic tokens
```

### Files NOT to Modify

```
src/components/ui/*.tsx               # DO NOT TOUCH - already using semantic tokens
src/lib/utils.ts                      # No changes needed
src/components/providers/database-provider.tsx  # No changes needed
src/components/providers/query-provider.tsx     # No changes needed
src/components/providers/sync-provider.tsx      # No changes needed
```

---

## Chrome Extension Considerations

### Current Extension Architecture

The Chrome extension (`packages/extension/`) is a plain HTML/CSS/JS side panel -- no React, no Tailwind, no build system. It uses:

- **Vanilla CSS** (`sidepanel.css`, 906 lines) with its own CSS variable system
- **Its own color tokens** (e.g., `--bg-primary: #0f0f0f`, `--accent-blue: #3b82f6`)
- **No dark/light toggle** -- always dark theme
- **Content scripts** (`overlay.js`) with fully inlined CSS using `!important`

### Recommendation: Keep Extension Theming Separate

**Do NOT share theme files between the web app and the Chrome extension.** Here is why:

1. **Different technology stacks:** The extension is vanilla JS/CSS. The web app is React/Tailwind. Sharing would require a build step for the extension, which currently has none.

2. **Different rendering context:** The extension side panel runs in Chrome's side panel, not in a Next.js page. CSS variables defined in the web app's `globals.css` are not available to the extension.

3. **Content scripts are fully isolated:** `overlay.js` injects CSS with `!important` into third-party pages (eBay, Amazon). These styles must be self-contained and hardcoded to avoid conflicts with host page styles.

4. **The extension's CSS variable system already works well.** It defines `--bg-primary`, `--bg-secondary`, `--accent-blue`, etc. in `:root` of `sidepanel.css`.

**What to do instead:**

- **Document shared design values** in a `src/lib/theme.ts` file that lists the canonical color palette, brand colors, and spacing scale. This serves as a reference for anyone updating extension styles manually.
- **If the extension ever moves to a React-based build** (e.g., using CRXJS or Plasmo), then shared theming becomes feasible. But that is a separate milestone decision.
- **Align color values** between `globals.css` and `sidepanel.css` by documenting the mapping (e.g., `--accent-blue: #3b82f6` in extension maps to `oklch(0.47 0.17 260)` in the web app). This is a documentation task, not a code-sharing task.

**Confidence:** HIGH -- The extension is plain JS with no build pipeline. Attempting to share CSS between Next.js and a Chrome MV3 extension without a shared build system would create unnecessary complexity.

---

## Build Order

The design system has clear dependency layers. Here is the recommended phase sequence:

### Phase 1: Theme Foundation (No Visual Changes)

**Creates the infrastructure. Zero visual regressions.**

1. Install `next-themes` (`npm install next-themes`)
2. Create `theme-provider.tsx` wrapper component
3. Add ThemeProvider to root `layout.tsx` (with `defaultTheme="dark"` to match current behavior)
4. Add `suppressHydrationWarning` to `<html>` tag
5. Remove hardcoded `className="dark"` from `<html>` (next-themes handles this)
6. Create `src/lib/theme.ts` with theme type definitions and color constants
7. Verify: App looks identical, dark mode still works

**Depends on:** Nothing
**Risk:** LOW -- Adding a provider wrapper with `defaultTheme="dark"` produces identical behavior
**Test:** Visual regression test -- app should look exactly the same

### Phase 2: Semantic Token Expansion

**Adds new CSS variables. No component changes yet.**

1. Add application-level tokens to `:root` and `.dark` in `globals.css`
2. Register new tokens in `@theme inline` block
3. Migrate scrollbar styles from hardcoded hex to CSS variables
4. Create `theme-toggle.tsx` component (but don't add it to any layout yet)
5. Verify: New Tailwind utilities available (`bg-app-bg`, `text-app-heading`, etc.)

**Depends on:** Phase 1 (ThemeProvider must exist for light/dark to work)
**Risk:** LOW -- Adding CSS variables is purely additive; existing hardcoded classes still work
**Test:** Toggle theme via browser devtools (add/remove `.dark` class), verify new variables respond correctly

### Phase 3: Layout Component Extraction

**Creates reusable layout primitives. Refactors the three dashboards.**

1. Create `app-shell.tsx`, `app-sidebar.tsx`, `nav-item.tsx`, `sidebar-header.tsx`, `sidebar-footer.tsx`
2. All new components use semantic tokens (NOT hardcoded grays)
3. Refactor `app/admin/layout.tsx` to use new layout components
4. Refactor `app/va/layout.tsx` to use new layout components
5. Refactor `app/client/layout.tsx` to use new layout components
6. Add theme toggle to sidebar footer

**Depends on:** Phase 2 (semantic tokens must exist for new components to reference)
**Risk:** MEDIUM -- Refactoring three layouts. Must preserve all existing behavior (nav item active states, role-based nav filtering in VA layout, provider hierarchy in admin layout)
**Test:** All three dashboards render correctly in both themes. Navigation, active states, and profile dialog all work.

### Phase 4: Component Color Migration

**The large migration phase. Converts hardcoded colors to semantic tokens across ~82 files.**

1. Migrate `src/app/**/page.tsx` files (lowest risk -- simple pages)
2. Migrate `src/components/auth/login-form.tsx`
3. Migrate `src/components/profile/*.tsx` (~40 occurrences)
4. Migrate `src/components/data-management/*.tsx` (~45 occurrences)
5. Migrate `src/components/sync/*.tsx`
6. Migrate `src/components/bookkeeping/*.tsx` (~150 occurrences, highest complexity)
7. Migrate `src/components/admin/**/*.tsx` (~300 occurrences, highest volume)
8. Migrate `src/components/va/*.tsx`

**Depends on:** Phase 2 (semantic tokens) and Phase 3 (layout components done first to establish patterns)
**Risk:** MEDIUM-HIGH -- Touching 82 files with ~800 color references. Risk of visual regressions.
**Test:** Visual inspection of every page/component in both light and dark themes. Consider taking screenshots before migration to compare.

**Migration pattern for each file:**
```
BEFORE:  bg-gray-950  ->  AFTER:  bg-app-bg
BEFORE:  bg-gray-900  ->  AFTER:  bg-app-sidebar (or bg-card, depending on context)
BEFORE:  bg-gray-800  ->  AFTER:  bg-muted (or bg-accent, depending on context)
BEFORE:  text-gray-400 ->  AFTER:  text-muted-foreground (or text-app-subtext)
BEFORE:  text-gray-300 ->  AFTER:  text-app-nav-item (in nav) or text-muted-foreground (elsewhere)
BEFORE:  border-gray-800 -> AFTER: border-app-sidebar-border (in sidebar) or border-border (elsewhere)
BEFORE:  text-white    ->  AFTER:  text-foreground (usually) or text-app-heading
```

**Important:** Not every `gray-XXX` maps to the same semantic token. Context matters. A `bg-gray-800` in a sidebar means something different than `bg-gray-800` in a table header. This phase requires judgment, not find-and-replace.

### Phase 5: Polish and Documentation

1. Add `page-header.tsx` component for consistent page titles
2. Create `theme-customizer.tsx` (dev-only) for live preview of token changes
3. Update `src/lib/theme.ts` with extension color mapping documentation
4. Verify all Framer Motion animations work in both themes (6 components use motion)
5. Test with `prefers-color-scheme` system preference

**Depends on:** Phase 4 (all components migrated)
**Risk:** LOW
**Test:** Full app walkthrough in light mode, dark mode, and system preference mode

### Dependency Diagram

```
Phase 1 -----> Phase 2 -----> Phase 3 -----> Phase 4 -----> Phase 5
(Provider)     (Tokens)       (Layouts)      (Migration)    (Polish)
                                  |
                                  +--> Phase 4 can start partially
                                       in parallel with Phase 3
                                       (pages and non-layout components)
```

---

## Migration Strategy

### Principle: Incremental, Zero-Regression

The migration must be incremental. At no point should the app look broken. The strategy:

1. **Phase 1-2 are invisible.** They add infrastructure without changing any visual output.
2. **Phase 3 refactors layouts.** The visual output should be identical -- same colors, same spacing. The only change is that colors come from CSS variables instead of hardcoded classes.
3. **Phase 4 migrates components.** Each file migration should produce identical dark-mode output. Light-mode support is a bonus, not the goal of migration.
4. **After Phase 4, toggle the theme.** Both themes should work.

### Handling Edge Cases

**Components that render differently per role:**
The VA layout conditionally shows/hides nav items based on `hasAccessProfile`. This logic must be preserved in the new layout components. Use a `navItems` prop on `AppSidebar`, not hardcoded items.

**Components with Framer Motion animations:**
Six components use `framer-motion`. Motion components use `className` for styling, so they will pick up theme changes automatically. No special handling needed.

**The `sonner` toast library:**
The `<Toaster>` component in `layout.tsx` uses `richColors` which automatically adapts to the page background. However, verify it respects the `.dark` class after migrating to `next-themes`.

**react-window virtualized lists:**
The virtualized bookkeeping table renders rows with inline `style` props (for positioning). Only `className`-based colors need migration. The `style` prop is only used for `top`, `height`, `position` -- no colors.

### What NOT to Change

- **Do not modify shadcn/ui components** (`src/components/ui/`). They already use semantic tokens correctly.
- **Do not add Tailwind plugins.** The CSS-first approach in TailwindCSS v4 handles everything via `globals.css`.
- **Do not add a CSS-in-JS solution.** Tailwind + CSS variables is the established pattern.
- **Do not attempt to share CSS between web app and Chrome extension.** Different technology stacks.
- **Do not convert the app to light-mode-first.** Keep `defaultTheme="dark"` to match existing user expectations. Light mode is an opt-in feature.

---

## Integration Points Summary

| Integration Point | Current State | Target State | Risk |
|-------------------|---------------|--------------|------|
| Root layout | Hardcoded `className="dark"` | `next-themes` ThemeProvider | LOW |
| CSS variables | shadcn/ui tokens only | + app-level semantic tokens | LOW |
| Scrollbar styles | Hardcoded hex in `.scrollbar-thin` | CSS variable references | LOW |
| Admin sidebar | 213 lines of hardcoded colors + inline SVGs | Layout primitives + semantic tokens + lucide-react | MEDIUM |
| VA layout | 153 lines of duplicated sidebar code | Shared AppSidebar component | MEDIUM |
| Client layout | 95 lines of duplicated sidebar code | Shared AppSidebar component | LOW |
| Bookkeeping components | ~150 hardcoded gray references | Semantic tokens | MEDIUM-HIGH |
| Admin components | ~300 hardcoded gray references | Semantic tokens | MEDIUM-HIGH |
| Chrome extension | Separate CSS with own variables | Keep separate, document mapping | NONE |
| Framer Motion | Uses className (6 components) | No changes needed | NONE |
| react-window | Uses style prop for positioning only | No changes needed | NONE |

---

## Sources

- [shadcn/ui Tailwind v4 Documentation](https://ui.shadcn.com/docs/tailwind-v4) -- HIGH confidence (official)
- [shadcn/ui Dark Mode with Next.js](https://ui.shadcn.com/docs/dark-mode/next) -- HIGH confidence (official)
- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming) -- HIGH confidence (official)
- [next-themes GitHub Repository](https://github.com/pacocoursey/next-themes) -- HIGH confidence (official)
- [Tailwind CSS v4 Dark Mode Documentation](https://tailwindcss.com/docs/dark-mode) -- HIGH confidence (official)
- [TailwindCSS v4 + shadcn/ui Migration Guide](https://www.shadcnblocks.com/blog/tailwind4-shadcn-themeing/) -- MEDIUM confidence (community blog, verified against official docs)
- [DeepWiki shadcn/ui Architecture](https://deepwiki.com/shadcn-ui/ui/2-architecture) -- MEDIUM confidence (third-party analysis)
- [Vercel Academy: Extending shadcn/ui](https://vercel.com/academy/shadcn-ui/extending-shadcn-ui-with-custom-components) -- HIGH confidence (Vercel official)
- [CSS `light-dark()` function](https://medium.com/front-end-weekly/forget-javascript-achieve-dark-mode-effortlessly-with-brand-new-css-function-light-dark-2024-94981c61756b) -- MEDIUM confidence (future consideration, not used in recommended approach)
- [Tailwind CSS Scrollbar Styling Discussion](https://github.com/tailwindlabs/tailwindcss/discussions/14031) -- MEDIUM confidence (community discussion)

---

*Architecture research for UI/Design System milestone: 2026-01-25*
