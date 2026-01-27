"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { vaNavItems } from "@/lib/navigation"
import { useUserRole } from "@/hooks/use-user-role"

export default function VALayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role, hasAccessProfile, loading } = useUserRole()

  // RBAC: Filter nav items based on access profile
  const navItemsToShow =
    role === "va" && !hasAccessProfile
      ? vaNavItems.filter((item) => item.href === "/va")
      : vaNavItems

  // RBAC: Redirect VA without access profile away from non-dashboard pages
  useEffect(() => {
    if (!loading && role === "va" && !hasAccessProfile && pathname !== "/va") {
      router.replace("/va")
    }
  }, [loading, role, hasAccessProfile, pathname, router])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar
        navItems={navItemsToShow}
        roleLabel="VA"
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <BreadcrumbNav />
        </header>
        <div className="flex-1 p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
