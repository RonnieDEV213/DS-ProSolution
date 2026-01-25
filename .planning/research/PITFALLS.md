# Pitfall Research: UI/Design System (v4)

**Domain:** Adding preset themes, custom UI components, and layout overhaul to existing 80K LOC Next.js/TailwindCSS/shadcn/ui eBay automation platform
**Researched:** 2026-01-25
**Confidence:** HIGH (codebase analysis + multiple authoritative sources cross-referenced)

**Context:** DS-ProSolution has virtualized tables (react-window v2), real-time SSE streaming, IndexedDB sync, and Framer Motion animations. Performance-neutral minimum, performance-positive preferred. CSS-first approach required.

---

## Critical Pitfalls (Cause Rewrites or Major Regressions)

---

### CP-01: Hardcoded Tailwind Color Classes Bypass Theme System

**Problem:** The codebase contains 172 occurrences of hardcoded color classes (`bg-gray-950`, `bg-gray-900`, `text-gray-400`, `border-gray-800`, etc.) across 30+ files. These classes resolve to fixed hex values at build time and do NOT respond to CSS variable changes. If the theme system is built on top of CSS variables (the correct approach), every component using hardcoded colors will ignore theme switches entirely, creating a two-toned broken UI.

**Warning Signs:**
- After theme switch, some elements change color while others stay dark gray
- Layout backgrounds and borders don't respond to theme toggle
- Components look correct in the default dark theme but broken in any preset theme
- QA reports "some parts didn't change" after switching themes

