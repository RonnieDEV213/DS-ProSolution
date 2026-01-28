'use client';

import { useEffect, type ReactNode } from 'react';
import { initializeDatabase } from '@/lib/db/init';

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * Initializes IndexedDB on app load.
 * Renders children immediately to avoid white flash — Dexie handles
 * pending queries gracefully (useLiveQuery returns undefined until DB is ready,
 * which downstream hooks treat as isLoading=true).
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  useEffect(() => {
    initializeDatabase().catch((err) => {
      console.error('[DB] Database init failed, continuing without cache:', err);
    });
  }, []);

  return <>{children}</>;
}
