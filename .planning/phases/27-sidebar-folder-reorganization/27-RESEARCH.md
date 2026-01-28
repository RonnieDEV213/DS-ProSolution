# Phase 27: Sidebar Folder Reorganization - Research

**Researched:** 2026-01-27
**Domain:** React sidebar navigation with collapsible sections, cookie-based state persistence, modal consolidation
**Confidence:** HIGH

## Summary

Phase 27 reorganizes DS-ProSolution's flat sidebar navigation into 3 collapsible sections (Admin, Monitoring, Automation Hub) with role-based visibility. The phase also consolidates Access Profiles, Invites, and Pairing Request into modals, and moves Agents into expandable rows within the Accounts table.

The codebase already has all necessary primitives in place from Phase 24:
- Radix UI Collapsible v1.1.12 is installed
- shadcn/ui sidebar primitives (SidebarGroup, SidebarGroupLabel, SidebarGroupContent) exist but are unused
- Cookie-based persistence pattern is established (sidebar:state cookie with 7-day max age)
- Dialog/modal pattern is well-established across the codebase
- Dynamic icon rendering pattern using Lucide icons is in place

The standard approach uses Radix UI Collapsible for independent section toggling (non-accordion), with per-section cookie persistence matching the existing sidebar:state pattern. Navigation config restructuring from flat arrays to grouped structures is straightforward TypeScript refactoring.

**Primary recommendation:** Use existing shadcn/ui sidebar primitives with Radix UI Collapsible, persist section state via cookies with section-specific keys (sidebar:section:admin, sidebar:section:monitoring, sidebar:section:automation), and consolidate pages into modals using established Dialog patterns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-collapsible | 1.1.12 | Collapsible sections | Already installed, WAI-ARIA compliant, 1992+ npm projects use it |
| shadcn/ui sidebar | Present | Sidebar primitives | SidebarGroup/Label/Content components already in codebase (unused) |
| next/navigation | Next.js 16.1.1 | usePathname for active state | Native Next.js navigation |
| lucide-react | 0.562.0 | Icons | Already used for all sidebar icons (PascalCase pattern) |
| Framer Motion | 12.25.0 | Animations (optional) | Already in codebase for micro-interactions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | 1.1.15 | Modal consolidation | Access Profiles, Invites, Pairing Request modals |
| next-themes | 0.4.6 | Theme context (passive) | No changes needed, existing integration |
| React useState | 19.2.3 | Section collapse state | Per-section open/closed tracking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Collapsible | @radix-ui/react-accordion | Accordion forces single-open sections; requirement specifies independent toggling |
| Cookie persistence | localStorage | Cookies work SSR+CSR, localStorage is client-only and causes hydration mismatches |
| Dynamic icon rendering | Static imports | Current pattern (LucideIcons[iconName]) enables config-driven navigation |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
# Collapsible component can be added via shadcn CLI if desired:
# npx shadcn@latest add collapsible
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── lib/
│   └── navigation.ts              # Restructure from flat arrays to grouped sections
├── types/
│   └── navigation.ts              # Add SidebarSection type alongside NavItem
├── components/
│   ├── layout/
│   │   └── app-sidebar.tsx        # Refactor to use SidebarGroup + Collapsible
│   └── admin/
│       ├── access-profiles-modal.tsx   # New modal for Access Profiles
│       ├── invites-modal.tsx           # New modal for Invites
│       └── pairing-request-modal.tsx   # New modal for Pairing Request
└── app/
    └── admin/
        ├── department-roles/      # DELETE - consolidate into Users modal
        ├── invites/               # DELETE - consolidate into Users modal
        └── users/page.tsx         # Add toolbar buttons for modals
```

### Pattern 1: Collapsible Sidebar Sections (Independent Toggling)

**What:** Each section (Admin, Monitoring, Automation Hub) can be expanded/collapsed independently using Radix UI Collapsible with cookie persistence.

**When to use:** Navigation sections that should allow multiple simultaneous open states (not accordion behavior).

**Example:**
```typescript
// Source: Radix UI Collapsible Official Docs + Phase 24 cookie pattern
// https://www.radix-ui.com/primitives/docs/components/collapsible

import * as Collapsible from "@radix-ui/react-collapsible"
import { ChevronDown } from "lucide-react"
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar"

