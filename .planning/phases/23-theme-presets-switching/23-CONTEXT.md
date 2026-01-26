# Phase 23: Theme Presets & Switching - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can choose from 4 distinct visual themes (Midnight, Dawn, Slate, Carbon) with a switcher UI in ProfileSettingsDialog and sidebar footer, preference persistence via localStorage, and OS preference detection. Theme switching is CSS-variable-only with zero React re-renders.

</domain>

<decisions>
## Implementation Decisions

### Theme color identity
- **Midnight** (blue-undertone dark): Deep ocean mood — rich navy blues, sophisticated and calming. Linear's dark mode is the reference.
- **Dawn** (light): Cool white — clean, crisp whites with gray accents. Vercel/Linear light mode as reference.
- **Slate** (warm gray-green dark): Claude's discretion on exact mood, positioned between Midnight and Carbon.
- **Carbon** (true-black OLED): Stark contrast — true #000000 blacks with sharp edges, minimal/brutalist. Maximum OLED battery savings.
- Each theme has a **unique accent color** (e.g., Midnight=blue, Dawn=indigo, Slate=teal, Carbon=purple — exact values at Claude's discretion)

### Switcher UI
- Theme picker in **ProfileSettingsDialog** shows **mini preview cards** — small cards showing a miniature UI mockup in each theme's colors
- Also accessible via **sidebar footer icon** that opens a **small popover** with the theme options
- Picker shows **5 options**: System (auto), Midnight, Dawn, Slate, Carbon
- "System" option follows OS preference and is labeled clearly

### Transition behavior
- **Smooth cross-fade** (~250ms) when switching themes — colors blend from old to new
- **Full page cross-fade**: backgrounds, text, borders, shadows, icons all transition together
- **Consistent duration** — same ~250ms whether switching from sidebar toggle or settings dialog
- **No flash on page load** — blocking inline script sets theme before first paint (standard next-themes behavior)

### System/default logic
- **OS mapping**: OS dark preference → Carbon, OS light preference → Dawn
- **Live reactivity**: When "System" is selected, app detects OS change via `matchMedia` listener and cross-fades in real-time
- **Explicit wins**: Once a user explicitly picks a named theme, OS preference changes are ignored until they switch back to "System"
- **Fallback**: Brand-new user with no OS preference signal defaults to **Carbon** (consistent with OS-dark mapping)

### Claude's Discretion
- Exact hex values and color palettes for all 4 themes
- Slate theme mood/personality (positioned between Midnight warmth and Carbon starkness)
- Specific accent colors per theme (unique per theme, exact hues flexible)
- Mini preview card design and layout
- Popover styling and positioning
- Exact cross-fade implementation technique (CSS transition on `<html>` color-scheme, view transitions API, etc.)

</decisions>

<specifics>
## Specific Ideas

- Midnight should feel like Linear's dark mode — deep ocean, sophisticated navy blues
- Dawn should feel like Vercel/Linear light mode — crisp, cool whites
- Carbon should be true #000000 OLED-friendly with a brutalist, minimal aesthetic
- Each theme should feel genuinely distinct, not just brightness variations
- Mini preview cards in the picker (not just color swatches) so users can see what they're choosing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-theme-presets-switching*
*Context gathered: 2026-01-25*
