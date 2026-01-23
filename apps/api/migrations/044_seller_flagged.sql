-- Migration: 044_seller_flagged.sql
-- Purpose: Add flagged column to sellers table for highlighting sellers

ALTER TABLE sellers ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for filtering flagged sellers
CREATE INDEX idx_sellers_flagged ON sellers(org_id, flagged) WHERE flagged = TRUE;
