"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PairingRequestsTable } from "@/components/admin/automation/pairing-requests-table";
import { AgentsTable } from "@/components/admin/automation/agents-table";
import { JobsTable } from "@/components/admin/automation/jobs-table";
import { SellersGrid } from "@/components/admin/collection/sellers-grid";
import { RecentLogsSidebar } from "@/components/admin/collection/recent-logs-sidebar";
import { LogDetailModal } from "@/components/admin/collection/log-detail-modal";
import { DiffModal } from "@/components/admin/collection/diff-modal";
import { ProgressBar } from "@/components/admin/collection/progress-bar";
import { ProgressDetailModal } from "@/components/admin/collection/progress-detail-modal";
import { RunConfigModal } from "@/components/admin/collection/run-config-modal";
import { CollectionHistory } from "@/components/admin/collection/collection-history";
import { ScheduleConfig } from "@/components/admin/collection/schedule-config";
import { useCollectionPolling } from "@/hooks/use-collection-polling";

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
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffSourceId, setDiffSourceId] = useState<string | null>(null);
  const [diffTargetId, setDiffTargetId] = useState<string | null>(null);
  const [progressDetailOpen, setProgressDetailOpen] = useState(false);
  const [runConfigOpen, setRunConfigOpen] = useState(false);
  const [progressMinimized, setProgressMinimized] = useState(false);
  const [preselectedCategories, setPreselectedCategories] = useState<string[]>([]);

  // Collection polling
  const { activeRun, progress, newSellerIds, clearNewSellerIds, refresh } =
    useCollectionPolling(2000);

  const supabase = createClient();

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
    setLogDetailOpen(true);
  };

  const handleHeaderClick = (mostRecentLogId: string | null) => {
    if (mostRecentLogId) {
      setSelectedLogId(mostRecentLogId);
      setLogDetailOpen(true);
    }
  };

  const handleCompare = (sourceId: string | null, targetId: string | null) => {
    setDiffSourceId(sourceId);
    setDiffTargetId(targetId);
    setLogDetailOpen(false);
    setDiffModalOpen(true);
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
        <h1 className="text-2xl font-bold text-white">Extension Hub</h1>
        <p className="text-gray-400 mt-1">
          Manage Chrome Extension agents, pairing requests, automation jobs, and seller collections.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
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
                onDetailsClick={() => {
                  setProgressMinimized(false);
                  setProgressDetailOpen(true);
                }}
                onRunStateChange={refresh}
              />
            )}

            {/* Main content: Grid (left) + Sidebar (right) */}
            <div className="flex gap-4 h-[calc(100vh-400px)] min-h-[400px]">
              {/* Sellers Grid - dominant left section */}
              <div className="flex-1 min-w-0">
                <SellersGrid
                  refreshTrigger={refreshTrigger}
                  onSellerChange={handleRefresh}
                  newSellerIds={newSellerIds}
                />
              </div>

              {/* Recent Logs Sidebar - right section */}
              <div className="w-64 flex-shrink-0">
                <RecentLogsSidebar
                  refreshTrigger={refreshTrigger}
                  onLogClick={handleLogClick}
                  onHeaderClick={handleHeaderClick}
                  onStartRunClick={() => setRunConfigOpen(true)}
                  hasActiveRun={!!activeRun}
                />
              </div>
            </div>

            {/* Collection History */}
            <CollectionHistory
              refreshTrigger={refreshTrigger}
              onRerun={(categoryIds) => {
                setPreselectedCategories(categoryIds);
                setRunConfigOpen(true);
              }}
            />

            {/* Schedule Configuration */}
            <ScheduleConfig />

            {/* Modals */}
            <LogDetailModal
              open={logDetailOpen}
              onOpenChange={setLogDetailOpen}
              selectedLogId={selectedLogId}
              onCompare={handleCompare}
            />

            <DiffModal
              open={diffModalOpen}
              onOpenChange={setDiffModalOpen}
              sourceId={diffSourceId}
              targetId={diffTargetId}
            />

            <ProgressDetailModal
              open={progressDetailOpen && !progressMinimized}
              onOpenChange={setProgressDetailOpen}
              progress={progress}
              isMinimized={progressMinimized}
              onMinimizeChange={setProgressMinimized}
              onCancel={handleCancelRun}
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
