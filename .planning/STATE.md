# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-25)

**Core value:** Automate repetitive eBay operations so the business can scale without proportional headcount growth
**Current focus:** Phase 28 — Collection Storage & Rendering Infrastructure

## Current Position

Phase: 28 of 28 (Collection Storage & Rendering Infrastructure)
Plan: 4 of 6 in progress
Status: In progress
Last activity: 2026-01-27 — Completed 28-04-PLAN.md

Progress: [████████░░] 80% (Phase 28, 4/6 plans complete)

## Shipped Milestones

- **v4 UI/Design System** (2026-01-27) - 6 phases, 36 plans
  - See: .planning/milestones/v4-ROADMAP.md

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
- Card shadow elevation: shadow-md → shadow-lg for clearly visible hover feedback
- Command palette scrollbar uses global scrollbar-thin class for theme consistency
- Ctrl+K toggle pattern (prev => !prev) allows keyboard-only users to close palette
- Vim shortcuts respect role boundaries: G+A and G+B blocked for client role
- Shortcuts modal uses bg-popover + text-xs uppercase headers to match command palette dialog
- All command-style dialogs use bg-popover with overflow-hidden p-0 pattern
- Group headers in command contexts use text-xs font-medium uppercase tracking-wider
- Keyboard shortcuts must check basePath for role-based navigation filtering

Phase 27 decisions:
- Sync status placed in Profile Settings Profile tab instead of persistent sidebar footer
- SyncStatusSection uses direct useSyncStatus hook (not useSidebar like SyncStatusIndicator)
- Border-top divider separates sync status from profile information
- Settings sections use border-t pt-6 mt-6 for visual separation
- Extension Hub renamed to Automation Hub in navigation sections
- Access Profiles and Invites removed from sidebar navigation (now modals on Users page)
- Dashboard nav item separated from sections (always visible above groups)
- Empty sections automatically hidden by getVisibleSections utility
- Deprecated flat exports maintained for backward compatibility until Plan 05
- SidebarSection pattern: grouping nav items with id, label, icon, items, roles
- Role-based filtering: sections declare which roles can see them
- Modal consolidation pattern: Toolbar buttons open Dialog wrappers around existing page content
- Modal sizing: max-w-5xl for tables, max-w-4xl for lists, max-h-[80vh] for scrolling
- Modal changes trigger parent table refresh via callback for immediate UI feedback
- Pairing Request button visible only to admin users via useUserRole hook
- Agents fetched separately and grouped by account_id client-side for expandable rows
- Expandable rows with Fragment wrapper for account + agent rows
- Chevron icons only shown when account has linked agents
- Event stopPropagation on edit button prevents row expansion toggle
- Command palette "Extension Hub" renamed to "Collection" to reflect Collections tab focus
- Breadcrumb and page titles use "Automation Hub" as the full descriptive name
- Access Profiles and Invites removed from command palette (modal-only UI)
- PageHeader component preferred over manual title/description markup for consistency
- Collapsible sections use Radix Collapsible (not accordion) for independent toggle behavior
- Section state persisted via cookies (sidebar:section:{id}) with 7-day max age
- Dashboard rendered as top-level SidebarMenuItem above all collapsible sections
- Theme picker and sync status removed from sidebar footer (moved to Profile Settings)
- Sidebar footer now contains only Profile Settings button + Collapse toggle
- VA without access profile shows empty sections array (only Dashboard visible)

Phase 28 decisions:
- sellerApi is a separate exported object, not merged into existing api object
- getAccessToken exported as named function (was file-scoped) for downstream imports
- Conflict detection guarded by mutation.table === 'records' (sellers use last-write-wins)
- Seller update dispatch checks 'flagged' in data before 'name' for flag toggle routing
- accounts case added as no-op stub in executeMutation for type exhaustiveness
- Seller export uses org_id scope (not account_id) since sellers are org-wide
- Seller export excludes internal columns (id, org_id, run IDs, updated_at, deleted_at)
- Permission gated by seller_collection.read to match sync endpoint pattern
- Cursor pagination on (created_at DESC, id DESC) for deterministic export ordering
- No TanStack Query cache manipulation in seller mutations (useLiveQuery is reactive to IndexedDB)
- No pagination at useSyncSellers hook level (react-window handles rendering performance)
- Dexie boolean index queried with equals(1) for true with fallback to in-memory filter
- useDeleteSeller accepts array of IDs for bulk delete support
- SCHEMA_VERSION bumped from 2 to 3 for collection_runs table (triggers one-time data wipe + resync)
- syncCollectionRuns uses /collection/runs/history endpoint (no dedicated sync endpoint)
- history-panel.tsx keeps server fetch for audit logs while using IndexedDB for runs
- useCollectionPolling return shape unchanged (backward compatible with CollectionProgressProvider)
- setSellers kept as no-op shim for incremental migration (Plan 05 removes)
- totalCount from useSyncSellers used for empty-state distinction (not sellers.length)
- Export functions use updated_at instead of created_at (SellerRecord schema)
- useDebouncedValue hook created as generic utility for 300ms search debounce

### Pending Todos

None.

### Blockers/Concerns

**v4 constraint:** Performance-neutral minimum, performance-positive preferred. All UI changes must use CSS-first approach to avoid compute overhead.
**v4 constraint:** Theme switching must trigger ZERO React re-renders -- CSS variable cascade only.
**v4 constraint:** No CSS-in-JS, no JS scrollbar libraries. Scrollbar styling must be CSS-only to preserve react-window virtualization.

## Session Continuity

Last session: 2026-01-27
Stopped at: Completed 28-04-PLAN.md
Resume file: None
Next action: Execute 28-05-PLAN.md (mutation migration)

### Roadmap Evolution

- Phase 27 added: Sidebar Folder Reorganization — reorganize sidebar into 3 collapsible folder groups with dropdown page tabs, enforce consistency for skeletons/SVGs/empty states across all pages
- Phase 28 added: Collection Storage & Rendering Infrastructure — bring v3 bookkeeping infrastructure (cursor pagination, TanStack Query, IndexedDB persistence, incremental sync, virtualized rendering, streaming export) to collection feature
