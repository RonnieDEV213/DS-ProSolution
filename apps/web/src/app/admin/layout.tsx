import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";
import { SyncProvider } from "@/components/providers/sync-provider";
import { ConflictResolutionModal } from "@/components/sync/conflict-resolution-modal";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <SyncProvider>
          <AdminLayoutClient>{children}</AdminLayoutClient>
          <ConflictResolutionModal />
        </SyncProvider>
      </main>
    </div>
  );
}
