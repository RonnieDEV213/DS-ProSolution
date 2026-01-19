"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OccupancyBadge } from "@/components/presence/occupancy-badge";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/api";

interface PresenceInfo {
  user_id: string;
  display_name?: string | null;
  clocked_in_at: string;
}

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
  disabled?: boolean;
  // Presence props
  presence?: Map<string, PresenceInfo>;
  currentUserId?: string;
  isAdmin?: boolean;
}

export function AccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
  disabled,
  presence,
  currentUserId,
  isAdmin,
}: AccountSelectorProps) {
  return (
    <Select
      value={selectedAccountId || ""}
      onValueChange={onSelect}
      disabled={disabled}
    >
      <SelectTrigger className="w-[280px] bg-gray-800 border-gray-700" aria-label="Select account">
        <SelectValue placeholder="Select an account..." />
      </SelectTrigger>
      <SelectContent className="bg-gray-800 border-gray-700">
        {accounts.map((account) => {
          const presenceEntry = presence?.get(account.id);
          const isOccupied = !!presenceEntry;
          const isCurrentUser = presenceEntry?.user_id === currentUserId;

          return (
            <SelectItem
              key={account.id}
              value={account.id}
              className={cn(
                "text-white hover:bg-gray-700",
                presenceEntry && !isCurrentUser && "bg-red-950/30"
              )}
            >
              <span className="flex items-center">
                {account.account_code}
                {account.name && ` - ${account.name}`}
                <OccupancyBadge
                  isOccupied={isOccupied}
                  occupantName={isAdmin ? presenceEntry?.display_name : undefined}
                  clockedInAt={presenceEntry?.clocked_in_at}
                  isCurrentUser={isCurrentUser}
                />
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
