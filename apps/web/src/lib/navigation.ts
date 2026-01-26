import { NavItem } from "@/types/navigation"

export const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "Home" },
  { href: "/admin/users", label: "Users", icon: "Users" },
  { href: "/admin/department-roles", label: "Access Profiles", icon: "Shield" },
  { href: "/admin/accounts", label: "Accounts", icon: "Folder" },
  { href: "/admin/invites", label: "Invites", icon: "UserPlus" },
  { href: "/admin/order-tracking", label: "Order Tracking", icon: "BookOpen" },
  { href: "/admin/automation", label: "Extension Hub", icon: "Zap" },
]

export const vaNavItems: NavItem[] = [
  { href: "/va", label: "Dashboard", icon: "Home" },
  { href: "/va/accounts", label: "Accounts", icon: "Building2" },
  { href: "/va/order-tracking", label: "Order Tracking", icon: "BookOpen" },
]

export const clientNavItems: NavItem[] = [
  { href: "/client", label: "Dashboard", icon: "Home" },
]
