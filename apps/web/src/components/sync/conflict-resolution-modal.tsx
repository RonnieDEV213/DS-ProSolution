'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useSyncConflicts } from '@/components/providers/sync-provider';
import type { MergeSelection } from '@/lib/db/conflicts';
import { formatCents, displayValue, STATUS_LABELS, type BookkeepingStatus } from '@/lib/api';

// Human-readable field labels
const FIELD_LABELS: Record<string, string> = {
  sale_date: 'Sale Date',
  item_name: 'Item Name',
  qty: 'Quantity',
  sale_price_cents: 'Sale Price',
  ebay_fees_cents: 'eBay Fees',
  amazon_price_cents: 'Amazon Price',
  amazon_tax_cents: 'Amazon Tax',
  amazon_shipping_cents: 'Amazon Shipping',
  amazon_order_id: 'Amazon Order',
  status: 'Status',
  return_label_cost_cents: 'Return Label Cost',
  order_remark: 'Order Remark',
  service_remark: 'Service Remark',
};

export function ConflictResolutionModal() {
  const { currentConflict, hasConflicts, conflicts, resolveCurrentConflict } =
    useSyncConflicts();
  const [mergeSelection, setMergeSelection] = useState<MergeSelection>({});
  const [applyToAll, setApplyToAll] = useState(false);
  const [resolving, setResolving] = useState(false);

  if (!hasConflicts || !currentConflict) return null;

  const formatValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (field.endsWith('_cents')) return formatCents(value as number);
    if (field === 'status') return STATUS_LABELS[value as BookkeepingStatus] ?? String(value);
    return displayValue(value);
  };

  const handleResolve = async (resolution: 'keep-mine' | 'keep-theirs' | 'merge') => {
    setResolving(true);
    try {
      await resolveCurrentConflict(
        resolution,
        resolution === 'merge' ? mergeSelection : undefined,
        applyToAll
      );
      setMergeSelection({});
      setApplyToAll(false);
    } finally {
      setResolving(false);
    }
  };

  const toggleMergeField = (field: string, choice: 'local' | 'server') => {
    setMergeSelection((prev) => ({ ...prev, [field]: choice }));
  };

  const remainingCount = conflicts.length - 1;

  return (
    <Dialog open={hasConflicts} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" showCloseButton={false} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Sync Conflict Detected</DialogTitle>
          <DialogDescription>
            This record was modified on both your device and the server.
            Choose how to resolve the conflict.
            {remainingCount > 0 && (
              <span className="block mt-1 text-yellow-400">
                {remainingCount} more conflict{remainingCount > 1 ? 's' : ''} remaining
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field-by-field comparison */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-muted-foreground">Field</th>
                  <th className="px-3 py-2 text-left text-blue-400">Your Value</th>
                  <th className="px-3 py-2 text-left text-green-400">Server Value</th>
                  <th className="px-3 py-2 text-left text-muted-foreground w-16">Keep</th>
                </tr>
              </thead>
              <tbody>
                {currentConflict.conflicting_fields.map((field) => (
                  <tr key={field} className="border-t border-border">
                    <td className="px-3 py-2 font-mono font-medium text-foreground">
                      {FIELD_LABELS[field] ?? field}
                    </td>
                    <td className="px-3 py-2 text-blue-300">
                      {formatValue(field, currentConflict.local_values[field])}
                    </td>
                    <td className="px-3 py-2 text-green-300">
                      {formatValue(field, currentConflict.server_values[field])}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleMergeField(field, 'local')}
                          className={`w-6 h-6 rounded text-xs font-medium ${
                            mergeSelection[field] === 'local'
                              ? 'bg-blue-600 text-white'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleMergeField(field, 'server')}
                          className={`w-6 h-6 rounded text-xs font-medium ${
                            mergeSelection[field] === 'server'
                              ? 'bg-green-600 text-white'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          S
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Apply to all checkbox (only show if more conflicts) */}
          {remainingCount > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-all"
                checked={applyToAll}
                onCheckedChange={(checked) => setApplyToAll(checked === true)}
              />
              <label htmlFor="apply-all" className="text-sm text-muted-foreground cursor-pointer">
                Apply this choice to all {remainingCount} remaining conflict{remainingCount > 1 ? 's' : ''}
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleResolve('keep-mine')}
            disabled={resolving}
            className="border-blue-600 text-blue-400 hover:bg-blue-900/20"
          >
            Keep Mine
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResolve('keep-theirs')}
            disabled={resolving}
            className="border-green-600 text-green-400 hover:bg-green-900/20"
          >
            Keep Theirs
          </Button>
          <Button
            variant="default"
            onClick={() => handleResolve('merge')}
            disabled={resolving || Object.keys(mergeSelection).length === 0}
          >
            Merge Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
