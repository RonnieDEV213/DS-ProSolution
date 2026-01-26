"use client"

import { useTheme } from "next-themes"
import { THEMES, type ThemeConfig } from "@/lib/themes"
import { withViewTransition } from "@/lib/view-transitions"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export function ThemePicker() {
  const { theme: currentTheme, setTheme } = useTheme()

  const handleThemeChange = (theme: ThemeConfig) => {
    withViewTransition(() => setTheme(theme.value))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Theme</h3>
        <p className="text-sm text-gray-400 mt-1">
          Choose your preferred visual theme
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {THEMES.map((theme) => {
          const isActive = currentTheme === theme.value
          const isSystem = theme.value === "system"

          return (
            <button
              key={theme.value}
              onClick={() => handleThemeChange(theme)}
              className={cn(
                "group rounded-lg overflow-hidden transition-all",
                "border-2",
                isActive
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
            >
              {/* Preview section */}
              <div className="h-20 p-2 flex gap-2">
                {isSystem ? (
                  // System shows split preview: dark on left, light on right
                  <>
                    <div
                      className="flex-1 rounded flex flex-col justify-between p-2"
                      style={{ backgroundColor: "#141825" }}
                    >
                      <div
                        className="h-1.5 w-2/3 rounded"
                        style={{ backgroundColor: "#5b8af0" }}
                      />
                      <div className="space-y-1">
                        <div
                          className="h-1 w-full rounded"
                          style={{ backgroundColor: "#e8ecf450" }}
                        />
                        <div
                          className="h-1 w-3/4 rounded"
                          style={{ backgroundColor: "#e8ecf430" }}
                        />
                      </div>
                    </div>
                    <div
                      className="flex-1 rounded flex flex-col justify-between p-2"
                      style={{ backgroundColor: "#f7f7fa" }}
                    >
                      <div
                        className="h-1.5 w-2/3 rounded"
                        style={{ backgroundColor: "#5046e5" }}
                      />
                      <div className="space-y-1">
                        <div
                          className="h-1 w-full rounded"
                          style={{ backgroundColor: "#1a1a2e50" }}
                        />
                        <div
                          className="h-1 w-3/4 rounded"
                          style={{ backgroundColor: "#1a1a2e30" }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // Regular themes show sidebar + main area
                  <>
                    {/* Sidebar area (left 1/3) */}
                    <div
                      className="w-1/3 rounded flex flex-col justify-between p-1.5"
                      style={{ backgroundColor: theme.preview.sidebar }}
                    >
                      <div
                        className="h-1 w-3/4 rounded"
                        style={{ backgroundColor: theme.preview.accent }}
                      />
                      <div className="space-y-1">
                        <div
                          className="h-0.5 w-full rounded"
                          style={{
                            backgroundColor: `${theme.preview.text}40`,
                          }}
                        />
                        <div
                          className="h-0.5 w-2/3 rounded"
                          style={{
                            backgroundColor: `${theme.preview.text}30`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Main area (right 2/3) */}
                    <div
                      className="flex-1 rounded flex flex-col justify-between p-2"
                      style={{ backgroundColor: theme.preview.bg }}
                    >
                      <div className="space-y-1">
                        <div
                          className="h-1.5 w-3/4 rounded"
                          style={{ backgroundColor: theme.preview.text }}
                        />
                        <div
                          className="h-1 w-full rounded"
                          style={{
                            backgroundColor: `${theme.preview.text}50`,
                          }}
                        />
                      </div>
                      <div
                        className="h-2 w-1/3 rounded self-end"
                        style={{ backgroundColor: theme.preview.accent }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Label section */}
              <div className="bg-card border-t border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm text-white">
                      {theme.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {theme.description}
                    </div>
                  </div>
                  {isActive && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ThemePickerCompact() {
  const { theme: currentTheme, setTheme } = useTheme()

  const handleThemeChange = (theme: ThemeConfig) => {
    withViewTransition(() => setTheme(theme.value))
  }

  return (
    <div className="space-y-1">
      {THEMES.map((theme) => {
        const isActive = currentTheme === theme.value

        return (
          <button
            key={theme.value}
            onClick={() => handleThemeChange(theme)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-gray-300"
            )}
          >
            {/* Accent color dot */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: theme.preview.accent }}
            />

            {/* Label */}
            <span className="flex-1 text-left font-medium">{theme.label}</span>

            {/* Checkmark if active */}
            {isActive && <Check className="w-4 h-4 flex-shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}
