export interface NavItem {
  href: string
  label: string
  icon: string  // Lucide React icon name (PascalCase, e.g., "Home", "Users", "Shield")
  indent?: boolean  // For sub-navigation items
}
