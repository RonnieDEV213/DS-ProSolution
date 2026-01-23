"use client";

import { ReactNode } from "react";
import { CollectionProgressProvider } from "@/contexts/collection-progress-context";
import { GlobalProgressIndicator } from "./collection/global-progress-indicator";

export function AdminLayoutClient({ children }: { children: ReactNode }) {
  return (
    <CollectionProgressProvider>
      {children}
      <GlobalProgressIndicator />
    </CollectionProgressProvider>
  );
}
