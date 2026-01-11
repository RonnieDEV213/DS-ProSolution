"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/api";

/**
 * Hook to get the current user's role and department information.
 * Uses cached membership data from Supabase.
 */
export function useUserRole(): UserRole & { loading: boolean } {
  const [role, setRole] = useState<UserRole>({
    isAdmin: false,
    isOrderDept: false,
    isServiceDept: false,
    canAccessOrderRemark: false,
    canAccessServiceRemark: false,
    department: null,
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

        // Fetch membership info
        const { data: membership } = await supabase
          .from("memberships")
          .select("role, department")
          .eq("user_id", user.id)
          .single();

        if (membership) {
          const isAdmin = membership.role === "admin";
          const isOrderDept = membership.department === "ordering";
          const isServiceDept =
            membership.department === "returns" ||
            membership.department === "cs";

          setRole({
            isAdmin,
            isOrderDept,
            isServiceDept,
            canAccessOrderRemark: isAdmin || isOrderDept,
            canAccessServiceRemark: isAdmin || isServiceDept,
            department: membership.department,
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