function SidebarSection({ section, items }: { section: string, items: NavItem[] }) {
  const [open, setOpen] = useState(() => {
    // Read from cookie on mount (SSR-safe)
    if (typeof document !== "undefined") {
      const match = document.cookie.match(
        new RegExp(`(?:^|; )sidebar:section:${section}=([^;]*)`)
      )
      return match ? match[1] === "true" : true // Default open
    }
    return true
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    // Persist to cookie (7-day max age matches sidebar:state pattern)
    document.cookie = `sidebar:section:${section}=${nextOpen}; path=/; max-age=${60 * 60 * 24 * 7}`
  }

  return (
    <Collapsible.Root open={open} onOpenChange={handleOpenChange}>
      <SidebarGroup>
        <Collapsible.Trigger asChild>
          <SidebarGroupLabel className="cursor-pointer group/trigger">
            <span>{section}</span>
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/trigger:rotate-180" />
          </SidebarGroupLabel>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.href}>
                  {/* Nav item rendering */}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </Collapsible.Content>
      </SidebarGroup>
    </Collapsible.Root>
  )
}
```

### Pattern 2: Navigation Config Restructuring (Flat to Grouped)

**What:** Transform flat NavItem arrays into grouped section structures with metadata.

**When to use:** Converting linear navigation lists into hierarchical sections with role-based visibility.

**Example:**
```typescript
// Source: Phase 24 navigation.ts + Phase 27 requirements

// BEFORE (Phase 24 - flat)
export const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "Home" },
  { href: "/admin/users", label: "Users", icon: "Users" },
  { href: "/admin/department-roles", label: "Access Profiles", icon: "Shield" },
  { href: "/admin/accounts", label: "Accounts", icon: "Folder" },
  // ...
]

// AFTER (Phase 27 - grouped)
export interface SidebarSection {
  id: string                    // For cookie persistence key
  label: string                 // Display name
  icon?: string                 // Optional section icon
  items: NavItem[]              // NavItem array unchanged
  roles: ("admin" | "va" | "client")[]  // Role visibility
}

export const adminSidebarSections: SidebarSection[] = [
  // Dashboard stays top-level, outside sections
  {
    id: "admin",
    label: "Admin",
    items: [
      { href: "/admin/users", label: "Users", icon: "Users" },
      // Access Profiles + Invites REMOVED (now modals)
    ],
    roles: ["admin"],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    items: [
      { href: "/admin/accounts", label: "Accounts", icon: "Folder" },
      { href: "/admin/order-tracking", label: "Order Tracking", icon: "BookOpen" },
    ],
    roles: ["admin", "va", "client"],
  },
  {
    id: "automation",
    label: "Automation Hub",  // Renamed from Extension Hub
    items: [
      { href: "/admin/automation", label: "Collection", icon: "Zap" },
      // Jobs future item
    ],
    roles: ["admin", "va"],
  },
]

// Top-level dashboard nav item (rendered above sections)
export const dashboardNavItem: NavItem = {
  href: "/admin",
  label: "Dashboard",
  icon: "Home"
}
```

### Pattern 3: Modal Consolidation via Toolbar Buttons

**What:** Convert standalone pages (Access Profiles, Invites, Pairing Request) into modals triggered from toolbar buttons on parent pages.

**When to use:** Reducing sidebar clutter by consolidating related admin functions into parent page toolbars.

**Example:**
```typescript
// Source: Existing modal patterns from run-config-modal.tsx, profile-settings-dialog.tsx

// apps/web/src/app/admin/users/page.tsx
export default function AdminUsersPage() {
  const [accessProfilesOpen, setAccessProfilesOpen] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Manage Users"
        description="View and manage user accounts"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAccessProfilesOpen(true)}>
              <Shield className="mr-2 h-4 w-4" />
              Access Profiles
            </Button>
            <Button variant="outline" onClick={() => setInvitesOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invites
            </Button>
          </div>
        }
      />

      <UsersTable {...props} />

      <AccessProfilesModal
        open={accessProfilesOpen}
        onOpenChange={setAccessProfilesOpen}
      />
      <InvitesModal
        open={invitesOpen}
        onOpenChange={setInvitesOpen}
      />
    </div>
  )
}

