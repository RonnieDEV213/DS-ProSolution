# Phase 26: Polish & Micro-interactions - Research

**Researched:** 2026-01-26
**Domain:** UI transitions, animations, command palette, keyboard shortcuts
**Confidence:** HIGH

## Summary

This phase adds the finishing polish to the v4 UI/Design System milestone through CSS-first transitions, loading skeletons, empty states, a command palette, and keyboard shortcuts. The research reveals a mature ecosystem with established patterns:

**Transitions**: The project already has View Transitions API infrastructure (Phase 23) for page navigations. Component-level transitions use CSS animations via Tailwind's built-in utilities and shadcn/ui's animation classes. Framer Motion is already installed for complex animations when needed. The key is using GPU-accelerated properties (transform, opacity) and respecting `prefers-reduced-motion`.

**Command Palette**: The shadcn/ui ecosystem includes a Command component built on `cmdk` (by Paco Coursey), which is the industry standard. It provides fast fuzzy search, keyboard navigation, composable API, and zero-config integration with the existing design system.

**Keyboard Shortcuts**: `react-hotkeys-hook` is the modern, hook-based solution with TypeScript support, scoping, and sequential key support. It's lightweight and follows React patterns.

**Loading Skeletons**: The codebase already has skeleton implementations (SkeletonRow, SidebarMenuSkeleton). The shimmer effect is preferred over pulse for perceived performance. Pure CSS animation is critical to avoid JS overhead.

**Empty States**: Custom SVG illustrations available from multiple sources (Iconscout, Flaticon, Pixeltrue). Professional tone with optional CTAs based on actionability.

**Primary recommendation:** Use shadcn/ui Command component with react-hotkeys-hook for keyboard shortcuts, extend existing skeleton patterns with CSS shimmer animations, leverage Framer Motion sparingly for staggered list animations, and respect `prefers-reduced-motion` throughout.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | latest | Command palette primitive | Industry standard by Paco Coursey, used by Vercel, Linear, Raycast. Unstyled, accessible, composable. |
| react-hotkeys-hook | latest | Keyboard shortcuts | Modern hook-based API, TypeScript support, scoping, sequential keys. 8.6k+ GitHub stars. |
| Framer Motion | 12.25.0 (installed) | Complex animations | GPU-accelerated, spring physics, layout animations. Already in package.json. |
| Tailwind CSS animations | 4.x (installed) | Simple transitions | Built-in animate-* utilities, CSS-first, zero JS overhead. |
| tw-animate-css | 1.4.0 (installed) | Additional animation utilities | Already installed, provides expanded animation classes. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| View Transitions API | Native | Page transitions | Already implemented (Phase 23), use for route changes |
| CSS Variables | Native | Theme-aware animations | Already in use, critical for theme-switching without re-renders |
| Radix UI Primitives | installed | Component animations | Dialog, Sheet, HoverCard already have built-in animations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk | kbar | kbar has more features (undo/redo, virtualization) but cmdk is lighter and matches shadcn/ui philosophy |
| react-hotkeys-hook | react-hotkeys | react-hotkeys is older, uses HOC pattern vs hooks |
| Framer Motion | react-spring | react-spring is declarative, but Framer Motion has better TypeScript support and layout animations |

**Installation:**
```bash
# Command palette (via shadcn/ui)
pnpm dlx shadcn@latest add command

# Keyboard shortcuts
pnpm add react-hotkeys-hook

# Kbd component for shortcut badges (via shadcn/ui)
pnpm dlx shadcn@latest add kbd

# Framer Motion already installed
# tw-animate-css already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/
│   │   ├── command.tsx          # shadcn/ui command palette
│   │   ├── kbd.tsx              # keyboard shortcut badge
│   │   └── skeleton.tsx         # base skeleton component
│   ├── command-palette/
│   │   ├── command-palette.tsx  # Main palette with all actions
│   │   ├── navigation-items.ts  # Page/section navigation
│   │   ├── action-items.ts      # Quick actions (toggle theme, etc.)
│   │   └── search-items.tsx     # Data search (orders, sellers)
│   ├── skeletons/
│   │   ├── dashboard-skeleton.tsx
│   │   ├── table-skeleton.tsx
│   │   └── card-skeleton.tsx
│   ├── empty-states/
│   │   ├── no-results.tsx
│   │   ├── first-time-empty.tsx
│   │   └── error-empty.tsx
│   └── shortcuts/
│       └── shortcuts-reference.tsx  # ? modal with full list
├── hooks/
│   ├── use-command-palette.ts   # Cmd+K trigger and state
│   └── use-keyboard-shortcuts.ts # Global shortcuts registration
└── lib/
    └── shortcuts.ts             # Shortcut definitions and registry
```

