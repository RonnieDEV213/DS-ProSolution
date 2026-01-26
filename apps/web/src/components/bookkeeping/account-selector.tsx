"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account } from "@/lib/api";

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
  disabled?: boolean;
}

export function AccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
  disabled,
}: AccountSelectorProps) {
  return (
    <Select
      value={selectedAccountId || ""}
      onValueChange={onSelect}
      disabled={disabled}
    >
      <SelectTrigger className="w-[280px] bg-popover border-border" aria-label="Select account">
        <SelectValue placeholder="Select an account..." />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {accounts.map((account) => (
          <SelectItem
            key={account.id}
            value={account.id}
            className="hover:bg-accent"
          >
            {account.account_code}
            {account.name && ` - ${account.name}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
