"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as LucideIcons from "lucide-react"
import { Palette, Settings } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ThemePickerCompact } from "@/components/profile/theme-picker"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { SyncStatusIndicator } from "@/components/sync/sync-status-indicator"
import { NavItem } from "@/types/navigation"

interface AppSidebarProps {
  navItems: NavItem[]
  dashboardTitle: string
  showSyncStatus?: boolean
}

export function AppSidebar({ navItems, dashboardTitle, showSyncStatus = false }: AppSidebarProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)

  const isItemActive = (item: NavItem) => {
    // For indent items: exact pathname match only
    if (item.indent) {
      return pathname === item.href
    }

    // For dashboard roots ("/admin", "/va", "/client"): exact match only
    const dashboardRoots = ["/admin", "/va", "/client"]
    if (dashboardRoots.includes(item.href)) {
      return pathname === item.href
    }

    // For other items: exact match OR pathname starts with href + "/"
    // (but not if a child indent item matches exactly)
    const hasExactIndentMatch = navItems.some(
      (ni) => ni.indent && pathname === ni.href
    )

    if (hasExactIndentMatch) {
      return false
    }

    return pathname === item.href || pathname.startsWith(item.href + "/")
  }

  return (
    <>
      <Sidebar>
        <SidebarHeader className="border-b border-border p-6">
          <h1 className="text-xl font-bold text-foreground">DS-ProSolution</h1>
          <p className="text-sm text-muted-foreground mt-1">{dashboardTitle}</p>
        </SidebarHeader>

        <SidebarContent className="p-4">
          <SidebarMenu className="space-y-1">
            {navItems.map((item) => {
              const Icon = LucideIcons[item.icon as keyof typeof LucideIcons] as React.ElementType
              const isActive = isItemActive(item)

              return (
                <SidebarMenuItem key={item.href} className={item.indent ? "ml-4" : undefined}>
                  <SidebarMenuButton asChild isActive={isActive} className={item.indent ? "text-xs" : "text-sm"}>
                    <Link href={item.href} className="flex items-center gap-3">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-border space-y-2 p-4">
          {showSyncStatus && <SyncStatusIndicator />}

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors">
                <Palette className="h-4 w-4" />
                Theme
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-48 p-2">
              <ThemePickerCompact />
            </PopoverContent>
          </Popover>

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
            Profile Settings
          </button>
        </SidebarFooter>
      </Sidebar>

      <ProfileSettingsDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  )
}
