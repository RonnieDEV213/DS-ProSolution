"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ListImperativeAPI } from "react-window";

const STORAGE_KEY = "dspro:last_order_tracking_account_id";
import { AccountSelector } from "@/components/bookkeeping/account-selector";
import { RecordsToolbar } from "@/components/bookkeeping/records-toolbar";
import { VirtualizedRecordsList } from "@/components/bookkeeping/virtualized-records-list";
import { AddRecordDialog } from "@/components/bookkeeping/add-record-dialog";
import { FirstTimeEmpty } from "@/components/empty-states/first-time-empty";
import { FilteredEmpty } from "@/components/empty-states/filtered-empty";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useRowDensity } from "@/hooks/use-row-density";
import { useUserRole } from "@/hooks/use-user-role";
import { useAccounts } from "@/hooks/queries/use-accounts";
import { useSyncRecords } from "@/hooks/sync/use-sync-records";
import { type Account, type BookkeepingStatus } from "@/lib/api";

// TODO: Get orgId from user context when multi-org support added
const DEFAULT_ORG_ID = "default";

export function BookkeepingContent() {
  const searchParams = useSearchParams();

  // Initialize from URL param only (SSR-safe). localStorage restored via useEffect.
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    () => searchParams.get("account_id")
  );
  const [accountRestored, setAccountRestored] = useState(
    () => !!searchParams.get("account_id")
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const persistenceApplied = useRef(false);
  const listRef = useRef<ListImperativeAPI | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState(600);

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

  // Restore persisted account ID from localStorage after hydration.
  // URL param is read synchronously in useState (SSR-safe); localStorage deferred here.
  useEffect(() => {
    if (accountRestored) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedAccountId(stored);
    } catch {
      // localStorage may be unavailable
    }
    setAccountRestored(true);
  }, [accountRestored]);

  // Validate restored account ID once accounts load from server.
  // If the persisted ID is invalid (deleted account), clear it.
  // Also sync URL params for the restored account.
  useEffect(() => {
    if (accounts.length === 0 || persistenceApplied.current) return;
    persistenceApplied.current = true;

    if (selectedAccountId) {
      // Validate the restored ID against actual accounts
      if (accounts.some((a) => a.id === selectedAccountId)) {
        // Valid - ensure URL is in sync
        const urlAccountId = searchParams.get("account_id");
        if (urlAccountId !== selectedAccountId) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("account_id", selectedAccountId);
          router.replace(`?${params.toString()}`, { scroll: false });
        }
        return;
      }
      // Invalid persisted ID - clear it
      setSelectedAccountId(null);
    }

    // No persisted ID (or it was invalid) - check URL param
    const urlAccountId = searchParams.get("account_id");
    if (urlAccountId && accounts.some((a) => a.id === urlAccountId)) {
      setSelectedAccountId(urlAccountId);
    }
  }, [accounts, selectedAccountId, searchParams, router]);

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
      <PageHeader
        title="Order Tracking"
        actions={
          <>
            {recordsFetching && !recordsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <AccountSelector
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelect={handleAccountSelect}
              disabled={accountsLoading}
            />
          </>
        }
      />

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!selectedAccountId && !accountRestored ? (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !selectedAccountId ? (
        <div className="py-16">
          <FirstTimeEmpty
            entityName="records"
            description="Select an account from the dropdown above to view order tracking records."
          />
        </div>
      ) : (
        <>
          <div className="space-y-4" ref={listContainerRef}>
            <div className="text-sm text-muted-foreground">
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
              onAddRecord={() => setAddDialogOpen(true)}
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
              isLoading={recordsLoading}
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
