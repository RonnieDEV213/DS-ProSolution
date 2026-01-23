"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Copy,
  Plus,
  RefreshCw,
  Database,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ActivityEntry } from "./activity-feed";

interface PipelineFeedProps {
  activities: ActivityEntry[];
  maxEntries?: number;
}

// Filter to only pipeline actions (worker_id=0 system events)
const PIPELINE_ACTIONS = ["uploading", "deduped", "inserted", "updated"];

const pipelineIcons: Record<string, React.ReactNode> = {
  uploading: <Upload className="h-3.5 w-3.5" />,
  deduped: <Copy className="h-3.5 w-3.5" />,
  inserted: <Plus className="h-3.5 w-3.5" />,
  updated: <RefreshCw className="h-3.5 w-3.5" />,
};

const pipelineColors: Record<string, string> = {
  uploading: "border-l-purple-400 bg-purple-900/20",
  deduped: "border-l-gray-400 bg-gray-800/50",
  inserted: "border-l-green-400 bg-green-900/20",
  updated: "border-l-blue-400 bg-blue-900/20",
};

function formatPipelineMessage(entry: ActivityEntry): string {
  const count = entry.items_count || 0;

  switch (entry.action) {
    case "uploading":
      return `Uploading ${count} products to database`;
    case "deduped":
      return `Deduped ${count} duplicate sellers`;
    case "inserted":
      const source = entry.source_worker_id
        ? ` from Worker ${entry.source_worker_id}`
        : "";
      return `Inserted ${count} new sellers${source}`;
    case "updated":
      return `Updated ${count} existing sellers`;
    default:
      return entry.action;
  }
}

function PipelineCard({ entry }: { entry: ActivityEntry }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "p-2 rounded border-l-4",
        pipelineColors[entry.action] || "border-l-gray-400 bg-gray-800/50"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="text-gray-400">
          {pipelineIcons[entry.action] || <Database className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200">
            {formatPipelineMessage(entry)}
          </div>
          {entry.source_worker_id && entry.source_worker_id > 0 && (
            <Badge className="text-[9px] mt-1 bg-gray-700/50 text-gray-400">
              <User className="h-2 w-2 mr-0.5" />
              W{entry.source_worker_id}
            </Badge>
          )}
        </div>
        <div className="text-[10px] text-gray-500">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </div>
      </div>
    </motion.div>
  );
}

export function PipelineFeed({ activities, maxEntries = 30 }: PipelineFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter to pipeline-only events
  const pipelineActivities = activities.filter(
    (a) => a.worker_id === 0 && PIPELINE_ACTIONS.includes(a.action)
  );

  // Auto-scroll to top on new entries
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [pipelineActivities.length]);

  const displayedActivities = pipelineActivities.slice(0, maxEntries);

  if (displayedActivities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-gray-500 text-sm">
        <Database className="h-5 w-5 mb-2 opacity-50" />
        <span>Waiting for pipeline activity...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="space-y-1.5 h-full overflow-y-auto pr-1"
    >
      <AnimatePresence mode="popLayout">
        {displayedActivities.map((entry) => (
          <PipelineCard key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </div>
  );
}