### Pattern 1: CSS-First Transitions
**What:** Use CSS transitions and animations wherever possible, only reaching for JS when necessary
**When to use:** All hover states, focus rings, simple enter/exit animations, theme transitions
**Example:**
```tsx
// Good: CSS-only hover transition (already in button.tsx)
const buttonVariants = cva(
  "transition-all ...", // Existing pattern
  // ...
)

// Good: Tailwind animation classes (already in dialog.tsx)
<DialogContent className="
  data-[state=open]:animate-in
  data-[state=closed]:animate-out
  data-[state=closed]:fade-out-0
  data-[state=open]:fade-in-0
  data-[state=closed]:zoom-out-95
  data-[state=open]:zoom-in-95
" />

// Good: CSS transition on sidebar (already in sidebar.tsx)
className="duration-200 transition-[width] ease-linear"
```
**Source:** Current codebase patterns (button.tsx, dialog.tsx, sidebar.tsx)

### Pattern 2: Framer Motion for Staggered Lists
**What:** Use Framer Motion's staggerChildren for data loading animations
**When to use:** List items appearing after data load, sequential animations
**Example:**
```tsx
// Source: Framer Motion docs + best practices
import { motion } from "framer-motion"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05 // 50ms between items
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
}

<motion.div variants={container} initial="hidden" animate="show">
  {items.map(item => (
    <motion.div key={item.id} variants={item}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```
