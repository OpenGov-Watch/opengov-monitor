// Re-export all shared types
export * from "@opengov-monitor/shared";

// API-specific types (not needed in frontend)

// Custom Table Metadata (tracks user-created tables via CSV import)
export interface CustomTableMetadata {
  id: number;
  table_name: string; // Internal name: "custom_my_data"
  display_name: string; // User-friendly: "My Data"
  schema_json: string; // JSON string of CustomTableSchema
  row_count: number;
  created_at: string | null;
  updated_at: string | null;
}

// Schema definition for custom tables
export interface CustomTableColumnDef {
  name: string;
  type: "text" | "integer" | "real" | "date" | "boolean";
  nullable: boolean;
}

export interface CustomTableSchema {
  columns: CustomTableColumnDef[];
}

// Import Item Types for Bulk Operations

export interface ReferendumImportItem {
  id: number;
  // Option A: Direct category ID (existing)
  category_id?: number | null;
  // Option B: Category strings (new - backend will resolve)
  category?: string | null;
  subcategory?: string | null;
  notes?: string | null;
  hide_in_spends?: number | null;
}

export interface ChildBountyImportItem {
  identifier: string;
  // Option A: Direct category ID (existing)
  category_id?: number | null;
  // Option B: Category strings (new - backend will resolve)
  category?: string | null;
  subcategory?: string | null;
  notes?: string | null;
  hide_in_spends?: number | null;
}

export interface BountyImportItem {
  id: number;
  name?: string;
  // Option A: Direct category ID (existing)
  category_id?: number | null;
  // Option B: Category strings (new - backend will resolve)
  category?: string | null;
  subcategory?: string | null;
}

export interface NetflowImportItem {
  month: string;
  asset_name: string;
  flow_type: string;
  amount_usd: number;
  amount_dot_equivalent: number;
}

export interface CustomSpendingImportItem {
  id?: number; // If provided, updates existing; if omitted, creates new
  type: string;
  title: string;
  description?: string | null;
  latest_status_change?: string | null;
  DOT_latest?: number | null;
  USD_latest?: number | null;
  DOT_component?: number | null;
  USDC_component?: number | null;
  USDT_component?: number | null;
  // Option A: Direct category ID (existing)
  category_id?: number | null;
  // Option B: Category strings (backend will resolve)
  category?: string | null;
  subcategory?: string | null;
}
