import type { BookkeepingStatus } from "./api";

/**
 * Filter options for records queries.
 */
export interface RecordFilters {
  date_from?: string;
  date_to?: string;
  status?: BookkeepingStatus;
}

/**
 * Filter options for seller queries.
 */
export interface SellerFilters {
  flagged?: boolean;
  search?: string;
}

/**
 * Type-safe query key factory.
 * Pattern: ['entity', orgId, ...scope] for org-scoped queries.
 */
export const queryKeys = {
  /**
   * Account query keys
   */
  accounts: {
    /** All account-related queries for an org */
    all: (orgId: string) => ["accounts", orgId] as const,
    /** Account list query */
    list: (orgId: string) => ["accounts", orgId, "list"] as const,
  },

  /**
   * Record query keys
   */
  records: {
    /** All record-related queries for an org */
    all: (orgId: string) => ["records", orgId] as const,
    /** Record list query for a specific account */
    list: (orgId: string, accountId: string, filters?: RecordFilters) =>
      ["records", orgId, accountId, "list", filters] as const,
    /** Infinite query for cursor pagination */
    infinite: (orgId: string, accountId: string, filters?: RecordFilters) =>
      ["records", orgId, accountId, "infinite", filters] as const,
  },

  /**
   * Seller query keys
   */
  sellers: {
    /** All seller-related queries for an org */
    all: (orgId: string) => ["sellers", orgId] as const,
    /** Seller list query with optional filters */
    list: (orgId: string, filters?: SellerFilters) =>
      ["sellers", orgId, "list", filters] as const,
    /** Infinite query for cursor pagination */
    infinite: (orgId: string, filters?: SellerFilters) =>
      ["sellers", orgId, "infinite", filters] as const,
  },
} as const;

/**
 * Helper type to extract query key types
 */
export type QueryKeys = typeof queryKeys;
