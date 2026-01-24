"use client";

import { useEffect, useState, type RefObject } from "react";
import type { ListImperativeAPI } from "react-window";

type ScrollAlignment = "auto" | "smart" | "center" | "start" | "end";
type ListWithScroll = ListImperativeAPI & {
  scrollToItem?: (index: number, align?: ScrollAlignment) => void;
};

const isEditableElement = (element: Element | null) => {
  if (!element) return false;
  if (element instanceof HTMLInputElement) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  return (element as HTMLElement).isContentEditable;
};

const isContainerFocused = (
  containerRef: RefObject<HTMLElement>
): boolean => {
  const container = containerRef.current;
  const activeElement = document.activeElement;
  if (!container || !activeElement) return false;
  if (container === activeElement) return true;
  return container.contains(activeElement) && !isEditableElement(activeElement);
};

export function useKeyboardNavigation(
  listRef: RefObject<ListWithScroll>,
  rowCount: number,
  onSelect: (index: number) => void,
  containerRef: RefObject<HTMLElement>
) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isContainerFocused(containerRef)) return;

      switch (event.key) {
        case "j":
        case "ArrowDown": {
          event.preventDefault();
          setFocusedIndex((prev) => {
            if (rowCount <= 0) return -1;
            const next = prev < 0 ? 0 : Math.min(prev + 1, rowCount - 1);
            return next;
          });
          break;
        }
        case "k":
        case "ArrowUp": {
          event.preventDefault();
          setFocusedIndex((prev) => {
            if (rowCount <= 0) return -1;
            const next = prev <= 0 ? 0 : prev - 1;
            return next;
          });
          break;
        }
        case "Enter": {
          if (focusedIndex >= 0) {
            event.preventDefault();
            onSelect(focusedIndex);
          }
          break;
        }
        case "Escape": {
          if (focusedIndex !== -1) {
            event.preventDefault();
            setFocusedIndex(-1);
          }
          break;
        }
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, focusedIndex, onSelect, rowCount]);

  useEffect(() => {
    if (focusedIndex >= 0) {
      listRef.current?.scrollToItem?.(focusedIndex, "smart");
    }
  }, [focusedIndex, listRef]);

  return { focusedIndex, setFocusedIndex };
}
