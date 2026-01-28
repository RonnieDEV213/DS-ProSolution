"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import * as LucideIcons from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { navigationItems, actionItems, type CommandItemDef } from "@/lib/command-items"
import { useSidebar } from "@/components/ui/sidebar"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSettings?: () => void
  basePath?: string  // "/admin", "/va", "/client" -- adjusts navigation hrefs
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenSettings,
  basePath = "/admin",
}: CommandPaletteProps) {
  const router = useRouter()
  const sidebar = useSidebar()

  const handleSelect = useCallback(
    (item: CommandItemDef) => {
      onOpenChange(false)

      if (item.href) {
        // Adapt navigation path based on user role
        let href = item.href
        if (basePath !== "/admin" && href.startsWith("/admin")) {
          const adminSubPath = href.replace("/admin", "")
          if (adminSubPath === "" || adminSubPath === "/accounts" || adminSubPath === "/order-tracking") {
            href = basePath + adminSubPath
          } else {
            return
          }
        }
        router.push(href)
        return
      }

      if (item.action) {
        switch (item.action) {
          case "toggle-sidebar":
            sidebar.toggleSidebar()
            break
          case "open-theme":
            if (sidebar.state === "collapsed") {
              sidebar.toggleSidebar()
            }
            break
          case "open-settings":
            onOpenSettings?.()
            break
        }
      }
    },
    [router, onOpenChange, onOpenSettings, sidebar, basePath]
  )

  // Filter navigation items based on role
  const filteredNavItems = navigationItems.filter((item) => {
    if (basePath === "/admin") return true
    if (item.adminOnly) return false
    if (basePath === "/va") {
      const vaRoutes = ["/admin", "/admin/accounts", "/admin/order-tracking"]
      return item.href ? vaRoutes.includes(item.href) : true
    }
    if (basePath === "/client") {
      return item.href === "/admin"
    }
    return true
  })

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {filteredNavItems.map((item) => {
            const Icon = LucideIcons[item.icon as keyof typeof LucideIcons] as React.ElementType
            return (
              <CommandItem
                key={item.id}
                value={item.label}
                keywords={item.keywords}
                onSelect={() => handleSelect(item)}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                <span>{item.label}</span>
                {item.shortcut && (
                  <CommandShortcut>{item.shortcut.join(" ")}</CommandShortcut>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => {
            const Icon = LucideIcons[item.icon as keyof typeof LucideIcons] as React.ElementType
            return (
              <CommandItem
                key={item.id}
                value={item.label}
                keywords={item.keywords}
                onSelect={() => handleSelect(item)}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" />}
                <span>{item.label}</span>
                {item.shortcut && (
                  <CommandShortcut>{item.shortcut.join(" ")}</CommandShortcut>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