**Source:** [Framer Motion Staggered Animations](https://medium.com/@onifkay/creating-staggered-animations-with-framer-motion-0e7dc90eae33)

### Pattern 3: Command Palette with Data Search
**What:** Combine navigation, actions, and data search in a single palette
**When to use:** Global command access (Cmd+K)
**Example:**
```tsx
// Source: shadcn/ui Command docs + cmdk patterns
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command"

export function CommandPalette() {
  return (
    <Command>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => router.push("/dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => toggleTheme()}>
            <Palette className="mr-2 h-4 w-4" />
            Toggle Theme
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Orders">
          {searchResults.map(order => (
            <CommandItem key={order.id} onSelect={() => openOrder(order.id)}>
              Order #{order.id}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}
```
**Source:** [shadcn/ui Command Component](https://ui.shadcn.com/docs/components/command)

### Pattern 4: Scoped Keyboard Shortcuts
**What:** Use react-hotkeys-hook with scoping for context-aware shortcuts
**When to use:** Global shortcuts + component-specific shortcuts
**Example:**
```tsx
// Source: react-hotkeys-hook docs
import { useHotkeys } from 'react-hotkeys-hook'

// Global shortcuts (no ref = works everywhere)
export function useGlobalShortcuts() {
  useHotkeys('mod+k', () => openCommandPalette())
  useHotkeys('mod+b', () => toggleSidebar())
  useHotkeys('?', () => openShortcutsModal())
}

// Scoped shortcuts (only when ref element is focused)
export function DataTable() {
  const ref = useRef(null)

  useHotkeys('j', () => nextRow(), { scopes: ['table'] })
  useHotkeys('k', () => prevRow(), { scopes: ['table'] })

  return <div ref={ref} tabIndex={0}>...</div>
}
```
**Source:** [react-hotkeys-hook docs](https://react-hotkeys-hook.vercel.app/)

### Pattern 5: High-Fidelity Skeletons with Shimmer
**What:** Match exact component structure, use CSS shimmer animation
**When to use:** Every data-loading page
**Example:**
```tsx
// Shimmer animation via CSS (preferred over pulse)
// Source: CSS shimmer patterns + accessibility research
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--muted) 0%,
    var(--muted-foreground/10) 50%,
    var(--muted) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// Component structure matches real content
<div className="space-y-4">
  <div className="h-12 w-48 skeleton-shimmer rounded" /> {/* Header */}
  <div className="grid grid-cols-3 gap-4">
    {[1,2,3].map(i => (
      <div key={i} className="h-32 skeleton-shimmer rounded" /> {/* Cards */}
    ))}
  </div>
</div>
```
**Source:** [Skeleton Screens Research](https://www.nngroup.com/articles/skeleton-screens/)

### Pattern 6: Reduced Motion Support
**What:** Disable or simplify animations for users with `prefers-reduced-motion`
**When to use:** All animations
**Example:**
```css
/* Source: WCAG 2.3.3 + MDN docs */
/* Base animation */
.animated-element {
  transition: transform 300ms ease, opacity 300ms ease;
}

/* Disable for reduced motion users */
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    transition: none;
  }

  /* Keep opacity fade (no motion), remove transform */
  .fade-only {
    transition: opacity 200ms ease;
  }
}
```
**Source:** [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [WCAG C39](https://www.w3.org/WAI/WCAG21/Techniques/css/C39)

### Anti-Patterns to Avoid
- **Animating width/height/margin/padding:** Triggers layout reflow. Use `transform: scale()` instead.
- **JS-based scrollbar libraries:** Phase 25 constraint - CSS-only scrollbars to preserve react-window virtualization.
- **Overusing will-change:** Only apply to frequently animated elements, remove when done.
- **Ignoring reduced motion:** Always provide fallback via `@media (prefers-reduced-motion: reduce)`.
- **Pulse skeletons:** Research shows shimmer/wave perceived as faster loading than pulse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command palette fuzzy search | Custom filter algorithm | cmdk's built-in filter | Handles edge cases, diacritics, optimized |
| Keyboard shortcut conflicts | Manual event listener management | react-hotkeys-hook scopes | Prevents collisions, easier to debug |
| Animation performance | Custom RAF loops | Framer Motion or CSS animations | GPU acceleration, cleanup, reduced motion |
| Skeleton shimmer | JS-based shimmer | CSS gradient animation | Zero JS overhead, theme-aware |
| Empty state illustrations | Hand-drawn SVGs | Iconscout/Flaticon/Pixeltrue | Professional quality, consistent style |
| Kbd badge component | Custom keyboard shortcut display | shadcn/ui Kbd component | Accessible, styled, modifier key support |

**Key insight:** The UI/animation domain is mature with battle-tested libraries. Custom implementations risk accessibility bugs (focus management, screen readers, reduced motion) and performance issues (layout thrashing, memory leaks). Use established solutions.

## Common Pitfalls

### Pitfall 1: Layout Thrashing from Animated Layout Properties
**What goes wrong:** Animating width, height, top, left causes the browser to recalculate layout on every frame, dropping to 30fps or lower.
**Why it happens:** These properties affect the document flow, requiring reflow + repaint.
**How to avoid:** Only animate `transform` and `opacity` - they're GPU-accelerated and composited on their own layer.
**Warning signs:** Janky animations, high CPU usage in DevTools Performance tab, "Forced reflow" warnings.
**Source:** [Framer Motion performance guide](https://www.framer.com/motion/animation/)

### Pitfall 2: Will-Change Abuse
**What goes wrong:** Adding `will-change` to many elements increases memory usage and can hurt performance.
**Why it happens:** Developers think "more optimization = better" without understanding the cost.
**How to avoid:** Only apply to elements about to animate, remove after animation completes. Use sparingly (< 10 elements).
**Warning signs:** High memory usage, slower initial renders, mobile battery drain.
**Source:** [CSS GPU Acceleration Guide (2026)](https://www.lexo.ch/blog/2025/01/boost-css-performance-with-will-change-and-transform-translate3d-why-gpu-acceleration-matters/)

### Pitfall 3: Missing Reduced Motion Fallbacks
**What goes wrong:** Animations trigger vestibular disorders (dizziness, nausea) for 70M+ people.
**Why it happens:** Developers forget to test `prefers-reduced-motion` or think it's optional.
**How to avoid:** Every animation must have a `@media (prefers-reduced-motion: reduce)` block. Test in DevTools Rendering panel.
**Warning signs:** Accessibility audit failures, user complaints about dizziness.
**Source:** [prefers-reduced-motion best practices](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html), [Josh Comeau's guide](https://www.joshwcomeau.com/react/prefers-reduced-motion/)

### Pitfall 4: Pulse Skeletons Instead of Shimmer
**What goes wrong:** Pulse animations (opacity fade) are perceived as 35% slower loading than shimmer/wave.
**Why it happens:** Pulse is easier to implement (single opacity transition).
**How to avoid:** Use CSS gradient shimmer animation that moves left-to-right. See Pattern 5.
**Warning signs:** User perception of slow loading, even with same actual load time.
**Source:** [Skeleton Screens Research](https://www.nngroup.com/articles/skeleton-screens/)

### Pitfall 5: Command Palette Without Keyboard Navigation
**What goes wrong:** Users expect arrow keys, Enter, Escape to work. Missing these makes it unusable for power users.
**Why it happens:** Custom implementations forget to handle all keyboard interactions.
**How to avoid:** Use cmdk (via shadcn/ui Command) which handles all keyboard navigation out of the box.
**Warning signs:** Keyboard-only users can't navigate, accessibility audit failures.
**Source:** [cmdk documentation](https://github.com/dip/cmdk)

### Pitfall 6: Staggered Animations with Re-Renders
**What goes wrong:** Animating list items causes full re-renders on every stagger step.
**Why it happens:** Using state updates to trigger sequential animations.
**How to avoid:** Use Framer Motion's `staggerChildren` with variants - no re-renders, GPU-accelerated.
**Warning signs:** React DevTools shows re-renders during animation, CPU spikes.
**Source:** [Staggered Animations in React](https://medium.com/@paramsingh_66174/staggered-animations-in-react-93d026c1a165)

## Code Examples

Verified patterns from official sources:

### Basic Command Palette Setup
```tsx
// Source: https://ui.shadcn.com/docs/components/command
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Cmd+K to open
  useHotkeys("mod+k", (e) => {
    e.preventDefault()
    setOpen(true)
  })

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => {
              router.push("/dashboard")
              setOpen(false)
            }}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              router.push("/bookkeeping")
              setOpen(false)
            }}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Bookkeeping</span>
            <CommandShortcut>G B</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              toggleTheme()
              setOpen(false)
            }}
          >
            <Palette className="mr-2 h-4 w-4" />
            <span>Toggle Theme</span>
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Global Keyboard Shortcuts Registration
```tsx
// Source: https://react-hotkeys-hook.vercel.app/
import { useHotkeys } from 'react-hotkeys-hook'
import { useRouter } from 'next/navigation'

export function useGlobalShortcuts() {
  const router = useRouter()
  const { toggleSidebar } = useSidebar()
  const [commandOpen, setCommandOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Command palette (Cmd+K already implemented in Phase 24 for sidebar)
  useHotkeys('mod+k', (e) => {
    e.preventDefault()
    setCommandOpen(true)
  })

  // Shortcuts reference
  useHotkeys('shift+/', (e) => {
    e.preventDefault()
    setShortcutsOpen(true)
  })

  // Go-to sequences (vim-style)
  useHotkeys('g,d', () => router.push('/dashboard'))
  useHotkeys('g,b', () => router.push('/bookkeeping'))
  useHotkeys('g,a', () => router.push('/admin/accounts'))

  // Sidebar toggle (already exists, keeping for reference)
  // useHotkeys('mod+b', () => toggleSidebar())

  return { commandOpen, setCommandOpen, shortcutsOpen, setShortcutsOpen }
}
```

### Skeleton with Shimmer Animation
```tsx
// CSS (add to globals.css)
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    oklch(from var(--muted) l c h) 0%,
    oklch(from var(--muted) calc(l * 1.1) c h) 50%,
    oklch(from var(--muted) l c h) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none;
    background: var(--muted);
  }
}

// Component
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="h-12 w-64 skeleton-shimmer rounded-lg" />

      {/* Metrics cards */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 skeleton-shimmer rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="space-y-2">
        <div className="h-10 skeleton-shimmer rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 skeleton-shimmer rounded" />
        ))}
      </div>
    </div>
  )
}
```

### Staggered List Animation with Framer Motion
```tsx
// Source: Framer Motion docs + best practices
import { motion } from "framer-motion"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // 50ms delay between items
      delayChildren: 0.1,    // Start after 100ms
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "tween",
      duration: 0.2,
      ease: "easeOut"
    }
  }
}

export function OrdersList({ orders }: { orders: Order[] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
    >
      {orders.map((order) => (
        <motion.div
          key={order.id}
          variants={item}
          className="p-4 border-b"
        >
          <OrderCard order={order} />
        </motion.div>
      ))}
    </motion.div>
  )
}
```

### Button Active State (Press Feedback)
```tsx
// Add to button.tsx variants
// Source: Current codebase pattern + phase context requirement
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ...",
  // ... rest of variants
)
```

### Card Hover Elevation
```tsx
// Add to card.tsx
// Source: Current codebase pattern + phase context requirement
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md",
        className
      )}
      {...props}
    />
  )
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Spring useSpring | Framer Motion layout animations | 2023 | Simpler API, better TypeScript support, layout prop for auto-animations |
| Custom keyboard libraries | react-hotkeys-hook | 2024 | Hook-based, smaller bundle, better tree-shaking |
| CSS @keyframes pulse | CSS gradient shimmer | 2022-2024 | 35% faster perceived load time per NN/g research |
| kbar for command palette | cmdk via shadcn/ui | 2023 | Lighter weight, matches design system, composable |
| Manual reduced motion checks | CSS @media (prefers-reduced-motion) | 2021 (WCAG 2.1) | Native browser support, auto-respects OS settings |
| JavaScript scrollbar libs | Pure CSS scrollbar-* properties | 2024 | Standards-first, works with virtualization, no JS overhead |

