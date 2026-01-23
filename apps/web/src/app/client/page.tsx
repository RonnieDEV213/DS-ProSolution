export default function ClientDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Client Dashboard</h1>
        <p className="text-gray-400 mt-2">Welcome to your client portal</p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 border border-gray-800">
        <h2 className="text-xl font-semibold text-white mb-4">
          Coming Soon
        </h2>
        <p className="text-gray-400">
          The client dashboard is under development. Check back soon for updates
          on your orders and account.
        </p>
      </div>
    </div>
  );
}
