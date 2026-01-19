"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PresenceEntry {
  account_id: string;
  user_id: string;
  clocked_in_at: string;
  // Joined from profiles - only available for admins via RLS
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

    // Initial fetch
    const fetchPresence = async () => {
      try {
        // Query presence with profile join for display name
        // RLS will filter rows to user's org
        // Note: display_name may be null for VAs depending on RLS
        const { data, error: fetchError } = await supabase
          .from("account_presence")
          .select(`
            account_id,
            user_id,
            clocked_in_at,
            profiles:user_id (display_name)
          `)
          .eq("org_id", orgId);

        if (fetchError) {
          console.error("[usePresence] Fetch error:", fetchError);
          setError(new Error(fetchError.message));
          return;
        }

        const map = new Map<string, PresenceEntry>();
        for (const row of data || []) {
          map.set(row.account_id, {
            account_id: row.account_id,
            user_id: row.user_id,
            clocked_in_at: row.clocked_in_at,
            display_name: (row.profiles as { display_name?: string } | null)?.display_name,
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
          setPresence((prev) => {
            const next = new Map(prev);

            if (payload.eventType === "DELETE") {
              // Remove by account_id from old record
              const oldAccountId = (payload.old as { account_id?: string })?.account_id;
              if (oldAccountId) {
                next.delete(oldAccountId);
              }
            } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const newRecord = payload.new as {
                account_id: string;
                user_id: string;
                clocked_in_at: string;
              };

              // For INSERT/UPDATE, we need to fetch display_name separately
              // since realtime doesn't include joined data
              // For now, set entry without display_name; it will be fetched on next render
              next.set(newRecord.account_id, {
                account_id: newRecord.account_id,
                user_id: newRecord.user_id,
                clocked_in_at: newRecord.clocked_in_at,
                display_name: undefined, // Will be populated on next full fetch
              });

              // Refetch to get display_name
              fetchPresence();
            }

            return next;
          });
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
