"use client"

import { useHotkeys } from "react-hotkeys-hook"

interface UseCollectionShortcutsOptions {
  /** Master enable switch (e.g., page is active) */
  enabled: boolean
  /** Current selection count */
  selectedCount: number
  /** Whether any dialog/modal is currently open */
  isDialogOpen: boolean
  /** Callbacks */
  onDelete: () => void
  onFlag: () => void
  onExport: () => void
  onStartRun: () => void
  onClearSelection: () => void
}

export function useCollectionShortcuts({
  enabled,
  selectedCount,
  isDialogOpen,
  onDelete,
  onFlag,
  onExport,
  onStartRun,
  onClearSelection,
}: UseCollectionShortcutsOptions) {
  // Delete/Backspace - delete selected sellers (requires selection)
  useHotkeys("Delete,Backspace", (e) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    onDelete()
  }, {
    enabled: () => enabled && selectedCount > 0 && !isDialogOpen,
    enableOnFormTags: false,
  }, [enabled, selectedCount, isDialogOpen, onDelete])

  // F - flag toggle (Google Docs Ctrl+B pattern, requires selection)
  // stopImmediatePropagation prevents global F (focus search) from also firing
  useHotkeys("f", (e) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    onFlag()
  }, {
    enabled: () => enabled && selectedCount > 0 && !isDialogOpen,
    enableOnFormTags: false,
  }, [enabled, selectedCount, isDialogOpen, onFlag])

  // E - export (always available on collection page, scoping handled by caller)
  // stopImmediatePropagation prevents global E (dispatch export event) from also firing
  useHotkeys("e", (e) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    onExport()
  }, {
    enabled: () => enabled && !isDialogOpen,
    enableOnFormTags: false,
  }, [enabled, isDialogOpen, onExport])

  // S - start run (always available on collection page, selection does NOT affect scope)
  useHotkeys("s", (e) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    onStartRun()
  }, {
    enabled: () => enabled && !isDialogOpen,
    enableOnFormTags: false,
  }, [enabled, isDialogOpen, onStartRun])

  // Escape - clear selection (only when no dialog is open)
  useHotkeys("Escape", (e) => {
    e.preventDefault()
    onClearSelection()
  }, {
    enabled: () => enabled && selectedCount > 0 && !isDialogOpen,
    enableOnFormTags: false,
  }, [enabled, selectedCount, isDialogOpen, onClearSelection])
}
