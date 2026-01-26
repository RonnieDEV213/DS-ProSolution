"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { adminNavItems } from "@/lib/navigation"
import { AdminLayoutClient } from "@/components/admin/admin-layout-client"
import { SyncProvider } from "@/components/providers/sync-provider"
import { ConflictResolutionModal } from "@/components/sync/conflict-resolution-modal"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar
          navItems={adminNavItems}
          dashboardTitle="Admin Dashboard"
          showSyncStatus={true}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <BreadcrumbNav />
            <SyncProvider>
              <AdminLayoutClient>{children}</AdminLayoutClient>
              <ConflictResolutionModal />
            </SyncProvider>
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
