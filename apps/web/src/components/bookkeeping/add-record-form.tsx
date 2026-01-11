"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  STATUS_LABELS,
  type BookkeepingRecord,
  type BookkeepingStatus,
  type UserRole,
} from "@/lib/api";

const STATUS_OPTIONS: { value: BookkeepingStatus; label: string }[] = [
  { value: "SUCCESSFUL", label: STATUS_LABELS.SUCCESSFUL },
  { value: "RETURN_LABEL_PROVIDED", label: STATUS_LABELS.RETURN_LABEL_PROVIDED },
  { value: "RETURN_CLOSED", label: STATUS_LABELS.RETURN_CLOSED },
  { value: "REFUND_NO_RETURN", label: STATUS_LABELS.REFUND_NO_RETURN },
];

interface AddRecordFormProps {
  accountId: string;
  userRole: UserRole;
  onRecordAdded: (record: BookkeepingRecord) => void;
  onCancel: () => void;
}

export function AddRecordForm({
  accountId,
  userRole,
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
    amazon_price: "",
    amazon_tax: "",
    amazon_shipping: "",
    amazon_order_id: "",
    order_remark: "",
    status: "SUCCESSFUL" as BookkeepingStatus,
  });

  const validateMoneyField = (
    value: string,
    fieldName: string
  ): number | null => {
    if (!value.trim()) return null;
    if (!/^-?\d*\.?\d{0,2}$/.test(value.trim())) {
      throw new Error(
        `${fieldName} must be a valid dollar amount (e.g., 123.45)`
      );
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
        throw new Error(
          "Sale price must be a valid dollar amount (e.g., 123.45)"
        );
      }
      const salePrice = parseDollars(formData.sale_price);
      if (salePrice === null || salePrice <= 0) {
        throw new Error("Sale price must be a positive amount");
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

      const record = await api.createRecord({
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
        order_remark:
          userRole.canAccessOrderRemark && formData.order_remark
            ? formData.order_remark
            : null,
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
          <Label htmlFor="amazon_price" className="text-gray-300">
            Amazon Price
          </Label>
          <Input
            id="amazon_price"
            type="text"
            placeholder="15.00"
            value={formData.amazon_price}
            onChange={(e) => handleChange("amazon_price", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amazon_tax" className="text-gray-300">
            Amazon Tax
          </Label>
          <Input
            id="amazon_tax"
            type="text"
            placeholder="1.20"
            value={formData.amazon_tax}
            onChange={(e) => handleChange("amazon_tax", e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amazon_shipping" className="text-gray-300">
            Amazon Shipping
          </Label>
          <Input
            id="amazon_shipping"
            type="text"
            placeholder="0.00"
            value={formData.amazon_shipping}
            onChange={(e) => handleChange("amazon_shipping", e.target.value)}
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

        {userRole.canAccessOrderRemark && (
          <div className="space-y-2 col-span-2">
            <Label htmlFor="order_remark" className="text-gray-300">
              Order Remark
            </Label>
            <Textarea
              id="order_remark"
              value={formData.order_remark}
              onChange={(e) => handleChange("order_remark", e.target.value)}
              className="bg-gray-800 border-gray-700 min-h-[60px]"
              placeholder="Notes about this order..."
            />
          </div>
        )}
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
