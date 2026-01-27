"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { DepartmentRolesTable } from "@/components/admin/department-roles-table";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

// Default org ID for single-org MVP
const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

export default function AdminDepartmentRolesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    // For now, use the default org ID
    // In the future, this could be fetched from the user's membership
    const fetchOrgId = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // For MVP, use default org ID
        setOrgId(DEFAULT_ORG_ID);
      }
    };

    fetchOrgId();
  }, []);

  const handleRoleUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (!orgId) {
    return <TableSkeleton columns={6} rows={5} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Access Profiles</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage access profiles for VAs. Each profile can have specific permissions.
        </p>
      </div>

      <DepartmentRolesTable
        orgId={orgId}
        refreshTrigger={refreshTrigger}
        onRoleUpdated={handleRoleUpdated}
      />
    </div>
  );
}
