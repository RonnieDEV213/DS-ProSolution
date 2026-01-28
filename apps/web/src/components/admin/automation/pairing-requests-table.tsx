"use client";

import { useCallback, useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  automationApi,
  PendingPairingRequest,
  AvailableAccount,
  AvailableEbayAgent,
  AgentRole,
} from "@/lib/api";
import { useAutomationPolling } from "@/hooks/use-automation-polling";
import { RejectDialog } from "./reject-dialog";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { FirstTimeEmpty } from "@/components/empty-states/first-time-empty";
import { AlertTriangle, User } from "lucide-react";

interface PairingRequestsTableProps {
  refreshTrigger: number;
  onActionComplete: () => void;
}

const ROLE_OPTIONS: { value: AgentRole; label: string }[] = [
  { value: "EBAY_AGENT", label: "eBay Agent" },
  { value: "AMAZON_AGENT", label: "Amazon Agent" },
];

// Special value for "Create New Account" option
const NEW_ACCOUNT_VALUE = "__new__";

export function PairingRequestsTable({
  refreshTrigger,
  onActionComplete,
}: PairingRequestsTableProps) {
  const [approvingRequest, setApprovingRequest] = useState<PendingPairingRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<PendingPairingRequest | null>(null);
  const [accounts, setAccounts] = useState<AvailableAccount[]>([]);
  const [ebayAgents, setEbayAgents] = useState<AvailableEbayAgent[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedEbayAgentId, setSelectedEbayAgentId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<AgentRole | "">("");
  const [label, setLabel] = useState("");
  const [approving, setApproving] = useState(false);

  const fetcher = useCallback(async () => {
    const result = await automationApi.getPendingRequests();
    return result.requests;
  }, []);

  const { data: requests, loading, refetch } = useAutomationPolling(fetcher, 5000);

  // Load available accounts and eBay agents when approval dialog opens
  useEffect(() => {
    if (approvingRequest) {
      // Fetch accounts for eBay agent assignment
      automationApi.getAvailableAccounts().then((res) => setAccounts(res.accounts));

      // Fetch eBay agents for Amazon agent assignment
      automationApi.getAvailableEbayAgents().then((res) => {
        setEbayAgents(res.ebay_agents);
        // Auto-select if only one eBay agent and role is Amazon
        if (approvingRequest.detected_role === "AMAZON_AGENT" && res.ebay_agents.length === 1) {
          setSelectedEbayAgentId(res.ebay_agents[0].id);
        }
      });

      // Pre-select detected role if available
      if (approvingRequest.detected_role) {
        setSelectedRole(approvingRequest.detected_role);
      }
      // Pre-select "Create New Account" if eBay agent with detected name
      if (approvingRequest.detected_role === "EBAY_AGENT" && approvingRequest.ebay_account_display) {
        setSelectedAccountId(NEW_ACCOUNT_VALUE);
      }
    }
  }, [approvingRequest]);

  const resetApprovalForm = () => {
    setSelectedAccountId("");
    setSelectedEbayAgentId("");
    setSelectedRole("");
    setLabel("");
    setApprovingRequest(null);
  };

  const handleApprove = async () => {
    if (!approvingRequest || !selectedRole) {
      toast.error("Please select a role");
      return;
    }

    // For eBay agents: require account selection (either new or existing)
    if (selectedRole === "EBAY_AGENT" && !selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    // For Amazon agents: require eBay agent selection
    if (selectedRole === "AMAZON_AGENT" && !selectedEbayAgentId) {
      toast.error("Please select an eBay agent");
      return;
    }

    // Determine account_id to send:
    // - NEW_ACCOUNT_VALUE = undefined (triggers auto-create)
    // - Actual UUID = use that account
    const accountIdToSend = selectedAccountId === NEW_ACCOUNT_VALUE ? undefined : selectedAccountId || undefined;

    setApproving(true);
    try {
      await automationApi.approveRequest(approvingRequest.id, {
        account_id: accountIdToSend,
        ebay_agent_id: selectedRole === "AMAZON_AGENT" ? selectedEbayAgentId : undefined,
        role: selectedRole,
        label: label.trim() || undefined,
      });
      toast.success("Pairing request approved");
      resetApprovalForm();
      refetch();
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request");
    } finally {
      setApproving(false);
    }
  };

  const handleRejected = () => {
    setRejectingRequest(null);
    refetch();
    onActionComplete();
  };

  const truncateId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-6)}`;
  };

  const getTimeRemaining = (expiresAt: string) => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return "Expired";
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt).getTime() < Date.now();
  };

  const getDetectedType = (request: PendingPairingRequest) => {
    if (request.detected_role === "EBAY_AGENT" || request.ebay_account_key) return "eBay";
    if (request.detected_role === "AMAZON_AGENT" || request.amazon_account_key) return "Amazon";
    return "Unknown";
  };

  const getDetectedAccount = (request: PendingPairingRequest) => {
    return request.ebay_account_display || request.amazon_account_display || null;
  };

  // Show warning for eBay agent when selecting an existing account (replacement warning)
  const showEbayWarning = selectedRole === "EBAY_AGENT" && selectedAccountId && selectedAccountId !== NEW_ACCOUNT_VALUE;

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-mono">Device ID</TableHead>
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Detected Account</TableHead>
              <TableHead className="text-muted-foreground font-mono">Expires In</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !requests ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <TableSkeleton columns={5} rows={3} />
                </TableCell>
              </TableRow>
            ) : !requests || requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8">
                  <FirstTimeEmpty
                    entityName="pairing requests"
                    description="No Chrome Extensions are waiting to be paired."
                  />
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => {
                const expired = isExpired(request.expires_at);
                const detectedType = getDetectedType(request);
                const detectedAccount = getDetectedAccount(request);

                return (
                  <TableRow
                    key={request.id}
                    className={`border-border ${expired ? "opacity-50" : ""}`}
                  >
                    <TableCell>
                        <span className="font-mono text-sm px-1.5 py-0.5 rounded bg-primary/10 text-foreground" title={request.install_instance_id}>
                          {truncateId(request.install_instance_id)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            detectedType === "eBay"
                              ? "bg-orange-600 text-white"
                              : detectedType === "Amazon"
                              ? "bg-blue-600 text-white"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {detectedType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {detectedAccount ? (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{detectedAccount}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Not detected</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={expired ? "text-red-400 font-mono" : "text-yellow-400 font-mono"}>
                          {getTimeRemaining(request.expires_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={() => setApprovingRequest(request)}
                          disabled={expired}
                          className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectingRequest(request)}
                          disabled={expired}
                          className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white disabled:opacity-50"
                        >
                          Reject
                        </Button>
                      </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Approval Dialog */}
      <Dialog open={!!approvingRequest} onOpenChange={(open) => !open && resetApprovalForm()}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Approve Pairing Request</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Assign this extension to an account and role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Device ID display */}
            <div className="space-y-2">
              <Label className="text-foreground">Device ID</Label>
              <p className="font-mono text-sm text-muted-foreground bg-muted p-2 rounded">
                {approvingRequest && truncateId(approvingRequest.install_instance_id)}
              </p>
            </div>

            {/* Detected Account Info */}
            {approvingRequest && (approvingRequest.ebay_account_display || approvingRequest.amazon_account_display) && (
              <div className="p-3 bg-muted rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase mb-2">Detected Account</p>
                {approvingRequest.ebay_account_display && (
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-orange-600 text-white text-xs">eBay</Badge>
                    <span className="text-foreground">{approvingRequest.ebay_account_display}</span>
                  </div>
                )}
                {approvingRequest.amazon_account_display && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-600 text-white text-xs">Amazon</Badge>
                    <span className="text-foreground">{approvingRequest.amazon_account_display}</span>
                  </div>
                )}
              </div>
            )}

            {/* Account/eBay Agent section - depends on role */}
            {selectedRole === "AMAZON_AGENT" ? (
              // Amazon: Show eBay agent dropdown
              <div className="space-y-2">
                <Label className="text-foreground">eBay Agent</Label>
                <Select value={selectedEbayAgentId} onValueChange={setSelectedEbayAgentId}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder="Select eBay agent..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {ebayAgents.length === 0 ? (
                      <SelectItem value="none" disabled className="text-muted-foreground">
                        No eBay agents available
                      </SelectItem>
                    ) : (
                      ebayAgents.map((agent) => (
                        <SelectItem
                          key={agent.id}
                          value={agent.id}
                          className="text-popover-foreground focus:bg-accent"
                        >
                          {agent.account_code}{agent.account_name ? ` - ${agent.account_name}` : ""}
                          {agent.label ? ` (${agent.label})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {ebayAgents.length === 0 && (
                  <p className="text-xs text-yellow-400">
                    No eBay agents available. Create an eBay agent first.
                  </p>
                )}
                {ebayAgents.length === 1 && selectedEbayAgentId && (
                  <p className="text-xs text-muted-foreground">
                    Auto-selected (only one eBay agent available)
                  </p>
                )}
              </div>
            ) : (
              // eBay: Show dropdown with "Create New" first, then existing accounts
              <div className="space-y-2">
                <Label className="text-foreground">Account</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {/* Create New Account option - only if eBay name detected */}
                    {approvingRequest?.ebay_account_display && (
                      <SelectItem
                        value={NEW_ACCOUNT_VALUE}
                        className="text-popover-foreground focus:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-green-600 text-white text-xs">New</Badge>
                          <span>{approvingRequest.ebay_account_display}</span>
                        </div>
                      </SelectItem>
                    )}
                    {/* Existing accounts */}
                    {accounts.map((account) => (
                      <SelectItem
                        key={account.id}
                        value={account.id}
                        className="text-popover-foreground focus:bg-accent"
                      >
                        {account.account_code}{account.name ? ` - ${account.name}` : ""}
                      </SelectItem>
                    ))}
                    {/* No options message */}
                    {!approvingRequest?.ebay_account_display && accounts.length === 0 && (
                      <SelectItem value="none" disabled className="text-muted-foreground">
                        No accounts available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedAccountId === NEW_ACCOUNT_VALUE && (
                  <p className="text-xs text-muted-foreground">
                    A new account will be created with sequential code when approved
                  </p>
                )}
              </div>
            )}

            {/* Role selection */}
            <div className="space-y-2">
              <Label className="text-foreground">Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(val) => {
                  setSelectedRole(val as AgentRole);
                  // Reset selections when switching roles
                  if (val === "AMAZON_AGENT") {
                    setSelectedAccountId("");
                    // Auto-select if only one eBay agent
                    if (ebayAgents.length === 1) {
                      setSelectedEbayAgentId(ebayAgents[0].id);
                    } else {
                      setSelectedEbayAgentId("");
                    }
                  } else if (val === "EBAY_AGENT") {
                    setSelectedEbayAgentId("");
                    if (approvingRequest?.ebay_account_display) {
                      setSelectedAccountId(NEW_ACCOUNT_VALUE);
                    }
                  }
                }}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {ROLE_OPTIONS.map((role) => {
                    const isDetected = approvingRequest?.detected_role === role.value;
                    return (
                      <SelectItem
                        key={role.value}
                        value={role.value}
                        className="text-popover-foreground focus:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          {isDetected && (
                            <Badge variant="secondary" className="bg-purple-600 text-white text-xs">Detected</Badge>
                          )}
                          <span>{role.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Warning for eBay agent - only one per account */}
            {showEbayWarning && (
              <div className="flex items-start gap-2 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-300">
                  <p className="font-medium">Only one eBay agent per account</p>
                  <p className="text-yellow-400/80">
                    If this account already has an eBay agent, it will be automatically revoked
                    and replaced by this new agent.
                  </p>
                </div>
              </div>
            )}

            {/* Label (optional) */}
            <div className="space-y-2">
              <Label className="text-foreground">Label (optional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., John's workstation"
                className="bg-muted border-border text-foreground"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetApprovalForm}
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={
                approving ||
                !selectedRole ||
                // eBay agents require account selection (new or existing)
                (selectedRole === "EBAY_AGENT" && !selectedAccountId) ||
                // Amazon agents require eBay agent selection
                (selectedRole === "AMAZON_AGENT" && !selectedEbayAgentId)
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {approving ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <RejectDialog
        request={rejectingRequest}
        open={!!rejectingRequest}
        onOpenChange={(open) => !open && setRejectingRequest(null)}
        onRejected={handleRejected}
      />
    </>
  );
}
