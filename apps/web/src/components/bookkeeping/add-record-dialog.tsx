"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseDollars, type UserRole } from "@/lib/api";
import { useCreateRecord } from "@/hooks/mutations/use-create-record";

interface AddRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  userRole: UserRole;
  orgId: string;
  onRecordAdded: () => void;
}

export function AddRecordDialog({
  open,
  onOpenChange,
  accountId,
  orgId,
  onRecordAdded,
}: AddRecordDialogProps) {
  const [error, setError] = useState<string | null>(null);

  // Use mutation hook
  const createMutation = useCreateRecord(orgId, accountId);

  const [formData, setFormData] = useState({
    ebay_order_id: "",
    sale_date: new Date().toISOString().split("T")[0],
    item_name: "",
    qty: "1",
    sale_price: "",
    ebay_fees: "",
    amazon_price: "",
    amazon_tax: "",
    amazon_shipping: "",
    amazon_order_id: "",
    order_remark: "",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        ebay_order_id: "",
        sale_date: new Date().toISOString().split("T")[0],
        item_name: "",
        qty: "1",
        sale_price: "",
        ebay_fees: "",
        amazon_price: "",
        amazon_tax: "",
        amazon_shipping: "",
        amazon_order_id: "",
        order_remark: "",
      });
      setError(null);
    }
  }, [open]);

  const validateMoneyField = (
    value: string,
    fieldName: string
  ): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Reject scientific notation
    if (trimmed.toLowerCase().includes("e")) {
      throw new Error(`${fieldName} cannot use scientific notation`);
    }
    const num = parseFloat(trimmed);
    if (!Number.isFinite(num)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    if (num < 0) {
      throw new Error(`${fieldName} cannot be negative`);
    }
    return parseDollars(trimmed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate sale price
      const salePriceTrimmed = formData.sale_price.trim();
      if (!salePriceTrimmed) {
        throw new Error("Sale price is required");
      }
      // Reject scientific notation
      if (salePriceTrimmed.toLowerCase().includes("e")) {
        throw new Error("Sale price cannot use scientific notation");
      }
      const salePriceNum = parseFloat(salePriceTrimmed);
      if (!Number.isFinite(salePriceNum)) {
        throw new Error("Sale price must be a valid number");
      }
      if (salePriceNum <= 0) {
        throw new Error("Sale price must be a positive amount");
      }
      const salePrice = parseDollars(salePriceTrimmed);
      if (salePrice === null) {
        throw new Error("Sale price must be a valid dollar amount");
      }

      // Validate other money fields
      const ebayFees = validateMoneyField(formData.ebay_fees, "eBay Fees");
      const amazonPrice = validateMoneyField(
        formData.amazon_price,
        "Amazon Price"
      );
      const amazonTax = validateMoneyField(formData.amazon_tax, "Amazon Tax");
      const amazonShipping = validateMoneyField(
        formData.amazon_shipping,
        "Amazon Shipping"
      );

      // Use mutation to create record
      await createMutation.mutateAsync({
        account_id: accountId,
        ebay_order_id: formData.ebay_order_id,
        sale_date: formData.sale_date,
        item_name: formData.item_name,
        qty: parseInt(formData.qty) || 1,
        sale_price_cents: salePrice,
        ebay_fees_cents: ebayFees,
        amazon_price_cents: amazonPrice,
        amazon_tax_cents: amazonTax,
        amazon_shipping_cents: amazonShipping,
        amazon_order_id: formData.amazon_order_id || null,
        order_remark: formData.order_remark || null,
        status: "SUCCESSFUL",
      });

      toast.success("Record added successfully");
      onOpenChange(false);
      onRecordAdded();
    } catch (err) {
      // Don't close dialog on error - let user fix and retry
      setError(err instanceof Error ? err.message : "Failed to create record");
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Add New Record</DialogTitle>
          <DialogDescription className="sr-only">
            Form to add a new bookkeeping record
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* eBay Details */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">eBay Details</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="ebay_order_id" className="text-gray-300 text-xs">
                  Order ID *
                </Label>
                <Input
                  id="ebay_order_id"
                  value={formData.ebay_order_id}
                  onChange={(e) => handleChange("ebay_order_id", e.target.value)}
                  required
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sale_date" className="text-gray-300 text-xs">
                  Sale Date *
                </Label>
                <Input
                  id="sale_date"
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) => handleChange("sale_date", e.target.value)}
                  required
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="space-y-1 flex-1">
                <Label htmlFor="item_name" className="text-gray-300 text-xs">
                  Item Name *
                </Label>
                <Input
                  id="item_name"
                  value={formData.item_name}
                  onChange={(e) => handleChange("item_name", e.target.value)}
                  required
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
              <div className="space-y-1 w-16">
                <Label htmlFor="qty" className="text-gray-300 text-xs">
                  Qty
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min="1"
                  value={formData.qty}
                  onChange={(e) => handleChange("qty", e.target.value)}
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* eBay Earnings */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">eBay Earnings</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="sale_price" className="text-gray-300 text-xs">
                  Sale Price *
                </Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="29.99"
                  value={formData.sale_price}
                  onChange={(e) => handleChange("sale_price", e.target.value)}
                  required
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ebay_fees" className="text-gray-300 text-xs">
                  eBay Fees
                </Label>
                <Input
                  id="ebay_fees"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="3.00"
                  value={formData.ebay_fees}
                  onChange={(e) => handleChange("ebay_fees", e.target.value)}
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Amazon Details */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">Amazon Details</h3>
            <div className="space-y-1">
              <Label htmlFor="amazon_order_id" className="text-gray-300 text-xs">
                Order ID
              </Label>
              <Input
                id="amazon_order_id"
                value={formData.amazon_order_id}
                onChange={(e) => handleChange("amazon_order_id", e.target.value)}
                disabled={createMutation.isPending}
                className="bg-gray-800 border-gray-700 h-8 text-sm"
              />
            </div>
          </div>

          {/* Amazon COGs */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">Amazon COGs</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="amazon_price" className="text-gray-300 text-xs">
                  Price
                </Label>
                <Input
                  id="amazon_price"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="15.00"
                  value={formData.amazon_price}
                  onChange={(e) => handleChange("amazon_price", e.target.value)}
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="amazon_tax" className="text-gray-300 text-xs">
                  Tax
                </Label>
                <Input
                  id="amazon_tax"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="1.20"
                  value={formData.amazon_tax}
                  onChange={(e) => handleChange("amazon_tax", e.target.value)}
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="amazon_shipping" className="text-gray-300 text-xs">
                  Shipping
                </Label>
                <Input
                  id="amazon_shipping"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formData.amazon_shipping}
                  onChange={(e) => handleChange("amazon_shipping", e.target.value)}
                  disabled={createMutation.isPending}
                  className="bg-gray-800 border-gray-700 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Remark */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">Remark</h3>
            <Textarea
              id="order_remark"
              value={formData.order_remark}
              onChange={(e) => handleChange("order_remark", e.target.value)}
              disabled={createMutation.isPending}
              className="bg-gray-800 border-gray-700 min-h-[50px] text-sm"
              placeholder="Notes about this order..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Add Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
