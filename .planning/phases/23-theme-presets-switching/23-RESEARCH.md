# Phase 23: Theme Presets & Switching - Research

**Researched:** 2026-01-26
**Domain:** Multi-theme systems, theme switching UX, CSS View Transitions API, theme preview UI
**Confidence:** HIGH

## Summary

Phase 23 extends Phase 22's theme foundation by implementing 4 distinct preset themes (Midnight, Dawn, Slate, Carbon) with a theme picker UI, smooth cross-fade transitions, and system preference detection. Research confirms that the existing next-themes (v0.4.6) + CSS variables architecture can support multiple custom themes through data-theme attributes, with the View Transitions API providing smooth cross-fade effects when switching.

The standard approach involves: (1) extending globals.css with theme-specific CSS variable sets for each preset theme under `[data-theme="theme-name"]` selectors, (2) updating ThemeProvider to specify available theme names via the `themes` prop, (3) building a theme picker UI with visual preview cards showing each theme's color identity, (4) implementing smooth transitions via `document.startViewTransition()` wrapped around theme changes, and (5) leveraging next-themes' built-in system preference detection with custom OS-to-theme mapping logic.

Key findings indicate that: the View Transitions API is production-ready in Chrome 126+ (Jan 2024) and works as progressive enhancement, theme switching can be zero-render with pure CSS variable updates, visual preview cards are a 2026 best practice for theme pickers (mini UI mockups preferred over simple color swatches), and true-black OLED themes (#000000) are viable but should be balanced with readability considerations for text contrast.

**Primary recommendation:** Use next-themes with custom themes array + View Transitions API for smooth cross-fade + mini preview cards in ProfileSettingsDialog + sidebar footer popover trigger. Map OS dark preference to Carbon, OS light preference to Dawn. Each theme gets unique accent color and full CSS variable set.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-themes | ^0.4.6 | Multi-theme state management | Already installed, supports multiple custom themes via `themes` prop, handles system preference detection and localStorage persistence |
| CSS Variables | Native | Theme value storage | Zero runtime cost, already used in Phase 22, perfect for multi-theme with selector-scoped overrides |
| View Transitions API | Native | Smooth theme switching animation | Browser-native (Chrome 126+), progressive enhancement, GPU-accelerated 60fps transitions |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| flushSync | React 19.2.3 | Synchronous DOM updates | Required when using View Transitions API with React state updates to ensure DOM reflects new theme before animation |
| matchMedia API | Native | OS theme preference detection | Listen for OS theme changes when user selects "System" theme option |
| Radix UI Popover | ^1.1.15 | Sidebar theme toggle popover | Already installed, lightweight popover for sidebar footer theme switcher |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| View Transitions API | CSS transitions on :root | Less smooth (doesn't animate pseudo-elements, shadows, etc.), more code to manage |
| Mini preview cards | Color swatches only | Less user-friendly, harder to distinguish themes visually, doesn't convey theme personality |
| Popover in sidebar | Inline theme dropdown | More visual clutter, less discoverable, conflicts with existing Profile Settings button |

**Installation:**
```bash
# No new packages needed - everything already installed
# View Transitions API is browser-native
```

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/
├── app/
│   ├── globals.css               # Extended with 4 theme presets
│   └── layout.tsx                # Update ThemeProvider themes prop
├── components/
│   ├── providers/
│   │   └── theme-provider.tsx    # Already exists, wrap startViewTransition
│   ├── profile/
│   │   ├── profile-settings-dialog.tsx   # Add theme tab or section
│   │   └── theme-picker.tsx              # NEW: Theme selection UI with previews
│   └── sidebar/
│       └── theme-toggle-button.tsx       # NEW: Sidebar footer theme popover
└── lib/
    └── themes.ts                 # NEW: Theme metadata (names, accents, previews)
```

### Pattern 1: Multi-Theme CSS Variables with next-themes

**What:** Define multiple theme presets as data-theme attribute selectors, each with full CSS variable overrides
**When to use:** When you need 3+ visually distinct themes beyond simple light/dark

**Example:**
```css
/* Source: https://darrenwhite.dev/blog/nextjs-tailwindcss-theming + Phase 22 foundation */

@layer base {
  :root {
    /* Default/fallback theme (same as Dawn for consistency) */
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --primary: oklch(0.488 0.243 264.376); /* Indigo accent */
    /* ... rest of shadcn tokens ... */

    --app-bg: oklch(0.98 0 0);
    --app-sidebar: oklch(0.96 0 0);
    --scrollbar-thumb: oklch(0.7 0 0);
    /* ... rest of app tokens ... */
  }

  [data-theme="midnight"] {
    /* Blue-undertone dark - Linear's dark mode reference */
    --background: oklch(0.12 0.01 240);      /* Near-black with blue undertone */
    --foreground: oklch(0.98 0.005 240);     /* Near-white with blue tint */
    --primary: oklch(0.55 0.15 240);         /* Blue accent */
    --card: oklch(0.16 0.012 240);
    --card-foreground: oklch(0.98 0.005 240);

    --app-bg: oklch(0.12 0.01 240);
    --app-sidebar: oklch(0.16 0.012 240);
    --scrollbar-thumb: oklch(0.45 0.05 240);
    --scrollbar-track: oklch(0.20 0.015 240);
  }

  [data-theme="dawn"] {
    /* Clean light - Vercel/Linear light mode reference */
    --background: oklch(1 0 0);              /* Pure white */
    --foreground: oklch(0.145 0 0);          /* Near-black */
    --primary: oklch(0.488 0.243 264.376);   /* Indigo accent */
    --card: oklch(0.99 0 0);
    --card-foreground: oklch(0.145 0 0);

    --app-bg: oklch(0.98 0 0);
    --app-sidebar: oklch(0.96 0 0);
    --scrollbar-thumb: oklch(0.7 0 0);
    --scrollbar-track: oklch(0.92 0 0);
  }

  [data-theme="slate"] {
    /* Warm gray-green dark - positioned between Midnight and Carbon */
    --background: oklch(0.18 0.008 150);     /* Dark gray with subtle green undertone */
    --foreground: oklch(0.95 0.005 150);     /* Near-white with green tint */
    --primary: oklch(0.60 0.12 180);         /* Teal accent */
    --card: oklch(0.22 0.01 150);
    --card-foreground: oklch(0.95 0.005 150);

    --app-bg: oklch(0.18 0.008 150);
    --app-sidebar: oklch(0.22 0.01 150);
    --scrollbar-thumb: oklch(0.50 0.06 180);
    --scrollbar-track: oklch(0.24 0.012 150);
  }

  [data-theme="carbon"] {
    /* True black OLED - maximum battery savings, brutalist/minimal */
    --background: oklch(0 0 0);              /* True #000000 black */
    --foreground: oklch(1 0 0);              /* Pure white */
    --primary: oklch(0.70 0.20 300);         /* Bright purple accent */
    --card: oklch(0.08 0 0);                 /* Subtle lift from black */
    --card-foreground: oklch(1 0 0);

    --app-bg: oklch(0 0 0);
    --app-sidebar: oklch(0.08 0 0);
    --scrollbar-thumb: oklch(0.60 0 0);
    --scrollbar-track: oklch(0.12 0 0);
  }
}
```

**Why unique accents matter:** Each theme has distinct accent color (Midnight=blue, Dawn=indigo, Slate=teal, Carbon=purple) to reinforce theme identity and create visual distinction beyond just brightness.

### Pattern 2: View Transitions API for Smooth Theme Switching

**What:** Wrap theme change with `document.startViewTransition()` to enable smooth cross-fade animation
**When to use:** Every theme change to provide professional, polished UX

**Example:**
```tsx
/* Source: https://notanumber.in/blog/animated-dark-mode-toggle-with-view-transitions-api-in-react */

"use client"

import { useTheme } from "next-themes"
import { flushSync } from "react-dom"

export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (newTheme: string) => {
    // Check browser support (progressive enhancement)
    if (!document.startViewTransition) {
      setTheme(newTheme)
      return
    }

    // Wrap theme change in view transition
    document.startViewTransition(() => {
      // flushSync ensures DOM updates synchronously before animation
      flushSync(() => {
        setTheme(newTheme)
      })
    })
  }

  return (
    <div className="space-y-2">
      <button onClick={() => handleThemeChange("system")}>System</button>
      <button onClick={() => handleThemeChange("midnight")}>Midnight</button>
      <button onClick={() => handleThemeChange("dawn")}>Dawn</button>
      <button onClick={() => handleThemeChange("slate")}>Slate</button>
      <button onClick={() => handleThemeChange("carbon")}>Carbon</button>
    </div>
  )
}
```

**CSS for transition:**
```css
/* Source: https://developer.chrome.com/docs/css-ui/view-transitions */

/* Define transition for root (all CSS variables) */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 250ms;
  animation-timing-function: ease-in-out;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0ms;
  }
}
```

**Why flushSync is critical:** React's state updates are asynchronous, but `startViewTransition()` needs the new DOM state immediately to snapshot and animate. Without flushSync, the animation captures the old state twice.

### Pattern 3: Theme Preview Cards in Picker UI

**What:** Show mini UI mockups in each theme's colors, not just color swatches
**When to use:** Always for multi-theme pickers - helps users understand theme personality

**Example:**
```tsx
/* Source: Inferred from 2026 card UI design trends + theme picker UX best practices */

