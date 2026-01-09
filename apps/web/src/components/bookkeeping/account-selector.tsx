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
      <SelectTrigger className="w-[280px] bg-gray-800 border-gray-700">
        <SelectValue placeholder="Select an account..." />
      </SelectTrigger>
      <SelectContent className="bg-gray-800 border-gray-700">
        {accounts.map((account) => (
          <SelectItem
            key={account.id}
            value={account.id}
            className="text-white hover:bg-gray-700"
          >
            {account.account_code}
            {account.name && ` - ${account.name}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
