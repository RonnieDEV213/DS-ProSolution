"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useHotkeys } from "react-hotkeys-hook"
import { useSidebar } from "@/components/ui/sidebar"

interface UseGlobalShortcutsOptions {
  basePath?: string
}

export function useGlobalShortcuts({ basePath = "/admin" }: UseGlobalShortcutsOptions = {}) {
  const router = useRouter()
  const { toggleSidebar } = useSidebar()
  const [commandOpen, setCommandOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Command palette: Cmd+K / Ctrl+K
  useHotkeys("mod+k", (e) => {
    e.preventDefault()
    setCommandOpen(prev => !prev)
  }, { enableOnFormTags: false })

  // Shortcuts reference: ? (Shift+/)
  useHotkeys("shift+/", (e) => {
    const target = e.target as HTMLElement
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return
    }
    e.preventDefault()
    setShortcutsOpen(true)
  })

  const navigateTo = useCallback((adminPath: string) => {
    if (basePath === "/admin") {
      router.push(adminPath)
      return
    }
    const subPath = adminPath.replace("/admin", "")
    router.push(basePath + subPath)
  }, [router, basePath])

  // Vim-style navigation
  useHotkeys("g,d", () => navigateTo("/admin"), { enableOnFormTags: false })
  useHotkeys("g,b", () => navigateTo("/admin/order-tracking"), { enableOnFormTags: false })
  useHotkeys("g,u", () => {
    if (basePath === "/admin") router.push("/admin/users")
  }, { enableOnFormTags: false })
  useHotkeys("g,a", () => navigateTo("/admin/accounts"), { enableOnFormTags: false })

  return {
    commandOpen,
    setCommandOpen,
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
  }
}
