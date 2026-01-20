"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PresenceEntry {
  account_id: string;
  user_id: string;
  clocked_in_at: string;
  // Fetched from profiles - only available for admins via RLS
  display_name?: string | null;
}

interface UsePresenceOptions {
  orgId: string;
  enabled?: boolean;
}

interface UsePresenceResult {
  presence: Map<string, PresenceEntry>;
  loading: boolean;
  error: Error | null;
}

export function usePresence({ orgId, enabled = true }: UsePresenceOptions): UsePresenceResult {
  const [presence, setPresence] = useState<Map<string, PresenceEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !orgId) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Fetch presence data and then enrich with profile names
    const fetchPresence = async () => {
      try {
        // Step 1: Query presence entries for this org
        const { data: presenceData, error: presenceError } = await supabase
          .from("account_presence")
          .select("account_id, user_id, clocked_in_at")
          .eq("org_id", orgId);

        if (presenceError) {
          console.error("[usePresence] Fetch error:", presenceError);
          setError(new Error(presenceError.message));
          return;
        }

        if (!presenceData || presenceData.length === 0) {
          setPresence(new Map());
          setError(null);
          setLoading(false);
          return;
        }

        // Step 2: Fetch display names for all user_ids
        // RLS on profiles will determine if user can see names
        const userIds = [...new Set(presenceData.map(p => p.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);

        // Build lookup map for display names
        const nameMap = new Map<string, string | null>();
        for (const profile of profilesData || []) {
          nameMap.set(profile.user_id, profile.display_name);
        }

        // Step 3: Build presence map with display names
        const map = new Map<string, PresenceEntry>();
        for (const row of presenceData) {
          map.set(row.account_id, {
            account_id: row.account_id,
            user_id: row.user_id,
            clocked_in_at: row.clocked_in_at,
            display_name: nameMap.get(row.user_id) ?? null,
          });
        }
        setPresence(map);
        setError(null);
      } catch (e) {
        console.error("[usePresence] Error:", e);
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPresence();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`presence-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "account_presence",
          filter: `org_id=eq.${orgId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            // Remove by account_id from old record
            const oldAccountId = (payload.old as { account_id?: string })?.account_id;
            if (oldAccountId) {
              setPresence((prev) => {
                const next = new Map(prev);
                next.delete(oldAccountId);
                return next;
              });
            }
          } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            // Refetch to get full data including display names
            fetchPresence();
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, enabled]);

  return { presence, loading, error };
}