// apps/web/src/components/admin/access-profiles-modal.tsx
export function AccessProfilesModal({ open, onOpenChange }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Access Profiles</DialogTitle>
          <DialogDescription>
            Create and manage access profiles for VAs
          </DialogDescription>
        </DialogHeader>
        {/* Embed DepartmentRolesTable from department-roles/page.tsx */}
        <DepartmentRolesTable orgId={orgId} {...props} />
      </DialogContent>
    </Dialog>
  )
}
```

### Pattern 4: Role-Based Section Visibility

**What:** Filter sidebar sections based on user role, hiding empty sections entirely.

**When to use:** Multi-role navigation where different user types see different sections.

**Example:**
```typescript
// Source: Existing role patterns from useUserRole hook + Phase 24 navigation

function AppSidebar({ role }: { role: "admin" | "va" | "client" }) {
  const visibleSections = adminSidebarSections.filter(section =>
    section.roles.includes(role)
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{/* ... */}</SidebarHeader>
      <SidebarContent className="p-2">
        {/* Dashboard always visible above sections */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === dashboardNavItem.href}>
              <Link href={dashboardNavItem.href}>
                <Icon />
                <span>{dashboardNavItem.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Collapsible sections */}
        {visibleSections.map(section => (
          <SidebarSection key={section.id} section={section} />
        ))}
      </SidebarContent>
      <SidebarFooter>{/* ... */}</SidebarFooter>
    </Sidebar>
  )
}
```

### Anti-Patterns to Avoid

- **Using Accordion instead of independent Collapsible:** Phase 27 explicitly requires sections to open/close independently (all 3 can be open), which Accordion doesn't support (single-open constraint).
- **LocalStorage for section state:** Use cookies to match existing sidebar:state pattern and enable SSR hydration without flash.
- **Nesting Collapsible inside Collapsible:** Keep section collapsing separate from item sub-navigation. Use SidebarMenuSub for hierarchical nav items within sections.
- **Hardcoding section open state:** Always persist to cookies so state survives page navigation and browser restart (7-day max age).
- **Breaking Phase 24 patterns:** Maintain Lucide PascalCase icon names, Fragment wrapper for ProfileSettingsDialog, "use client" layouts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible animation | Custom height transitions | Radix Collapsible CSS variables | Radix provides `--radix-collapsible-content-height` for smooth animations, handles edge cases (dynamic content, nested elements) |
| Cookie parsing/setting | String manipulation utilities | Existing sidebar.tsx cookie pattern | Pattern already proven in SidebarProvider (lines 65-89), handles SSR/hydration correctly |
| Section state management | Redux/Zustand store | React useState + cookies | Over-engineering for simple open/closed state; cookies persist across sessions |
| Icon rendering | Switch statements per icon | Phase 24 dynamic pattern | `LucideIcons[iconName as keyof typeof LucideIcons]` already works for all icons |
| Role-based filtering | Runtime permission checks | Array.filter on section.roles | Simple, declarative, no external auth calls needed |

**Key insight:** DS-ProSolution's Phase 24 foundation provides mature patterns for all Phase 27 requirements. Don't reinvent — refactor existing components to use unused primitives (SidebarGroup/Label/Content) and extend proven patterns (cookie persistence, dynamic icons, modal dialogs).

## Common Pitfalls

### Pitfall 1: Accordion vs Independent Collapsible Confusion

**What goes wrong:** Using `@radix-ui/react-accordion` instead of `@radix-ui/react-collapsible`, forcing only one section open at a time.

**Why it happens:** Accordion and Collapsible are similar Radix primitives. Developers default to Accordion for grouped expandable content.

**How to avoid:**
- Phase 27 requirement explicitly states "sections open/close independently (not accordion)"
- Use `Collapsible.Root` with separate state per section, not `Accordion` with `type="single"`
- Test: expand all 3 sections simultaneously — should stay open

**Warning signs:**
- Only one section expands when clicking triggers
- Opening a section auto-closes another
- User frustration having to re-expand sections repeatedly

### Pitfall 2: Cookie Hydration Mismatch

**What goes wrong:** Section open state flickers or resets on page load due to server/client cookie mismatch.

**Why it happens:** Reading cookies client-side after hydration causes SSR HTML to render differently than initial client state.

**How to avoid:**
- Read cookies synchronously in useState initializer (runs once before hydration)
- Pattern from sidebar.tsx lines 65-75: `useState(() => { if (typeof document !== "undefined") { /* read cookie */ } })`
- Never read cookies in useEffect for initial state (too late, causes flash)

**Warning signs:**
- Sections collapse briefly on page load then expand
- Console warnings about hydration mismatch
- Different states between server HTML and client render

### Pitfall 3: Breaking Active State Detection

**What goes wrong:** Current page doesn't highlight after sidebar restructuring; all nav items appear inactive.

**Why it happens:** AppSidebar's `isItemActive` function expects flat navItems array, breaks when items move into sections.

**How to avoid:**
- Maintain same NavItem structure inside SidebarSection.items
- Pass pathname to nested SidebarSection components
- Test active state detection for: dashboard, top-level pages, nested pages (e.g., /admin/users/[id])

**Warning signs:**
- No nav items have active styling
- Active item is in wrong section
- Active styling persists on multiple items

### Pitfall 4: Modal State Leakage Between Consolidations

**What goes wrong:** Opening Access Profiles modal after closing Invites modal shows stale data or wrong tab.

**Why it happens:** Modals share state in parent component without reset on close.

**How to avoid:**
- Each modal manages internal state independently (separate components)
- Reset local state in modal's onOpenChange when closing: `if (!open) { resetState() }`
- Use refreshTrigger pattern from existing pages to force data refetch

**Warning signs:**
- Modal opens with previous modal's filter/search applied
- Data doesn't refresh when reopening modal
- Wrong tab selected in multi-tab modals

### Pitfall 5: Icon String References Breaking After Refactor

**What goes wrong:** Nav item icons fail to render (blank space where icon should be) after moving items between sections.

**Why it happens:** Icon name typos or non-PascalCase strings in refactored navigation config.

**How to avoid:**
- Keep existing icon string values unchanged when moving items: "Home", "Users", "Folder", "BookOpen", "Zap"
- Maintain Phase 24 pattern: `LucideIcons[item.icon as keyof typeof LucideIcons]`
- Validate: all icon strings exist in lucide-react exports

**Warning signs:**
- Nav items render without icons (just text labels)
- Console errors: "undefined is not a function" when rendering icons
- TypeScript errors on icon name type assertions

## Code Examples

Verified patterns from official sources:

### Radix Collapsible with Cookie Persistence
```typescript
// Source: Radix UI Collapsible docs + sidebar.tsx cookie pattern (lines 65-89)
// https://www.radix-ui.com/primitives/docs/components/collapsible

