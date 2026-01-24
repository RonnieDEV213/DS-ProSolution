"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createQueryClient } from "@/lib/query-client";

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Query provider component that wraps the application with TanStack Query.
 * Uses useState to ensure a new QueryClient is only created once per component instance,
 * which is essential for SSR safety.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient only once per component instance
  // This pattern ensures SSR safety by not sharing state between requests
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
