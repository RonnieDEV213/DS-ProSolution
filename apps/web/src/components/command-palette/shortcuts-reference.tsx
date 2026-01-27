"use client"

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-card-foreground">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Navigate faster with keyboard shortcuts. Press <Kbd>?</Kbd> to toggle this reference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          {SHORTCUT_GROUPS.map((group) => {
            const groupShortcuts = SHORTCUTS.filter((s) => s.group === group)
            if (groupShortcuts.length === 0) return null

            return (
              <div key={group}>
                <h4 className="text-sm font-semibold text-foreground mb-3">{group}</h4>
                <div className="grid grid-cols-[1fr,auto] gap-y-2.5 gap-x-4">
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
