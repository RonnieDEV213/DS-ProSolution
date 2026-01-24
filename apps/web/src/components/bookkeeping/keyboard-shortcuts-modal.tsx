"use client";

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["j", "Down Arrow"], label: "Next row" },
  { keys: ["k", "Up Arrow"], label: "Previous row" },
  { keys: ["Enter"], label: "Expand/collapse row" },
  { keys: ["Escape"], label: "Clear focus" },
  { keys: ["?"], label: "Show this help" },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="text-gray-400">
            Navigate the records list faster with these shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-3 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className="contents">
              <div className="flex flex-wrap gap-2">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-200"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
              <div className="text-gray-300">{shortcut.label}</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-500">
          Press Escape or click outside to close.
        </div>
      </DialogContent>
    </Dialog>
  );
}
