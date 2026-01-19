"use client";

import { useEffect, useState } from "react";
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
  /** Whether to show as inline text instead of badge (for table cells) */
  inline?: boolean;
}

/**
 * Displays account occupancy status.
 *
 * - Available accounts: Green "Available" badge (or nothing if inline)
 * - VA view of others: Red "Occupied" badge
 * - Admin view: Shows "Name · Time · Duration" with live updating duration
 * - Current user's account: Blue "You" badge
 */
export function OccupancyBadge({
  isOccupied,
  occupantName,
  clockedInAt,
  isCurrentUser,
  inline = false,
}: OccupancyBadgeProps) {
  const [duration, setDuration] = useState<string>("");

  // Live duration timer - updates every minute
  useEffect(() => {
    if (!clockedInAt || !isOccupied) {
      setDuration("");
      return;
    }

    const updateDuration = () => {
      setDuration(formatDuration(clockedInAt));
    };

    // Initial calculation
    updateDuration();

    // Update every minute
    const interval = setInterval(updateDuration, 60000);

    return () => clearInterval(interval);
  }, [clockedInAt, isOccupied]);

  // Available accounts
  if (!isOccupied) {
    if (inline) {
      return <span className="text-green-400">Available</span>;
    }
    return (
      <Badge variant="secondary" className="bg-green-600/20 text-green-400 hover:bg-green-600/20">
        Available
      </Badge>
    );
  }

  // Current user's own account - distinct styling
  if (isCurrentUser) {
    if (inline) {
      return <span className="text-blue-400">You {duration && `· ${duration}`}</span>;
    }
    return (
      <Badge variant="secondary" className="bg-blue-600 hover:bg-blue-600 text-white">
        You {duration && `· ${duration}`}
      </Badge>
    );
  }

  // Admin view with name, time, and duration
  if (occupantName) {
    const timeStr = formatClockInTime(clockedInAt);
    const parts = [occupantName];
    if (timeStr) parts.push(timeStr);
    if (duration) parts.push(duration);

    if (inline) {
      return <span className="text-red-400">{parts.join(" · ")}</span>;
    }
    return (
      <Badge variant="destructive">
        {parts.join(" · ")}
      </Badge>
    );
  }

  // VA view - just "Occupied"
  if (inline) {
    return <span className="text-red-400">Occupied</span>;
  }
  return (
    <Badge variant="destructive">
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

/**
 * Format duration since clock-in for display.
 * Shows as "Xh Ym" format.
 */
function formatDuration(clockedInAt: string): string {
  try {
    const start = new Date(clockedInAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();

    if (diffMs < 0) return "";

    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  } catch {
    return "";
  }
}
