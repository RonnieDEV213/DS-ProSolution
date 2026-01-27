export interface ShortcutDefinition {
  key: string            // react-hotkeys-hook key string (e.g., "mod+k", "g,d")
  label: string          // Human-readable label
  description: string    // What this shortcut does
  display: string[]      // Display keys for Kbd badges (e.g., ["Ctrl", "K"] or ["G", "D"])
  group: string          // Category for grouping
  scope?: string         // Optional scope restriction
}

export const SHORTCUT_GROUPS = [
  "Navigation",
  "Actions",
  "Command Palette",
] as const

export type ShortcutGroup = typeof SHORTCUT_GROUPS[number]

export const SHORTCUTS: ShortcutDefinition[] = [
  // Command Palette
  {
    key: "mod+k",
    label: "Command Palette",
    description: "Open the command palette",
    display: ["\u2318", "K"],
    group: "Command Palette",
  },
  {
    key: "shift+/",
    label: "Shortcuts Reference",
    description: "Open keyboard shortcuts reference",
    display: ["?"],
    group: "Command Palette",
  },

  // Navigation (vim-style go-to sequences)
  {
    key: "g,d",
    label: "Go to Dashboard",
    description: "Navigate to Dashboard",
    display: ["G", "D"],
    group: "Navigation",
  },
  {
    key: "g,b",
    label: "Go to Order Tracking",
    description: "Navigate to Order Tracking",
    display: ["G", "B"],
    group: "Navigation",
  },
  {
    key: "g,u",
    label: "Go to Users",
    description: "Navigate to Users (Admin)",
    display: ["G", "U"],
    group: "Navigation",
  },
  {
    key: "g,a",
    label: "Go to Accounts",
    description: "Navigate to Accounts",
    display: ["G", "A"],
    group: "Navigation",
  },

  // Actions
  {
    key: "mod+b",
    label: "Toggle Sidebar",
    description: "Expand or collapse the sidebar",
    display: ["\u2318", "B"],
    group: "Actions",
  },
  {
    key: "Escape",
    label: "Close",
    description: "Close modal or dialog",
    display: ["Esc"],
    group: "Actions",
  },
]

/** Get shortcuts filtered by group */
export function getShortcutsByGroup(group: ShortcutGroup): ShortcutDefinition[] {
  return SHORTCUTS.filter((s) => s.group === group)
}

/** Get the display string for a shortcut (for Kbd component) */
export function getShortcutDisplay(key: string): string[] | undefined {
  return SHORTCUTS.find((s) => s.key === key)?.display
}
