"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useCollectionPolling } from "@/hooks/use-collection-polling";

interface CollectionRun {
  id: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
}

interface EnhancedProgress {
  run_id: string;
  status: "running" | "paused" | "pending";
  phase: "amazon" | "ebay";
  departments_total: number;
  departments_completed: number;
  categories_total: number;
  categories_completed: number;
  products_found: number;
  products_total: number;
  products_searched: number;
  sellers_found: number;
  sellers_new: number;
  started_at?: string;
  checkpoint?: {
    status?: "rate_limited" | "paused_failures" | string;
    waiting_seconds?: number;
    current_category?: string;
    current_activity?: string;
  };
  worker_status: Array<{
    worker_id: number;
    department: string;
    category: string;
    product: string | null;
    status: "idle" | "fetching" | "searching" | "complete";
  }>;
}

interface CollectionProgressContextValue {
  activeRun: CollectionRun | null;
  progress: EnhancedProgress | null;
  newSellerIds: Set<string>;
  addNewSellerId: (id: string) => void;
  clearNewSellerIds: () => void;
  refresh: () => Promise<void>;
  // Modal state
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  // Hide minimized indicator (e.g., when progress bar is visible)
  hideMinimized: boolean;
  setHideMinimized: (hide: boolean) => void;
}

const CollectionProgressContext = createContext<CollectionProgressContextValue | null>(null);

export function CollectionProgressProvider({ children }: { children: ReactNode }) {
  const polling = useCollectionPolling(2000);
  const [modalOpen, setModalOpen] = useState(false);
  const [hideMinimized, setHideMinimized] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <CollectionProgressContext.Provider value={{ ...polling, modalOpen, openModal, closeModal, hideMinimized, setHideMinimized }}>
      {children}
    </CollectionProgressContext.Provider>
  );
}

export function useCollectionProgress() {
  const context = useContext(CollectionProgressContext);
  if (!context) {
    throw new Error("useCollectionProgress must be used within CollectionProgressProvider");
  }
  return context;
}
