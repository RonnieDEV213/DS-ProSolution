import { db, SCHEMA_VERSION } from './index';

const VERSION_KEY = 'ds-pro-schema-version';

/**
 * Initialize database with version migration handling.
 * Clears all data if schema version changed (simpler than migrations).
 */
export async function initializeDatabase(): Promise<void> {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  const currentVersion = String(SCHEMA_VERSION);

  if (storedVersion !== currentVersion) {
    // Schema version changed - clear all data for clean resync
    console.log('[DB] Schema version changed, clearing IndexedDB...');
    await db.delete();
    await db.open();
    localStorage.setItem(VERSION_KEY, currentVersion);
    console.log('[DB] Database cleared, will resync from server');
  } else {
    await db.open();
    console.log('[DB] Database opened');
  }
}
