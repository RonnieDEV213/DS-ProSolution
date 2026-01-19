# Phase 5: Presence System - Research

**Researched:** 2026-01-19
**Domain:** Real-time presence tracking, Supabase Realtime, account occupancy
**Confidence:** HIGH

## Summary

This phase implements account occupancy visibility with privacy-aware display. Admins see who is working on which account (name + clock-in time), while VAs see only "Occupied" status. Presence updates must be near real-time (1-3 seconds).

The research evaluated two primary approaches for real-time updates: Supabase Realtime (postgres_changes) and polling. **Supabase Realtime postgres_changes is the recommended approach** due to:
1. Already have Supabase client configured in frontend
2. Sub-100ms latency for updates (far exceeds 1-3s requirement)
3. Eliminates polling overhead and complexity
4. Simpler implementation than Supabase Presence (ephemeral) since we need persistent data

The presence data model is a simple PostgreSQL table (`account_presence`) storing current occupancy, updated on clock-in/out events. The existing clock-in flow (Phase 3) already tracks session start; presence recording hooks into that flow.

**Primary recommendation:** Use Supabase Realtime postgres_changes subscription on an `account_presence` table. Record presence at access code validation (clock-in), clear on clock-out/inactivity timeout.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.90.1 | Realtime subscriptions | Already in stack, handles WebSocket connections |
| PostgreSQL | (Supabase) | Presence table storage | Persistent storage with RLS |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React hooks | Built-in | Subscription management | Custom `usePresence` hook for cleanup |
| shadcn/ui Badge | Installed | Occupancy indicators | Display "Occupied" / VA name badges |
| Lucide React | 0.562.0 | Icons | Circle/dot indicator if needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| postgres_changes | Supabase Presence | Presence is ephemeral (in-memory), we need persistent data for admin visibility |
| postgres_changes | Polling (5s interval) | More requests, higher latency, but simpler fallback |
| postgres_changes | Supabase Broadcast + triggers | More complex, better for high-scale |

**No new installations required** - all components exist in current stack.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/
├── migrations/
│   └── 036_presence_system.sql      # presence table + RLS
├── src/app/
│   ├── routers/
│   │   └── presence.py              # GET /presence (optional)
│   └── services/
│       └── access_code.py           # Update to record presence on validate

apps/web/src/
├── hooks/
│   └── use-presence.ts              # Realtime subscription hook
├── components/
│   ├── bookkeeping/
│   │   └── account-selector.tsx     # Update to show presence badge
│   └── presence/
│       └── occupancy-badge.tsx      # Reusable badge component

packages/extension/
└── service-worker.js                # Clear presence on clock-out
```

### Pattern 1: Presence Table (Database-Centric)

**What:** Single `account_presence` table stores who is on which account
**When to use:** Always for this use case (need persistent data, RLS filtering, admin visibility)

**Schema:**
```sql
-- Source: Verified pattern from codebase migrations
CREATE TABLE account_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  clocked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One VA per account, one account per VA
  CONSTRAINT account_presence_account_unique UNIQUE (account_id),
  CONSTRAINT account_presence_user_unique UNIQUE (user_id, org_id)
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE account_presence;

-- RLS: Admins see full data, VAs see existence only
```

### Pattern 2: Supabase Realtime postgres_changes Subscription

**What:** Subscribe to INSERT/DELETE on `account_presence` table
**When to use:** Frontend components that display account list with occupancy

**Example:**
```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PresenceEntry {
  account_id: string;
  user_id: string;
  user_display_name?: string; // Only visible to admins
  clocked_in_at: string;
}

export function usePresence(orgId: string) {
  const [presence, setPresence] = useState<Map<string, PresenceEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    const fetchPresence = async () => {
      const { data, error } = await supabase
        .from('account_presence')
        .select('account_id, user_id, clocked_in_at, profiles(display_name)')
        .eq('org_id', orgId);

      if (data) {
        const map = new Map<string, PresenceEntry>();
        for (const row of data) {
          map.set(row.account_id, {
            account_id: row.account_id,
            user_id: row.user_id,
            user_display_name: row.profiles?.display_name,
            clocked_in_at: row.clocked_in_at,
          });
        }
        setPresence(map);
      }
      setLoading(false);
    };
    fetchPresence();

    // Subscribe to changes
    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'account_presence',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          setPresence(prev => {
            const next = new Map(prev);
            if (payload.eventType === 'INSERT') {
              next.set(payload.new.account_id, payload.new as PresenceEntry);
            } else if (payload.eventType === 'DELETE') {
              next.delete(payload.old.account_id);
            } else if (payload.eventType === 'UPDATE') {
              next.set(payload.new.account_id, payload.new as PresenceEntry);
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
  }, [orgId]);

  return { presence, loading };
}
```

### Pattern 3: Privacy-Filtered RLS

**What:** Different data visible to admins vs VAs via RLS
**When to use:** When role determines what fields are visible

**Example:**
```sql
-- Source: Codebase RLS patterns in migrations/
-- Admins: see user_id, profiles join works
CREATE POLICY "admin_read_presence" ON account_presence
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT m.org_id FROM memberships m
      WHERE m.user_id = auth.uid()
      AND m.role = 'admin'
    )
  );

