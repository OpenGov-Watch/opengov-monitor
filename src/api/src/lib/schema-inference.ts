/**
 * Schema inference utilities for CSV data
 * Detects column types based on sample data values
 */

import type { CustomTableColumnDef, CustomTableSchema } from "../db/types.js";

// Type detection patterns
const INTEGER_PATTERN = /^-?\d+$/;
const REAL_PATTERN = /^-?\d*\.?\d+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no", "0", "1"]);

// Reserved SQL keywords that cannot be used as column names
const SQL_KEYWORDS = new Set([
  "select", "from", "where", "and", "or", "not", "null", "is", "in", "like",
  "between", "join", "on", "as", "order", "by", "group", "having", "limit",
  "offset", "union", "all", "distinct", "create", "table", "drop", "alter",
  "insert", "into", "values", "update", "set", "delete", "index", "primary",
  "key", "foreign", "references", "unique", "check", "default", "constraint",
  "case", "when", "then", "else", "end", "cast", "exists", "count", "sum",
  "avg", "min", "max", "true", "false", "asc", "desc", "inner", "outer",
  "left", "right", "full", "cross", "natural", "using", "rowid", "_rowid_",
]);

// Max columns allowed
export const MAX_COLUMNS = 50;
export const MAX_TABLE_NAME_LENGTH = 100;

/**
 * Detect the type of a single value
 */
function detectValueType(value: string): "text" | "integer" | "real" | "date" | "boolean" | null {
  if (value === "" || value === null || value === undefined) {
    return null; // Empty values don't contribute to type detection
  }

  const trimmed = value.trim();

  // Check boolean first (most specific)
  if (BOOLEAN_VALUES.has(trimmed.toLowerCase())) {
    return "boolean";
  }

  // Check date (specific format)
  if (DATE_PATTERN.test(trimmed)) {
    return "date";
  }

  // Check integer (before real)
  if (INTEGER_PATTERN.test(trimmed)) {
    return "integer";
  }

  // Check real
  if (REAL_PATTERN.test(trimmed)) {
    return "real";
  }

  // Default to text
  return "text";
}

/**
 * Type precedence for merging (higher = more general)
 */
const TYPE_PRECEDENCE: Record<string, number> = {
  boolean: 1,
  date: 2,
  integer: 3,
  real: 4,
  text: 5,
};

/**
 * Merge two types, returning the more general one
 */
function mergeTypes(
  type1: "text" | "integer" | "real" | "date" | "boolean" | null,
  type2: "text" | "integer" | "real" | "date" | "boolean" | null
): "text" | "integer" | "real" | "date" | "boolean" {
  if (type1 === null) return type2 ?? "text";
  if (type2 === null) return type1;

  // Special case: integer + real = real
  if ((type1 === "integer" && type2 === "real") || (type1 === "real" && type2 === "integer")) {
    return "real";
  }

  // Otherwise, take the more general type
  return TYPE_PRECEDENCE[type1] >= TYPE_PRECEDENCE[type2] ? type1 : type2;
}

/**
 * Sanitize a column name for SQL use
 * - Replace spaces with underscores
 * - Keep only alphanumeric and underscores
 * - Ensure doesn't start with a number
 * - Ensure not a SQL keyword
 */
export function sanitizeColumnName(name: string): string {
  let sanitized = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  // Ensure doesn't start with a number
  if (/^\d/.test(sanitized)) {
    sanitized = "col_" + sanitized;
  }

  // Ensure not empty
  if (sanitized === "") {
    sanitized = "column";
  }

  // Ensure not a SQL keyword
  if (SQL_KEYWORDS.has(sanitized)) {
    sanitized = sanitized + "_col";
  }

  return sanitized;
}

/**
 * Generate a unique table name from display name
 * Format: custom_<sanitized_name>
 */
export function generateTableName(displayName: string): string {
  const sanitized = displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .substring(0, MAX_TABLE_NAME_LENGTH - 7); // Reserve space for "custom_" prefix

  return `custom_${sanitized || "table"}`;
}

/**
 * Validate a display name for a custom table
 */
export function validateDisplayName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Display name is required" };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Display name cannot be empty" };
  }

  if (trimmed.length > MAX_TABLE_NAME_LENGTH) {
    return { valid: false, error: `Display name cannot exceed ${MAX_TABLE_NAME_LENGTH} characters` };
  }

  return { valid: true };
}

/**
 * Infer schema from CSV headers and data rows
 * @param headers - Array of column header names
 * @param rows - Array of data rows (each row is an object with header keys)
 * @returns Inferred schema with column types
 */
