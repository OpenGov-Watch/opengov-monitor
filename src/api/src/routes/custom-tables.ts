import { Router } from "express";
import {
  getCustomTables,
  getCustomTableById,
  createCustomTable,
  deleteCustomTable,
  getCustomTableData,
  insertCustomTableRow,
  updateCustomTableRow,
  deleteCustomTableRow,
  wipeAndImportCustomTable,
} from "../db/queries.js";
import { requireAuth } from "../middleware/auth.js";
import {
  inferSchema,
  validateSchema,
  validateDisplayName,
  schemasMatch,
  sanitizeColumnName,
  MAX_COLUMNS,
} from "../lib/schema-inference.js";
import type { CustomTableSchema, CustomTableColumnDef } from "../db/types.js";

export const customTablesRouter: Router = Router();

// SECURITY: Limits to prevent DoS via memory exhaustion
const MAX_IMPORT_ROWS = 100000;
const MAX_SCHEMA_INFERENCE_ROWS = 1000;

/**
 * Validate row data against the table schema.
 * Returns null if valid, or an error message string if invalid.
 */
function validateRowData(
  data: Record<string, unknown>,
  schema: CustomTableSchema
): string | null {
  // Build a set of valid column names
  const validColumns = new Set(schema.columns.map((c) => c.name));
  const columnMap = new Map<string, CustomTableColumnDef>(
    schema.columns.map((c) => [c.name, c])
  );

  // Check for unknown fields
  for (const key of Object.keys(data)) {
    if (!validColumns.has(key)) {
      return `Unknown field: ${key}`;
    }
  }

  // Validate each column
  for (const col of schema.columns) {
    const value = data[col.name];

    // Check required fields (non-nullable columns)
    if ((value === undefined || value === null || value === "") && !col.nullable) {
      return `Missing required field: ${col.name}`;
    }

    // Skip further validation for null/empty values
    if (value === undefined || value === null || value === "") {
      continue;
    }

    // Type validation
    switch (col.type) {
      case "integer":
        if (typeof value !== "number" && (typeof value !== "string" || isNaN(Number(value)))) {
          return `Field "${col.name}" must be an integer`;
        }
        // Check it's actually an integer, not a float
        const intVal = typeof value === "number" ? value : Number(value);
        if (!Number.isInteger(intVal)) {
          return `Field "${col.name}" must be an integer, not a decimal`;
        }
        break;

      case "real":
        if (typeof value !== "number" && (typeof value !== "string" || isNaN(Number(value)))) {
          return `Field "${col.name}" must be a number`;
        }
        break;

      case "boolean":
        const validBooleans = ["true", "false", "yes", "no", "0", "1", 0, 1, true, false];
        if (!validBooleans.includes(value as string | number | boolean) &&
            (typeof value === "string" && !validBooleans.includes(value.toLowerCase()))) {
          return `Field "${col.name}" must be a boolean (true/false, yes/no, 0/1)`;
        }
        break;

      case "date":
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return `Field "${col.name}" must be a date in YYYY-MM-DD format`;
        }
        break;

      case "text":
        // Text can be anything that can be converted to string
        if (typeof value !== "string" && typeof value !== "number") {
          return `Field "${col.name}" must be a text value`;
        }
        break;
    }
  }

  return null;
}

// ============================================================================
// Table Management Endpoints
// ============================================================================

/**
 * GET /api/custom-tables
 * List all custom tables
 */
