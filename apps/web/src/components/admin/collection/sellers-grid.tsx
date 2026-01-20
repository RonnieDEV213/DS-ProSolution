"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, Download, FileText, Braces, Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Seller {
  id: string;
  display_name: string;
  normalized_name: string;
  platform: string;
  times_seen: number;
}

interface SellersGridProps {
  refreshTrigger: number;
  onSellerChange: () => void;
  newSellerIds?: Set<string>; // IDs of sellers added in current run (for highlighting)
}

export function SellersGrid({ refreshTrigger, onSellerChange, newSellerIds = new Set() }: SellersGridProps) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSellerName, setNewSellerName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch sellers
  const fetchSellers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/sellers`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSellers(data.sellers || []);
      }
    } catch (e) {
      console.error("Failed to fetch sellers:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    fetchSellers();
  }, [refreshTrigger, fetchSellers]);

  // Add seller
  const handleAddSeller = async () => {
    if (!newSellerName.trim()) return;
    setAddError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE}/sellers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: newSellerName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        setAddError(data.detail || "Failed to add seller");
        return;
      }

      setNewSellerName("");
      onSellerChange();
      fetchSellers();
    } catch (e) {
      setAddError("Failed to add seller");
    }
  };

  // Edit seller
  const startEdit = (seller: Seller) => {
    setEditingId(seller.id);
    setEditValue(seller.display_name);
  };

  const saveEdit = async () => {
    if (!editingId || !editValue?.trim()) {
      setEditingId(null);
      setEditValue("");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/sellers/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: editValue.trim() }),
      });

      setEditingId(null);
      onSellerChange();
      fetchSellers();
    } catch (e) {
      console.error("Failed to update seller:", e);
    }
  };

  // Delete seller
  const handleDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/sellers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      onSellerChange();
      fetchSellers();
    } catch (e) {
      console.error("Failed to delete seller:", e);
    }
  };

  // Export functions
  const downloadCSV = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${API_BASE}/sellers/export?format=csv`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sellers.csv";
    a.click();
  };

  const copyJSON = async () => {
    const json = JSON.stringify(sellers.map(s => s.display_name), null, 2);
    await navigator.clipboard.writeText(json);
  };

  const copyRawText = async () => {
    const text = sellers.map(s => s.display_name).join("\n");
    await navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="text-gray-400 p-4">Loading sellers...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with add + export */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={newSellerName}
            onChange={(e) => setNewSellerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSeller()}
            placeholder="Add seller..."
            className="bg-gray-800 border-gray-700 text-white max-w-xs"
          />
          <Button
            size="sm"
            onClick={handleAddSeller}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {addError && <span className="text-red-400 text-sm">{addError}</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">{sellers.length} sellers</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
              <DropdownMenuItem onClick={downloadCSV} className="text-gray-200 focus:bg-gray-700">
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyJSON} className="text-gray-200 focus:bg-gray-700">
                <Braces className="h-4 w-4 mr-2" />
                Copy JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyRawText} className="text-gray-200 focus:bg-gray-700">
                <FileText className="h-4 w-4 mr-2" />
                Copy Raw Text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid container */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg">
        {sellers.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No sellers yet. Add one above or run a collection.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 p-2">
            {sellers.map((seller, index) => (
              <div
                key={seller.id}
                className={cn(
                  "group relative px-2 py-1 bg-gray-800 rounded text-sm text-gray-200 truncate",
                  "hover:bg-gray-700 transition-colors cursor-pointer",
                  newSellerIds.has(seller.id) && "ring-1 ring-green-500 bg-green-900/20"
                )}
                onClick={() => startEdit(seller)}
              >
                {editingId === seller.id ? (
                  <input
                    value={editValue ?? ""}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="w-full bg-gray-700 px-1 rounded outline-none text-white"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="text-gray-500 mr-1">{index + 1}.</span>
                    <span className="truncate">{seller.display_name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(seller.id);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
