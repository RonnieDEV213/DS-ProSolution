"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  parseDollars,
  type BookkeepingRecord,
  type BookkeepingStatus,
} from "@/lib/api";

const STATUS_OPTIONS: { value: BookkeepingStatus; label: string }[] = [
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "RETURN_LABEL_PROVIDED", label: "Return Label Provided" },
  { value: "RETURN_CLOSED", label: "Return Closed" },
  { value: "REFUND_NO_RETURN", label: "Refund (No Return)" },
];

interface AddRecordFormProps {
  accountId: string;
  onRecordAdded: (record: BookkeepingRecord) => void;
  onCancel: () => void;
}

export function AddRecordForm({
  accountId,
  onRecordAdded,
  onCancel,
}: AddRecordFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ebay_order_id: "",
    sale_date: new Date().toISOString().split("T")[0],
    item_name: "",
    qty: "1",
    sale_price: "",
    ebay_fees: "",
    cogs: "",
    tax_paid: "",
    return_label_cost: "",
    amazon_order_id: "",
    remarks: "",
    status: "SUCCESSFUL" as BookkeepingStatus,
  });

  const validateMoneyField = (value: string, fieldName: string): number | null => {
    if (!value.trim()) return null;
    // Only allow valid dollar amounts: optional minus, digits, optional decimal with up to 2 digits
    if (!/^-?\d*\.?\d{0,2}$/.test(value.trim())) {
      throw new Error(`${fieldName} must be a valid dollar amount (e.g., 123.45)`);
    }
    return parseDollars(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Validate sale price format
      if (!formData.sale_price.trim()) {
        throw new Error("Sale price is required");
      }
      if (!/^\d*\.?\d{0,2}$/.test(formData.sale_price.trim())) {
        throw new Error("Sale price must be a valid dollar amount (e.g., 123.45)");
      }
      const salePrice = parseDollars(formData.sale_price);
      if (salePrice === null || salePrice <= 0) {
        throw new Error("Sale price must be a positive amount");
      }

      // Validate other money fields
      const ebayFees = validateMoneyField(formData.ebay_fees, "eBay Fees");
      const cogs = validateMoneyField(formData.cogs, "COGS");
      const taxPaid = validateMoneyField(formData.tax_paid, "Tax Paid");
      const returnLabelCost = validateMoneyField(formData.return_label_cost, "Return Label Cost");

      const record = await api.createRecord({
        account_id: accountId,
        ebay_order_id: formData.ebay_order_id,
        sale_date: formData.sale_date,
        item_name: formData.item_name,
        qty: parseInt(formData.qty) || 1,
        sale_price_cents: salePrice,
        ebay_fees_cents: ebayFees,
        cogs_cents: cogs,
        tax_paid_cents: taxPaid,
        return_label_cost_cents: returnLabelCost,
        amazon_order_id: formData.amazon_order_id || null,
        remarks: formData.remarks || null,
        status: formData.status,
      });

      onRecordAdded(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create record");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4"
    >
      <h3 className="text-lg font-semibold text-white mb-4">Add New Record</h3>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ebay_order_id" className="text-gray-300">
            eBay Order ID *
          </Label>
          <Input
            id="ebay_order_id"
            value={formData.ebay_order_id}
            onChange={(e) => handleChange("ebay_order_id", e.target.value)}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale_date" className="text-gray-300">
            Sale Date *
          </Label>
          <Input
            id="sale_date"
            type="date"
            value={formData.sale_date}
            onChange={(e) => handleChange("sale_date", e.target.value)}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="item_name" className="text-gray-300">
            Item Name *
          </Label>
          <Input
            id="item_name"
            value={formData.item_name}
            onChange={(e) => handleChange("item_name", e.target.value)}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="qty" className="text-gray-300">
            Quantity
          </Label>
          <Input
            id="qty"
            type="number"
            min="1"
            value={formData.qty}
            onChange={(e) => handleChange("qty", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale_price" className="text-gray-300">
            Sale Price *
          </Label>
          <Input
            id="sale_price"
            type="text"
            placeholder="29.99"
            value={formData.sale_price}
            onChange={(e) => handleChange("sale_price", e.target.value)}
            required
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ebay_fees" className="text-gray-300">
            eBay Fees
          </Label>
          <Input
            id="ebay_fees"
            type="text"
            placeholder="3.00"
            value={formData.ebay_fees}
            onChange={(e) => handleChange("ebay_fees", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cogs" className="text-gray-300">
            COGS
          </Label>
          <Input
            id="cogs"
            type="text"
            placeholder="15.00"
            value={formData.cogs}
            onChange={(e) => handleChange("cogs", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_paid" className="text-gray-300">
            Tax Paid
          </Label>
          <Input
            id="tax_paid"
            type="text"
            placeholder="0.00"
            value={formData.tax_paid}
            onChange={(e) => handleChange("tax_paid", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="return_label_cost" className="text-gray-300">
            Return Label Cost
          </Label>
          <Input
            id="return_label_cost"
            type="text"
            placeholder="0.00"
            value={formData.return_label_cost}
            onChange={(e) => handleChange("return_label_cost", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amazon_order_id" className="text-gray-300">
            Amazon Order ID
          </Label>
          <Input
            id="amazon_order_id"
            value={formData.amazon_order_id}
            onChange={(e) => handleChange("amazon_order_id", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status" className="text-gray-300">
            Status
          </Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleChange("status", value)}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-white hover:bg-gray-700"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="remarks" className="text-gray-300">
            Remarks
          </Label>
          <Input
            id="remarks"
            value={formData.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Add Record"}
        </Button>
      </div>
    </form>
  );
}
