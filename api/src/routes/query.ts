import { Router } from "express";
import { getDatabase } from "../db/index.js";
import type { QueryConfig, FilterCondition } from "../db/types.js";

export const queryRouter: Router = Router();

// Whitelist of tables/views that can be queried
const ALLOWED_SOURCES = new Set([
  "Referenda",
  "Treasury",
  "Child Bounties",
  "Fellowship",
  "Fellowship Salary Cycles",
  "Fellowship Salary Claimants",
  "categories",
  "bounties",
  "subtreasury",
  "Fellowship Subtreasury",
  "outstanding_claims",
  "expired_claims",
  "all_spending",
]);

const ALLOWED_TABLES = [
  "Referenda",
  "Treasury",
  "Child Bounties",
  "Fellowship",
  "Fellowship Salary Cycles",
  "Fellowship Salary Claimants",
  "categories",
  "bounties",
  "subtreasury",
  "Fellowship Subtreasury",
];

const ALLOWED_VIEWS = [
  "outstanding_claims",
  "expired_claims",
  "all_spending",
];

const MAX_ROWS = 10000;
const ALLOWED_OPERATORS = new Set([
  "=", "!=", ">", "<", ">=", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL",
]);
const ALLOWED_AGGREGATES = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

function validateQueryConfig(config: QueryConfig): string | null {
  if (!config.sourceTable || !ALLOWED_SOURCES.has(config.sourceTable)) {
    return `Invalid source table: ${config.sourceTable}`;
  }

  if (!config.columns || config.columns.length === 0) {
    return "At least one column must be selected";
  }

  for (const col of config.columns) {
    if (col.aggregateFunction && !ALLOWED_AGGREGATES.has(col.aggregateFunction)) {
      return `Invalid aggregate function: ${col.aggregateFunction}`;
    }
  }

  for (const filter of config.filters || []) {
    if (!ALLOWED_OPERATORS.has(filter.operator)) {
      return `Invalid operator: ${filter.operator}`;
    }
  }

  return null;
}

function sanitizeColumnName(name: string): string {
  if (!/^[a-zA-Z0-9_.\s]+$/.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
  return `"${name}"`;
}

function buildSelectClause(config: QueryConfig): string {
  return config.columns
    .map((col) => {
      const colName = sanitizeColumnName(col.column);
      if (col.aggregateFunction) {
        const alias = col.alias || `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
        return `${col.aggregateFunction}(${colName}) AS "${alias}"`;
      }
      return col.alias ? `${colName} AS "${col.alias}"` : colName;
    })
    .join(", ");
}

function buildWhereClause(
  filters: FilterCondition[]
): { clause: string; params: (string | number)[] } {
  if (!filters || filters.length === 0) {
    return { clause: "", params: [] };
  }

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  for (const filter of filters) {
    const colName = sanitizeColumnName(filter.column);

    switch (filter.operator) {
      case "IS NULL":
        conditions.push(`${colName} IS NULL`);
        break;
      case "IS NOT NULL":
        conditions.push(`${colName} IS NOT NULL`);
        break;
      case "IN":
        if (Array.isArray(filter.value)) {
          const placeholders = filter.value.map(() => "?").join(", ");
          conditions.push(`${colName} IN (${placeholders})`);
          params.push(...filter.value);
        }
        break;
      default:
        conditions.push(`${colName} ${filter.operator} ?`);
        params.push(filter.value as string | number);
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function buildGroupByClause(groupBy?: string[]): string {
  if (!groupBy || groupBy.length === 0) {
    return "";
  }
  return `GROUP BY ${groupBy.map((col) => sanitizeColumnName(col)).join(", ")}`;
}

function buildOrderByClause(orderBy?: { column: string; direction: "ASC" | "DESC" }[]): string {
  if (!orderBy || orderBy.length === 0) {
    return "";
  }
  return `ORDER BY ${orderBy
    .map((o) => `${sanitizeColumnName(o.column)} ${o.direction}`)
    .join(", ")}`;
}

function buildQuery(config: QueryConfig): { sql: string; params: (string | number)[] } {
  const selectClause = buildSelectClause(config);
  const tableName = `"${config.sourceTable}"`;
  const { clause: whereClause, params } = buildWhereClause(config.filters || []);
  const groupByClause = buildGroupByClause(config.groupBy);
  const orderByClause = buildOrderByClause(config.orderBy);
  const limit = Math.min(config.limit || MAX_ROWS, MAX_ROWS);

  const sql = [
    `SELECT ${selectClause}`,
    `FROM ${tableName}`,
    whereClause,
    groupByClause,
    orderByClause,
    `LIMIT ${limit}`,
  ]
    .filter(Boolean)
    .join(" ");

  return { sql, params };
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
      const isAllowedTable = ALLOWED_TABLES.includes(item.name);
      const isAllowedView = ALLOWED_VIEWS.includes(item.name);

      if (!isAllowedTable && !isAllowedView) {
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
    const { sql, params } = buildQuery(config);
    const results = db.prepare(sql).all(...params);

    res.json({
      data: results,
      rowCount: results.length,
      sql: sql,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
