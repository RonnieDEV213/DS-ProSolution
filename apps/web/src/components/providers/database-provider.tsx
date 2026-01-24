'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { initializeDatabase } from '@/lib/db/init';

interface DatabaseProviderProps {
  children: ReactNode;
}

/**
 * Initializes IndexedDB on app load.
 * Renders children only after database is ready.
 * Falls back gracefully if IndexedDB unavailable (app works without cache).
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then(() => setReady(true))
      .catch((err) => {
        console.error('[DB] Database init failed, continuing without cache:', err);
        // Still render app - it will work without local cache
        setReady(true);
      });
  }, []);

  if (!ready) {
    // Brief loading state while DB initializes (typically <100ms)
    return null;
  }

  return <>{children}</>;
}