**Deprecated/outdated:**
- **react-transition-group**: Replaced by Framer Motion for React animations
- **CSS transform: translate3d(0,0,0) hack**: Modern browsers auto-promote animated transforms to GPU layer
- **react-hotkeys (old)**: Superseded by react-hotkeys-hook with modern hooks API
- **will-change: transform on everything**: Now understood as anti-pattern, use sparingly

## Open Questions

1. **Command Palette Data Search Performance**
   - What we know: cmdk supports async loading, keywords prop for search optimization
   - What's unclear: Performance with 10K+ orders in search results
   - Recommendation: Start with client-side search (TanStack Query cache), add server-side search if > 5K items

2. **Stagger Animation on Large Lists**
   - What we know: Framer Motion staggerChildren works well up to ~100 items
   - What's unclear: Performance impact on 1000+ virtualized rows
   - Recommendation: Only stagger initial visible items (first ~20 rows), skip for subsequent loads

3. **Keyboard Shortcut Collision with Browser Defaults**
   - What we know: `mod+k` conflicts with browser search on some platforms
   - What's unclear: Best fallback for when preventDefault fails
   - Recommendation: Use `mod+k` (industry standard), provide `mod+/` alternative, document in shortcuts modal

4. **Empty State Illustration Licensing**
   - What we know: Free options exist (Iconscout, Flaticon) but may have attribution requirements
   - What's unclear: Whether MIT-friendly SVG packs are sufficient
   - Recommendation: Use Flaticon free tier with attribution, or commission custom illustrations for final polish

