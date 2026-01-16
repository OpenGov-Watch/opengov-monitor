-- Migration: Remove PRIMARY KEY constraint from Local Flows
-- Version: 011
-- Created: 2026-01-16
-- Description: Remove unique constraint from extrinsic_id column

-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate the table

-- Create new table without PRIMARY KEY
CREATE TABLE IF NOT EXISTS "Local Flows_new" (
    "extrinsic_id" TEXT,
    "date" TEXT,
    "block" INTEGER,
    "hash" TEXT,
    "symbol" TEXT,
    "from_account" TEXT,
    "to_account" TEXT,
    "value" TEXT,
    "result" TEXT,
    "year_month" TEXT,
    "quarter" TEXT
);

-- Copy data from old table (if any exists)
INSERT INTO "Local Flows_new" SELECT * FROM "Local Flows";

-- Drop old table
DROP TABLE "Local Flows";

-- Rename new table
ALTER TABLE "Local Flows_new" RENAME TO "Local Flows";

-- Recreate indexes
CREATE INDEX IF NOT EXISTS "idx_local_flows_from_account" ON "Local Flows" ("from_account");
CREATE INDEX IF NOT EXISTS "idx_local_flows_to_account" ON "Local Flows" ("to_account");
CREATE INDEX IF NOT EXISTS "idx_local_flows_date" ON "Local Flows" ("date");
CREATE INDEX IF NOT EXISTS "idx_local_flows_year_month" ON "Local Flows" ("year_month");
CREATE INDEX IF NOT EXISTS "idx_local_flows_quarter" ON "Local Flows" ("quarter");
