"use client"

import { usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { SHORTCUTS, SHORTCUT_GROUPS, type ShortcutGroup } from "@/lib/shortcuts"

interface ShortcutsReferenceProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsReference({ open, onOpenChange }: ShortcutsReferenceProps) {
  const pathname = usePathname()
  const activeScope = pathname?.includes("/automation") ? "collection" : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0 bg-popover text-popover-foreground border-border">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Navigate faster with keyboard shortcuts. Press <Kbd>?</Kbd> to toggle this reference.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {SHORTCUT_GROUPS.map((group) => {
            const groupShortcuts = SHORTCUTS.filter(
              (s) => s.group === group && (!s.scope || s.scope === activeScope)
            )
            if (groupShortcuts.length === 0) return null

            return (
              <div key={group}>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{group}</h4>
                <div className="grid grid-cols-[1fr,auto] gap-y-2 gap-x-4">
                  {groupShortcuts.map((shortcut) => (
                    <div key={shortcut.key} className="contents">
                      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.display.map((key, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-muted-foreground/50 text-xs">then</span>}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