**Prevention:**
1. **Audit and replace ALL hardcoded color classes before building themes.** Map every `bg-gray-*`, `text-gray-*`, `border-gray-*` to semantic CSS variable equivalents (`bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, etc.)
2. **Create a mapping reference** from gray scale values to semantic tokens: `bg-gray-950 -> bg-background`, `bg-gray-900 -> bg-card`, `text-gray-400 -> text-muted-foreground`, `border-gray-800 -> border-border`
3. **Add a lint rule or CI check** to prevent new hardcoded color classes from being introduced (e.g., no `gray-*`, `slate-*`, `zinc-*` in component files)
4. **Prioritize this as the FIRST phase task** -- nothing else works until color abstraction is complete

**Phase to Address:** Phase 1 (Color Token Migration) -- must be done before any theme definition work

**Performance Impact:** None if done correctly. This is a class name swap, no runtime cost change. But if NOT done, the team will waste days debugging why themes "partially work."

**Confidence:** HIGH -- verified via codebase grep: 172 occurrences across 30 files including critical components like `virtualized-records-list.tsx`, `admin/layout.tsx`, `va/layout.tsx`, `sidebar.tsx`.

---

### CP-02: Theme Flash (FOUC) on Page Load with Server-Side Rendering

**Problem:** The root layout currently hardcodes `<html lang="en" className="dark">`. Adding a multi-theme system requires the correct theme class/attribute to be present BEFORE the first paint. If the theme preference is stored client-side (localStorage/cookie) and applied via React hydration, users see a flash of the default theme before their chosen theme applies. This is especially jarring for light-to-dark or color-to-color transitions.

**Warning Signs:**
- White flash on page load for dark-theme users
- Brief color change visible during navigation
- Users report "flickering" when they refresh the page
- Hydration mismatch warnings in console (`suppressHydrationWarning` missing)

**Prevention:**
1. **Use `next-themes` library** with `attribute="data-theme"` (or `class`), which injects a blocking `<script>` in `<head>` to set the theme attribute before paint
2. **Add `suppressHydrationWarning` to `<html>` element** -- next-themes modifies it before hydration
3. **Remove the hardcoded `className="dark"`** from `layout.tsx` and let next-themes manage it
4. **Configure `defaultTheme` to match the current dark theme** so the fallback matches what users currently see
5. **Use `disableTransitionOnChange`** during initial load to prevent animation of the theme application
6. **Store theme preference in cookie** (not just localStorage) if SSR needs it for server-rendered pages

**Phase to Address:** Phase 2 (Theme Infrastructure) -- foundational, blocks all theme switching UI

**Performance Impact:** If done correctly with next-themes' blocking script approach, ZERO performance cost -- the script runs synchronously before paint. If done incorrectly with React state/useEffect, adds visible jank on every page load.

**Confidence:** HIGH -- verified via [next-themes documentation](https://github.com/pacocoursey/next-themes), [Next.js discussion #53063](https://github.com/vercel/next.js/discussions/53063), [FOUC fix guides](https://notanumber.in/blog/fixing-react-dark-mode-flickering).

---

### CP-03: Theme Context Provider Triggers Full React Re-render Tree

**Problem:** If theme state is managed via React Context (e.g., a `ThemeProvider` that passes theme values as context), every theme switch triggers re-rendering of ALL consuming components. In an 80K LOC app with virtualized lists, SSE feeds, and complex forms, this causes visible jank and potential data loss (unsaved form state reset).

**Warning Signs:**
- Theme toggle causes 200ms+ freeze
- React DevTools Profiler shows full component tree re-rendering on theme change
- Virtualized list rows all re-render simultaneously on theme switch
- Form inputs lose focus or value during theme change
- SSE feed stutters or drops events during theme transition

**Prevention:**
1. **CSS-first theming is NON-NEGOTIABLE.** Theme switching must ONLY change a CSS class or `data-theme` attribute on `<html>`. All downstream styling happens via CSS variable cascade.
2. **Never pass theme values as React props or context to components.** Components use `var(--background)` in CSS, not `theme.background` in JS.
3. **The only React context needed is `useTheme()` from next-themes** -- consumed only by the theme picker UI, not by styled components.
4. **Verify with React DevTools Profiler**: On theme switch, only the theme picker component and `<html>` element should re-render. Zero other components should re-render.

**Phase to Address:** Phase 2 (Theme Infrastructure) -- architectural decision, must be correct from start

**Performance Impact:** SEVERE if violated. CSS variable changes cascade through the browser's style engine (fast, ~1-5ms). React re-renders cascade through the JS engine (slow, ~50-500ms for large trees). The difference is 10-100x.

**Confidence:** HIGH -- verified via [Epic React CSS Variables article](https://www.epicreact.dev/css-variables), [react-window re-render research](https://web.dev/articles/virtualize-long-lists-react-window).

---

### CP-04: Custom Scrollbar Breaks react-window Virtualization

**Problem:** The app uses `react-window` v2's `List` and `Grid` components for virtualized rendering of bookkeeping records and seller grids. react-window manages its own scroll container with inline positioning. Replacing the native scrollbar with a JS-based custom scrollbar library (react-scrollbars-custom, SimpleBar, etc.) can break virtualization by: (a) intercepting scroll events, (b) wrapping the scroll container in extra DOM layers, (c) conflicting with `outerRef`/`outerElementType` props.

**Warning Signs:**
- Scroll position jumps or stutters in virtualized tables
- Infinite scroll loading stops working after scrollbar customization
- Two scrollbars appear (native + custom)
- Virtual list height calculations become incorrect
- Keyboard navigation (j/k) stops working in records list

**Prevention:**
1. **Use CSS-only scrollbar styling** -- NOT JavaScript scrollbar replacement libraries
2. **Use `scrollbar-width: thin` + `scrollbar-color`** (Firefox/standard) and `::-webkit-scrollbar` pseudo-elements (Chrome/Safari/Edge) for visual customization
3. **The existing `scrollbar-thin` class in globals.css is the correct approach** -- extend it, don't replace it with a JS library
4. **Make scrollbar CSS theme-aware** by using CSS variables: `scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track)` instead of hardcoded `#4b5563 #1f2937`
5. **Test scrollbar appearance in virtualized lists specifically**, not just regular overflow containers
6. **Accept that CSS scrollbar styling has limited customization** -- pure CSS cannot create scrollbar overlays, rounded-rect shapes on all browsers, or hover-expand animations. This is an acceptable tradeoff for not breaking virtualization.

**Phase to Address:** Phase 3 (Custom Components) -- after theme infrastructure is stable

**Performance Impact:** CSS-only scrollbars: ZERO performance cost. JS-based scrollbar libraries: can add 2-5ms per scroll event, which at 60fps in a virtualized list with 50+ visible rows compounds to visible stutter.