customTablesRouter.get("/", (_req, res) => {
  try {
    const tables = getCustomTables();
    res.json(tables);
  } catch (error) {
    console.error("[custom-tables:get] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/custom-tables/:id
 * Get table metadata + schema
 */
customTablesRouter.get("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const table = getCustomTableById(id);
    if (!table) {
      res.status(404).json({ error: "Custom table not found" });
      return;
    }

    // Parse schema for convenience
    const schema = JSON.parse(table.schema_json);
    res.json({ ...table, schema });
  } catch (error) {
    console.error("[custom-tables:getById] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/custom-tables
 * Create a new custom table with schema and optional initial data
 * Body: { displayName: string, schema: CustomTableSchema, data?: Record<string, any>[] }
 */
customTablesRouter.post("/", requireAuth, (req, res) => {
  try {
    const { displayName, schema, data } = req.body;

    // Validate display name
    const nameValidation = validateDisplayName(displayName);
    if (!nameValidation.valid) {
      res.status(400).json({ error: nameValidation.error });
      return;
    }

    // Validate schema
    if (!schema) {
      res.status(400).json({ error: "Schema is required" });
      return;
    }

    const schemaValidation = validateSchema(schema);
    if (!schemaValidation.valid) {
      res.status(400).json({ error: schemaValidation.errors.join("; ") });
      return;
    }

    // Create the table
    const result = createCustomTable(displayName, schema, data);
    res.status(201).json(result);
  } catch (error) {
    const message = (error as Error).message;
    // Check for duplicate table name error
    if (message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "A table with this name already exists" });
      return;
    }
    console.error("[custom-tables:create] Error:", error);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/custom-tables/:id
 * Delete a custom table (drops the table and removes metadata)
 */
customTablesRouter.delete("/:id", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const deleted = deleteCustomTable(id);
    if (!deleted) {
      res.status(404).json({ error: "Custom table not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[custom-tables:delete] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// Data Operation Endpoints
// ============================================================================

/**
 * GET /api/custom-tables/:id/data
 * Get rows from a custom table (paginated)
 * Query params: limit (default 100), offset (default 0)
 */
customTablesRouter.get("/:id/data", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const table = getCustomTableById(id);
    if (!table) {
      res.status(404).json({ error: "Custom table not found" });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = getCustomTableData(table.table_name, limit, offset);
    res.json(result);
  } catch (error) {
    console.error("[custom-tables:getData] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/custom-tables/:id/data
 * Insert a row into a custom table
 * Body: { data: Record<string, any> }
 */
customTablesRouter.post("/:id/data", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const table = getCustomTableById(id);
    if (!table) {
      res.status(404).json({ error: "Custom table not found" });
      return;
    }

    const { data } = req.body;
    if (!data || typeof data !== "object") {
      res.status(400).json({ error: "data object is required" });
      return;
    }

    // Validate row data against schema
    const schema: CustomTableSchema = JSON.parse(table.schema_json);
    const validationError = validateRowData(data, schema);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const result = insertCustomTableRow(table.table_name, data);
    res.status(201).json(result);
  } catch (error) {
    console.error("[custom-tables:insertRow] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/custom-tables/:id/data/:rowId
 * Update a row in a custom table
 * Body: { data: Record<string, any> }
 */
customTablesRouter.put("/:id/data/:rowId", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rowId = parseInt(req.params.rowId);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid table id format" });
      return;
    }
    if (isNaN(rowId)) {
      res.status(400).json({ error: "Invalid row id format" });
      return;
    }

    const table = getCustomTableById(id);
    if (!table) {
      res.status(404).json({ error: "Custom table not found" });
      return;
    }

    const { data } = req.body;
    if (!data || typeof data !== "object") {
      res.status(400).json({ error: "data object is required" });
      return;
    }

    // Validate row data against schema (for updates, only validate provided fields)
    const schema: CustomTableSchema = JSON.parse(table.schema_json);
    // For updates, make all columns nullable since we only validate provided fields
    const updateSchema: CustomTableSchema = {
      columns: schema.columns.map((col) => ({ ...col, nullable: true })),
    };
    const validationError = validateRowData(data, updateSchema);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const updated = updateCustomTableRow(table.table_name, rowId, data);
    if (!updated) {
      res.status(404).json({ error: "Row not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[custom-tables:updateRow] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/custom-tables/:id/data/:rowId
 * Delete a row from a custom table
 */
customTablesRouter.delete("/:id/data/:rowId", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rowId = parseInt(req.params.rowId);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid table id format" });
      return;
    }
    if (isNaN(rowId)) {
      res.status(400).json({ error: "Invalid row id format" });
      return;
    }

    const table = getCustomTableById(id);
    if (!table) {
      res.status(404).json({ error: "Custom table not found" });
      return;
    }

    const deleted = deleteCustomTableRow(table.table_name, rowId);
    if (!deleted) {
      res.status(404).json({ error: "Row not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[custom-tables:deleteRow] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/custom-tables/:id/import
 * Bulk import data (with optional wipe)
 * Body: { rows: Record<string, any>[], wipe?: boolean }
 */
customTablesRouter.post("/:id/import", requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const table = getCustomTableById(id);
    if (!table) {
      res.status(404).json({ error: "Custom table not found" });
      return;
    }

    const { rows, wipe } = req.body;
    if (!Array.isArray(rows)) {
      res.status(400).json({ error: "rows array is required" });
      return;
    }

    // SECURITY: Limit row count to prevent memory exhaustion
    if (rows.length > MAX_IMPORT_ROWS) {
      res.status(400).json({
        error: `Import limit exceeded. Maximum ${MAX_IMPORT_ROWS.toLocaleString()} rows per import.`,
      });
      return;
    }

    // Validate all rows against schema before importing
    const schema: CustomTableSchema = JSON.parse(table.schema_json);
    const validationErrors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const error = validateRowData(rows[i], schema);
      if (error) {
        validationErrors.push({ row: i + 1, error });
        // Stop after collecting first 10 errors to avoid overwhelming response
        if (validationErrors.length >= 10) break;
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({
        error: `Validation failed for ${validationErrors.length}${validationErrors.length >= 10 ? '+' : ''} rows`,
        details: validationErrors,
      });
      return;
    }

    if (wipe) {
      // Wipe and reimport
      const count = wipeAndImportCustomTable(table.table_name, rows);
      res.json({ success: true, count, wiped: true });
    } else {
      // Append rows
      let count = 0;
      for (const row of rows) {
        insertCustomTableRow(table.table_name, row);
        count++;
      }
      res.json({ success: true, count, wiped: false });
    }
  } catch (error) {
    console.error("[custom-tables:import] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// Schema Inference Endpoint
// ============================================================================

/**
 * POST /api/custom-tables/infer-schema
 * Infer schema from CSV headers and sample data
 * Body: { headers: string[], rows: Record<string, string>[] }
 */
customTablesRouter.post("/infer-schema", (req, res) => {
  try {
    const { headers, rows } = req.body;

    if (!Array.isArray(headers) || headers.length === 0) {
      res.status(400).json({ error: "headers array is required" });
      return;
    }

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: "rows array is required" });
      return;
    }

    // SECURITY: Limit rows used for schema inference to prevent memory exhaustion
    const sampleRows = rows.slice(0, MAX_SCHEMA_INFERENCE_ROWS);
    const { schema, errors } = inferSchema(headers, sampleRows);

    res.json({
      schema,
      errors: errors.length > 0 ? errors : undefined,
      originalHeaders: headers,
      sanitizedHeaders: schema.columns.map((c) => c.name),
    });
  } catch (error) {
    console.error("[custom-tables:inferSchema] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});