export function inferSchema(
  headers: string[],
  rows: Record<string, string>[]
): { schema: CustomTableSchema; errors: string[] } {
  const errors: string[] = [];

  if (headers.length === 0) {
    return { schema: { columns: [] }, errors: ["No columns found in CSV"] };
  }

  if (headers.length > MAX_COLUMNS) {
    errors.push(`CSV has ${headers.length} columns, but maximum is ${MAX_COLUMNS}`);
  }

  // Sanitize and deduplicate column names
  const sanitizedNames = new Map<string, number>();
  const columns: CustomTableColumnDef[] = [];

  for (let i = 0; i < Math.min(headers.length, MAX_COLUMNS); i++) {
    const originalName = headers[i];
    let sanitizedName = sanitizeColumnName(originalName);

    // Handle duplicates by appending a number
    const count = sanitizedNames.get(sanitizedName) || 0;
    if (count > 0) {
      sanitizedName = `${sanitizedName}_${count}`;
    }
    sanitizedNames.set(sanitizedName.replace(/_\d+$/, ""), count + 1);

    // Detect type from all values in this column
    let inferredType: "text" | "integer" | "real" | "date" | "boolean" | null = null;
    let hasNullValues = false;

    for (const row of rows) {
      const value = row[originalName];
      if (value === "" || value === null || value === undefined) {
        hasNullValues = true;
      } else {
        const valueType = detectValueType(value);
        inferredType = mergeTypes(inferredType, valueType);
      }
    }

    columns.push({
      name: sanitizedName,
      type: inferredType ?? "text",
      nullable: hasNullValues || rows.length === 0,
    });
  }

  return { schema: { columns }, errors };
}

/**
 * Validate that a schema matches expected format
 */
export function validateSchema(schema: CustomTableSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!schema || !Array.isArray(schema.columns)) {
    return { valid: false, errors: ["Invalid schema format"] };
  }

  if (schema.columns.length === 0) {
    errors.push("Schema must have at least one column");
  }

  if (schema.columns.length > MAX_COLUMNS) {
    errors.push(`Schema cannot have more than ${MAX_COLUMNS} columns`);
  }

  const validTypes = ["text", "integer", "real", "date", "boolean"];
  const seenNames = new Set<string>();

  for (let i = 0; i < schema.columns.length; i++) {
    const col = schema.columns[i];

    if (!col.name || typeof col.name !== "string") {
      errors.push(`Column ${i + 1}: name is required`);
      continue;
    }

    // Check for duplicate names
    if (seenNames.has(col.name)) {
      errors.push(`Column ${i + 1}: duplicate column name "${col.name}"`);
    }
    seenNames.add(col.name);

    // Validate column name format
    if (!/^[a-z_][a-z0-9_]*$/.test(col.name)) {
      errors.push(`Column ${i + 1}: invalid column name "${col.name}" (must be lowercase, start with letter or underscore)`);
    }

    // Check for SQL keywords
    if (SQL_KEYWORDS.has(col.name)) {
      errors.push(`Column ${i + 1}: "${col.name}" is a reserved SQL keyword`);
    }

    // Validate type
    if (!validTypes.includes(col.type)) {
      errors.push(`Column ${i + 1}: invalid type "${col.type}"`);
    }

    // Validate nullable
    if (typeof col.nullable !== "boolean") {
      errors.push(`Column ${i + 1}: nullable must be a boolean`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if two schemas match (for re-import validation)
 */
export function schemasMatch(schema1: CustomTableSchema, schema2: CustomTableSchema): boolean {
  if (schema1.columns.length !== schema2.columns.length) {
    return false;
  }

  for (let i = 0; i < schema1.columns.length; i++) {
    const col1 = schema1.columns[i];
    const col2 = schema2.columns[i];

    if (col1.name !== col2.name || col1.type !== col2.type) {
      return false;
    }
    // Note: We don't compare nullable since that can change based on data
  }

  return true;
}

/**
 * Convert a value to the appropriate type for database insertion
 */
export function coerceValue(
  value: string | null | undefined,
  type: "text" | "integer" | "real" | "date" | "boolean"
): string | number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const trimmed = value.trim();

  switch (type) {
    case "integer":
      const intVal = parseInt(trimmed, 10);
      return isNaN(intVal) ? null : intVal;

    case "real":
      const floatVal = parseFloat(trimmed);
      return isNaN(floatVal) ? null : floatVal;

    case "boolean":
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "yes" || lower === "1") return 1;
      if (lower === "false" || lower === "no" || lower === "0") return 0;
      return null;

    case "date":
      // Validate date format
      if (DATE_PATTERN.test(trimmed)) {
        return trimmed;
      }
      return null;

    case "text":
    default:
      return trimmed;
  }
}

/**
 * Generate CREATE TABLE SQL for a custom table schema
 */
export function generateCreateTableSQL(tableName: string, schema: CustomTableSchema): string {
  const columnDefs = [
    '"_id" INTEGER PRIMARY KEY AUTOINCREMENT',
    ...schema.columns.map((col) => {
      const sqlType = col.type === "boolean" ? "INTEGER" : col.type.toUpperCase();
      const nullable = col.nullable ? "" : " NOT NULL";
      return `"${col.name}" ${sqlType}${nullable}`;
    }),
  ];

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(", ")})`;
}
