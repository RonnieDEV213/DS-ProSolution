import { PageHeader } from "@/components/layout/page-header";

export default function ClientDashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Client Dashboard"
        description="Welcome to your client portal"
      />

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
