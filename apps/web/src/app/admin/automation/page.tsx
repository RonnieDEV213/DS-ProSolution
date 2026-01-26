"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PairingRequestsTable } from "@/components/admin/automation/pairing-requests-table";
import { AgentsTable } from "@/components/admin/automation/agents-table";
import { JobsTable } from "@/components/admin/automation/jobs-table";
import { SellersGrid } from "@/components/admin/collection/sellers-grid";
import { HistoryPanel } from "@/components/admin/collection/history-panel";
import { LogDetailModal } from "@/components/admin/collection/log-detail-modal";
import { ProgressBar } from "@/components/admin/collection/progress-bar";
import { RunConfigModal } from "@/components/admin/collection/run-config-modal";
import { useCollectionProgress } from "@/contexts/collection-progress-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type Tab = "pairing" | "agents" | "jobs" | "collections";

const tabs: { id: Tab; label: string }[] = [
  { id: "pairing", label: "Pairing Requests" },
  { id: "agents", label: "Agents" },
  { id: "jobs", label: "Jobs" },
  { id: "collections", label: "Collections" },
];

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pairing");
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

  // Hide minimized indicator when on Collections tab (progress bar is visible there)
  useEffect(() => {
    setHideMinimized(activeTab === "collections");
    return () => setHideMinimized(false); // Reset when leaving page
  }, [activeTab, setHideMinimized]);

  const supabase = createClient();

  // Track sellers_new to refresh seller list when new sellers are found
  const prevSellersNewRef = useRef<number | null>(null);
  const prevRunStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!progress) {
      // Run completed or no active run - trigger final refresh if we were tracking
      if (prevSellersNewRef.current !== null && prevSellersNewRef.current > 0) {
        handleRefresh();
      }
      prevSellersNewRef.current = null;
      prevRunStatusRef.current = null;
      return;
    }

    // Refresh seller list when new sellers count increases
    const currentNew = progress.sellers_new || 0;
    if (prevSellersNewRef.current !== null && currentNew > prevSellersNewRef.current) {
      handleRefresh();
    }
    prevSellersNewRef.current = currentNew;
    prevRunStatusRef.current = progress.status;
  }, [progress?.sellers_new, progress?.status]);

  const handleRefresh = () => setRefreshTrigger((n) => n + 1);

  const handleCancelRun = async () => {
    if (!activeRun) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await fetch(`${API_BASE}/collection/runs/${activeRun.id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      refresh();
      handleRefresh();
    } catch (e) {
      console.error("Failed to cancel run:", e);
    }
  };

  const handleLogClick = (logId: string) => {
    setSelectedLogId(logId);
    setSelectedRunId(null);
    setLogDetailOpen(true);
  };

  const handleHeaderClick = (mostRecentLogId: string | null) => {
    if (mostRecentLogId) {
      setSelectedLogId(mostRecentLogId);
      setLogDetailOpen(true);
    }
  };

  const handleRunStarted = () => {
    clearNewSellerIds();
    refresh();
    handleRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Extension Hub</h1>
        <p className="text-muted-foreground mt-1">
          Manage Chrome Extension agents, pairing requests, automation jobs, and seller collections.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "pairing" && (
          <PairingRequestsTable
            refreshTrigger={refreshTrigger}
            onActionComplete={handleRefresh}
          />
        )}
        {activeTab === "agents" && (
          <AgentsTable
            refreshTrigger={refreshTrigger}
            onActionComplete={handleRefresh}
          />
        )}
        {activeTab === "jobs" && (
          <JobsTable refreshTrigger={refreshTrigger} />
        )}
        {activeTab === "collections" && (
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
              {/* Sellers Grid - reduced columns per CONTEXT.md */}
              <div className="flex-1 min-w-0">
                <SellersGrid
                  refreshTrigger={refreshTrigger}
                  onSellerChange={handleRefresh}
                  newSellerIds={newSellerIds}
                />
              </div>

              {/* History Panel - wider than old sidebar */}
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
        )}
      </div>
    </div>
  );
}
