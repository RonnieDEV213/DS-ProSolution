"use client";

import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCollectionProgress } from "@/contexts/collection-progress-context";
import { ProgressDetailModal } from "./progress-detail-modal";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function GlobalProgressIndicator() {
  const pathname = usePathname();
  const { activeRun, progress, refresh, modalOpen, openModal, closeModal, hideMinimized } = useCollectionProgress();
  const supabase = createClient();

  // Hide on dashboard (/admin)
  const isDashboard = pathname === "/admin";

  // Don't render anything if no progress or on dashboard
  if (!progress || isDashboard) {
    return null;
  }

  const handleCancel = async () => {
    if (!activeRun) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await fetch(`${API_BASE}/collection/runs/${activeRun.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      refresh();
    } catch (e) {
      console.error("Failed to cancel run:", e);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openModal();
    } else {
      closeModal();
    }
  };

  return (
    <ProgressDetailModal
      open={modalOpen}
      onOpenChange={handleOpenChange}
      progress={progress}
      onCancel={handleCancel}
      onPauseResume={refresh}
      hideMinimized={hideMinimized}
    />
  );
}
