"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
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
    <SidebarProvider>
      <AppSidebar
        navItems={adminNavItems}
        roleLabel="Admin"
        showSyncStatus={true}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <BreadcrumbNav />
        </header>
        <div className="flex-1 p-8">
          <SyncProvider>
            <AdminLayoutClient>{children}</AdminLayoutClient>
            <ConflictResolutionModal />
          </SyncProvider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