interface ThemePreview {
  name: string
  value: string
  label: string
  accent: string
  preview: {
    bg: string
    sidebar: string
    text: string
    accent: string
  }
}

const themes: ThemePreview[] = [
  {
    name: "midnight",
    value: "midnight",
    label: "Midnight",
    accent: "Blue-undertone dark",
    preview: {
      bg: "oklch(0.12 0.01 240)",
      sidebar: "oklch(0.16 0.012 240)",
      text: "oklch(0.98 0.005 240)",
      accent: "oklch(0.55 0.15 240)",
    },
  },
  // ... other themes
]

export function ThemePreviewCard({ theme, isActive, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-lg border-2 transition-all",
        isActive ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
      )}
    >
      {/* Mini UI mockup */}
      <div className="h-24 flex">
        {/* Sidebar preview */}
        <div
          className="w-1/3 flex items-center justify-center"
          style={{ backgroundColor: theme.preview.sidebar }}
        >
          <div className="w-8 h-1 rounded" style={{ backgroundColor: theme.preview.accent }} />
        </div>

        {/* Main area preview */}
        <div
          className="flex-1 p-3 flex flex-col gap-1.5"
          style={{ backgroundColor: theme.preview.bg }}
        >
          <div className="h-2 w-3/4 rounded" style={{ backgroundColor: theme.preview.text, opacity: 0.9 }} />
          <div className="h-2 w-1/2 rounded" style={{ backgroundColor: theme.preview.text, opacity: 0.6 }} />
          <div className="h-6 w-16 rounded mt-auto" style={{ backgroundColor: theme.preview.accent }} />
        </div>
      </div>

      {/* Label */}
      <div className="p-2 bg-card border-t">
        <p className="text-sm font-medium">{theme.label}</p>
        <p className="text-xs text-muted-foreground">{theme.accent}</p>
      </div>
    </button>
  )
}
```

**Why mini mockups:** Color swatches don't convey how a theme feels in practice. Mini mockups showing sidebar, main area, text, and accent give users confidence in their choice.

### Pattern 4: System Preference Detection with Custom Mapping

**What:** Map OS dark/light preference to specific themes (Carbon for dark, Dawn for light)
**When to use:** When "System" theme option is selected

**Example:**
```tsx
/* Source: https://davidwalsh.name/detect-system-theme-preference-change-using-javascript + next-themes docs */

