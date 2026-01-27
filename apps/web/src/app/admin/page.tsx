import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  let inviteCount: number | null = null;
  let memberCount: number | null = null;
  let loadError = false;

  try {
    const { count, error } = await supabase
      .from("invites")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    inviteCount = count ?? 0;
  } catch (e) {
    console.error("[admin/page] Failed to load invite count:", e);
    loadError = true;
  }

  try {
    const { count, error } = await supabase
      .from("memberships")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    memberCount = count ?? 0;
  } catch (e) {
    console.error("[admin/page] Failed to load member count:", e);
    loadError = true;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to the DS-ProSolution admin panel
        </p>
      </div>

      {loadError && (
        <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-3 rounded">
          Unable to load some dashboard data. Please refresh the page.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Invites</h3>
          <p className="text-3xl font-bold font-mono text-foreground mt-2">
            {inviteCount !== null ? inviteCount : "—"}
          </p>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Members</h3>
          <p className="text-3xl font-bold font-mono text-foreground mt-2">
            {memberCount !== null ? memberCount : "—"}
          </p>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
          <p className="text-3xl font-bold text-green-400 mt-2">Active</p>
        </div>
      </div>
    </div>
  );
}
