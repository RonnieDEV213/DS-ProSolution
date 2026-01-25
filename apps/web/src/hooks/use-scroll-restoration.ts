"use client";

import { useEffect, type RefObject } from "react";
import type { ListImperativeAPI } from "react-window";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const getScrollOffset = (listRef: RefObject<ListImperativeAPI | null>) => {
  const list = listRef.current as {
    getScrollOffset?: () => number;
    element?: HTMLDivElement | null;
    state?: { scrollOffset?: number };
  } | null;
  if (!list) return null;

  if (typeof list.getScrollOffset === "function") {
    return list.getScrollOffset();
  }

  if (list.element) {
    return list.element.scrollTop ?? null;
  }

  return list.state?.scrollOffset ?? null;
};

export function useScrollRestoration(
  listRef: RefObject<ListImperativeAPI | null>,
  key: string
) {
  useEffect(() => {
    if (!key) return;

    try {
      const saved = sessionStorage.getItem(
        `${STORAGE_KEYS.SCROLL_OFFSET}:${key}`
      );
      if (!saved || !listRef.current) return;
      const offset = Number.parseFloat(saved);
      if (Number.isNaN(offset)) return;

      const frame = requestAnimationFrame(() => {
        const list = listRef.current as {
          scrollTo?: (value: number) => void;
          element?: HTMLDivElement | null;
        } | null;
        if (typeof list?.scrollTo === "function") {
          list.scrollTo(offset);
          return;
        }
        if (list?.element) {
          list.element.scrollTop = offset;
        }
      });

      return () => cancelAnimationFrame(frame);
    } catch {
      return;
    }
  }, [key, listRef]);

  useEffect(() => {
    return () => {
      if (!key) return;
      const offset = getScrollOffset(listRef);
      if (offset === null) return;

      try {
        sessionStorage.setItem(
          `${STORAGE_KEYS.SCROLL_OFFSET}:${key}`,
          String(offset)
        );
      } catch {
        // sessionStorage may be unavailable
      }
    };
  }, [key, listRef]);
}
