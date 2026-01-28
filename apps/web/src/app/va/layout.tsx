"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav"
import { vaSidebarSections } from "@/lib/navigation"
import { useUserRole } from "@/hooks/use-user-role"
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import dynamic from "next/dynamic"
import { ShortcutsReference } from "@/components/command-palette/shortcuts-reference"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts"

const CommandPalette = dynamic(
  () => import("@/components/command-palette/command-palette").then(mod => ({ default: mod.CommandPalette })),
  { ssr: false }
)

function VaLayoutShortcuts({ children }: { children: React.ReactNode }) {
  const { commandOpen, setCommandOpen, shortcutsOpen, setShortcutsOpen, settingsOpen, setSettingsOpen } = useGlobalShortcuts({ basePath: "/va" })

  return (
    <>
      {children}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} onOpenSettings={() => setSettingsOpen(true)} basePath="/va" />
      <ShortcutsReference open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

export default function VALayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { role, hasAccessProfile, loading } = useUserRole()

  // RBAC: Filter sections based on access profile
  const sectionsToShow =
    role === "va" && !hasAccessProfile
      ? []  // No sections if VA has no access profile (only Dashboard visible)
      : vaSidebarSections

  // RBAC: Redirect VA without access profile away from non-dashboard pages
  useEffect(() => {
    if (!loading && role === "va" && !hasAccessProfile && pathname !== "/va") {
      router.replace("/va")
    }
  }, [loading, role, hasAccessProfile, pathname, router])

  // Loading state
  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar sections={[]} basePath="/va" roleLabel="VA" role="va" />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
            <Skeleton className="h-4 w-32" />
          </header>
          <div className="flex-1 p-8">
            <DashboardSkeleton />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <VaLayoutShortcuts>
        <AppSidebar
          sections={sectionsToShow}
          basePath="/va"
          roleLabel="VA"
          role="va"
        />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
            <BreadcrumbNav />
          </header>
          <div className="flex-1 p-8">
            {children}
          </div>
        </SidebarInset>
      </VaLayoutShortcuts>
    </SidebarProvider>
  )
}
