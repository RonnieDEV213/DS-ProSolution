"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DepartmentRolesTable } from "@/components/admin/department-roles-table";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";

const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

interface AccessProfilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleUpdated?: () => void;
}

export function AccessProfilesModal({
  open,
  onOpenChange,
  onRoleUpdated,
}: AccessProfilesModalProps) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (open) {
      const fetchOrgId = async () => {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setOrgId(DEFAULT_ORG_ID);
        }
      };
      fetchOrgId();
    }
  }, [open]);

  const handleRoleUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
    onRoleUpdated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access Profiles</DialogTitle>
          <DialogDescription>
            Create and manage access profiles for VAs. Each profile can have
            specific permissions.
          </DialogDescription>
        </DialogHeader>
        {orgId ? (
          <DepartmentRolesTable
            orgId={orgId}
            refreshTrigger={refreshTrigger}
            onRoleUpdated={handleRoleUpdated}
          />
        ) : (
          <TableSkeleton columns={6} rows={5} />
        )}
      </DialogContent>
    </Dialog>
  );
}