**Confidence:** HIGH -- verified via [react-window issue #110](https://github.com/bvaughn/react-window/issues/110), existing codebase analysis of `virtualized-records-list.tsx` and `sellers-grid.tsx`.

---

## Performance Pitfalls

---

### PP-01: Universal Selector `* {}` with CSS Variables on Large DOM

**Problem:** The current globals.css contains `* { @apply border-border outline-ring/50; }` which applies CSS variable-based styles to EVERY DOM element. On pages with virtualized lists (50+ visible rows, each with 10+ cells = 500+ elements, plus sidebar, modals, etc.), this universal selector forces the browser to resolve CSS variables for every node on any style recalculation. Tailwind's own team has acknowledged this as a real performance issue.

**Warning Signs:**
- Chrome DevTools Performance tab shows long "Recalculate Style" times (>10ms)
- Frame drops during scroll on tables with many columns
- Slower rendering on mobile/lower-end devices
- Adding more theme variables to `:root` makes existing pages slower

**Prevention:**
1. **Audit the necessity of `* { @apply border-border }`.** Most elements don't have visible borders -- only elements with explicit `border` width need `border-color`.
2. **Consider replacing universal selector with targeted selectors**: apply `border-border` only to elements that actually use borders (inputs, cards, table cells, dividers)
3. **Measure before and after** with Chrome DevTools Performance tab on the bookkeeping records page with 50+ visible rows
4. **If keeping the universal selector**: minimize the number of CSS variable resolutions it triggers. `border-color` alone is less costly than multiple variables.

**Phase to Address:** Phase 1 (Color Token Migration) -- address during the globals.css refactor

**Performance Impact:** On pages with <100 DOM elements: negligible. On virtualized pages with 500+ visible elements: measurable. [Tailwind PR #4850](https://github.com/tailwindlabs/tailwindcss/pull/4850) specifically addressed this issue.

**Confidence:** MEDIUM -- the universal selector cost is real and documented, but whether it's measurable in THIS app depends on actual DOM size during virtualized rendering. Requires profiling.

---

### PP-02: backdrop-filter on Dialog/Modal Overlay

**Problem:** shadcn/ui's `DialogOverlay` can include `backdrop-blur-sm` (CSS `backdrop-filter: blur()`) which causes severe rendering lag, especially on larger screens. This is a known GPU-intensive operation that affects paint performance. While the current codebase uses `bg-black/80` (good), custom modal designs might introduce backdrop blur.

**Warning Signs:**
- Modal open/close animation stutters or drops frames
- Opening a modal causes visible lag on pages with complex content behind the overlay
- Chrome DevTools shows high GPU memory during modal display
- Performance degrades on larger monitors (more pixels to blur)

**Prevention:**
1. **Never use `backdrop-blur-*` on full-screen overlays.** Use opaque/semi-transparent backgrounds only (`bg-black/80`, `bg-background/90`).
2. **If blur effect is desired for aesthetics**, limit it to small areas (popovers, dropdown backgrounds), never full-viewport overlays.
3. **The current `bg-black/80` overlay is performant** -- maintain this pattern in custom modals.
4. **Test modal performance on the seller collection page** (complex content behind overlay with SSE activity feed).

**Phase to Address:** Phase 3 (Custom Components) -- enforce during custom modal implementation

**Performance Impact:** `backdrop-blur` on full overlay: 5-50ms per frame on large screens (effectively unusable). Without blur: near-zero paint cost. This is documented in [shadcn/ui issue #327](https://github.com/shadcn-ui/ui/issues/327) and [issue #830](https://github.com/shadcn-ui/ui/issues/830).

**Confidence:** HIGH -- verified via shadcn/ui GitHub issues with multiple confirmed reports and fixes.

---

### PP-03: Framer Motion Individual Transform Animations Use Non-Accelerated CSS Variables

**Problem:** The app uses Framer Motion in 6 files (sync indicators, activity feeds, progress bars, waiting states). Framer Motion animates individual transform properties (`x`, `scale`, `rotate`) by setting CSS custom properties under the hood, which are NOT hardware-accelerated. This means these animations run on the main thread, competing with React rendering and SSE event processing.

**Warning Signs:**
- Animations stutter when SSE events arrive simultaneously
- CPU usage spikes during animations (visible in DevTools Performance)
- Animations smooth when page is idle, janky during data loading
- Mobile devices show worse animation performance than expected

**Prevention:**
1. **For any new animations, prefer CSS transitions/animations over Framer Motion** where possible (CSS transforms ARE hardware-accelerated when not using CSS variables)
2. **Use `useMotionValue` and `useTransform` instead of state-driven animations** to avoid React re-renders during animation
3. **Keep Framer Motion usage contained to non-critical UI** (loading indicators, page transitions) -- never on data-rendering paths like table rows
4. **For the existing 6 files using Framer Motion**: audit whether they animate during data-intensive operations and optimize if needed
5. **Use `will-change: transform` on animated elements** to hint GPU acceleration where helpful

**Phase to Address:** Phase 3 (Custom Components) -- audit during component redesign

**Performance Impact:** Main-thread animations: 2-8ms per frame. GPU-accelerated animations: <1ms per frame. The difference matters most when SSE events or IndexedDB operations are running simultaneously.

**Confidence:** MEDIUM -- verified via [Motion performance docs](https://motion.dev/docs/performance), but actual impact depends on animation complexity and concurrency with data operations.

---

### PP-04: Theme Switch Triggers Layout Recalculation on All Visible Elements

**Problem:** When CSS variables on `:root` change (theme switch), the browser must recalculate styles for every element that references those variables. With the current shadcn/ui setup using ~40 CSS variables and the universal `* { @apply border-border }` selector, a theme switch triggers style recalculation for the ENTIRE page. On a page with a virtualized table showing 50 rows of 10+ columns, this means 500+ element style recalculations simultaneously.

**Warning Signs:**
- Visible "flash" or frame drop during theme switch
- Chrome DevTools shows >16ms "Recalculate Style" event on theme change
- Theme switch feels laggy on pages with more content
- Users avoid changing themes because it "freezes the app"

**Prevention:**
1. **This is an inherent cost of CSS variable-based theming -- but it's a ONE-TIME cost per switch, not per frame.** The browser recalculates once, then caches.
2. **Use `disableTransitionOnChange` in next-themes** to prevent transition animations during the variable swap (avoids rendering intermediate states)
3. **Do NOT add CSS transitions on background-color or color globally** (`transition: all` on body or `*` is disastrous). Only add transitions to specific interactive elements.
4. **Accept that theme switch is a "pause" moment** -- users expect a brief instant of processing when actively switching themes. Optimize for <50ms total.
5. **Test theme switching specifically on the bookkeeping records page** (highest DOM complexity)

**Phase to Address:** Phase 2 (Theme Infrastructure) -- measure and optimize during theme system setup

**Performance Impact:** Well-implemented: <50ms one-time cost on switch (imperceptible). Poorly implemented (with transitions on `*`): 200-500ms with visible jank.

**Confidence:** HIGH -- CSS variable cascade performance is well-documented browser behavior. The concern is proportional to DOM size.

---

### PP-05: CSS Transition on `*` or `body` During Theme Change

**Problem:** A common "polish" attempt is to add `transition: background-color 200ms, color 200ms` to `body` or `*` so theme changes feel smooth. On an 80K LOC app with 500+ visible DOM elements, this creates 500+ simultaneous CSS transitions. The browser must interpolate colors for every element on every animation frame for 200ms, causing severe frame drops.

**Warning Signs:**
- Theme toggle causes 200ms of frozen/janky UI
- Chrome DevTools Performance shows continuous "Paint" and "Composite" events for hundreds of milliseconds after theme switch
- Smooth on small pages, terrible on data-dense pages
- CPU fans spin up during theme change

**Prevention:**
1. **Never add color transitions to `*`, `body`, or universal selectors.**
2. **If you want smooth theme transitions, use `View Transitions API`** (`document.startViewTransition()`) which renders a snapshot and crossfades -- no per-element transitions needed.
3. **Alternatively, use a brief opacity fade on `<main>` container** -- fade out, swap theme, fade in. This transitions ONE element, not 500+.
4. **If individual element transitions are desired**, apply ONLY to interactive components (buttons, cards) with explicit transition classes, NOT inherited.

**Phase to Address:** Phase 2 (Theme Infrastructure) -- establish as architectural rule

**Performance Impact:** `transition: * { color 200ms }` on 500-element page: ~200ms of continuous jank. View Transitions API or opacity fade: ~16ms (single frame). Difference: 12x.

**Confidence:** HIGH -- well-documented browser rendering principle. Each CSS transition is independently tracked by the compositor.

---

## Integration Pitfalls

---

### IP-01: Existing Scrollbar Classes Use Hardcoded Colors

**Problem:** The existing `scrollbar-thin` class in `globals.css` uses hardcoded hex values (`#4b5563`, `#1f2937`, `#6b7280`) that will not respond to theme changes. These colors were chosen for the dark theme and will look wrong on any other theme.

**Warning Signs:**
- Scrollbars remain dark gray on light/colored themes
- Visual inconsistency between scrollbar and adjacent content colors
- Users report "scrollbar looks out of place" on non-default themes

**Prevention:**
1. **Replace hardcoded hex values with CSS variable references:**
   ```css
   .scrollbar-thin {
     scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
   }
   .scrollbar-thin::-webkit-scrollbar-track {
     background: var(--scrollbar-track);
   }
   .scrollbar-thin::-webkit-scrollbar-thumb {
     background: var(--scrollbar-thumb);
   }
   ```
2. **Define `--scrollbar-thumb` and `--scrollbar-track` in each theme's variable set**
3. **Test scrollbar appearance across all preset themes** -- scrollbars are highly visible in the virtualized records list

**Phase to Address:** Phase 1 (Color Token Migration) -- part of the globals.css refactor

**Performance Impact:** None -- swapping hex values for CSS variables has identical render cost.

**Confidence:** HIGH -- directly observed in `globals.css` lines 128-154.

---

### IP-02: SSE Activity Feed Animations Compete with Theme Transition

**Problem:** The seller collection page has real-time SSE streaming with Framer Motion animations on the activity feed and progress bars. If a user switches themes while a collection is running, the theme recalculation competes with ongoing animations and SSE event processing on the main thread, potentially causing dropped events or animation glitches.

**Warning Signs:**
- SSE feed shows gaps during theme switch on collection page
- Progress bar animation stutters when theme changes
- Worker status cards briefly show incorrect state during transition
- Activity feed items appear in wrong order after theme switch

**Prevention:**
1. **Theme switch should be instant (no transitions)** to minimize main-thread contention
2. **SSE processing should use `requestIdleCallback` or microtask scheduling** to avoid blocking style recalculation
3. **Test theme switching specifically during active collection** (worst-case concurrency scenario)
4. **Consider debouncing rapid theme switches** (don't allow switching 10 themes in 1 second)

**Phase to Address:** Phase 2 (Theme Infrastructure) -- validate during integration testing

**Performance Impact:** If theme switch is instant (<16ms): negligible interference. If theme switch involves transitions (200ms+): potential SSE event loss during transition.

**Confidence:** MEDIUM -- theoretical concern based on main-thread contention. Actual impact depends on SSE event frequency during theme switch.

---

### IP-03: Layout Overhaul Breaks Virtualized List Height Calculation

**Problem:** `VirtualizedRecordsList` receives a `height` prop that determines the virtual scroll container size. The component is inside `AdminLayout` which uses `flex-1 p-8` for the main content area. If the layout overhaul changes padding, adds a navigation bar, changes the sidebar width, or modifies the flex structure, the calculated `height` value can become wrong -- causing the virtualized list to be too tall (scrollbar extends past viewport) or too short (wasted space, fewer visible rows).

**Warning Signs:**
- Virtualized table extends below the viewport fold
- Empty space appears below the table that shouldn't be there
- `height` calculation returns negative or zero values
- Scroll behavior changes after layout modifications
- ResizeObserver warnings in console

**Prevention:**
1. **Use a ResizeObserver-based hook to calculate available height dynamically**, not a static value
2. **Test layout changes with the bookkeeping records page open** (most complex virtualized view)
3. **Make virtualized container height responsive to layout changes**: if navbar height changes, table height should adjust automatically
4. **Document the height calculation chain**: viewport height -> minus navbar -> minus padding -> minus page header -> minus filter bar = table height
5. **Never use `100vh` for the container** -- it doesn't account for browser chrome on mobile or dynamic navbars

**Phase to Address:** Phase 4 (Layout Overhaul) -- critical integration concern

**Performance Impact:** Incorrect height: functional breakage (not performance). But unnecessary ResizeObserver thrashing from layout animations can cause 2-5ms per frame cost.

**Confidence:** HIGH -- `virtualized-records-list.tsx` explicitly requires a `height` prop (line 76), and `admin/layout.tsx` uses specific padding/flex rules.

---

### IP-04: Form Control Restyling Breaks Existing Validation and Accessibility

**Problem:** The app has 18 shadcn/ui components in `components/ui/`. These are built on Radix UI primitives with built-in focus management, keyboard handling, and ARIA attributes. Creating "custom form controls" that replace these components (custom selects, custom checkboxes, custom inputs) risks losing the accessibility features that come free with Radix primitives, and may break existing form validation patterns used in bookkeeping record editing, account management, and profile settings.

**Warning Signs:**
- Tab/keyboard navigation stops working on forms
- Screen readers no longer announce form field labels
- Custom select doesn't support typeahead search (native select does)
- Form submission behavior changes after component replacement
- Existing validation error display breaks

**Prevention:**
1. **Restyle shadcn/ui components, do NOT replace them.** Modify the className props and CSS variables in existing components rather than building new ones from scratch.
2. **The existing Radix primitives provide**: focus trapping in dialogs, keyboard navigation in selects/dropdowns, proper ARIA roles, typeahead in listboxes. None of this should be reimplemented.
3. **Custom styling should be additive**: change colors, padding, borders, border-radius via CSS variables. Don't change component structure.
4. **Test every restyled form with keyboard-only navigation** before shipping
5. **For truly custom controls** (e.g., branded toggle switch that looks nothing like the current checkbox), extend the existing Radix primitive with new visual layers rather than building from scratch.

**Phase to Address:** Phase 3 (Custom Components) -- establish as design constraint

**Performance Impact:** Replacing Radix with custom implementations often introduces more DOM elements and event listeners. Radix is already optimized; restyling it is zero-cost compared to reimplementing.

**Confidence:** HIGH -- the existing components use Radix (verified in `dialog.tsx`, `select.tsx`, `checkbox.tsx`).

---

### IP-05: Multiple `data-theme` Variable Sets Increase CSS Bundle Size

**Problem:** Each preset theme requires a complete set of ~40 CSS variables (background, foreground, card, primary, secondary, muted, accent, destructive, border, input, ring, chart-1 through chart-5, sidebar variants, plus any new scrollbar/custom variables). With 4 themes, that's ~160 variable declarations in the CSS bundle. While this is small in absolute terms (~3-5KB), the pattern of adding "just one more variable" to the theme system can compound if not disciplined.

**Warning Signs:**
- globals.css grows beyond 300 lines of variable declarations
- New features add variables without removing unused ones
- Different themes have different sets of variables (inconsistency)
- Theme switcher shows visual inconsistencies because some variables are missing from some themes

**Prevention:**
1. **Define a strict variable contract**: EVERY theme must define EXACTLY the same set of variables. No optional variables.
2. **Use the existing shadcn/ui variable names** (`--background`, `--foreground`, `--primary`, etc.) as the contract. Don't invent new semantic names unless absolutely necessary.
3. **Add new variables (e.g., `--scrollbar-thumb`, `--scrollbar-track`) to ALL themes simultaneously**
4. **Keep theme definitions in a single CSS file** for easy auditing
5. **Target 40-50 variables per theme maximum** -- if you need more, you're over-designing the theme system

**Phase to Address:** Phase 2 (Theme Infrastructure) -- establish variable contract

**Performance Impact:** CSS bundle size impact is minimal (4 themes x 50 variables = ~4KB uncompressed, ~1KB gzipped). The real risk is maintenance burden and visual bugs from missing variables, not performance.

**Confidence:** HIGH -- based on the existing ~40 variables in globals.css.

---

### IP-06: OKLCH Color Values and Third-Party Tool Compatibility

**Problem:** The existing CSS variables use OKLCH color space (`oklch(0.145 0 0)`), which is the modern Tailwind v4 default. While browser support is now ~92% globally, OKLCH values cause issues with: (a) older browsers, (b) PDF export libraries, (c) html2canvas/html2pdf tools, (d) Chrome DevTools color picker in some contexts, and (e) PostCSS plugins that attempt to transform CSS variables.

**Warning Signs:**
- PDF/screenshot export shows wrong colors or errors
- Colors appear as black in some browsers/contexts
- Build tools emit warnings about unrecognized color functions
- CSS DevTools shows "invalid value" for some variables

**Prevention:**
1. **Maintain OKLCH as the primary color format** -- it's the correct choice for perceptual uniformity across themes and is already in use
2. **If the app uses html2pdf or similar export tools**: provide hex/rgb fallback values or ensure export uses a headless browser that supports OKLCH
3. **Test in the app's minimum supported browser** (check analytics for oldest browser in active use)
4. **For the v3 streaming CSV/Excel export**: this is data-only and unaffected by CSS colors, so no concern there
5. **Monitor PostCSS plugin compatibility** -- the current `@tailwindcss/postcss` plugin handles OKLCH natively

**Phase to Address:** Phase 2 (Theme Infrastructure) -- note as constraint during theme definition

**Performance Impact:** None -- OKLCH parsing performance is identical to hex/rgb in modern browsers.

**Confidence:** MEDIUM -- OKLCH browser support is broadly good (92%+), but edge cases with export tools and older browsers depend on the specific user base. [Can I Use OKLCH](https://caniuse.com/?search=oklch) shows current support data.

---

## Anti-Patterns

Common approaches that seem good but cause problems in this specific context.

---

### Anti-Pattern 1: "Theme Provider That Passes Colors as Props"

**Seems good:** Create a React ThemeContext that provides `{ colors: { background: '#1a1a2e', primary: '#0f3460' } }` so components can use `style={{ backgroundColor: theme.colors.background }}`.

**Why bad in THIS app:** Every component consuming the context re-renders on theme switch. With react-window virtualized lists, this means all 50+ visible rows re-render simultaneously. With SSE feeds updating every 500ms, this means theme switch + SSE update can create a render storm.

**Do instead:** CSS variables on `:root`, swapped by changing `data-theme` attribute. Components use Tailwind classes (`bg-background`) that resolve via CSS -- zero React re-renders.

---

### Anti-Pattern 2: "JS-Based Custom Scrollbar Library"

**Seems good:** Use react-scrollbars-custom or SimpleBar for beautiful, consistent scrollbars with animations and hover effects.

**Why bad in THIS app:** react-window v2 owns the scroll container. JS scrollbar libraries intercept scroll events and wrap the container in extra DOM. This breaks virtualization measurement, infinite scroll loading, keyboard navigation (j/k), and scroll restoration that are all already implemented.

**Do instead:** CSS `scrollbar-width` + `scrollbar-color` + `::-webkit-scrollbar` pseudo-elements with theme-aware CSS variables. Accept the limited customization as a worthwhile tradeoff.

---

### Anti-Pattern 3: "Replace shadcn/ui Components with Custom Implementations"

**Seems good:** Build custom Modal, Select, and Checkbox components from scratch to match the exact Figma design spec.

**Why bad in THIS app:** The existing 18 shadcn/ui components are built on Radix UI primitives, which provide focus trapping, keyboard navigation, ARIA semantics, and portal rendering. The bookkeeping inline editing, account management forms, and profile settings all depend on this. Replacing them means reimplementing these behaviors -- and getting them wrong.

**Do instead:** Restyle the existing shadcn/ui components by modifying their className props and CSS variables. Radix primitives are headless -- they don't dictate visual appearance. Change the look, keep the behavior.

---

### Anti-Pattern 4: "Transition All Colors for Smooth Theme Switch"

**Seems good:** Add `* { transition: background-color 300ms, color 300ms, border-color 300ms; }` for a smooth, polished theme transition.

**Why bad in THIS app:** On the bookkeeping records page with 50 virtualized rows of 10+ columns = 500+ elements, this creates 1500+ simultaneous CSS transitions (3 properties x 500 elements). The browser must interpolate every color on every frame for 300ms. Combined with SSE events arriving during the transition, this overwhelms the main thread.

**Do instead:** Use `disableTransitionOnChange` from next-themes for instant switching, or use the View Transitions API (`document.startViewTransition()`) which crossfades a screenshot rather than transitioning individual elements.

---

### Anti-Pattern 5: "Theme Variables in Tailwind Config Instead of CSS"

**Seems good:** Define theme colors in `tailwind.config.ts` using the `extend` mechanism, which feels more "Tailwind-native."

**Why bad in THIS app:** The project uses Tailwind v4 with the CSS-first `@theme inline` pattern already established in `globals.css`. Moving to config-based theming would require: (a) reverting to a config file approach, (b) losing runtime CSS variable switching (config is build-time only), and (c) conflicting with shadcn/ui's CSS variable conventions. The existing approach is correct.

**Do instead:** Keep the CSS-first approach. Define all theme variables in `globals.css` under `:root` and `html[data-theme="..."]` selectors. Use `@theme inline` to register them with Tailwind.

---

## Phase-Specific Warning Summary

| Phase | Likely Pitfall | Severity | Mitigation |
|-------|---------------|----------|------------|
| **Phase 1: Color Token Migration** | CP-01 (hardcoded colors bypass themes) | CRITICAL | Audit and replace 172 occurrences across 30 files |
| **Phase 1: Color Token Migration** | IP-01 (scrollbar hardcoded colors) | HIGH | Replace hex with CSS variables in scrollbar classes |
| **Phase 1: Color Token Migration** | PP-01 (universal selector cost) | MEDIUM | Audit `* {}` impact on virtualized pages |
| **Phase 2: Theme Infrastructure** | CP-02 (FOUC on page load) | CRITICAL | Use next-themes with blocking script |
| **Phase 2: Theme Infrastructure** | CP-03 (React re-render on theme switch) | CRITICAL | CSS-only theming, no React context for colors |
| **Phase 2: Theme Infrastructure** | PP-04 (style recalculation cost) | MEDIUM | Instant switch, no transitions on variables |
| **Phase 2: Theme Infrastructure** | PP-05 (transition on * kills performance) | HIGH | Architectural rule: never transition * |
| **Phase 2: Theme Infrastructure** | IP-05 (CSS bundle variable growth) | LOW | Strict variable contract, 40-50 max |
| **Phase 2: Theme Infrastructure** | IP-06 (OKLCH compatibility) | LOW | Monitor, provide fallbacks if needed |
| **Phase 3: Custom Components** | CP-04 (scrollbar breaks virtualization) | CRITICAL | CSS-only scrollbar styling |
| **Phase 3: Custom Components** | PP-02 (backdrop-blur on modal overlay) | HIGH | No blur on full-screen overlays |
| **Phase 3: Custom Components** | PP-03 (Framer Motion main-thread) | MEDIUM | Prefer CSS transitions for new work |
| **Phase 3: Custom Components** | IP-04 (form control accessibility loss) | HIGH | Restyle, don't replace Radix primitives |
| **Phase 4: Layout Overhaul** | IP-03 (virtualized list height breaks) | HIGH | ResizeObserver-based dynamic height |
| **Phase 4: Layout Overhaul** | IP-02 (SSE + theme animation contention) | MEDIUM | Instant theme switch, test during collection |

---

## Prevention Checklist

### Before Starting (Phase 0)
- [ ] Chrome DevTools Performance baseline recorded on bookkeeping records page
- [ ] DOM element count measured on highest-complexity pages
- [ ] Current Lighthouse score recorded for reference
- [ ] Inventory of all hardcoded color classes completed

### Phase 1 Checklist (Color Token Migration)
- [ ] All `bg-gray-*`, `text-gray-*`, `border-gray-*` classes replaced with semantic tokens
- [ ] Scrollbar CSS uses CSS variables, not hex values
- [ ] Universal selector `* {}` impact profiled
- [ ] Lint rule blocks new hardcoded color classes
- [ ] Visual parity verified (app looks identical after migration)

### Phase 2 Checklist (Theme Infrastructure)
- [ ] next-themes configured with blocking script (no FOUC)
- [ ] `suppressHydrationWarning` on `<html>`
- [ ] Hardcoded `className="dark"` removed from root layout
- [ ] Theme switch triggers ZERO React component re-renders (verified with Profiler)
- [ ] `disableTransitionOnChange` enabled
- [ ] No `transition` on `*` or `body` for color properties
- [ ] All themes define identical variable sets
- [ ] Theme switch measured at <50ms on bookkeeping page

### Phase 3 Checklist (Custom Components)
- [ ] Scrollbar styling is CSS-only (no JS scrollbar library)
- [ ] react-window lists still work with custom scrollbar styles
- [ ] No `backdrop-blur` on full-screen modal overlays
- [ ] All form controls maintain keyboard navigation after restyling
- [ ] Radix primitives preserved (not replaced)
- [ ] New Framer Motion animations use `useMotionValue` where possible

### Phase 4 Checklist (Layout Overhaul)
- [ ] Virtualized list height recalculates correctly after layout changes
- [ ] ResizeObserver handles dynamic height for all viewports
- [ ] Theme switching works during active SSE streaming
- [ ] Performance profiled matches or improves baseline
- [ ] No regressions in infinite scroll, keyboard nav, or scroll restoration

---

## Sources

### Verified (HIGH confidence)
- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming) -- CSS variable architecture
- [shadcn/ui issue #327: backdrop-filter performance](https://github.com/shadcn-ui/ui/issues/327) -- confirmed backdrop-blur problem
- [shadcn/ui issue #830: overlay lag for modals](https://github.com/shadcn-ui/ui/issues/830) -- confirmed fix by removing blur
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- multi-theme support with FOUC prevention
- [Tailwind CSS PR #4850: universal selector optimization](https://github.com/tailwindlabs/tailwindcss/pull/4850) -- confirmed `*` performance issue
- [react-window issue #110: custom scrollbar integration](https://github.com/bvaughn/react-window/issues/110) -- scrollbar/virtualization conflict
- [Motion Performance Guide](https://motion.dev/docs/performance) -- CSS variable transforms not GPU-accelerated
- [Epic React: CSS Variables over Context](https://www.epicreact.dev/css-variables) -- CSS vs JS theming performance
- [Next.js Discussion #53063: dark mode with App Router](https://github.com/vercel/next.js/discussions/53063) -- FOUC prevention patterns
- [Can I Use: OKLCH support](https://caniuse.com/?search=oklch) -- browser compatibility data

### Cross-Referenced (MEDIUM confidence)
- [Evil Martians: OKLCH dynamic themes](https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic) -- OKLCH theming patterns
- [web.dev: Virtualize long lists](https://web.dev/articles/virtualize-long-lists-react-window) -- react-window best practices
- [Multi-Theme Next.js + shadcn/ui guide](https://www.vaibhavt.com/blog/multi-theme) -- implementation walkthrough
- [FOUC fix in Next.js](https://notanumber.in/blog/fixing-react-dark-mode-flickering) -- multiple FOUC prevention strategies

### Codebase Analysis (HIGH confidence)
- `globals.css`: 155 lines, OKLCH variables, universal selector, hardcoded scrollbar colors
- `layout.tsx`: hardcoded `className="dark"` on `<html>`, provider structure
- `virtualized-records-list.tsx`: react-window List with height prop, keyboard navigation, scroll restoration
- `sellers-grid.tsx`: react-window Grid with calculated cell dimensions
- `components/ui/dialog.tsx`: Radix Dialog primitive with `bg-black/80` overlay (no blur -- good)
- `components.json`: shadcn/ui new-york style, CSS variables enabled, Tailwind v4
- 30+ files with hardcoded gray color classes (172 total occurrences)

---

*Researched: 2026-01-25 | Domain: UI/Design System for existing production app | Confidence: HIGH*
