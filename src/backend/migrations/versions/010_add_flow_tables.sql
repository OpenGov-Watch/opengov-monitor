-- Migration: Add Cross Chain Flows and Local Flows tables
-- Version: 010
-- Created: 2026-01-16
-- Description: Add CSV-backed tables for cross chain and local flow tracking

-- Create Cross Chain Flows table
CREATE TABLE IF NOT EXISTS "Cross Chain Flows" (
    "message_hash" TEXT,
    "from_account" TEXT,
    "to_account" TEXT,
    "block" INTEGER,
    "origin_event_index" TEXT,
    "dest_event_index" TEXT,
    "time" TEXT,
    "from_chain_id" TEXT,
    "destination_chain_id" TEXT,
    "value" TEXT,
    "protocol" TEXT,
    "status" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_cross_chain_flows_message_hash" ON "Cross Chain Flows" ("message_hash");
CREATE INDEX IF NOT EXISTS "idx_cross_chain_flows_from_account" ON "Cross Chain Flows" ("from_account");
CREATE INDEX IF NOT EXISTS "idx_cross_chain_flows_to_account" ON "Cross Chain Flows" ("to_account");
CREATE INDEX IF NOT EXISTS "idx_cross_chain_flows_time" ON "Cross Chain Flows" ("time");

-- Create Local Flows table
CREATE TABLE IF NOT EXISTS "Local Flows" (
    "extrinsic_id" TEXT PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS "idx_local_flows_from_account" ON "Local Flows" ("from_account");
CREATE INDEX IF NOT EXISTS "idx_local_flows_to_account" ON "Local Flows" ("to_account");
CREATE INDEX IF NOT EXISTS "idx_local_flows_date" ON "Local Flows" ("date");
CREATE INDEX IF NOT EXISTS "idx_local_flows_year_month" ON "Local Flows" ("year_month");
CREATE INDEX IF NOT EXISTS "idx_local_flows_quarter" ON "Local Flows" ("quarter");
