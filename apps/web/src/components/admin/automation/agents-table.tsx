"use client";

import { useCallback, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  automationApi,
  Agent,
  AgentRole,
  AgentStatus,
  ApprovalStatus,
} from "@/lib/api";
import { useAutomationPolling } from "@/hooks/use-automation-polling";
import { MoreVertical, Pencil, RefreshCcw, Trash2, ChevronDown, ChevronRight, User } from "lucide-react";
import { FirstTimeEmpty } from "@/components/empty-states/first-time-empty";

interface AgentsTableProps {
  refreshTrigger: number;
  onActionComplete: () => void;
}

const ROLE_BADGES: Record<AgentRole, { label: string; className: string }> = {
  EBAY_AGENT: { label: "eBay Agent", className: "bg-orange-600 text-white" },
  AMAZON_AGENT: { label: "Amazon Agent", className: "bg-blue-600 text-white" },
};

const STATUS_BADGES: Record<AgentStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-primary/20 text-primary" },
  offline: { label: "Offline", className: "bg-muted text-muted-foreground" },
  paused: { label: "Paused", className: "bg-chart-4/20 text-chart-4" },
  revoked: { label: "Revoked", className: "bg-destructive/20 text-destructive" },
};

const APPROVAL_BADGES: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-chart-4/20 text-chart-4" },
  approved: { label: "Approved", className: "bg-primary/20 text-primary" },
  rejected: { label: "Rejected", className: "bg-destructive/20 text-destructive" },
  revoked: { label: "Revoked", className: "bg-destructive/20 text-destructive" },
  replacing: { label: "Replacing", className: "bg-purple-600 text-white" },
};

interface GroupedAgents {
  accountId: string | null;
  accountCode: string;
  accountName: string | null;
  agents: Agent[];
}

