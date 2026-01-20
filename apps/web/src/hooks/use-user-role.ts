"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/api";

/**
 * Hook to get the current user's role and access profile information.
 * Returns flags for route guarding and admin detection.
 */
export function useUserRole(): UserRole & { loading: boolean; userId: string | null } {
  const [role, setRole] = useState<UserRole>({
    role: null,
    isAdmin: false,
    hasAccessProfile: false,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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

        setUserId(user.id);

        // Fetch membership with access profile count
        const { data: membership } = await supabase
          .from("memberships")
          .select("id, role")
          .eq("user_id", user.id)
          .single();

        if (membership) {
          const isAdmin = membership.role === "admin";
          const isVA = membership.role === "va";

          // For VAs, check if they have any access profiles assigned
          let hasAccessProfile = true;
          if (isVA) {
            const { count } = await supabase
              .from("membership_department_roles")
              .select("*", { count: "exact", head: true })
              .eq("membership_id", membership.id);

            hasAccessProfile = (count ?? 0) > 0;
          }

          setRole({
            role: membership.role,
            isAdmin,
            hasAccessProfile,
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

  return { ...role, loading, userId };
}
