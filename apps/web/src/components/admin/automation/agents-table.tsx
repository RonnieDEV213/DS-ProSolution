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

interface AgentsTableProps {
  refreshTrigger: number;
  onActionComplete: () => void;
}

const ROLE_BADGES: Record<AgentRole, { label: string; className: string }> = {
  EBAY_AGENT: { label: "eBay Agent", className: "bg-orange-600 text-white" },
  AMAZON_AGENT: { label: "Amazon Agent", className: "bg-blue-600 text-white" },
};

const STATUS_BADGES: Record<AgentStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-600 text-white" },
  offline: { label: "Offline", className: "bg-gray-600 text-white" },
  paused: { label: "Paused", className: "bg-yellow-600 text-white" },
  revoked: { label: "Revoked", className: "bg-red-600 text-white" },
};

const APPROVAL_BADGES: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-600 text-white" },
  approved: { label: "Approved", className: "bg-green-600 text-white" },
  rejected: { label: "Rejected", className: "bg-red-600 text-white" },
  revoked: { label: "Revoked", className: "bg-red-600 text-white" },
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
      <div className="rounded-lg border border-gray-800 bg-gray-900">
        {loading && !agents ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : !agents || agents.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No agents registered</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {groupedAgents.map((group) => {
              const key = group.accountCode || "unassigned";
              const isCollapsed = collapsedGroups.has(key);

              return (
                <div key={key}>
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.accountCode)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-800/50 transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-medium text-white">
                      {group.accountCode}
                      {group.accountName && (
                        <span className="text-gray-400 font-normal ml-2">({group.accountName})</span>
                      )}
                    </span>
                    <Badge variant="secondary" className="bg-gray-700 text-gray-300 ml-2">
                      {group.agents.length} agent{group.agents.length !== 1 ? "s" : ""}
                    </Badge>
                  </button>

                  {/* Agents Table */}
                  {!isCollapsed && (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-800 hover:bg-gray-900">
                          <TableHead className="text-gray-400 pl-10">Label</TableHead>
                          <TableHead className="text-gray-400">Role</TableHead>
                          <TableHead className="text-gray-400">Account Key</TableHead>
                          <TableHead className="text-gray-400">Status</TableHead>
                          <TableHead className="text-gray-400">Last Seen</TableHead>
                          <TableHead className="text-gray-400 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.agents.map((agent) => {
                          const roleBadge = agent.role ? ROLE_BADGES[agent.role] : null;
                          const statusBadge = STATUS_BADGES[agent.status];
                          const approvalBadge = APPROVAL_BADGES[agent.approval_status];
                          const accountKey = agent.ebay_account_key || agent.amazon_account_key;

                          return (
                            <TableRow key={agent.id} className="border-gray-800">
                              <TableCell className="text-white pl-10">
                                <div>
                                  <p className="font-medium">
                                    {agent.label || (
                                      <span className="text-gray-500 italic">No label</span>
                                    )}
                                  </p>
                                  <p
                                    className="text-xs text-gray-500 font-mono"
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
                                  <Badge variant="secondary" className="bg-gray-700 text-gray-400">
                                    Unconfigured
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {accountKey ? (
                                  <div className="flex items-center gap-2">
                                    <User className="w-3 h-3 text-gray-500" />
                                    <span className="text-gray-300 font-mono text-xs">{accountKey}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-600 italic text-xs">—</span>
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
                              <TableCell className="text-gray-400">
                                {formatDate(agent.last_seen_at)}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="bg-gray-800 border-gray-700"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => handleEditClick(agent)}
                                      className="text-gray-300 focus:bg-gray-700 focus:text-white cursor-pointer"
                                    >
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Edit Label
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setRevokingAgent(agent)}
                                      disabled={agent.status === "revoked"}
                                      className="text-yellow-400 focus:bg-gray-700 focus:text-yellow-300 cursor-pointer disabled:opacity-50"
                                    >
                                      <RefreshCcw className="w-4 h-4 mr-2" />
                                      Revoke (Force Re-pair)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setDeletingAgent(agent)}
                                      className="text-red-400 focus:bg-gray-700 focus:text-red-300 cursor-pointer"
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
        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Agent Label</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the display label for this agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Device ID</Label>
              <p className="font-mono text-sm text-gray-400 bg-gray-800 p-2 rounded">
                {editingAgent && truncateId(editingAgent.install_instance_id)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label" className="text-gray-300">
                Label
              </Label>
              <Input
                id="label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., John's workstation"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingAgent(null)}
              className="border-gray-700 text-gray-300"
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
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Revoke Agent</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will invalidate the agent&apos;s authentication token. The extension will need to
              request pairing again to continue working.
              {revokingAgent && (
                <span className="block mt-2 font-mono text-gray-300">
                  {revokingAgent.label || truncateId(revokingAgent.install_instance_id)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300">Cancel</AlertDialogCancel>
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
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Agent</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete this agent record. This action cannot be undone.
              {deletingAgent && (
                <span className="block mt-2 font-mono text-gray-300">
                  {deletingAgent.label || truncateId(deletingAgent.install_instance_id)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300">Cancel</AlertDialogCancel>
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