// In ThemeProvider config
<ThemeProvider
  attribute={["class", "data-theme"]}
  defaultTheme="system"
  enableSystem={true}
  themes={["system", "midnight", "dawn", "slate", "carbon"]}
  // Custom value mapping for system preference
  value={{
    system: undefined, // Let next-themes detect, then we'll map
  }}
>

// Custom hook to handle system theme mapping
export function useSystemThemeMapping() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    if (theme !== "system") return

    // Listen for OS theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Map OS preference to our custom themes
      const systemTheme = e.matches ? "carbon" : "dawn"
      // Update data-theme attribute directly (next-themes handles this)
    }

    // Set initial theme based on OS preference
    handleChange(mediaQuery)

    // Listen for OS changes
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])
}
```

**Note:** This pattern requires investigation during planning - next-themes may handle this via `value` prop mapping or may require custom logic. The library's system preference detection is built-in, but mapping to specific themes (not just "light"/"dark") needs verification.

### Pattern 5: Sidebar Footer Popover Theme Toggle

**What:** Quick theme switcher accessible from sidebar footer, complementing full picker in ProfileSettingsDialog
**When to use:** When user needs fast theme switching without opening full settings

**Example:**
```tsx
/* Source: Radix UI Popover docs + project sidebar pattern */

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function SidebarThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors">
          <svg className="w-5 h-5" /* palette icon */>
          <span>Theme</span>
        </button>
      </PopoverTrigger>

      <PopoverContent side="right" align="end" className="w-48">
        <div className="space-y-1">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => handleThemeChange(t.value)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 rounded text-sm transition-colors",
                theme === t.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.preview.accent }} />
              {t.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Anti-Patterns to Avoid

- **Separate stylesheets per theme:** Don't create `midnight.css`, `dawn.css` - use CSS variables with selector scoping instead (maintenance nightmare, bundle bloat)
- **Theme in React Context:** Don't duplicate next-themes state in custom context - causes unnecessary re-renders, next-themes already provides useTheme hook
- **Instant theme switching:** Don't skip View Transitions API - jarring instant changes feel unpolished in 2026
- **System theme as just "dark":** Don't map system preference to generic "dark" theme - users expect specific theme choice (Carbon for dark, Dawn for light per requirements)
- **Pure black text on pure black:** Don't use #000 backgrounds with white text without testing - readability issues, use near-white text (oklch(0.98+)) instead

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme state management | Custom localStorage + Context | next-themes (already installed) | Handles SSR hydration, FOUC prevention, tab sync, system preference detection, all battle-tested |
| Smooth theme transitions | Custom CSS transitions per element | View Transitions API | Browser-native, GPU-accelerated, animates all elements including pseudo-elements/shadows automatically |
| OS theme detection | Manual matchMedia setup | next-themes' enableSystem + matchMedia listener | Built-in detection, handles edge cases, automatic cleanup |
| Theme preview generation | Manual color sampling | Hardcoded preview metadata | More reliable, easier to maintain, allows custom preview layouts |

**Key insight:** Multi-theme systems are complex due to SSR hydration, smooth transitions, system preference mapping, and localStorage persistence. next-themes + View Transitions API solve 90% of this. Don't rebuild what's already solved.

## Common Pitfalls

### Pitfall 1: Forgetting flushSync with View Transitions API in React

**What goes wrong:** Theme change animation shows old theme twice instead of smooth cross-fade
**Why it happens:** React batches state updates asynchronously, but `startViewTransition()` captures DOM state immediately
**How to avoid:** Always wrap `setTheme()` call in `flushSync()` when using View Transitions API
**Warning signs:** Theme appears to "flash" rather than smoothly fade, animation looks like fade-out then instant change

### Pitfall 2: Not Respecting prefers-reduced-motion

**What goes wrong:** Users with motion sensitivity get jarring animations, accessibility violation
**Why it happens:** View Transitions API animations run by default without checking user preferences
**How to avoid:** Add CSS media query to disable/shorten animations when `prefers-reduced-motion: reduce`
**Warning signs:** Accessibility audit failures, user complaints about motion sickness

### Pitfall 3: Theme Values Not Updating in Sonner Toasts

**What goes wrong:** Toast notifications don't reflect current theme colors after switching
**Why it happens:** Sonner may capture CSS variables at mount time, or needs explicit theme prop
**How to avoid:** Pass `theme={resolvedTheme}` to `<Toaster>` component, or use Sonner's CSS variable support
**Warning signs:** Toasts remain in old theme colors after switching, mismatched notification colors

### Pitfall 4: System Theme Mapping Not Reactive

**What goes wrong:** User selects "System" theme, changes OS preference, but app doesn't update
**Why it happens:** No `matchMedia` listener attached to detect OS preference changes
**How to avoid:** Use next-themes' built-in system support with custom logic to map to Carbon/Dawn
**Warning signs:** Theme doesn't change when OS dark mode toggles, "System" option feels broken

### Pitfall 5: Hardcoded Theme Colors in Components

**What goes wrong:** Some UI elements don't change when theme switches, still show old colors
**Why it happens:** Components using hardcoded Tailwind classes (e.g., `bg-gray-900`) instead of semantic tokens
**How to avoid:** Complete Phase 22 migration fully - all components must use semantic tokens (`bg-app-sidebar`, not `bg-gray-900`)
**Warning signs:** Sidebar or certain components stay same color when switching themes, inconsistent theme application

### Pitfall 6: True Black Readability Issues in Carbon Theme

**What goes wrong:** White text on pure black (#000000) causes halation, eye strain, reduced readability
**Why it happens:** High contrast causes optical bleeding effect on OLED screens, especially with white text
**How to avoid:** Use near-white text (oklch(0.98) not oklch(1)) and consider slightly lifted black for large text areas
**Warning signs:** User complaints about eye strain, text appearing to "bleed" or "glow" on black background

### Pitfall 7: Missing accent-color on Form Controls

**What goes wrong:** Native form controls (checkboxes, radios, sliders) don't match theme accent color
**Why it happens:** Forgot to set `accent-color: var(--primary)` on `:root` for native form theming
**How to avoid:** Add `accent-color` to `:root` selector in globals.css, updates automatically per theme
**Warning signs:** Form controls remain browser default blue, inconsistent with theme accent

### Pitfall 8: ::selection Highlights Not Theme-Aware

**What goes wrong:** Text selection highlight remains same color across all themes
**Why it happens:** No `::selection` pseudo-element styles defined, browser default is static blue
**How to avoid:** Define `::selection { background: var(--primary); color: var(--primary-foreground); }`
**Warning signs:** Text selection looks wrong in different themes, doesn't match accent color

## Code Examples

Verified patterns from official sources:

### Complete ThemeProvider Configuration for Multi-Theme

```tsx
/* Source: https://github.com/pacocoursey/next-themes + project requirements */

// app/layout.tsx
import { ThemeProvider } from "@/components/providers/theme-provider"

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute={["class", "data-theme"]}
          defaultTheme="system"
          enableSystem={true}
          themes={["system", "midnight", "dawn", "slate", "carbon"]}
          disableTransitionOnChange={false} // Let View Transitions API handle animations
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Key changes from Phase 22:**
- `themes` prop lists all available theme names
- `defaultTheme="system"` respects OS preference on first visit
- `enableSystem={true}` enables system preference detection
- `disableTransitionOnChange={false}` allows View Transitions API to work

### Theme Metadata Definition

```typescript
/* Source: Best practices for theme configuration */

// lib/themes.ts
export interface ThemeConfig {
  name: string
  value: string
  label: string
  description: string
  accent: string
  preview: {
    bg: string
    sidebar: string
    text: string
    accent: string
  }
}

export const THEMES: ThemeConfig[] = [
  {
    name: "system",
    value: "system",
    label: "System",
    description: "Match your OS preference",
    accent: "Auto",
    preview: {
      bg: "var(--app-bg)",
      sidebar: "var(--app-sidebar)",
      text: "var(--foreground)",
      accent: "var(--primary)",
    },
  },
  {
    name: "midnight",
    value: "midnight",
    label: "Midnight",
    description: "Blue-undertone dark",
    accent: "Blue",
    preview: {
      bg: "oklch(0.12 0.01 240)",
      sidebar: "oklch(0.16 0.012 240)",
      text: "oklch(0.98 0.005 240)",
      accent: "oklch(0.55 0.15 240)",
    },
  },
  {
    name: "dawn",
    value: "dawn",
    label: "Dawn",
    description: "Clean light mode",
    accent: "Indigo",
    preview: {
      bg: "oklch(0.98 0 0)",
      sidebar: "oklch(0.96 0 0)",
      text: "oklch(0.145 0 0)",
      accent: "oklch(0.488 0.243 264.376)",
    },
  },
  {
    name: "slate",
    value: "slate",
    label: "Slate",
    description: "Warm gray-green dark",
    accent: "Teal",
    preview: {
      bg: "oklch(0.18 0.008 150)",
      sidebar: "oklch(0.22 0.01 150)",
      text: "oklch(0.95 0.005 150)",
      accent: "oklch(0.60 0.12 180)",
    },
  },
  {
    name: "carbon",
    value: "carbon",
    label: "Carbon",
    description: "True black OLED",
    accent: "Purple",
    preview: {
      bg: "oklch(0 0 0)",
      sidebar: "oklch(0.08 0 0)",
      text: "oklch(1 0 0)",
      accent: "oklch(0.70 0.20 300)",
    },
  },
]

export function getThemeConfig(theme: string): ThemeConfig | undefined {
  return THEMES.find((t) => t.value === theme)
}
```

### View Transition Wrapper Utility

```typescript
/* Source: https://notanumber.in/blog/animated-dark-mode-toggle-with-view-transitions-api-in-react */

// lib/view-transitions.ts
import { flushSync } from "react-dom"

export function withViewTransition(callback: () => void) {
  // Check browser support (progressive enhancement)
  if (!document.startViewTransition) {
    callback()
    return
  }

  // Wrap callback in view transition
  document.startViewTransition(() => {
    flushSync(callback)
  })
}
```

**Usage:**
```tsx
import { withViewTransition } from "@/lib/view-transitions"

const handleThemeChange = (newTheme: string) => {
  withViewTransition(() => setTheme(newTheme))
}
```

### Global Styles for Theme-Aware UI Elements

```css
/* Source: MDN + CSS-Tricks + project requirements */

/* globals.css additions */

@layer base {
  /* SWITCH-05: Native form control theming */
  :root {
    accent-color: var(--primary);
  }

  /* SWITCH-03: Selection highlight matches theme accent */
  ::selection {
    background-color: var(--primary);
    color: var(--primary-foreground);
  }

  /* Firefox-specific selection styling */
  ::-moz-selection {
    background-color: var(--primary);
    color: var(--primary-foreground);
  }
}

/* View Transitions API animation configuration */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 250ms;
  animation-timing-function: ease-in-out;
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0ms;
  }
}
```

### Theme Picker with Preview Cards

```tsx
/* Source: Inferred from UI/UX best practices + project requirements */

