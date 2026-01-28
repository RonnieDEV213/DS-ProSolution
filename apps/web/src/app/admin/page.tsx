"use client";

import { PageHeader } from "@/components/layout/page-header";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { ErrorEmpty } from "@/components/empty-states/error-empty";
import { useCachedQuery } from "@/hooks/use-cached-query";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";

interface DashboardCounts {
  inviteCount: number;
  memberCount: number;
}

export default function AdminDashboardPage() {
  const {
    data: counts,
    isLoading,
    isError,
  } = useCachedQuery<DashboardCounts>({
    queryKey: queryKeys.admin.dashboardCounts(),
    queryFn: async () => {
      const supabase = createClient();

      const [invitesResult, membersResult] = await Promise.all([
        supabase.from("invites").select("*", { count: "exact", head: true }),
        supabase.from("memberships").select("*", { count: "exact", head: true }),
      ]);

      if (invitesResult.error) throw invitesResult.error;
      if (membersResult.error) throw membersResult.error;

      return {
        inviteCount: invitesResult.count ?? 0,
        memberCount: membersResult.count ?? 0,
      };
    },
    cacheKey: "admin:dashboard-counts",
    staleTime: 60 * 1000, // 1min — dashboard counts are low-churn
  });

  // Show skeleton on first load with no cached data
  if (isLoading && !counts) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Admin Dashboard"
        description="Welcome to the DS-ProSolution admin panel"
      />

      {isError && !counts ? (
        <ErrorEmpty
          message="Unable to load dashboard data. Please try again."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card rounded-lg p-6 border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Total Invites</h3>
            <p className="text-3xl font-bold font-mono text-foreground mt-2">
              {counts?.inviteCount ?? "—"}
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Total Members</h3>
            <p className="text-3xl font-bold font-mono text-foreground mt-2">
              {counts?.memberCount ?? "—"}
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border border-border">
            <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
            <p className="text-3xl font-bold text-green-400 mt-2">Active</p>
          </div>
        </div>
      )}
    </div>
  );
}
