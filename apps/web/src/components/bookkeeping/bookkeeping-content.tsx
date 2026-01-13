"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AccountSelector } from "@/components/bookkeeping/account-selector";
import { RecordsTable } from "@/components/bookkeeping/records-table";
import { AddRecordForm } from "@/components/bookkeeping/add-record-form";
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
  const [showAddForm, setShowAddForm] = useState(false);

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

  // Load records when account changes
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

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setShowAddForm(false);
    loadRecords(accountId);
  };

  const handleRecordUpdated = (updated: BookkeepingRecord) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  };

  const handleRecordAdded = (record: BookkeepingRecord) => {
    setRecords((prev) => [record, ...prev]);
    setShowAddForm(false);
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
        <h1 className="text-3xl font-bold text-white">Order Tracker</h1>
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
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? "Cancel" : "+ Add Record"}
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
          {showAddForm && (
            <AddRecordForm
              accountId={selectedAccountId}
              userRole={userRole}
              onRecordAdded={handleRecordAdded}
              onCancel={() => setShowAddForm(false)}
            />
          )}

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
    </motion.div>
  );
}
