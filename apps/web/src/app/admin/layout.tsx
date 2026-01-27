"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { adminSidebarSections } from "@/lib/navigation"
import { AdminLayoutClient } from "@/components/admin/admin-layout-client"
import { SyncProvider } from "@/components/providers/sync-provider"
import { ConflictResolutionModal } from "@/components/sync/conflict-resolution-modal"
import dynamic from "next/dynamic"
import { ShortcutsReference } from "@/components/command-palette/shortcuts-reference"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts"

const CommandPalette = dynamic(
  () => import("@/components/command-palette/command-palette").then(mod => ({ default: mod.CommandPalette })),
  { ssr: false }
)

function AdminLayoutShortcuts({ children }: { children: React.ReactNode }) {
  const { commandOpen, setCommandOpen, shortcutsOpen, setShortcutsOpen, settingsOpen, setSettingsOpen } = useGlobalShortcuts({ basePath: "/admin" })

  return (
    <>
      {children}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} onOpenSettings={() => setSettingsOpen(true)} basePath="/admin" />
      <ShortcutsReference open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AdminLayoutShortcuts>
        <AppSidebar
          sections={adminSidebarSections}
          basePath="/admin"
          roleLabel="Admin"
          role="admin"
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
      </AdminLayoutShortcuts>
    </SidebarProvider>
  )
}
