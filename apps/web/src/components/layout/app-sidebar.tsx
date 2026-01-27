"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as LucideIcons from "lucide-react"
import { Settings, ChevronsLeft, ChevronsRight, ChevronDown } from "lucide-react"
import * as Collapsible from "@radix-ui/react-collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar"
import { ProfileSettingsDialog } from "@/components/profile/profile-settings-dialog"
import { SidebarSection, NavItem } from "@/types/navigation"
import { dashboardNavItem, getVisibleSections } from "@/lib/navigation"
import { cn } from "@/lib/utils"

interface AppSidebarProps {
  sections: SidebarSection[]
  basePath: string
  roleLabel: string
  role: "admin" | "va" | "client"
}

const SIDEBAR_SECTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function useSectionState(sectionId: string, defaultOpen = true) {
  const [open, setOpen] = useState(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(
        new RegExp(`(?:^|; )sidebar:section:${sectionId}=([^;]*)`)
      )
      return match ? match[1] === "true" : defaultOpen
    }
    return defaultOpen
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    document.cookie = `sidebar:section:${sectionId}=${nextOpen}; path=/; max-age=${SIDEBAR_SECTION_COOKIE_MAX_AGE}`
  }

  return [open, handleOpenChange] as const
}

function CollapsibleSection({
  section,
  pathname,
  isItemActive,
}: {
  section: SidebarSection
  pathname: string
  isItemActive: (item: NavItem) => boolean
}) {
  const [open, setOpen] = useSectionState(section.id)
  const SectionIcon = LucideIcons[section.icon as keyof typeof LucideIcons] as React.ElementType

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <SidebarGroup className="py-0">
        <Collapsible.Trigger asChild>
          <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors">
            {SectionIcon && <SectionIcon className="mr-2" />}
            <span>{section.label}</span>
            <ChevronDown className={cn(
              "ml-auto h-4 w-4 transition-transform duration-200",
              open && "rotate-180"
            )} />
          </SidebarGroupLabel>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const Icon = LucideIcons[item.icon as keyof typeof LucideIcons] as React.ElementType
                const isActive = isItemActive(item)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        {Icon && <Icon />}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </Collapsible.Content>
      </SidebarGroup>
    </Collapsible.Root>
  )
}

export function AppSidebar({ sections, basePath, roleLabel, role }: AppSidebarProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const { toggleSidebar, state } = useSidebar()

  const visibleSections = getVisibleSections(sections, role)
  const dashboard = dashboardNavItem(basePath)

  const isItemActive = (item: NavItem) => {
    // For dashboard: exact match only
    if (item.href === basePath) {
      return pathname === basePath
    }

    // For section items: exact match OR startsWith with trailing slash
    return pathname === item.href || pathname.startsWith(item.href + "/")
  }

  const DashboardIcon = LucideIcons[dashboard.icon as keyof typeof LucideIcons] as React.ElementType
  const isDashboardActive = isItemActive(dashboard)

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
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isDashboardActive} tooltip={dashboard.label}>
                <Link href={dashboard.href}>
                  {DashboardIcon && <DashboardIcon />}
                  <span>{dashboard.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          {visibleSections.map((section) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              pathname={pathname}
              isItemActive={isItemActive}
            />
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
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
