export const SPACING = {
  page: "p-8",           // 32px
  card: "p-6",           // 24px
  section: "space-y-6",  // 24px
  form: "gap-4",         // 16px
  nav: "p-4",            // 16px
  header: "p-6",         // 24px
} as const

export const GAPS = {
  tight: "gap-2",    // 8px
  normal: "gap-4",   // 16px
  relaxed: "gap-6",  // 24px
  loose: "gap-8",    // 32px
} as const

export type SpacingKey = keyof typeof SPACING
export type GapKey = keyof typeof GAPS
