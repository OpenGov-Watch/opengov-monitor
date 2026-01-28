/**
 * Authorization module for query builder
 *
 * Manages allowlists for tables, views, and sources that can be queried.
 */

import { getCustomTableNames } from "../../db/queries.js";
import { QUERYABLE_TABLE_NAMES, QUERYABLE_VIEW_NAMES } from "../../db/types.js";

// Derive allowlists from constants - no hardcoded table names
export const BASE_ALLOWED_TABLES = [...QUERYABLE_TABLE_NAMES];
export const ALLOWED_VIEWS = [...QUERYABLE_VIEW_NAMES];
export const BASE_ALLOWED_SOURCES = [...BASE_ALLOWED_TABLES, ...ALLOWED_VIEWS];

/**
 * Get all allowed sources including custom tables.
 * Custom tables are dynamically fetched from the database.
 */
export function getAllowedSources(): Set<string> {
  const customTables = getCustomTableNames();
  return new Set([...BASE_ALLOWED_SOURCES, ...customTables]);
}

/**
 * Get all allowed tables including custom tables.
 * Does not include views.
 */
export function getAllowedTables(): string[] {
  const customTables = getCustomTableNames();
  return [...BASE_ALLOWED_TABLES, ...customTables];
}

/**
 * Check if a source (table or view) is allowed for querying.
 */
export function isSourceAllowed(source: string): boolean {
  return getAllowedSources().has(source);
}
