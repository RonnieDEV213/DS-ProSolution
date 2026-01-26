"use client"

import { useTheme } from "next-themes"
import { Toaster } from "sonner"

export function ThemedToaster() {
  const { resolvedTheme, theme } = useTheme()

  // Determine if current theme is dark for Sonner
  // resolvedTheme may be "light" or "dark" for system, or our custom theme names
  const isDark =
    theme === "midnight" ||
    theme === "slate" ||
    theme === "carbon" ||
    resolvedTheme === "dark"

  return (
    <Toaster
      position="top-right"
      richColors
      duration={5000}
      closeButton
      theme={isDark ? "dark" : "light"}
    />
  )
}
