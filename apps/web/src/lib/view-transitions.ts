import { flushSync } from "react-dom"

/**
 * Wraps a callback in the View Transitions API for smooth visual transitions.
 * Falls back to immediate execution on unsupported browsers (progressive enhancement).
 *
 * Usage: withViewTransition(() => setTheme("midnight"))
 */
export function withViewTransition(callback: () => void): void {
  // Progressive enhancement: instant change if View Transitions API not supported
  if (
    typeof document === "undefined" ||
    !("startViewTransition" in document)
  ) {
    callback()
    return
  }

  // Wrap in view transition for smooth cross-fade
  document.startViewTransition(() => {
    // flushSync ensures React commits DOM changes synchronously
    // so the View Transitions API can snapshot the new state
    flushSync(callback)
  })
}
