# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-25)

**Core value:** Automate repetitive eBay operations so the business can scale without proportional headcount growth
**Current focus:** v4 UI/Design System - Phase 26 Polish & Micro-interactions

## Current Position

Phase: 26 of 26 (Polish & Micro-interactions)
Plan: 9 of TBD (In progress)
Status: Phase 26 in progress — polish and micro-interactions
Last activity: 2026-01-27 — Completed 26-09-PLAN.md (UAT gap closure - empty state integration)

Progress: [██████████] 98% (v4 milestone, 29 of ~30+ plans estimated)

## Shipped Milestones

- **v3 Storage & Rendering Infrastructure** (2026-01-25) - 7 phases, 23 plans
  - See: .planning/milestones/v3-ROADMAP.md

- **v2 SellerCollection** (2026-01-23) - 9 phases, 37 plans
  - See: .planning/milestones/v2-ROADMAP.md

- **v1 Extension Auth & RBAC** (2026-01-20) - 7 phases, 12 plans
  - See: .planning/milestones/v1-ROADMAP.md

## Performance Metrics

**Historical:**
- v3: 23 plans in 2 days
- v2: 37 plans in 4 days
- v1: 12 plans in 3 days

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table.

Phase 23 decisions:
- Used oklch() color space consistently across all 4 theme presets
- True #000000 black in Carbon theme for OLED battery savings with near-white text (oklch 0.97) to reduce halation
- Hardcoded hex preview colors in theme metadata for preview cards (not CSS variables)
- View Transitions API with progressive enhancement (instant fallback on unsupported browsers)
- SystemThemeMapper manipulates DOM attributes directly (not setTheme) to preserve "system" in localStorage
- Each theme has unique accent hue: Midnight=blue(250), Dawn=indigo(264), Slate=teal(175), Carbon=purple(300)

Phase 24 decisions:
- Manually created shadcn/ui components (sidebar, breadcrumb) due to Windows CLI prompt issues
- Cookie persistence for sidebar state with 7-day max age (cookie: "sidebar:state")
- Cmd+B/Ctrl+B keyboard shortcut for sidebar toggle
- Lucide icon names stored as PascalCase strings in navigation configs
- Fragment wrapper for AppSidebar to render ProfileSettingsDialog as sibling (dialog outside sidebar DOM)
- Semantic color tokens replacing hardcoded gray-* classes for theme compatibility
- Dynamic icon rendering: LucideIcons[iconName as keyof typeof LucideIcons] pattern
- PageHeader is server-compatible (no "use client") for RSC and client component use
- Made layouts "use client" components because SidebarProvider requires client context
- Placed BreadcrumbNav inside main content area rather than in sidebar

Phase 25 decisions:
- Monospace pill pattern: Data values use font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10
- Table data column headers use font-mono for visual alignment with cell data
- Strikethrough text uses text-muted-foreground/70 for theme-aware disabled appearance
- SelectContent pattern: bg-popover border-border with hover:bg-accent on items
- Status badge semantic mapping: active=bg-primary/20, offline=bg-muted, running=bg-chart-1/20, failed=bg-destructive/20, pending=bg-chart-4/20
- Worker color arrays (blue/green/purple/orange/pink/cyan) preserved as intentional per-worker distinction, not theme-dependent
- AlertDialog uses bg-card/border-border; Tooltip uses bg-popover/text-popover-foreground
- Checkbox checked state uses bg-primary/border-primary/text-primary-foreground (follows theme accent)
- Slider range/thumb uses bg-primary/border-primary (follows theme accent)
- themes.ts "gray-green" description string preserved (not a CSS class)
- Access codes use font-mono text-lg bg-primary/10 rounded-md tracking-wider pill for maximum readability
- Theme picker preview hex colors preserved (Phase 23 decision) - only structural grays migrated
- Auth pages (login/page.tsx, login-form.tsx) retain fixed dark grays with exclusion comments
- Suspended page title uses text-destructive for warning emphasis
- Conflict resolution field names use font-mono for precise comparison
- Tab navigation uses bg-primary/text-primary-foreground (not hardcoded blue-600)
- Dialog sidebars use bg-muted/50 instead of bg-gray-950 for subtlety
- Pagination/Cancel buttons use default outline variant without gray overrides
- Progress bar track uses bg-muted, container uses bg-background/border-border (fill colors kept as status colors)
- All metric values in StatCard use font-mono for tabular numeric alignment
- Category selector selected state uses bg-accent/50, hover uses bg-accent
- Simplified "Refund (No Return)" to "Refund" for status column readability
- scrollbar-thin applied to all overflow containers across bookkeeping and collection areas
- History panel quick view entries condensed; full details deferred to detail modal

Phase 26 decisions:
- All SVG illustrations use currentColor to inherit theme colors from parent Tailwind text classes
- CTA buttons appear only when handlers are provided (optional action pattern)
- FirstTimeEmpty uses configurable entityName for reuse across orders/accounts/users
- Professional messaging tone in empty states: "No results found" not "Oops!" or "Nothing here!"
- Minimalist SVG line art style (stroke-only, no fills, opacity variations for hierarchy)
- Empty state base component pattern: illustration + title + description + action slots
- SHORTCUTS array is single source of truth for all keyboard shortcuts
- Vim-style go-to sequences (g,d / g,b / g,u / g,a) for navigation shortcuts
- mod+k for command palette (cross-platform Cmd/Ctrl)
- Keywords array enhances cmdk fuzzy search (e.g., "bookkeeping" finds "Order Tracking")
- Icon names stored as PascalCase strings matching Phase 24 navigation pattern
- Kbd component uses theme semantic tokens (border-border, bg-muted, text-muted-foreground)
- Base Skeleton primitive delegates styling to skeleton-shimmer CSS class from globals.css
- Page-specific skeletons match exact structure (toolbar + table, header + metrics, header + cards)
- TableSkeleton and CardGridSkeleton accept configurable props (rows, columns, cards) for reusability
- All skeletons use animate-fade-in class for entry animation and border-border for theme compatibility
- basePath prop enables role-based route adaptation in command palette (admin/VA/client paths)
- Inner LayoutShortcuts components must be inside SidebarProvider for useSidebar context access
- Dual ProfileSettingsDialog instances: sidebar button + command palette action (only one open at a time)
- Shortcuts disabled in form inputs via enableOnFormTags: false and explicit input checks
- Vim-style navigation adapts paths based on basePath (navigateTo callback)
- All page root wrappers use animate-fade-in for 300ms fade-in entry animation
- Suspense fallbacks use skeleton components instead of plain text
- Inline loading states use skeleton components instead of plain text
- FirstTimeEmpty for all empty data scenarios (not just 'first time' but also no-results and no-selection states)
- Custom description override for context-specific messaging (VA account assignment, agent pairing, account selection)
- Empty state integration pattern: import FirstTimeEmpty, replace plain text with <FirstTimeEmpty entityName='...' />

### Pending Todos

None.

### Blockers/Concerns

**v4 constraint:** Performance-neutral minimum, performance-positive preferred. All UI changes must use CSS-first approach to avoid compute overhead.
**v4 constraint:** Theme switching must trigger ZERO React re-renders -- CSS variable cascade only.
**v4 constraint:** No CSS-in-JS, no JS scrollbar libraries. Scrollbar styling must be CSS-only to preserve react-window virtualization.

## Session Continuity

Last session: 2026-01-27
Stopped at: Completed 26-09-PLAN.md (UAT gap closure - empty state integration) — Integrated FirstTimeEmpty component into all 7 table/list components (admin, automation, bookkeeping)
Resume file: None
Next action: Continue Phase 26 polish and micro-interactions