import * as Collapsible from "@radix-ui/react-collapsible"

const SIDEBAR_SECTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function useSectionState(sectionId: string, defaultOpen = true) {
  const [open, setOpen] = useState(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(
        new RegExp(`(?:^|; )sidebar:section:${sectionId}=([^;]*)`)
      )
      return match ? match[1] === "true" : defaultOpen
    }
    return defaultOpen
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    document.cookie = `sidebar:section:${sectionId}=${nextOpen}; path=/; max-age=${SIDEBAR_SECTION_COOKIE_MAX_AGE}`
  }

  return [open, handleOpenChange] as const
}

function CollapsibleSection({ id, label, items }: SidebarSection) {
  const [open, setOpen] = useSectionState(id)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <SidebarGroup>
        <Collapsible.Trigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            {label}
          </SidebarGroupLabel>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarGroupContent>
            {/* Nav items */}
          </SidebarGroupContent>
        </Collapsible.Content>
      </SidebarGroup>
    </Collapsible.Root>
  )
}
```

### Grouped Navigation Config with Role Filtering
```typescript
// Source: Phase 24 navigation.ts + Phase 27 section requirements

import { NavItem } from "@/types/navigation"

export interface SidebarSection {
  id: string                              // Cookie key: sidebar:section:{id}
  label: string                           // Display name
  icon?: string                           // Optional section icon
  items: NavItem[]                        // Existing NavItem type
  roles: ("admin" | "va" | "client")[]   // Which roles see this section
}

export const dashboardNavItem: NavItem = {
  href: "/admin",
  label: "Dashboard",
  icon: "Home",
}

