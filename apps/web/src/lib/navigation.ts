import { NavItem, SidebarSection } from "@/types/navigation"

// Dashboard nav item (above sections, always visible)
export const dashboardNavItem = (basePath: string): NavItem => ({
  href: basePath,
  label: "Dashboard",
  icon: "Home",
})

// Admin sidebar sections
export const adminSidebarSections: SidebarSection[] = [
  {
    id: "admin",
    label: "Admin",
    icon: "ShieldCheck",
    items: [
      { href: "/admin/users", label: "Users", icon: "Users" },
      // Access Profiles and Invites REMOVED — now modals on Users page
    ],
    roles: ["admin"],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: "Activity",
    items: [
      { href: "/admin/accounts", label: "Accounts", icon: "Folder" },
      { href: "/admin/order-tracking", label: "Order Tracking", icon: "BookOpen" },
    ],
    roles: ["admin", "va", "client"],
  },
  {
    id: "automation",
    label: "Automation Hub",
    icon: "Zap",
    items: [
      { href: "/admin/automation", label: "Collection", icon: "Database" },
      { href: "/admin/jobs", label: "Jobs", icon: "ListChecks" },
    ],
    roles: ["admin", "va"],
  },
]

// VA sidebar sections
export const vaSidebarSections: SidebarSection[] = [
  {
    id: "monitoring",
    label: "Monitoring",
    icon: "Activity",
    items: [
      { href: "/va/accounts", label: "Accounts", icon: "Building2" },
      { href: "/va/order-tracking", label: "Order Tracking", icon: "BookOpen" },
    ],
    roles: ["admin", "va", "client"],
  },
]

// Client sidebar sections
export const clientSidebarSections: SidebarSection[] = []

// Filtering utility
export function getVisibleSections(
  sections: SidebarSection[],
  role: "admin" | "va" | "client"
): SidebarSection[] {
  return sections
    .filter(section => section.roles.includes(role))
    .filter(section => section.items.length > 0)  // Hide empty sections
}
