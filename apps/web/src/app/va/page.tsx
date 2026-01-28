import { PageHeader } from "@/components/layout/page-header";

export default async function VADashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="VA Dashboard"
        description="Welcome to your virtual assistant dashboard"
      />

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
