"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

function SystemThemeMapper() {
  const { theme } = useTheme()

  React.useEffect(() => {
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const applySystemTheme = (isDark: boolean) => {
      const html = document.documentElement
      const mappedTheme = isDark ? "carbon" : "dawn"
      html.setAttribute("data-theme", mappedTheme)
      // Update class for Tailwind dark variant
      if (isDark) {
        html.classList.add("dark")
      } else {
        html.classList.remove("dark")
      }
    }

    // Apply immediately
    applySystemTheme(mediaQuery.matches)

    // Listen for OS changes
    const handler = (e: MediaQueryListEvent) => applySystemTheme(e.matches)
    mediaQuery.addEventListener("change", handler)

    return () => mediaQuery.removeEventListener("change", handler)
  }, [theme])

  return null
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <SystemThemeMapper />
      {children}
    </NextThemesProvider>
  )
}
