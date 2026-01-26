# Phase 25: Component Color Migration - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate every component file in the application from hardcoded gray color classes to semantic tokens, making theme switching visually complete across the entire UI. Includes monospace data formatting and text hierarchy audit. Does NOT add new components, features, or interactions — those belong in Phase 26.

</domain>

<decisions>
## Implementation Decisions

### Migration Priority Order
- Claude's discretion on batch ordering — optimize for efficiency based on dependency analysis and file counts
- Claude's discretion on verification cadence — judge per-batch whether theme verification is needed before proceeding
- Auth pages (login, signup) stay fixed dark appearance — do NOT migrate to follow current theme. Auth pages always use dark theme regardless of user preference
- Migration scope: colors + obvious cleanup. Replace gray-* classes with semantic tokens AND fix obvious inconsistencies found along the way (mismatched padding, stray inline styles). Keep diffs reasonable

### Monospace Data Formatting
- ALL data values get font-mono — order IDs, monetary values, account numbers, dates, counts, percentages. Anything that's "data" vs "label"
- Monospace values get a subtle background pill (like inline code) — font change alone isn't enough, add a faint background to make data values pop in dense UIs
- Background pill is theme-aware — each theme gets its own pill color complementing its palette (Midnight=blue-tint, Dawn=warm-tint, Slate=teal-tint, Carbon=purple-tint)
- Table columns with data values use monospace for the entire column — header + all cells. "Order ID", "Amount" column headers are also mono

### Text Hierarchy Rules
- Claude's discretion on number of hierarchy levels — pick based on what the existing UI needs (2 or 3 levels)
- Claude's discretion on form label vs value weight — pick based on existing form patterns
- Status badges (active, pending, error) use theme-harmonized colors — adjust status colors per theme to feel cohesive. Carbon=deeper tones, Dawn=softer pastels. Still distinguishable but blended into the theme
- Claude's discretion on placeholder/empty-state text treatment — pick whether to add a distinct lighter level or use muted

### Edge Case Handling
- Claude's discretion on interactive state colors — pick between dedicated tokens vs opacity modifiers based on existing token system
- Claude's discretion on border token granularity — single vs subtle/strong based on existing border usage
- Charts and data visualizations are theme-aware — chart colors adapt per theme (Midnight=cool, Dawn=warm, etc.)
- Claude's discretion on third-party component overrides — judge per-component whether overriding library styles is worth the maintenance cost

### Claude's Discretion
- Migration batch ordering and verification cadence
- Text hierarchy level count (2 vs 3 levels)
- Form label subordination approach
- Placeholder text visual treatment
- Interactive state color strategy (tokens vs opacity)
- Border token granularity
- Third-party component override decisions

</decisions>

<specifics>
## Specific Ideas

- Auth pages should create a distinct "entry" feel with fixed dark appearance — common SaaS pattern
- Monospace background pill inspired by GitHub inline code styling — subtle, not heavy
- Theme-harmonized status badges: still universally readable (green=good, red=bad) but toned to fit each theme's palette rather than using vivid universal colors
- Entire data columns in tables get monospace (header included) for clean column alignment

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-component-color-migration*
*Context gathered: 2026-01-26*
