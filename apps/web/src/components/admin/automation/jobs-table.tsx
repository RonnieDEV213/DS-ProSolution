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
import { FirstTimeEmpty } from "@/components/empty-states/first-time-empty";
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
  QUEUED: { label: "Queued", className: "bg-chart-4/20 text-chart-4" },
  CLAIMED: { label: "Claimed", className: "bg-chart-4/20 text-chart-4" },
  RUNNING: { label: "Running", className: "bg-chart-1/20 text-chart-1" },
  COMPLETED: { label: "Completed", className: "bg-primary/20 text-primary" },
  FAILED_NEEDS_ATTENTION: { label: "Failed", className: "bg-destructive/20 text-destructive" },
  FAILED_MAX_RETRIES: { label: "Max Retries", className: "bg-destructive/20 text-destructive" },
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
            <SelectTrigger className="bg-muted border-border text-foreground">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-popover-foreground hover:bg-accent"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-mono">eBay Order ID</TableHead>
              <TableHead className="text-muted-foreground">Item Name</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground font-mono">Attempts</TableHead>
              <TableHead className="text-muted-foreground font-mono">Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !jobs ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !jobs || jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8">
                  <FirstTimeEmpty entityName="jobs" />
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const statusBadge = STATUS_BADGES[job.status];

                return (
                  <TableRow key={job.id} className="border-border">
                    <TableCell className="font-mono text-sm px-1.5 py-0.5">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-foreground">{job.ebay_order_id}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      <span title={job.item_name}>{job.item_name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusBadge.className}>
                        {statusBadge.label}
                      </Badge>
                      {job.failure_reason && (
                        <p
                          className="text-xs text-destructive mt-1 truncate max-w-[150px]"
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
                            ? "bg-chart-4/20 text-chart-4 font-mono"
                            : "bg-muted text-muted-foreground font-mono"
                        }
                      >
                        {job.attempt_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground font-mono">
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, total)} of {total} jobs
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-border text-muted-foreground hover:bg-accent"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border-border text-muted-foreground hover:bg-accent"
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
