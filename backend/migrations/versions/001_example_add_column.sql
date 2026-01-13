-- Migration: Add example column (EXAMPLE - DO NOT RUN)
-- Version: 001
-- Created: 2026-01-13
--
-- This is an example migration file showing the format.
-- Real migrations should be created using: pnpm migrate:create

-- Example: Adding a column to an existing table
-- ALTER TABLE "Referenda" ADD COLUMN "example_field" TEXT;

-- Example: Creating an index
-- CREATE INDEX "idx_referenda_example" ON "Referenda" ("example_field");

-- Example: Updating data
-- UPDATE "Referenda" SET example_field = 'default' WHERE example_field IS NULL;

-- NOTE: This example file should be deleted before implementing real migrations