export const adminSidebarSections: SidebarSection[] = [
  {
    id: "admin",
    label: "Admin",
    items: [
      { href: "/admin/users", label: "Users", icon: "Users" },
    ],
    roles: ["admin"],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    items: [
      { href: "/admin/accounts", label: "Accounts", icon: "Folder" },
      { href: "/admin/order-tracking", label: "Order Tracking", icon: "BookOpen" },
    ],
    roles: ["admin", "va", "client"],
  },
  {
    id: "automation",
    label: "Automation Hub",
    items: [
      { href: "/admin/automation", label: "Collection", icon: "Zap" },
    ],
    roles: ["admin", "va"],
  },
]

// Role-based filtering
export function getVisibleSections(
  sections: SidebarSection[],
  role: "admin" | "va" | "client"
): SidebarSection[] {
  return sections.filter(section => section.roles.includes(role))
}
```

### Modal Consolidation Pattern
```typescript
// Source: Existing modals (run-config-modal.tsx, profile-settings-dialog.tsx)

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Shield, UserPlus } from "lucide-react"

// Page with toolbar buttons
export default function AdminUsersPage() {
  const [accessProfilesOpen, setAccessProfilesOpen] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Manage Users"
        description="View and manage user accounts"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAccessProfilesOpen(true)}>
              <Shield className="mr-2 h-4 w-4" />
              Access Profiles
            </Button>
            <Button variant="outline" onClick={() => setInvitesOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invites
            </Button>
          </div>
        }
      />

      <UsersTable refreshTrigger={refreshTrigger} />

      <AccessProfilesModal
        open={accessProfilesOpen}
        onOpenChange={setAccessProfilesOpen}
        onRoleUpdated={() => setRefreshTrigger(n => n + 1)}
      />
      <InvitesModal
        open={invitesOpen}
        onOpenChange={setInvitesOpen}
        onInviteCreated={() => setRefreshTrigger(n => n + 1)}
      />
    </div>
  )
}

// Modal wrapper for existing page content
interface AccessProfilesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRoleUpdated: () => void
}

