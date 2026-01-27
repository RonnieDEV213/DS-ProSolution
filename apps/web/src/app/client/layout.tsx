"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { clientNavItems } from "@/lib/navigation"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        navItems={clientNavItems}
        roleLabel="Client"
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
