-- Migration 025: Add Custom Table Metadata table for user-created tables via CSV import
-- This table stores metadata about dynamically created custom tables

CREATE TABLE IF NOT EXISTS "Custom Table Metadata" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "table_name" TEXT NOT NULL UNIQUE,     -- Internal name: "custom_my_data"
    "display_name" TEXT NOT NULL,          -- User-friendly: "My Data"
    "schema_json" TEXT NOT NULL,           -- Column definitions JSON
    "row_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_custom_table_metadata_name"
    ON "Custom Table Metadata" ("table_name");
