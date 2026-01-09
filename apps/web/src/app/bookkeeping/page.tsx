"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AccountSelector } from "@/components/bookkeeping/account-selector";
import { RecordsTable } from "@/components/bookkeeping/records-table";
import { AddRecordForm } from "@/components/bookkeeping/add-record-form";
import {
  api,
  exportToCSV,
  type Account,
  type BookkeepingRecord,
} from "@/lib/api";

export default function BookkeepingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [records, setRecords] = useState<BookkeepingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

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

  const handleExportCSV = () => {
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (account && records.length > 0) {
      exportToCSV(records, account.account_code);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-gray-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">DS ProSolution</h2>
        <nav className="space-y-1">
          <Link
            href="/"
            className="block text-sm text-gray-400 px-3 py-2 rounded-md hover:bg-gray-800 cursor-pointer"
          >
            Dashboard
          </Link>
          <div className="text-sm font-medium text-white bg-gray-800 px-3 py-2 rounded-md border-l-2 border-white">
            Order Tracker
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
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
                    {selectedAccount?.account_code} -{" "}
                    {records.length} record{records.length !== 1 ? "s" : ""}
                  </div>
                  <RecordsTable
                    records={records}
                    onRecordUpdated={handleRecordUpdated}
                  />
                </>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