// components/profile/theme-picker.tsx
"use client"

import { useTheme } from "next-themes"
import { withViewTransition } from "@/lib/view-transitions"
import { THEMES, type ThemeConfig } from "@/lib/themes"
import { cn } from "@/lib/utils"

export function ThemePicker() {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (newTheme: string) => {
    withViewTransition(() => setTheme(newTheme))
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Theme</h3>
        <p className="text-sm text-muted-foreground">
          Choose your visual theme preference
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {THEMES.map((t) => (
          <ThemePreviewCard
            key={t.value}
            theme={t}
            isActive={theme === t.value}
            onClick={() => handleThemeChange(t.value)}
          />
        ))}
      </div>
    </div>
  )
}

interface ThemePreviewCardProps {
  theme: ThemeConfig
  isActive: boolean
  onClick: () => void
}

function ThemePreviewCard({ theme, isActive, onClick }: ThemePreviewCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-lg border-2 transition-all text-left",
        isActive
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      )}
    >
      {/* Mini UI mockup */}
      <div className="h-24 flex">
        {/* Sidebar preview */}
        <div
          className="w-1/3 flex flex-col items-center justify-center gap-1.5 p-2"
          style={{ backgroundColor: theme.preview.sidebar }}
        >
          <div
            className="w-8 h-1 rounded"
            style={{ backgroundColor: theme.preview.accent }}
          />
          <div
            className="w-6 h-0.5 rounded"
            style={{ backgroundColor: theme.preview.text, opacity: 0.5 }}
          />
          <div
            className="w-6 h-0.5 rounded"
            style={{ backgroundColor: theme.preview.text, opacity: 0.5 }}
          />
        </div>

        {/* Main area preview */}
        <div
          className="flex-1 p-3 flex flex-col gap-1.5"
          style={{ backgroundColor: theme.preview.bg }}
        >
          <div
            className="h-2 w-3/4 rounded"
            style={{ backgroundColor: theme.preview.text, opacity: 0.9 }}
          />
          <div
            className="h-2 w-1/2 rounded"
            style={{ backgroundColor: theme.preview.text, opacity: 0.6 }}
          />
          <div
            className="h-6 w-16 rounded mt-auto"
            style={{ backgroundColor: theme.preview.accent }}
          />
        </div>
      </div>

      {/* Label */}
      <div className="p-3 bg-card border-t">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{theme.label}</p>
            <p className="text-xs text-muted-foreground">{theme.description}</p>
          </div>
          {isActive && (
            <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </button>
  )
}
```

### Sonner Theme Integration

```tsx
/* Source: https://ui.shadcn.com/docs/components/sonner + Sonner docs */

