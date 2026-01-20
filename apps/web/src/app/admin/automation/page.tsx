"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PairingRequestsTable } from "@/components/admin/automation/pairing-requests-table";
import { AgentsTable } from "@/components/admin/automation/agents-table";
import { JobsTable } from "@/components/admin/automation/jobs-table";

type Tab = "pairing" | "agents" | "jobs";

const tabs: { id: Tab; label: string }[] = [
  { id: "pairing", label: "Pairing Requests" },
  { id: "agents", label: "Agents" },
  { id: "jobs", label: "Jobs" },
];

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pairing");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => setRefreshTrigger((n) => n + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Extension Hub</h1>
        <p className="text-gray-400 mt-1">
          Manage Chrome Extension agents, pairing requests, and automation jobs.
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
      </div>
    </div>
  );
}
