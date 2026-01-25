"use client";

import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export type RowDensity = "compact" | "comfortable";

const DEFAULT_DENSITY: RowDensity = "comfortable";

const getInitialDensity = (): RowDensity => {
  if (typeof window === "undefined") return DEFAULT_DENSITY;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TABLE_DENSITY);
    return stored === "compact" ? "compact" : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
};

export function useRowDensity() {
  const [density, setDensity] = useState<RowDensity>(getInitialDensity);

  const toggleDensity = useCallback(() => {
    setDensity((prev) => {
      const next = prev === "compact" ? "comfortable" : "compact";

      try {
        localStorage.setItem(STORAGE_KEYS.TABLE_DENSITY, next);
      } catch {
        // localStorage may be unavailable
      }

      return next;
    });
  }, []);

  const rowHeight = density === "compact" ? 36 : 52;

  return { density, toggleDensity, rowHeight };
}
