"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { clientNavItems } from "@/lib/navigation"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar
          navItems={clientNavItems}
          dashboardTitle="Client Dashboard"
        />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <BreadcrumbNav />
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
