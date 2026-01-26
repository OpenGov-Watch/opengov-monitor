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
import type { CustomTableSchema } from "../db/types.js";

export const customTablesRouter: Router = Router();

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

    const result = insertCustomTableRow(table.table_name, data);
    res.status(201).json(result);
  } catch (error) {
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

    const updated = updateCustomTableRow(table.table_name, rowId, data);
    if (!updated) {
      res.status(404).json({ error: "Row not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
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

    const { schema, errors } = inferSchema(headers, rows);

    res.json({
      schema,
      errors: errors.length > 0 ? errors : undefined,
      originalHeaders: headers,
      sanitizedHeaders: schema.columns.map((c) => c.name),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
