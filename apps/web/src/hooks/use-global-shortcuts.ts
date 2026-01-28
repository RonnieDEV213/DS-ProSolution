"use client"

import { useState, useCallback, useEffect } from "react"
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

  // Shortcuts reference: ? — uses raw addEventListener (same pattern as order tracker)
  // useHotkeys has matching issues with shifted characters like ?
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "?") return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return
      }
      e.preventDefault()
      setShortcutsOpen(prev => !prev)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

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
  useHotkeys("g,b", () => {
    if (basePath === "/client") return
    navigateTo("/admin/order-tracking")
  }, { enableOnFormTags: false })
  useHotkeys("g,u", () => {
    if (basePath === "/admin") router.push("/admin/users")
  }, { enableOnFormTags: false })
  useHotkeys("g,a", () => {
    if (basePath === "/client") return
    navigateTo("/admin/accounts")
  }, { enableOnFormTags: false })

  // Action shortcuts: N=new, F=filter, E=export
  useHotkeys("n", () => {
    window.dispatchEvent(new CustomEvent("dspro:shortcut:new"))
  }, { enableOnFormTags: false })

  useHotkeys("f", () => {
    const searchInput = document.querySelector<HTMLInputElement>(
      'input[placeholder*="earch"], input[placeholder*="ilter"]'
    )
    if (searchInput) {
      searchInput.focus()
      searchInput.select()
    }
  }, { enableOnFormTags: false })

  useHotkeys("e", () => {
    window.dispatchEvent(new CustomEvent("dspro:shortcut:export"))
  }, { enableOnFormTags: false })

  return {
    commandOpen,
    setCommandOpen,
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
  }
}
