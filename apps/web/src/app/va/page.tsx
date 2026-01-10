import { createClient } from "@/lib/supabase/server";

export default async function VADashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("memberships")
    .select("department")
    .eq("user_id", user?.id ?? "")
    .single();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">VA Dashboard</h1>
        <p className="text-gray-400 mt-2">
          Welcome to your virtual assistant dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Department</h3>
          <p className="text-2xl font-bold text-white mt-2 capitalize">
            {membership?.department || "General"}
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Status</h3>
          <p className="text-2xl font-bold text-green-400 mt-2">Active</p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Quick Actions</h3>
          <p className="text-gray-400 mt-2 text-sm">
            Use the sidebar to navigate
          </p>
        </div>
      </div>
    </div>
  );
}
