"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Download, Copy, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const CELL_WIDTH = 140; // pixels per seller cell
const MIN_COLUMNS = 3;
const MAX_COLUMNS = 8;

interface Seller {
  id: string;
  name: string;
  discovered_at: string;
}

interface SellersGridProps {
  refreshTrigger: number;
  onSellerChange: () => void;
  newSellerIds?: Set<string>; // IDs of sellers added in current run (for highlighting)
}

export function SellersGrid({ refreshTrigger, onSellerChange, newSellerIds = new Set() }: SellersGridProps) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState(5);
  const [newSellerName, setNewSellerName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
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

  // Resize handling
  useEffect(() => {
    const handle = resizeRef.current;
    if (!handle) return;

    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = containerRef.current?.offsetWidth || CELL_WIDTH * columns;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = startWidth + delta;
      const newCols = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.round(newWidth / CELL_WIDTH)));
      setColumns(newCols);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    handle.addEventListener("mousedown", onMouseDown);
    return () => handle.removeEventListener("mousedown", onMouseDown);
  }, [columns]);

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
    setEditValue(seller.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editValue.trim()) {
      setEditingId(null);
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
  const exportCSV = async () => {
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

  const exportJSON = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${API_BASE}/sellers/export?format=json`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data.sellers, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sellers.json";
    a.click();
  };

  const copyToClipboard = async () => {
    const names = sellers.map(s => s.name).join("\n");
    await navigator.clipboard.writeText(names);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading) {
    return <div className="text-gray-400 p-4">Loading sellers...</div>;
  }

  const gridWidth = columns * CELL_WIDTH;

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

        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-sm mr-2">{sellers.length} sellers</span>
          <Button variant="ghost" size="sm" onClick={exportCSV} title="Export CSV">
            <Download className="h-4 w-4" />
            <span className="ml-1 text-xs">CSV</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={exportJSON} title="Export JSON">
            <Download className="h-4 w-4" />
            <span className="ml-1 text-xs">JSON</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={copyToClipboard} title="Copy to clipboard">
            {copySuccess ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Grid container with resize handle */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={containerRef}
          style={{ width: gridWidth }}
          className="h-full overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg"
        >
          {sellers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No sellers yet. Add one above or run a collection.
            </div>
          ) : (
            <div
              className="grid gap-1 p-2"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {sellers.map((seller) => (
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
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="w-full bg-gray-700 px-1 rounded outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="truncate">{seller.name}</span>
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

        {/* Resize handle */}
        <div
          ref={resizeRef}
          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-blue-500/30"
          style={{ right: `calc(100% - ${gridWidth}px - 8px)` }}
        />
      </div>
    </div>
  );
}
