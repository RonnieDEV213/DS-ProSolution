"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ListImperativeAPI } from "react-window";

const STORAGE_KEY = "dspro:last_order_tracking_account_id";
import { Button } from "@/components/ui/button";
import { AccountSelector } from "@/components/bookkeeping/account-selector";
import { RecordsToolbar } from "@/components/bookkeeping/records-toolbar";
import { VirtualizedRecordsList } from "@/components/bookkeeping/virtualized-records-list";
import { AddRecordDialog } from "@/components/bookkeeping/add-record-dialog";
import { useRowDensity } from "@/hooks/use-row-density";
import { useUserRole } from "@/hooks/use-user-role";
import { useAccounts } from "@/hooks/queries/use-accounts";
import { useSyncRecords } from "@/hooks/sync/use-sync-records";
import { exportToCSV, type Account, type BookkeepingStatus } from "@/lib/api";

// TODO: Get orgId from user context when multi-org support added
const DEFAULT_ORG_ID = "default";

export function BookkeepingContent() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const persistenceApplied = useRef(false);
  const listRef = useRef<ListImperativeAPI | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState(600);

  const searchParams = useSearchParams();
  const router = useRouter();
  const userRole = useUserRole();

  // Fetch accounts using TanStack Query
  const {
    data: accounts = [],
    isPending: accountsLoading,
    error: accountsError,
  } = useAccounts(DEFAULT_ORG_ID);

  // Fetch records using cache-first sync hook (IndexedDB first, then server sync)
  const syncResult = useSyncRecords({
    accountId: selectedAccountId ?? "",
    filters: undefined,
  });

  // Destructure only when account selected
  const rawRecords = selectedAccountId ? syncResult.records : [];
  const recordsLoading = selectedAccountId ? syncResult.isLoading : false;
  const recordsFetching = selectedAccountId ? syncResult.isSyncing : false;
  const recordsError = selectedAccountId ? syncResult.error : null;
  const totalCount = selectedAccountId ? syncResult.totalCount : 0;
  const hasMore = selectedAccountId ? syncResult.hasMore : false;
  const { density, toggleDensity, rowHeight } = useRowDensity();

  // Compute derived fields (profit, earnings, COGS) - same logic as use-records-infinite.ts
  const records = rawRecords.map((item) => {
    const salePriceCents = item.sale_price_cents ?? 0;
    const ebayFeesCents = item.ebay_fees_cents ?? 0;
    const amazonPriceCents = item.amazon_price_cents ?? 0;
    const amazonTaxCents = item.amazon_tax_cents ?? 0;
    const amazonShippingCents = item.amazon_shipping_cents ?? 0;
    const returnLabelCostCents = item.return_label_cost_cents ?? 0;

    const earningsNetCents = salePriceCents - ebayFeesCents;
    const cogsTotalCents = amazonPriceCents + amazonTaxCents + amazonShippingCents;
    const profitCents = earningsNetCents - cogsTotalCents - returnLabelCostCents;

    return {
      ...item,
      status: item.status as BookkeepingStatus, // Cast from string to typed status
      earnings_net_cents: earningsNetCents,
      cogs_total_cents: cogsTotalCents,
      profit_cents: profitCents,
    };
  });

  useLayoutEffect(() => {
    const updateHeight = () => {
      if (!listContainerRef.current) {
        setListHeight(600);
        return;
      }

      const { top } = listContainerRef.current.getBoundingClientRect();
      const available = window.innerHeight - top - 32;
      setListHeight(Math.max(600, available));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
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

    // Apply restored account (records will load via query)
    if (restoredAccountId) {
      setSelectedAccountId(restoredAccountId);
    }
  }, [accounts, searchParams, router]);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    setAddDialogOpen(false);
    setActiveFilter("all");

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

  const filteredRecords = useMemo(() => {
    if (activeFilter === "all") return records;
    if (activeFilter === "successful") {
      return records.filter((record) => record.status === "SUCCESSFUL");
    }
    if (activeFilter === "return_label") {
      return records.filter((record) => record.status === "RETURN_LABEL_PROVIDED");
    }
    if (activeFilter === "return_closed") {
      return records.filter((record) => record.status === "RETURN_CLOSED");
    }
    if (activeFilter === "refunds") {
      return records.filter((record) => record.status === "REFUND_NO_RETURN");
    }
    return records;
  }, [records, activeFilter]);

  const isFiltered = activeFilter !== "all";
  const displayTotalCount = isFiltered
    ? filteredRecords.length
    : totalCount || filteredRecords.length;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "?") return;

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      event.preventDefault();
      setHelpModalOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Error display (handle both null and undefined from different hooks)
  const error = accountsError?.message || recordsError?.message || null;

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
          <div className="space-y-4" ref={listContainerRef}>
            <div className="text-sm text-gray-400">
              {selectedAccount?.account_code} - {displayTotalCount} record
              {displayTotalCount !== 1 ? "s" : ""}
              {isFiltered ? " (filtered)" : ""}
            </div>

            <RecordsToolbar
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              density={density}
              onToggleDensity={toggleDensity}
              recordCount={displayTotalCount}
              isFiltered={isFiltered}
              helpOpen={helpModalOpen}
              onHelpOpenChange={setHelpModalOpen}
              accountId={selectedAccountId}
              totalRecords={totalCount}
            />

            <VirtualizedRecordsList
              records={filteredRecords}
              userRole={userRole}
              orgId={DEFAULT_ORG_ID}
              accountId={selectedAccountId}
              height={listHeight}
              density={density}
              rowHeight={rowHeight}
              isFiltered={isFiltered}
              hasMore={hasMore}
              totalCount={displayTotalCount}
              loadMore={syncResult.loadMore}
              isLoading={recordsFetching}
              listRef={listRef}
            />
          </div>
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
