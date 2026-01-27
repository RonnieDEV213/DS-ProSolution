export default function ClientDashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Client Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome to your client portal</p>
      </div>

      <div className="bg-card rounded-lg p-8 border border-border">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Coming Soon
        </h2>
        <p className="text-muted-foreground">
          The client dashboard is under development. Check back soon for updates
          on your orders and account.
        </p>
      </div>
    </div>
  );
}
