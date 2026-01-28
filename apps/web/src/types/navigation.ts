export interface NavItem {
  href: string
  label: string
  icon: string  // Lucide React icon name (PascalCase, e.g., "Home", "Users", "Shield")
  indent?: boolean  // For sub-navigation items
}

export interface SidebarSection {
  id: string                              // Cookie key: sidebar:section:{id}
  label: string                           // Display name in sidebar
  icon: string                            // Lucide icon name (PascalCase)
  items: NavItem[]                        // Nav items within this section
  roles: ("admin" | "va" | "client")[]   // Which roles see this section
}
