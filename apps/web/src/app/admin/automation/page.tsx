"use client";

import { useState, useEffect, useRef } from "react";
import { SellersGrid } from "@/components/admin/collection/sellers-grid";
import { HistoryPanel } from "@/components/admin/collection/history-panel";
import { LogDetailModal } from "@/components/admin/collection/log-detail-modal";
import { ProgressBar } from "@/components/admin/collection/progress-bar";
import { RunConfigModal } from "@/components/admin/collection/run-config-modal";
import { useCollectionProgress } from "@/contexts/collection-progress-context";
import { PageHeader } from "@/components/layout/page-header";

export default function CollectionPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Collection modals state
  const [logDetailOpen, setLogDetailOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [runConfigOpen, setRunConfigOpen] = useState(false);
  const [preselectedCategories, setPreselectedCategories] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Collection progress from global context
  const { activeRun, progress, newSellerIds, clearNewSellerIds, refresh, openModal, setHideMinimized } =
    useCollectionProgress();

  // Hide minimized indicator when on this page (progress bar is visible)
  useEffect(() => {
    setHideMinimized(true);
    return () => setHideMinimized(false);
  }, [setHideMinimized]);

  // Track sellers_new to refresh seller list when new sellers are found
  const prevSellersNewRef = useRef<number | null>(null);
  const prevRunStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!progress) {
      if (prevSellersNewRef.current !== null && prevSellersNewRef.current > 0) {
        handleRefresh();
      }
      prevSellersNewRef.current = null;
      prevRunStatusRef.current = null;
      return;
    }

    const currentNew = progress.sellers_new || 0;
    if (prevSellersNewRef.current !== null && currentNew > prevSellersNewRef.current) {
      handleRefresh();
    }
    prevSellersNewRef.current = currentNew;
    prevRunStatusRef.current = progress.status;
  }, [progress?.sellers_new, progress?.status]);

  const handleRefresh = () => setRefreshTrigger((n) => n + 1);

  const handleLogClick = (logId: string) => {
    setSelectedLogId(logId);
    setSelectedRunId(null);
    setLogDetailOpen(true);
  };

  const handleHistoryHeaderClick = () => {
    // Open modal with no specific entry pre-selected (browse-only mode)
    setSelectedLogId(null);
    setSelectedRunId(null);
    setLogDetailOpen(true);
  };

  const handleRunStarted = () => {
    clearNewSellerIds();
    refresh();
    handleRefresh();
  };

  // Listen for S keyboard shortcut from SellersGrid
  useEffect(() => {
    const handleStartRun = () => setRunConfigOpen(true);
    window.addEventListener("dspro:shortcut:startrun", handleStartRun);
    return () => window.removeEventListener("dspro:shortcut:startrun", handleStartRun);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Automation Hub"
        description="Manage seller collections and collection runs."
      />

      <div className="space-y-6">
        {/* Progress bar (shown during active runs) */}
        {progress && (
          <ProgressBar
            progress={progress}
            onDetailsClick={openModal}
            onRunStateChange={refresh}
          />
        )}

        {/* Main content: Grid (left) + History Panel (right) */}
        <div className="flex gap-4 h-[calc(100vh-300px)] min-h-[500px]">
          <div className="flex-1 min-w-0">
            <SellersGrid
              refreshTrigger={refreshTrigger}
              onSellerChange={handleRefresh}
              newSellerIds={newSellerIds}
            />
          </div>

          <div className="w-80 flex-shrink-0">
            <HistoryPanel
              refreshTrigger={refreshTrigger}
              onStartRunClick={() => setRunConfigOpen(true)}
              hasActiveRun={!!activeRun}
              onManualEditClick={handleLogClick}
              onCollectionRunClick={(runId) => {
                setSelectedRunId(runId);
                setSelectedLogId(null);
                setLogDetailOpen(true);
              }}
              onHistoryClick={handleHistoryHeaderClick}
            />
          </div>
        </div>

        {/* Modals */}
        <LogDetailModal
          open={logDetailOpen}
          onOpenChange={(open) => {
            setLogDetailOpen(open);
            if (!open) {
              setSelectedLogId(null);
              setSelectedRunId(null);
            }
          }}
          selectedLogId={selectedLogId}
          selectedRunId={selectedRunId}
        />

        <RunConfigModal
          open={runConfigOpen}
          onOpenChange={(open) => {
            setRunConfigOpen(open);
            if (!open) setPreselectedCategories([]);
          }}
          onRunStarted={handleRunStarted}
          initialCategories={preselectedCategories}
        />
      </div>
    </div>
  );
}
