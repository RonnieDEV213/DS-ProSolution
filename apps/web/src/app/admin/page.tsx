import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Get some stats
  const { count: inviteCount } = await supabase
    .from("invites")
    .select("*", { count: "exact", head: true });

  const { count: memberCount } = await supabase
    .from("memberships")
    .select("*", { count: "exact", head: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-2">
          Welcome to the DS-ProSolution admin panel
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Total Invites</h3>
          <p className="text-3xl font-bold text-white mt-2">{inviteCount ?? 0}</p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Total Members</h3>
          <p className="text-3xl font-bold text-white mt-2">{memberCount ?? 0}</p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Status</h3>
          <p className="text-3xl font-bold text-green-400 mt-2">Active</p>
        </div>
      </div>
    </div>
  );
}