export function AgentsTable({ refreshTrigger, onActionComplete }: AgentsTableProps) {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [revokingAgent, setRevokingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const fetcher = useCallback(async () => {
    const result = await automationApi.getAgents();
    return result.agents;
  }, []);

  const { data: agents, loading, refetch } = useAutomationPolling(fetcher, 10000);

  // Group agents by account (using account_code as key since Amazon agents have no account_id)
  const groupedAgents = useMemo(() => {
    if (!agents) return [];

    const groups: Map<string, GroupedAgents> = new Map();

    agents.forEach((agent) => {
      // Use account_code as the grouping key
      // For eBay agents: account_code comes from their account
      // For Amazon agents: account_code comes from their linked eBay agent's account
      const accountCode = agent.account_code;
      const key = accountCode || "unassigned";

      if (!groups.has(key)) {
        groups.set(key, {
          accountId: agent.account_id,
          accountCode: accountCode || "Unassigned",
          accountName: agent.account_name || null,
          agents: [],
        });
      }
      groups.get(key)!.agents.push(agent);
    });

    // Sort groups: accounts first (by account_code), then unassigned
    return Array.from(groups.values()).sort((a, b) => {
      if (a.accountCode === "Unassigned") return 1;
      if (b.accountCode === "Unassigned") return -1;
      return a.accountCode.localeCompare(b.accountCode);
    });
  }, [agents]);

  const toggleGroup = (accountCode: string) => {
    const key = accountCode || "unassigned";
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleEditClick = (agent: Agent) => {
    setNewLabel(agent.label || "");
    setEditingAgent(agent);
  };

  const handleSaveLabel = async () => {
    if (!editingAgent) return;

    setSaving(true);
    try {
      await automationApi.updateAgent(editingAgent.id, { label: newLabel.trim() || undefined });
      toast.success("Agent label updated");
      setEditingAgent(null);
      refetch();
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokingAgent) return;

    setSaving(true);
    try {
      await automationApi.revokeAgent(revokingAgent.id);
      toast.success("Agent revoked - extension will need to re-pair");
      setRevokingAgent(null);
      refetch();
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAgent) return;

    setSaving(true);
    try {
      await automationApi.deleteAgent(deletingAgent.id);
      toast.success("Agent deleted");
      setDeletingAgent(null);
      refetch();
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const truncateId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-6)}`;
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        {loading && !agents ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : !agents || agents.length === 0 ? (
          <div className="py-8">
            <FirstTimeEmpty
              entityName="agents"
              description="No Chrome Extension agents have been registered yet. Pair an extension to get started."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groupedAgents.map((group) => {
              const key = group.accountCode || "unassigned";
              const isCollapsed = collapsedGroups.has(key);

              return (
                <div key={key}>
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.accountCode)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-foreground">
                      {group.accountCode}
                      {group.accountName && (
                        <span className="text-muted-foreground font-normal ml-2">({group.accountName})</span>
                      )}
                    </span>
                    <Badge variant="secondary" className="bg-muted text-muted-foreground ml-2">
                      {group.agents.length} agent{group.agents.length !== 1 ? "s" : ""}
                    </Badge>
                  </button>

                  {/* Agents Table */}
                  {!isCollapsed && (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground pl-10">Label</TableHead>
                          <TableHead className="text-muted-foreground">Role</TableHead>
                          <TableHead className="text-muted-foreground font-mono">Account Key</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground font-mono">Last Seen</TableHead>
                          <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.agents.map((agent) => {
                          const roleBadge = agent.role ? ROLE_BADGES[agent.role] : null;
                          const statusBadge = STATUS_BADGES[agent.status];
                          const approvalBadge = APPROVAL_BADGES[agent.approval_status];
                          const accountKey = agent.ebay_account_key || agent.amazon_account_key;

                          return (
                            <TableRow key={agent.id} className="border-border">
                              <TableCell className="text-foreground pl-10">
                                <div>
                                  <p className="font-medium">
                                    {agent.label || (
                                      <span className="text-muted-foreground italic">No label</span>
                                    )}
                                  </p>
                                  <p
                                    className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10 text-muted-foreground inline-block"
                                    title={agent.install_instance_id}
                                  >
                                    {truncateId(agent.install_instance_id)}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {roleBadge ? (
                                  <Badge variant="secondary" className={roleBadge.className}>
                                    {roleBadge.label}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                    Unconfigured
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {accountKey ? (
                                  <div className="flex items-center gap-2">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                    <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10 text-foreground">{accountKey}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic text-xs">&mdash;</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant="secondary" className={statusBadge.className}>
                                    {statusBadge.label}
                                  </Badge>
                                  {agent.approval_status !== "approved" && (
                                    <Badge variant="secondary" className={approvalBadge.className + " text-xs"}>
                                      {approvalBadge.label}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground font-mono text-sm">
                                {formatDate(agent.last_seen_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="bg-popover border-border"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => handleEditClick(agent)}
                                      className="text-popover-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer"
                                    >
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Edit Label
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setRevokingAgent(agent)}
                                      disabled={agent.status === "revoked"}
                                      className="text-yellow-400 focus:bg-accent focus:text-yellow-300 cursor-pointer disabled:opacity-50"
                                    >
                                      <RefreshCcw className="w-4 h-4 mr-2" />
                                      Revoke (Force Re-pair)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setDeletingAgent(agent)}
                                      className="text-red-400 focus:bg-accent focus:text-red-300 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Label Dialog */}
      <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Agent Label</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the display label for this agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Device ID</Label>
              <p className="font-mono text-sm text-muted-foreground bg-muted p-2 rounded">
                {editingAgent && truncateId(editingAgent.install_instance_id)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label" className="text-foreground">
                Label
              </Label>
              <Input
                id="label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., John's workstation"
                className="bg-muted border-border text-foreground"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingAgent(null)}
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLabel}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokingAgent} onOpenChange={(open) => !open && setRevokingAgent(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Revoke Agent</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will invalidate the agent&apos;s authentication token. The extension will need to
              request pairing again to continue working.
              {revokingAgent && (
                <span className="block mt-2 font-mono text-foreground">
                  {revokingAgent.label || truncateId(revokingAgent.install_instance_id)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={saving}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {saving ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAgent} onOpenChange={(open) => !open && setDeletingAgent(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Agent</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete this agent record. This action cannot be undone.
              {deletingAgent && (
                <span className="block mt-2 font-mono text-foreground">
                  {deletingAgent.label || truncateId(deletingAgent.install_instance_id)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