export function AccessProfilesModal({ open, onOpenChange, onRoleUpdated }: AccessProfilesModalProps) {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Fetch orgId when modal opens (same logic as page)
  useEffect(() => {
    if (open) {
      const fetchOrgId = async () => {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setOrgId(DEFAULT_ORG_ID)
        }
      }
      fetchOrgId()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access Profiles</DialogTitle>
          <DialogDescription>
            Create and manage access profiles for VAs. Each profile can have specific permissions.
          </DialogDescription>
        </DialogHeader>

        {orgId ? (
          <DepartmentRolesTable
            orgId={orgId}
            refreshTrigger={refreshTrigger}
            onRoleUpdated={() => {
              setRefreshTrigger(n => n + 1)
              onRoleUpdated()
            }}
          />
        ) : (
          <TableSkeleton columns={6} rows={5} />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

### Expandable Table Rows Pattern
```typescript
// Source: agents-table.tsx lines 60-90 (existing expandable row implementation)

import { ChevronDown, ChevronRight } from "lucide-react"

export function AccountsTable() {
  const [expandedAccountIds, setExpandedAccountIds] = useState<Set<string>>(new Set())

  const toggleAccount = (accountId: string) => {
    setExpandedAccountIds(prev => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  return (
    <Table>
      <TableBody>
        {accounts.map(account => {
          const isExpanded = expandedAccountIds.has(account.id)
          const accountAgents = agents.filter(agent => agent.account_id === account.id)

          return (
            <Fragment key={account.id}>
              {/* Main account row with expand trigger */}
              <TableRow className="cursor-pointer" onClick={() => toggleAccount(account.id)}>
                <TableCell>
                  {accountAgents.length > 0 ? (
                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  ) : null}
                </TableCell>
                <TableCell>{account.account_code}</TableCell>
                <TableCell>{account.name}</TableCell>
                {/* ... */}
              </TableRow>

              {/* Expanded agent rows (nested within account) */}
              {isExpanded && accountAgents.map(agent => (
                <TableRow key={agent.id} className="bg-muted/30">
                  <TableCell></TableCell>
                  <TableCell className="pl-8">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{agent.label || agent.agent_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>{/* agent details */}</TableCell>
                  {/* ... */}
                </TableRow>
              ))}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat sidebar navigation | Grouped/sectioned navigation | 2023-2024 (shadcn/ui evolution) | Reduces visual clutter, enables role-based progressive disclosure |
| LocalStorage for state | Cookie-based persistence | Next.js 13+ App Router | SSR compatibility, no hydration flash |
| Accordion sections (single-open) | Independent Collapsible | Radix UI v1.0+ | User flexibility, maintain context across sections |
| Standalone admin pages | Modal consolidation | Modern SaaS patterns (2024-2025) | Fewer route changes, faster workflows |
| Static icon imports | Dynamic icon rendering | Phase 24 (2026-01-26) | Config-driven navigation, easier maintenance |

**Deprecated/outdated:**
- Accordion for multi-section navigation: Modern UX prefers independent section toggling (Slack, Linear, Notion patterns)
- LocalStorage for sidebar state: Next.js App Router SSR requires cookie-based persistence to avoid hydration mismatches
- Separate pages for every admin action: Modal consolidation reduces route complexity and speeds up workflows

## Open Questions

Things that couldn't be fully resolved:

1. **Sync Status Placement in Profile Settings**
   - What we know: Phase 27 moves sync status from sidebar footer to Profile Settings General tab
   - What's unclear: Exact placement within General tab (above/below profile fields, as separate section)
   - Recommendation: Place as final section in General tab with "Sync Status" heading, showing last sync time + manual trigger button

2. **Jobs Page Visibility in Automation Hub**
   - What we know: Jobs is listed in Automation Hub section but "still in development" (deferred)
   - What's unclear: Should nav item be hidden or disabled? When will it be enabled?
   - Recommendation: Comment out Jobs nav item in sidebar config, uncomment when page is ready (prevents broken links)

3. **Client Role Monitoring Access Scope**
   - What we know: Clients see Monitoring section (read-only), but specific page access unclear
   - What's unclear: Do clients see both Accounts + Order Tracking, or just one? Read-only means what exactly?
   - Recommendation: Show both pages, disable edit/delete buttons, hide admin-only columns (e.g., client assignments)

4. **Empty Section Visibility**
   - What we know: Sections with no permitted pages should be hidden
   - What's unclear: Hide empty sections before or after section state loads from cookies?
   - Recommendation: Filter sections first (role-based visibility), then render with cookie state — avoids rendering hidden sections

## Sources

### Primary (HIGH confidence)
- [Radix UI Collapsible Official Docs](https://www.radix-ui.com/primitives/docs/components/collapsible) - Complete API reference, data attributes, CSS variables
- [shadcn/ui Collapsible Component](https://ui.shadcn.com/docs/components/collapsible) - Implementation patterns and usage examples
- [Next.js Cookies Documentation](https://nextjs.org/docs/app/api-reference/functions/cookies) - Official cookie handling in App Router
- Codebase Phase 24 artifacts:
  - apps/web/src/components/ui/sidebar.tsx (lines 13-14, 65-89) - Cookie persistence pattern
  - apps/web/src/lib/navigation.ts - Current flat navigation config
  - apps/web/src/components/layout/app-sidebar.tsx - Icon rendering pattern (line 74)
  - apps/web/src/components/admin/automation/agents-table.tsx (lines 60-90) - Expandable row pattern

### Secondary (MEDIUM confidence)
- [React & Next.js Best Practices in 2026](https://fabwebstudio.com/blog/react-nextjs-best-practices-2026-performance-scale) - WebSearch verified with Next.js docs
- [Implementing Robust Cookie Management for Next.js Applications](https://www.wisp.blog/blog/implementing-robust-cookie-management-for-nextjs-applications) - Cookie security and best practices

### Tertiary (LOW confidence)
- Medium articles on cookie persistence - General patterns, not Next.js-specific
- Community discussions on sidebar UX - Not authoritative for Phase 27 decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use, official docs referenced
- Architecture: HIGH - Patterns verified in existing codebase (Phase 24, modal implementations)
- Pitfalls: MEDIUM-HIGH - Based on common React/Next.js issues and Radix UI patterns, not all tested in this codebase

**Research date:** 2026-01-27
**Valid until:** ~30 days (stable dependencies, mature patterns)
