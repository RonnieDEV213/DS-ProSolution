"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";

const STORAGE_KEY = "dspro:last_order_tracking_account_id";
import { Button } from "@/components/ui/button";
import { AccountSelector } from "@/components/bookkeeping/account-selector";
import { RecordsTable } from "@/components/bookkeeping/records-table";
import { AddRecordDialog } from "@/components/bookkeeping/add-record-dialog";
import { useUserRole } from "@/hooks/use-user-role";
import {
  api,
  exportToCSV,
  type Account,
  type BookkeepingRecord,
} from "@/lib/api";

export function BookkeepingContent() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [records, setRecords] = useState<BookkeepingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const persistenceApplied = useRef(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const userRole = useUserRole();

  // Load accounts on mount
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await api.getAccounts();
        setAccounts(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load accounts"
        );
      } finally {
        setLoading(false);
      }
    };
    loadAccounts();
  }, []);

  // Load records for an account
  const loadRecords = useCallback(async (accountId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRecords({ account_id: accountId });
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

    // Apply restored account and load records
    if (restoredAccountId) {
      setSelectedAccountId(restoredAccountId);
      loadRecords(restoredAccountId);
    }
  }, [accounts, searchParams, router, loadRecords]);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setAddDialogOpen(false);
    loadRecords(accountId);

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

  const handleRecordUpdated = (updated: BookkeepingRecord) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  };

  const handleRecordAdded = (record: BookkeepingRecord) => {
    setRecords((prev) => [record, ...prev]);
  };

  const handleRecordDeleted = (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
  };

  const handleExportCSV = () => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (account && records.length > 0) {
      exportToCSV(records, account.account_code);
      toast.success(`Exported ${records.length} records`);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Order Tracking</h1>
        <div className="flex items-center gap-4">
          <AccountSelector
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelect={handleAccountSelect}
            disabled={loading && accounts.length === 0}
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
          {loading ? (
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
                onRecordUpdated={handleRecordUpdated}
                onRecordDeleted={handleRecordDeleted}
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
          onRecordAdded={handleRecordAdded}
        />
      )}
    </motion.div>
  );
}