## Sources

### Primary (HIGH confidence)
- [cmdk GitHub](https://github.com/dip/cmdk) - Command palette component architecture and API
- [shadcn/ui Command Component](https://ui.shadcn.com/docs/components/command) - Integration with shadcn/ui
- [react-hotkeys-hook docs](https://react-hotkeys-hook.vercel.app/) - Keyboard shortcuts implementation
- [Framer Motion Animation](https://www.framer.com/motion/animation/) - Performance best practices
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) - Accessibility spec
- [WCAG C39 Technique](https://www.w3.org/WAI/WCAG21/Techniques/css/C39) - Reduced motion standard

### Secondary (MEDIUM confidence)
- [NN/g Skeleton Screens Research](https://www.nngroup.com/articles/skeleton-screens/) - Shimmer vs pulse perception study
- [CSS GPU Acceleration 2026](https://www.lexo.ch/blog/2025/01/boost-css-performance-with-will-change-and-transform-translate3d-why-gpu-acceleration-matters/) - Recent will-change guidance
- [Framer Motion Staggered Animations](https://medium.com/@onifkay/creating-staggered-animations-with-framer-motion-0e7dc90eae33) - Stagger implementation patterns
- [Josh Comeau Reduced Motion](https://www.joshwcomeau.com/react/prefers-reduced-motion/) - React accessibility patterns

### Tertiary (LOW confidence)
- Various WebSearch results on empty state illustrations - marked as exploratory, verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are documented, widely used, match existing tech (Next.js 14+, React 19, TypeScript, Tailwind, shadcn/ui)
- Architecture: HIGH - Patterns verified against official docs, current codebase already uses similar approaches
- Pitfalls: HIGH - Based on official performance guides and WCAG standards

**Research date:** 2026-01-26
**Valid until:** 60 days (stable ecosystem, slow-moving standards)

**Codebase constraints verified:**
- ✓ Performance-neutral minimum: CSS-first transitions, no JS scrollbar libraries
- ✓ Theme switching zero re-renders: CSS variables cascade only
- ✓ Framer Motion already installed (package.json)
- ✓ View Transitions API already implemented (Phase 23)
- ✓ Kbd badges pattern exists (keyboard-shortcuts-modal.tsx)
- ✓ Skeleton pattern exists (SkeletonRow, SidebarMenuSkeleton)
- ✓ CSS scrollbar styling in place (Phase 25, globals.css)
- ✓ `prefers-reduced-motion` already used for View Transitions
