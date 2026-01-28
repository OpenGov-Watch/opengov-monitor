import { Router } from "express";
import { getDatabase } from "../../db/index.js";
import type { QueryConfig, FacetQueryConfig, FacetValue, FacetQueryResponse } from "../../db/types.js";
import { ALLOWED_VIEWS, getAllowedTables, isSourceAllowed } from "./authorization.js";
import { ALLOWED_AGGREGATES, isValidTableName } from "./security.js";
import { validateFilterOperators } from "./filter-builder.js";
import {
  validateJoinConfig,
  buildQuery,
  buildCountQuery,
  buildFacetQuery,
} from "./sql-builder.js";

export const queryRouter: Router = Router();

function validateQueryConfig(config: QueryConfig): string | null {
  if (!config.sourceTable || !isSourceAllowed(config.sourceTable)) {
    return `Invalid source table: ${config.sourceTable}`;
  }

  // Must have at least one column or expression column
  const hasColumns = config.columns && config.columns.length > 0;
  const hasExpressions = config.expressionColumns && config.expressionColumns.length > 0;
  if (!hasColumns && !hasExpressions) {
    return "At least one column or expression must be selected";
  }

  for (const col of config.columns || []) {
    if (col.aggregateFunction && !ALLOWED_AGGREGATES.has(col.aggregateFunction)) {
      return `Invalid aggregate function: ${col.aggregateFunction}`;
    }
  }

  // Validate filters (supports both FilterCondition[] and FilterGroup)
  if (config.filters) {
    const filterError = validateFilterOperators(config.filters);
    if (filterError) {
      return filterError;
    }
  }

  // Validate expression columns
  for (const expr of config.expressionColumns || []) {
    if (!expr.alias || !expr.alias.trim()) {
      return "Expression columns must have an alias";
    }
    if (!expr.expression || !expr.expression.trim()) {
      return "Expression cannot be empty";
    }
    // Note: sanitizeAlias now auto-sanitizes, so no validation error needed
  }

  // Validate joins
  for (const join of config.joins || []) {
    const joinError = validateJoinConfig(join);
    if (joinError) {
      return joinError;
    }
  }

  return null;
}

// GET /api/query/schema - Get database schema for query builder
queryRouter.get("/schema", (_req, res) => {
  try {
    const db = getDatabase();

    const tablesAndViews = db
      .prepare(
        `SELECT name, type FROM sqlite_master
         WHERE type IN ('table', 'view')
         AND name NOT LIKE 'sqlite_%'
         ORDER BY type, name`
      )
      .all() as { name: string; type: string }[];

    const result: { name: string; columns: { name: string; type: string; nullable: boolean }[] }[] = [];

    for (const item of tablesAndViews) {
      const isAllowedTable = getAllowedTables().includes(item.name);
      const isAllowedView = ALLOWED_VIEWS.includes(item.name);

      if (!isAllowedTable && !isAllowedView) {
        continue;
      }

      // Validate table name format before PRAGMA call
      if (!isValidTableName(item.name)) {
        continue;
      }

      const columns = db
        .prepare(`PRAGMA table_info("${item.name}")`)
        .all() as {
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }[];

      result.push({
        name: item.name,
        columns: columns.map((col) => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
        })),
      });
    }

    res.json(result);
  } catch (error) {
    console.error("[query:schema] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/query/execute - Execute a query
queryRouter.post("/execute", (req, res) => {
  try {
    const config = req.body as QueryConfig;

    const validationError = validateQueryConfig(config);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const db = getDatabase();

    // If offset is present, perform server-side pagination with count query
    let totalCount: number | undefined;
    if (config.offset !== undefined) {
      const { sql: countSql, params: countParams } = buildCountQuery(config);
      const countResult = db.prepare(countSql).get(...countParams) as { total: number };
      totalCount = countResult.total;
    }

    const { sql, params } = buildQuery(config);
    const results = db.prepare(sql).all(...params);

    res.json({
      data: results,
      rowCount: results.length,
      totalCount,  // undefined for non-paginated queries (dashboard mode)
      sql: sql,
    });
  } catch (error) {
    console.error("[query:execute] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/query/facets - Get distinct values + counts for faceted columns
queryRouter.post("/facets", (req, res) => {
  try {
    const config = req.body as FacetQueryConfig;

    // Validate source table
    if (!config.sourceTable || !isSourceAllowed(config.sourceTable)) {
      res.status(400).json({ error: `Invalid source table: ${config.sourceTable}` });
      return;
    }

    // Validate columns array
    if (!config.columns || !Array.isArray(config.columns) || config.columns.length === 0) {
      res.status(400).json({ error: "At least one column must be specified" });
      return;
    }

    // Validate joins if present
    if (config.joins) {
      for (const join of config.joins) {
        const joinError = validateJoinConfig(join);
        if (joinError) {
          res.status(400).json({ error: joinError });
          return;
        }
      }
    }

    // Validate filters if present
    if (config.filters) {
      const filterError = validateFilterOperators(config.filters);
      if (filterError) {
        res.status(400).json({ error: filterError });
        return;
      }
    }

    const db = getDatabase();
    const facets: Record<string, FacetValue[]> = {};

    // For each column, build and execute facet query
    for (const columnName of config.columns) {
      try {
        const { sql, params } = buildFacetQuery(config, columnName);
        const results = db.prepare(sql).all(...params) as Array<{ [key: string]: string | number; count: number }>;

        // Convert results to FacetValue format
        // The first column in results is the faceted column value, second is count
        facets[columnName] = results.map((row) => {
          // Get the column value (it's the first property that's not "count")
          const valueKey = Object.keys(row).find((key) => key !== "count");
          const value = valueKey ? row[valueKey] : null;
          return {
            value: value as string | number,
            count: row.count,
          };
        });
      } catch (error) {
        res.status(400).json({ error: `Error computing facets for column ${columnName}: ${(error as Error).message}` });
        return;
      }
    }

    const response: FacetQueryResponse = { facets };
    res.json(response);
  } catch (error) {
    console.error("[query:facets] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});
