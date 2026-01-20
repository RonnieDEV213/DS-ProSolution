"use client";

import { useCallback, useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { automationApi, AutomationJob, JobStatus } from "@/lib/api";
import { useAutomationPolling } from "@/hooks/use-automation-polling";

interface JobsTableProps {
  refreshTrigger: number;
}

const STATUS_BADGES: Record<JobStatus, { label: string; className: string }> = {
  QUEUED: { label: "Queued", className: "bg-blue-600 text-white" },
  CLAIMED: { label: "Claimed", className: "bg-yellow-600 text-white" },
  RUNNING: { label: "Running", className: "bg-yellow-600 text-white" },
  COMPLETED: { label: "Completed", className: "bg-green-600 text-white" },
  FAILED_NEEDS_ATTENTION: { label: "Failed", className: "bg-red-600 text-white" },
  FAILED_MAX_RETRIES: { label: "Max Retries", className: "bg-red-600 text-white" },
};

const STATUS_OPTIONS: { value: JobStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "QUEUED", label: "Queued" },
  { value: "CLAIMED", label: "Claimed" },
  { value: "RUNNING", label: "Running" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED_NEEDS_ATTENTION", label: "Failed" },
  { value: "FAILED_MAX_RETRIES", label: "Max Retries" },
];

export function JobsTable({ refreshTrigger }: JobsTableProps) {
  const [statusFilter, setStatusFilter] = useState<JobStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const fetcher = useCallback(async () => {
    const result = await automationApi.getJobs({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      page,
      pageSize,
    });
    setTotal(result.total);
    return result.jobs;
  }, [statusFilter, page, pageSize]);

  const { data: jobs, loading } = useAutomationPolling(fetcher, 10000);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as JobStatus | "ALL")}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-white hover:bg-gray-700"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-800 bg-gray-900">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-gray-900">
              <TableHead className="text-gray-400">eBay Order ID</TableHead>
              <TableHead className="text-gray-400">Item Name</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400">Attempts</TableHead>
              <TableHead className="text-gray-400">Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !jobs ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !jobs || jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const statusBadge = STATUS_BADGES[job.status];

                return (
                  <TableRow key={job.id} className="border-gray-800">
                    <TableCell className="font-mono text-white">
                      {job.ebay_order_id}
                    </TableCell>
                    <TableCell className="text-gray-300 max-w-[200px] truncate">
                      <span title={job.item_name}>{job.item_name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusBadge.className}>
                        {statusBadge.label}
                      </Badge>
                      {job.failure_reason && (
                        <p
                          className="text-xs text-red-400 mt-1 truncate max-w-[150px]"
                          title={job.failure_reason}
                        >
                          {job.failure_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          job.attempt_count > 1
                            ? "bg-yellow-600 text-white"
                            : "bg-gray-700 text-gray-300"
                        }
                      >
                        {job.attempt_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {formatDate(job.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <div className="text-sm text-gray-400">
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, total)} of {total} jobs
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
