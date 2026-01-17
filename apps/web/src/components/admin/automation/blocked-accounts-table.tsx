"use client";

import { useCallback, useState } from "react";
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
  BlockedAccount,
  BlockedAccountProvider,
} from "@/lib/api";
import { useAutomationPolling } from "@/hooks/use-automation-polling";
import { Trash2, Plus, RefreshCcw } from "lucide-react";

const PROVIDER_BADGES: Record<BlockedAccountProvider, { label: string; className: string }> = {
  ebay: { label: "eBay", className: "bg-orange-600 text-white" },
  amazon: { label: "Amazon", className: "bg-blue-600 text-white" },
};

export function BlockedAccountsTable() {
  const [unblockingAccount, setUnblockingAccount] = useState<BlockedAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Add block form state
  const [newProvider, setNewProvider] = useState<BlockedAccountProvider>("ebay");
  const [newAccountKey, setNewAccountKey] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  const fetcher = useCallback(async () => {
    const result = await automationApi.getBlockedAccounts();
    return result.blocked_accounts;
  }, []);

  const { data: blockedAccounts, loading, refetch } = useAutomationPolling(fetcher, 30000);

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountKey.trim()) {
      toast.error("Account key is required");
      return;
    }

    setAdding(true);
    try {
      await automationApi.blockAccount({
        provider: newProvider,
        account_key: newAccountKey.trim().toLowerCase(),
        reason: newReason.trim() || undefined,
      });
      toast.success("Account blocked successfully");
      setNewAccountKey("");
      setNewReason("");
      refetch();
    } catch (error) {
      toast.error("Failed to block account");
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  const handleUnblock = async () => {
    if (!unblockingAccount) return;

    setSaving(true);
    try {
      await automationApi.unblockAccount(unblockingAccount.id);
      toast.success("Account unblocked successfully");
      setUnblockingAccount(null);
      refetch();
    } catch (error) {
      toast.error("Failed to unblock account");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Add Block Form */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Block an Account</h3>
        <form onSubmit={handleAddBlock} className="flex gap-3 items-end flex-wrap">
          <div className="space-y-1.5">
            <Label htmlFor="provider" className="text-xs text-gray-400">Provider</Label>
            <Select
              value={newProvider}
              onValueChange={(val) => setNewProvider(val as BlockedAccountProvider)}
            >
              <SelectTrigger className="w-[120px] bg-gray-800 border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ebay">eBay</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label htmlFor="account-key" className="text-xs text-gray-400">Account Key</Label>
            <Input
              id="account-key"
              placeholder="e.g., seller_store_123"
              value={newAccountKey}
              onChange={(e) => setNewAccountKey(e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label htmlFor="reason" className="text-xs text-gray-400">Reason (optional)</Label>
            <Input
              id="reason"
              placeholder="e.g., Suspicious activity"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>
          <Button type="submit" disabled={adding || !newAccountKey.trim()} className="gap-2">
            <Plus className="h-4 w-4" />
            {adding ? "Blocking..." : "Block Account"}
          </Button>
        </form>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="text-gray-400">Provider</TableHead>
              <TableHead className="text-gray-400">Account Key</TableHead>
              <TableHead className="text-gray-400">Reason</TableHead>
              <TableHead className="text-gray-400">Created At</TableHead>
              <TableHead className="text-gray-400 w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !blockedAccounts?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !blockedAccounts?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                  No blocked accounts. Accounts added here will be prevented from auto-reconnecting.
                </TableCell>
              </TableRow>
            ) : (
              blockedAccounts.map((account) => {
                const providerBadge = PROVIDER_BADGES[account.provider];
                return (
                  <TableRow key={account.id} className="border-gray-800">
                    <TableCell>
                      <Badge className={providerBadge.className}>
                        {providerBadge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-300">
                      {account.account_key}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {account.reason || "—"}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {formatDate(account.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUnblockingAccount(account)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Unblock Confirmation Dialog */}
      <AlertDialog open={!!unblockingAccount} onOpenChange={() => setUnblockingAccount(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Unblock Account</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to unblock{" "}
              <span className="font-mono text-gray-300">{unblockingAccount?.account_key}</span>?
              <br /><br />
              This account will be able to auto-reconnect again if it matches an existing approved agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              disabled={saving}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnblock}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving ? "Unblocking..." : "Unblock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
