export default async function VADashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">VA Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to your virtual assistant dashboard
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Access</h3>
          <p className="text-2xl font-bold text-blue-400 mt-2">Dashboard</p>
          <p className="text-xs text-muted-foreground mt-2">
            Access expands when roles are assigned.
          </p>
        </div>

        <div className="bg-card rounded-lg p-6 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Quick Actions</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Use the sidebar to navigate
          </p>
        </div>
      </div>
    </div>
  );
}
