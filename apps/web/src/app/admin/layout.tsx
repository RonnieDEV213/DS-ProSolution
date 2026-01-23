import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </main>
    </div>
  );
}
