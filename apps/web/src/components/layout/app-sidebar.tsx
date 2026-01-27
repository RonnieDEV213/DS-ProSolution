"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as LucideIcons from "lucide-react"
import { Palette, Settings, ChevronsLeft, ChevronsRight } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ThemePickerCompact } from "@/components/profile/theme-picker"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { SyncStatusIndicator } from "@/components/sync/sync-status-indicator"
import { NavItem } from "@/types/navigation"

interface AppSidebarProps {
  navItems: NavItem[]
  roleLabel: string
  showSyncStatus?: boolean
}

export function AppSidebar({ navItems, roleLabel, showSyncStatus = false }: AppSidebarProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const { toggleSidebar, state } = useSidebar()

  const isItemActive = (item: NavItem) => {
    if (item.indent) {
      return pathname === item.href
    }

    const dashboardRoots = ["/admin", "/va", "/client"]
    if (dashboardRoots.includes(item.href)) {
      return pathname === item.href
    }

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
      <Sidebar collapsible="icon">
        <SidebarHeader className="relative h-14 flex-row items-center border-b border-sidebar-border px-4 overflow-hidden group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-2 whitespace-nowrap transition-opacity duration-150 delay-200 opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0">
            <h1 className="text-sm font-semibold text-sidebar-foreground">DS-ProSolution</h1>
            <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium uppercase text-sidebar-accent-foreground">{roleLabel}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 opacity-0 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:delay-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shrink-0">
              DS
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => {
              const Icon = LucideIcons[item.icon as keyof typeof LucideIcons] as React.ElementType
              const isActive = isItemActive(item)

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={item.indent ? "text-xs ml-4" : undefined}
                  >
                    <Link href={item.href}>
                      {Icon && <Icon />}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          {showSyncStatus && <SyncStatusIndicator />}

          <SidebarMenu>
            <SidebarMenuItem>
              <Popover>
                <PopoverTrigger asChild>
                  <SidebarMenuButton tooltip="Theme">
                    <Palette />
                    <span>Theme</span>
                  </SidebarMenuButton>
                </PopoverTrigger>
                <PopoverContent side="right" align="end" className="w-48 p-2">
                  <ThemePickerCompact />
                </PopoverContent>
              </Popover>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Profile Settings" onClick={() => setProfileOpen(true)}>
                <Settings />
                <span>Profile Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton tooltip={state === "expanded" ? "Collapse" : "Expand"} onClick={toggleSidebar}>
                {state === "expanded" ? <ChevronsLeft /> : <ChevronsRight />}
                <span>Collapse</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <ProfileSettingsDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  )
}
