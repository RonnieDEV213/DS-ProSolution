/**
 * @deprecated This component has been replaced by HistoryPanel in Phase 10.
 * Kept for reference but no longer used in automation page.
 * See: history-panel.tsx
 */
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { History, Plus, Minus, Edit3, Bot, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface LogEntry {
  id: string;
  action: "add" | "edit" | "remove";
  seller_name: string;
  source: "manual" | "collection_run" | "auto_remove";
  affected_count: number;
  created_at: string;
}

interface RecentLogsSidebarProps {
  refreshTrigger: number;
  onLogClick: (logId: string) => void;
  onHeaderClick: (mostRecentLogId: string | null) => void;
  onStartRunClick: () => void;
  hasActiveRun: boolean;
}

const actionIcons = {
  add: <Plus className="h-3 w-3 text-green-400" />,
  edit: <Edit3 className="h-3 w-3 text-yellow-400" />,
  remove: <Minus className="h-3 w-3 text-red-400" />,
};

const sourceIcons = {
  manual: <User className="h-3 w-3" />,
  collection_run: <Bot className="h-3 w-3" />,
  auto_remove: <Bot className="h-3 w-3" />,
};

export function RecentLogsSidebar({
  refreshTrigger,
  onLogClick,
  onHeaderClick,
  onStartRunClick,
  hasActiveRun,
}: RecentLogsSidebarProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch(`${API_BASE}/sellers/audit-log?limit=20`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setLogs(data.entries || []);
        }
      } catch (e) {
        console.error("Failed to fetch audit log:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [refreshTrigger, supabase.auth]);

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => onHeaderClick(logs.length > 0 ? logs[0].id : null)}
        className="flex items-center gap-2 mb-3 hover:text-white transition-colors group"
      >
        <History className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Recent Activity</h3>
      </button>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 scrollbar-thin">
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-muted-foreground text-sm">No activity yet</div>
        ) : (
          logs.map((log) => (
            <button
              key={log.id}
              onClick={() => onLogClick(log.id)}
              className="w-full text-left px-2 py-1.5 rounded bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                {actionIcons[log.action]}
                <span className="text-foreground text-sm truncate flex-1">
                  {log.affected_count > 1
                    ? `${log.affected_count} sellers`
                    : log.seller_name}
                </span>
                {sourceIcons[log.source]}
              </div>
              <div className="text-muted-foreground text-xs mt-0.5 font-mono">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Start Run button */}
      <div className="mt-3 pt-3 border-t border-border">
        <Button
          onClick={onStartRunClick}
          disabled={hasActiveRun}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {hasActiveRun ? "Run in Progress..." : "Start Collection"}
        </Button>
      </div>
    </div>
  );
}