-- VAs: see only account_id (existence check)
-- The select list is restricted by the view/function, not RLS
-- Alternative: Use a view that filters columns based on role
```

**Note:** RLS controls row access, not column access. For privacy filtering (VAs see "Occupied" not who), implement in application layer or use a role-checking view.

### Anti-Patterns to Avoid

- **Storing presence in localStorage/sessionStorage:** Not synchronized, stale across tabs
- **Polling without realtime fallback:** If WebSocket disconnects, data goes stale
- **Heartbeat-only (no explicit clear):** Clock-out should immediately clear, not wait for timeout
- **Ephemeral Supabase Presence for persistent data:** Presence feature is in-memory only; need DB for admin views
- **Querying presence on every account render:** Subscribe once, update via realtime

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom reconnect logic | Supabase client handles it | Automatic reconnect with exponential backoff |
| Subscription cleanup | Manual tracking | React useEffect cleanup | Prevents memory leaks on unmount |
| Real-time filtering | Client-side filter all rows | `filter` param in subscription | Supabase filters at server level |
| Time formatting | Manual date formatting | `Intl.DateTimeFormat` | Locale-aware, existing pattern in api.ts |

**Key insight:** Supabase Realtime is already battle-tested. The postgres_changes approach handles connection management, reconnection, and server-side filtering. Don't rebuild this.

## Common Pitfalls

### Pitfall 1: Missing Realtime Publication

**What goes wrong:** Subscribe to table changes but nothing happens
**Why it happens:** Table not added to `supabase_realtime` publication
**How to avoid:** Always run `ALTER PUBLICATION supabase_realtime ADD TABLE table_name`
**Warning signs:** Subscription connects but never receives events

### Pitfall 2: Stale Presence After Tab Close

**What goes wrong:** User closes browser, presence stays forever
**Why it happens:** No cleanup mechanism for abandoned sessions
**How to avoid:**
1. Clock-out explicitly clears presence (primary)
2. Inactivity timeout clears presence (existing 1hr alarm in extension)
3. Admin can manually clear orphaned entries (force-clear action)
**Warning signs:** "Ghost" users shown as present

### Pitfall 3: Race Condition on Clock-In

**What goes wrong:** VA clocks into new account, old presence not cleared atomically
**Why it happens:** Separate DELETE then INSERT operations
**How to avoid:** Use UPSERT with unique constraint on `(user_id, org_id)` - automatically replaces previous entry
**Warning signs:** Brief moment showing user on two accounts

### Pitfall 4: RLS Blocking Realtime Events

**What goes wrong:** User subscribes but RLS blocks the change events
**Why it happens:** Realtime checks RLS on every change event
**How to avoid:** Ensure RLS policy allows SELECT for all users who subscribe
**Warning signs:** Initial fetch works but realtime updates don't arrive

### Pitfall 5: Memory Leak from Unsubscribed Channels

**What goes wrong:** Performance degrades over time
**Why it happens:** Components unmount without calling `removeChannel`
**How to avoid:** Always return cleanup function from useEffect
**Warning signs:** Multiple subscription callbacks firing for same event

## Code Examples

Verified patterns from official sources:

### Recording Presence on Clock-In

```python
# Source: Existing access_code.py service pattern
async def record_presence(
    supabase,
    account_id: str,
    user_id: str,
    membership_id: str,
    org_id: str,
) -> None:
    """Record presence when VA clocks into an account.

    Uses upsert with (user_id, org_id) constraint to:
    1. Clear any existing presence for this user
    2. Set new presence on the target account
    """
    await supabase.table("account_presence").upsert({
        "account_id": account_id,
        "user_id": user_id,
        "membership_id": membership_id,
        "org_id": org_id,
        "clocked_in_at": datetime.now(timezone.utc).isoformat(),
        "last_heartbeat_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="user_id,org_id").execute()
```

### Clearing Presence on Clock-Out

```python
# Source: Pattern from existing services
async def clear_presence(supabase, user_id: str, org_id: str) -> None:
    """Clear presence when VA clocks out or session times out."""
    await supabase.table("account_presence").delete().match({
        "user_id": user_id,
        "org_id": org_id,
    }).execute()
```

### Occupancy Badge Component

```tsx
// Source: Existing badge.tsx component pattern
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OccupancyBadgeProps {
  isOccupied: boolean;
  occupantName?: string | null; // Only provided for admins
  clockedInAt?: string | null;
  isCurrentUser?: boolean;
}

export function OccupancyBadge({
  isOccupied,
  occupantName,
  clockedInAt,
  isCurrentUser,
}: OccupancyBadgeProps) {
  if (!isOccupied) return null; // Available accounts show nothing

  // VA view: just "Occupied" (unless it's their own account)
  if (!occupantName && !isCurrentUser) {
    return (
      <Badge variant="destructive" className="ml-2 text-xs">
        Occupied
      </Badge>
    );
  }

  // Current user's own account
  if (isCurrentUser) {
    return (
      <Badge variant="secondary" className="ml-2 text-xs">
        You
      </Badge>
    );
  }

  // Admin view: name + time
  const timeStr = clockedInAt
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(clockedInAt))
    : null;

  return (
    <Badge variant="destructive" className="ml-2 text-xs">
      {occupantName}{timeStr ? ` • ${timeStr}` : ""}
    </Badge>
  );
}
```

### Admin Force-Clear Presence

```typescript
// Source: Existing admin action patterns
export async function clearPresence(accountId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/admin/presence/${accountId}`, {
    method: "DELETE",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    throw new Error("Failed to clear presence");
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling every 5s | Supabase Realtime | 2023+ | Sub-100ms latency, less server load |
| Supabase Presence | postgres_changes | Use case dependent | Presence = ephemeral, postgres_changes = persistent |
| Global subscription | Filtered subscription | Supabase 2.0+ | `filter` param reduces traffic |

**Recommended (2025+):**
- Supabase now recommends Broadcast with database triggers for high-scale scenarios
- For moderate scale (this project), postgres_changes is simpler and sufficient
- Always enable RLS for the presence table

## Integration Points

### Clock-In Flow Integration

The presence system hooks into the existing Phase 3 clock-in flow:

```
Extension                    Backend                      Database
    |                           |                            |
    |--[1] Clock In (code)----->|                            |
    |                           |--[2] Validate code-------->|
    |                           |                            |
    |                           |--[3] Get user's account--->|
    |                           |   (from access code)       |
    |                           |                            |
    |                           |--[4] Record presence------>|
    |                           |   (upsert)                 |
    |                           |                            |
    |<--[5] JWT + context-------|                            |
    |                           |                            |
    |   (Realtime broadcasts presence INSERT to web clients) |
```

### Clock-Out Flow Integration

```
Extension                    Backend                      Database
    |                           |                            |
    |--[1] Clock Out----------->|                            |
    |   (or inactivity timeout) |--[2] Clear presence------->|
    |                           |   (delete)                 |
    |                           |                            |
    |   (Realtime broadcasts presence DELETE to web clients) |
```

### Web Client Integration

```
[AccountSelector Component]
    |
    |--[Mount] Subscribe to presence channel
    |
    |<-[Realtime] Receive INSERT/DELETE events
    |
    |--[Render] Show OccupancyBadge based on presence map
```

## Open Questions

Things that couldn't be fully resolved:

1. **Account ID at Clock-In**
   - What we know: Clock-in validates access code, returns JWT
   - What's unclear: How does backend know which account the VA is working on?
   - Recommendation: Extend access code validation endpoint to accept `account_id` parameter, or require separate "select account" step after clock-in

2. **Staleness Threshold**
   - What we know: Context says show "last seen X minutes ago" for stale data
   - What's unclear: Exact threshold value
   - Recommendation: Use 2 minutes as threshold; if `last_heartbeat_at` is older, show "Last seen X min ago"

3. **Heartbeat Necessity**
   - What we know: Existing 1hr inactivity timeout in extension
   - What's unclear: Whether periodic heartbeats are needed beyond this
   - Recommendation: Rely on existing inactivity timeout; heartbeats optional for "last seen" display

## Sources

### Primary (HIGH confidence)
- [Supabase Postgres Changes Docs](https://supabase.com/docs/guides/realtime/postgres-changes) - Subscription patterns, filtering, RLS
- [Supabase Presence Docs](https://supabase.com/docs/guides/realtime/presence) - Ephemeral vs persistent comparison
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) - React hook patterns
- Existing codebase: `apps/api/migrations/*`, `apps/api/src/app/services/access_code.py`, `packages/extension/service-worker.js`

### Secondary (MEDIUM confidence)
- [Supabase Realtime Architecture](https://supabase.com/docs/guides/realtime/architecture) - Performance characteristics
- [Supabase Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks) - Latency and scale numbers

### Tertiary (LOW confidence)
- Community patterns from WebSearch (verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already have Supabase, verified docs
- Architecture: HIGH - Follows existing codebase patterns
- Pitfalls: MEDIUM - Some based on general realtime experience

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (Supabase Realtime is stable)
