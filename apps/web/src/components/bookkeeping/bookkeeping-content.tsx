"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STORAGE_KEY = "dspro:last_order_tracking_account_id";
import { Button } from "@/components/ui/button";
import { AccountSelector } from "@/components/bookkeeping/account-selector";
import { RecordsTable } from "@/components/bookkeeping/records-table";
import { AddRecordDialog } from "@/components/bookkeeping/add-record-dialog";
import { useUserRole } from "@/hooks/use-user-role";
import { useAccounts } from "@/hooks/queries/use-accounts";
import { useRecordsInfinite } from "@/hooks/queries/use-records-infinite";
import { exportToCSV, type Account } from "@/lib/api";

// TODO: Get orgId from user context when multi-org support added
const DEFAULT_ORG_ID = "default";

export function BookkeepingContent() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const persistenceApplied = useRef(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const userRole = useUserRole();

  // Fetch accounts using TanStack Query
  const {
    data: accounts = [],
    isPending: accountsLoading,
    error: accountsError,
  } = useAccounts(DEFAULT_ORG_ID);

  // Fetch records using TanStack Query infinite query
  const {
    data: recordsData,
    isPending: recordsLoading,
    isFetching: recordsFetching,
    error: recordsError,
  } = useRecordsInfinite(
    DEFAULT_ORG_ID,
    selectedAccountId ?? "",
    undefined // No filters for now
  );

  // Extract records from pages
  const records = recordsData?.pages?.flatMap((page) => page.items) ?? [];

  // Apply persisted account selection after accounts load (once)
  useEffect(() => {
    if (accounts.length === 0 || persistenceApplied.current) return;
    persistenceApplied.current = true;

    let restoredAccountId: string | null = null;

    // Check URL param first
    const urlAccountId = searchParams.get("account_id");
    if (urlAccountId && accounts.some((a) => a.id === urlAccountId)) {
      restoredAccountId = urlAccountId;
    } else {
      // Fall back to localStorage
      try {
        const storedId = localStorage.getItem(STORAGE_KEY);
        if (storedId && accounts.some((a) => a.id === storedId)) {
          restoredAccountId = storedId;
          // Update URL to match
          const params = new URLSearchParams(searchParams.toString());
          params.set("account_id", storedId);
          router.replace(`?${params.toString()}`, { scroll: false });
        }
      } catch {
        // localStorage may be unavailable
      }
    }

    // Apply restored account (records will load via query)
    if (restoredAccountId) {
      setSelectedAccountId(restoredAccountId);
    }
  }, [accounts, searchParams, router]);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setAddDialogOpen(false);

    // Persist to URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("account_id", accountId);
    router.replace(`?${params.toString()}`, { scroll: false });

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, accountId);
    } catch {
      // localStorage may be unavailable
    }
  };

  const handleRecordAdded = () => {
    // Close dialog - TanStack Query handles cache invalidation via mutation hook
    setAddDialogOpen(false);
  };

  const handleExportCSV = () => {
    const account = accounts.find((a: Account) => a.id === selectedAccountId);
    if (account && records.length > 0) {
      exportToCSV(records, account.account_code);
      toast.success(`Exported ${records.length} records`);
    }
  };

  const selectedAccount = accounts.find(
    (a: Account) => a.id === selectedAccountId
  );

  // Error display
  const error = accountsError?.message || recordsError?.message;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white">Order Tracking</h1>
          {/* Background refetch indicator */}
          {recordsFetching && !recordsLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>
        <div className="flex items-center gap-4">
          <AccountSelector
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelect={handleAccountSelect}
            disabled={accountsLoading}
          />
          {selectedAccountId && (
            <>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
              >
                Add Record
              </Button>
              <Button
                variant="secondary"
                onClick={handleExportCSV}
                disabled={records.length === 0}
              >
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!selectedAccountId ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Select an account to view records</p>
        </div>
      ) : (
        <>
          {recordsLoading ? (
            <div className="text-center py-12 text-gray-400">
              Loading records...
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-400 mb-4">
                {selectedAccount?.account_code} - {records.length} record
                {records.length !== 1 ? "s" : ""}
              </div>
              <RecordsTable
                records={records}
                userRole={userRole}
                orgId={DEFAULT_ORG_ID}
                accountId={selectedAccountId}
              />
            </>
          )}
        </>
      )}

      {selectedAccountId && (
        <AddRecordDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          accountId={selectedAccountId}
          userRole={userRole}
          orgId={DEFAULT_ORG_ID}
          onRecordAdded={handleRecordAdded}
        />
      )}
    </motion.div>
  );
}