// app/layout.tsx - Update Toaster
import { useTheme } from "next-themes"

function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      position="top-right"
      richColors
      duration={5000}
      closeButton
      // Pass resolved theme to ensure Sonner uses correct colors
      theme={resolvedTheme as "light" | "dark"}
    />
  )
}
```

**Note:** Sonner's `richColors` prop uses theme-aware colors. The `theme` prop ensures Sonner knows current theme even if custom theme names are used.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate CSS files per theme | CSS variables with selector scoping | 2023-2024 | Smaller bundles, easier maintenance, no page reload needed |
| Instant theme switching | View Transitions API | Chrome 126 (Jan 2024) | Smooth, polished UX that matches native OS transitions |
| Color swatch pickers | Mini UI mockup previews | 2025-2026 | Better user understanding of theme personality, higher confidence in choice |
| Generic "light" and "dark" | Named theme presets with personality | 2024-2026 | Stronger brand identity, user preference granularity |
| Client-only theme detection | SSR-safe with FOUC prevention | next-themes adoption (2021+) | Better performance, no flash on page load |
| CSS transitions on individual elements | View Transitions API (all elements) | 2024+ | Complete theme transition including shadows, pseudo-elements, borders |

**Deprecated/outdated:**
- **Separate stylesheet loading:** Loading `theme-dark.css` vs `theme-light.css` - replaced by CSS variables with zero-cost switching
- **theme-ui or styled-components for theming:** CSS-in-JS solutions - replaced by CSS variables for zero-runtime cost
- **Manual matchMedia boilerplate:** next-themes handles all edge cases (tab sync, hydration, cleanup)

## Open Questions

Things that couldn't be fully resolved:

1. **System theme to named theme mapping in next-themes**
   - What we know: next-themes has `enableSystem` and detects OS preference, but maps to "light"/"dark" by default
   - What's unclear: How to map OS dark → Carbon and OS light → Dawn automatically without breaking "System" selection
   - Recommendation: Investigate next-themes `value` prop for custom mapping, or implement custom logic with `useTheme()` + `matchMedia` listener that overrides data-theme attribute when theme === "system"

2. **Optimal placement of theme picker in ProfileSettingsDialog**
   - What we know: Dialog has tabs (Profile, Security, Extension), could add Theme tab or embed in Profile tab
   - What's unclear: Whether theme deserves dedicated tab or should be section in Profile tab
   - Recommendation: Add as dedicated "Theme" tab - theme is significant enough feature and tab structure supports easy addition

3. **True black vs near-black for Carbon theme**
   - What we know: Research suggests near-black (#121212) is better for readability, but requirements specify "true black OLED-friendly"
   - What's unclear: Whether to prioritize OLED battery savings (true black) or readability (near-black)
   - Recommendation: Use true #000000 black for backgrounds as specified, but use near-white text (oklch(0.98) not 1.0) to reduce halation effect - balances both concerns

4. **View Transitions API browser support coverage**
   - What we know: Chrome 126+ (Jan 2024), Edge 126+, no Safari/Firefox support yet
   - What's unclear: Exact fallback experience in unsupported browsers, whether progressive enhancement is sufficient
   - Recommendation: Implement with progressive enhancement - unsupported browsers get instant theme change (current behavior), supported browsers get smooth transition - no users worse off

## Sources

### Primary (HIGH confidence)

- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Multi-theme configuration, system preference detection
- [next-themes npm](https://www.npmjs.com/package/next-themes) - API reference, version compatibility
- [View Transitions API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) - Browser API specification
- [View Transitions in Next.js - LogRocket](https://blog.logrocket.com/nextjs-view-transitions-api/) - Next.js integration patterns
- [Document.startViewTransition() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) - API usage and examples
- [accent-color - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/accent-color) - Native form control theming
- [::selection - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::selection) - Text selection styling
- [prefers-color-scheme - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) - OS theme preference detection
- [Vercel Geist Colors](https://vercel.com/geist/colors) - Vercel design system color reference for Dawn theme inspiration

### Secondary (MEDIUM confidence)

- [Multiple Themes for Next.js with next-themes - Darren White](https://darrenwhite.dev/blog/nextjs-tailwindcss-theming) - Multi-theme implementation guide
- [Animated Dark Mode Toggle with View Transitions API in React - Not A Number](https://notanumber.in/blog/animated-dark-mode-toggle-with-view-transitions-api-in-react) - React + View Transitions pattern
- [Full-page theme toggle animation with View Transitions API - Akash Hamirwasia](https://akashhamirwasia.com/blog/full-page-theme-toggle-animation-with-view-transitions-api/) - Theme transition examples
- [Detect System Theme Preference Change Using JavaScript - David Walsh](https://davidwalsh.name/detect-system-theme-preference-change-using-javascript) - matchMedia listener pattern
- [Sonner Styling Documentation](https://sonner.emilkowal.ski/styling) - Toast notification theming
- [12 UI/UX Design Trends That Will Dominate 2026 - Index](https://www.index.dev/blog/ui-ux-design-trends) - Card UI design trends
- [How Card UI Patterns Dominate Web Design - Designmodo](https://designmodo.com/web-design-cards/) - Preview card best practices
- [Modern App Colors: Design Palettes That Work In 2026 - WebOsmotic](https://webosmotic.com/blog/modern-app-colors/) - Color palette guidance
- [Why Dark Mode is Mandatory in 2026 - Siva Designer](https://www.sivadesigner.in/blog/dark-mode-evolution-modern-web-design/) - Dark mode design trends

### Tertiary (LOW confidence)

- Theme toggle demos (theme-toggle.rdsx.dev) - Visual examples, implementation varies
- Various Medium articles on multi-theme systems - Community approaches, not authoritative
- OLED theme marketplace listings - Show demand for true black themes, limited design guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - next-themes is already installed and proven in Phase 22, View Transitions API is well-documented browser standard
- Architecture: HIGH - Patterns verified from official docs (MDN, next-themes, React) and production implementations
- Pitfalls: MEDIUM-HIGH - Most derived from official discussions and real-world issues, some inferred from browser behavior

**Research date:** 2026-01-26
**Valid until:** 2026-03-26 (60 days - stable technologies, View Transitions API is standard, next-themes is mature)

**Codebase context verified:**
- Phase 22 complete: next-themes v0.4.6 installed, ThemeProvider in layout.tsx, globals.css with CSS variables for light/dark themes
- Current limitation: Only 2 themes (light/dark), no smooth transitions, no theme picker UI
- Ready for extension: CSS variable architecture supports unlimited themes, just need additional `[data-theme="name"]` selectors
