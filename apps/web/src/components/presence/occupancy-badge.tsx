"use client";

import { Badge } from "@/components/ui/badge";

interface OccupancyBadgeProps {
  /** Whether this account is occupied */
  isOccupied: boolean;
  /** Occupant's display name (only provided for admins) */
  occupantName?: string | null;
  /** When the occupant clocked in */
  clockedInAt?: string | null;
  /** Whether current user is the occupant */
  isCurrentUser?: boolean;
}

/**
 * Displays account occupancy status.
 *
 * - Available accounts: No badge shown (available is default state)
 * - VA view of others: Red "Occupied" badge
 * - Admin view: Red badge with "Name * Time" format
 * - Current user's account: Blue "You" badge
 */
export function OccupancyBadge({
  isOccupied,
  occupantName,
  clockedInAt,
  isCurrentUser,
}: OccupancyBadgeProps) {
  // Available accounts show nothing
  if (!isOccupied) {
    return null;
  }

  // Current user's own account - distinct styling
  if (isCurrentUser) {
    return (
      <Badge variant="secondary" className="ml-2 text-xs bg-blue-600 hover:bg-blue-600 text-white">
        You
      </Badge>
    );
  }

  // Admin view with name and time
  if (occupantName) {
    const timeStr = formatClockInTime(clockedInAt);
    return (
      <Badge variant="destructive" className="ml-2 text-xs">
        {occupantName}{timeStr ? ` \u2022 ${timeStr}` : ""}
      </Badge>
    );
  }

  // VA view - just "Occupied"
  return (
    <Badge variant="destructive" className="ml-2 text-xs">
      Occupied
    </Badge>
  );
}

/**
 * Format clock-in time for display.
 * Shows time in 12-hour format with AM/PM.
 */
function formatClockInTime(clockedInAt?: string | null): string | null {
  if (!clockedInAt) return null;

  try {
    const date = new Date(clockedInAt);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return null;
  }
}
