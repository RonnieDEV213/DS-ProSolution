"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/api";

/**
 * Hook to get the current user's role and status information.
 * Returns status flags for route guarding and admin detection.
 */
export function useUserRole(): UserRole & { loading: boolean } {
  const [role, setRole] = useState<UserRole>({
    isAdmin: false,
    isPending: false,
    isActive: false,
    isSuspended: false,
    needsAccessProfile: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      try {
        const supabase = createClient();

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch membership with access profile count
        const { data: membership } = await supabase
          .from("memberships")
          .select("id, role, status")
          .eq("user_id", user.id)
          .single();

        if (membership) {
          const isAdmin = membership.role === "admin";
          const isVA = membership.role === "va";
          const isPending = membership.status === "pending";
          const isActive = membership.status === "active";
          const isSuspended = membership.status === "suspended";

          // For VAs, check if they have any access profiles assigned
          let needsAccessProfile = false;
          if (isVA && isActive) {
            const { count } = await supabase
              .from("membership_department_roles")
              .select("*", { count: "exact", head: true })
              .eq("membership_id", membership.id);

            needsAccessProfile = (count ?? 0) === 0;
          }

          setRole({
            isAdmin,
            isPending,
            isActive,
            isSuspended,
            needsAccessProfile,
          });
        }
      } catch (error) {
        console.error("Failed to fetch user role:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, []);

  return { ...role, loading };
}
