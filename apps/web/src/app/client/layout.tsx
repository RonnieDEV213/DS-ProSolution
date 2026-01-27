"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { clientSidebarSections } from "@/lib/navigation"
import dynamic from "next/dynamic"
import { ShortcutsReference } from "@/components/command-palette/shortcuts-reference"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts"

const CommandPalette = dynamic(
  () => import("@/components/command-palette/command-palette").then(mod => ({ default: mod.CommandPalette })),
  { ssr: false }
)

function ClientLayoutShortcuts({ children }: { children: React.ReactNode }) {
  const { commandOpen, setCommandOpen, shortcutsOpen, setShortcutsOpen, settingsOpen, setSettingsOpen } = useGlobalShortcuts({ basePath: "/client" })

  return (
    <>
      {children}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} onOpenSettings={() => setSettingsOpen(true)} basePath="/client" />
      <ShortcutsReference open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <ClientLayoutShortcuts>
        <AppSidebar
          sections={clientSidebarSections}
          basePath="/client"
          roleLabel="Client"
          role="client"
        />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
            <BreadcrumbNav />
          </header>
          <div className="flex-1 p-8">
            {children}
          </div>
        </SidebarInset>
      </ClientLayoutShortcuts>
    </SidebarProvider>
  )
}
