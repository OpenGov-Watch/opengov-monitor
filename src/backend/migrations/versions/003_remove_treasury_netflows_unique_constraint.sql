-- Migration: Remove UNIQUE constraint from Treasury Netflows
-- Version: 003
-- Description: Allow multiple transactions per (month, asset, flow_type)
-- Recreates table without PRIMARY KEY constraint

-- Drop the composite unique index (if exists)
DROP INDEX IF EXISTS "idx_netflows_unique";

-- Rename old table
ALTER TABLE "Treasury Netflows" RENAME TO "Treasury Netflows_old";

-- Create new table without PRIMARY KEY
CREATE TABLE "Treasury Netflows" (
  "month" TEXT,
  "asset_name" TEXT,
  "flow_type" TEXT,
  "amount_usd" REAL,
  "amount_dot_equivalent" REAL
);

-- Copy data from old table
INSERT INTO "Treasury Netflows" (month, asset_name, flow_type, amount_usd, amount_dot_equivalent)
SELECT month, asset_name, flow_type, amount_usd, amount_dot_equivalent
FROM "Treasury Netflows_old";

-- Drop old table
DROP TABLE "Treasury Netflows_old";

-- Recreate indexes
CREATE INDEX "idx_netflows_month" ON "Treasury Netflows" ("month");
CREATE INDEX "idx_netflows_asset" ON "Treasury Netflows" ("asset_name");
CREATE INDEX "idx_netflows_type" ON "Treasury Netflows" ("flow_type");
