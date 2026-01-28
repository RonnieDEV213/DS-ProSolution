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
  "Order Tracking",
  "Collection",
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
    key: "?",
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
    key: "n",
    label: "New",
    description: "Create new item (context-dependent)",
    display: ["N"],
    group: "Actions",
  },
  {
    key: "f",
    label: "Filter",
    description: "Focus search/filter input",
    display: ["F"],
    group: "Actions",
  },
  {
    key: "e",
    label: "Export",
    description: "Export current view",
    display: ["E"],
    group: "Actions",
  },
  {
    key: "Escape",
    label: "Close",
    description: "Close modal or dialog",
    display: ["Esc"],
    group: "Actions",
  },

  // Order Tracking (page-scoped)
  {
    key: "j",
    label: "Next Row",
    description: "Move to next row",
    display: ["J"],
    group: "Order Tracking",
    scope: "order-tracking",
  },
  {
    key: "k",
    label: "Previous Row",
    description: "Move to previous row",
    display: ["K"],
    group: "Order Tracking",
    scope: "order-tracking",
  },
  {
    key: "Enter",
    label: "Expand / Collapse",
    description: "Expand or collapse selected row",
    display: ["Enter"],
    group: "Order Tracking",
    scope: "order-tracking",
  },
  {
    key: "Escape",
    label: "Clear Focus",
    description: "Clear row focus",
    display: ["Esc"],
    group: "Order Tracking",
    scope: "order-tracking",
  },

  // Collection (page-scoped)
  {
    key: "Delete",
    label: "Delete Selected",
    description: "Delete selected sellers",
    display: ["Del"],
    group: "Collection",
    scope: "collection",
  },
  {
    key: "f",
    label: "Flag Selected",
    description: "Toggle flag on selected sellers",
    display: ["F"],
    group: "Collection",
    scope: "collection",
  },
  {
    key: "e",
    label: "Export",
    description: "Export sellers (selection-scoped if any selected)",
    display: ["E"],
    group: "Collection",
    scope: "collection",
  },
  {
    key: "s",
    label: "Start Run",
    description: "Open run configuration dialog",
    display: ["S"],
    group: "Collection",
    scope: "collection",
  },
  {
    key: "Escape",
    label: "Clear Selection",
    description: "Clear seller selection",
    display: ["Esc"],
    group: "Collection",
    scope: "collection",
  },
  {
    key: "mod+z",
    label: "Undo Delete",
    description: "Undo last bulk delete",
    display: ["\u2318", "Z"],
    group: "Collection",
    scope: "collection",
  },
  {
    key: "mod+a",
    label: "Select All",
    description: "Select all visible sellers",
    display: ["\u2318", "A"],
    group: "Collection",
    scope: "collection",
  },
  {
    key: "mod+c",
    label: "Copy Selected",
    description: "Copy selected seller names to clipboard",
    display: ["\u2318", "C"],
    group: "Collection",
    scope: "collection",
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
