export interface ThemeConfig {
  name: string
  value: string
  label: string
  description: string
  accentLabel: string
  isDark: boolean
  preview: {
    bg: string
    sidebar: string
    text: string
    accent: string
  }
}

export const THEMES: ThemeConfig[] = [
  {
    name: "system",
    value: "system",
    label: "System",
    description: "Match your OS preference",
    accentLabel: "Auto",
    isDark: false, // not relevant for system
    preview: {
      // System preview shows a split light/dark card -- handled by UI component
      bg: "#1a1a2e",
      sidebar: "#222240",
      text: "#e8e8f0",
      accent: "#7c7cf0",
    },
  },
  {
    name: "midnight",
    value: "midnight",
    label: "Midnight",
    description: "Blue-undertone dark",
    accentLabel: "Blue",
    isDark: true,
    preview: {
      bg: "#141825",
      sidebar: "#1a2030",
      text: "#e8ecf4",
      accent: "#5b8af0",
    },
  },
  {
    name: "dawn",
    value: "dawn",
    label: "Dawn",
    description: "Clean light mode",
    accentLabel: "Indigo",
    isDark: false,
    preview: {
      bg: "#f7f7fa",
      sidebar: "#ededf2",
      text: "#1a1a2e",
      accent: "#5046e5",
    },
  },
  {
    name: "slate",
    value: "slate",
    label: "Slate",
    description: "Warm gray-green dark",
    accentLabel: "Teal",
    isDark: true,
    preview: {
      bg: "#1e2a28",
      sidebar: "#263432",
      text: "#e0ebe8",
      accent: "#4db8a0",
    },
  },
  {
    name: "carbon",
    value: "carbon",
    label: "Carbon",
    description: "True black OLED",
    accentLabel: "Purple",
    isDark: true,
    preview: {
      bg: "#000000",
      sidebar: "#141414",
      text: "#e8e8e8",
      accent: "#b07cf0",
    },
  },
]

export function getThemeConfig(theme: string): ThemeConfig | undefined {
  return THEMES.find((t) => t.value === theme)
}

/** Named themes only (excludes "system") */
export const NAMED_THEMES = THEMES.filter((t) => t.value !== "system")
