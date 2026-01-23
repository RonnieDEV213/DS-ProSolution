"use client";

import { WorkerCard } from "./worker-card";
import { ActivityEntry, WorkerMetrics } from "./activity-feed";

interface WorkerStatusPanelProps {
  activities: ActivityEntry[];
  workerMetrics: Map<number, WorkerMetrics>;
  onExpandWorker: (workerId: number) => void;
}

export function WorkerStatusPanel({
  activities,
  workerMetrics,
  onExpandWorker,
}: WorkerStatusPanelProps) {
  // Get last activity per worker
  const lastActivityByWorker = new Map<number, ActivityEntry>();
  for (const activity of activities) {
    if (
      activity.worker_id > 0 &&
      !lastActivityByWorker.has(activity.worker_id)
    ) {
      lastActivityByWorker.set(activity.worker_id, activity);
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-300 mb-3">Workers</div>
      {/* 2x3 grid of workers */}
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4, 5, 6].map((workerId) => (
          <WorkerCard
            key={workerId}
            worker_id={workerId}
            lastActivity={lastActivityByWorker.get(workerId)}
            onClick={() => onExpandWorker(workerId)}
          />
        ))}
      </div>
    </div>
  );
}
