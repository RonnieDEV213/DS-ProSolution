import type { LucideIcon } from "lucide-react"

export interface CommandItemDef {
  id: string
  label: string
  icon: string          // Lucide icon name (PascalCase, matches navigation.ts pattern)
  shortcut?: string[]   // Display shortcut keys
  group: "navigation" | "actions" | "admin"
  href?: string         // For navigation items
  action?: string       // Action identifier for non-navigation items
  keywords?: string[]   // Extra search keywords for cmdk fuzzy search
  adminOnly?: boolean   // Only show for admin users
}

export const navigationItems: CommandItemDef[] = [
  {
    id: "nav-dashboard",
    label: "Dashboard",
    icon: "Home",
    shortcut: ["G", "D"],
    group: "navigation",
    href: "/admin",
    keywords: ["home", "overview"],
  },
  {
    id: "nav-users",
    label: "Users",
    icon: "Users",
    shortcut: ["G", "U"],
    group: "navigation",
    href: "/admin/users",
    keywords: ["members", "team"],
    adminOnly: true,
  },
  {
    id: "nav-accounts",
    label: "Accounts",
    icon: "Folder",
    shortcut: ["G", "A"],
    group: "navigation",
    href: "/admin/accounts",
    keywords: ["ebay", "manage"],
  },
  {
    id: "nav-order-tracking",
    label: "Order Tracking",
    icon: "BookOpen",
    shortcut: ["G", "B"],
    group: "navigation",
    href: "/admin/order-tracking",
    keywords: ["bookkeeping", "orders", "records"],
  },
  {
    id: "nav-automation",
    label: "Collection",
    icon: "Zap",
    group: "navigation",
    href: "/admin/automation",
    keywords: ["automation", "collection", "chrome", "extension", "sellers"],
    adminOnly: true,
  },
]

export const actionItems: CommandItemDef[] = [
  {
    id: "action-toggle-sidebar",
    label: "Toggle Sidebar",
    icon: "PanelLeft",
    shortcut: ["\u2318", "B"],
    group: "actions",
    action: "toggle-sidebar",
    keywords: ["collapse", "expand", "menu"],
  },
  {
    id: "action-theme",
    label: "Change Theme",
    icon: "Palette",
    group: "actions",
    action: "open-theme",
    keywords: ["dark", "light", "mode", "color"],
  },
  {
    id: "action-settings",
    label: "Profile Settings",
    icon: "Settings",
    group: "actions",
    action: "open-settings",
    keywords: ["profile", "account", "preferences"],
  },
]
