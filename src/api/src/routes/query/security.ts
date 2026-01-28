/**
 * Security module for query builder
 *
 * Contains constants and validation functions for SQL security.
 * Prevents SQL injection attacks in query construction.
 */

// Query limits
export const MAX_ROWS = 10000;

// Allowed filter operators
export const ALLOWED_OPERATORS = new Set([
  "=", "!=", ">", "<", ">=", "<=", "LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL",
]);

// Allowed aggregate functions
export const ALLOWED_AGGREGATES = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

// Expression column validation
export const MAX_EXPRESSION_LENGTH = 500;

// Allowed SQL functions in expressions
export const ALLOWED_EXPRESSION_FUNCTIONS = new Set([
  // Math functions
  "ABS", "ROUND", "CEIL", "FLOOR", "MAX", "MIN", "AVG", "SUM", "COUNT",
  "TOTAL", "RANDOM", "ZEROBLOB",
  // String functions
  "UPPER", "LOWER", "LENGTH", "SUBSTR", "SUBSTRING", "TRIM", "LTRIM", "RTRIM",
  "REPLACE", "INSTR", "PRINTF", "QUOTE", "HEX", "UNHEX", "UNICODE", "CHAR",
  "GLOB", "LIKE",
  // Null handling
  "COALESCE", "NULLIF", "IFNULL",
  // Conditional
  "CASE", "WHEN", "THEN", "ELSE", "END", "IIF",
  // Type conversion
  "CAST", "TYPEOF",
  // Date functions (SQLite)
  "DATE", "TIME", "DATETIME", "JULIANDAY", "STRFTIME", "UNIXEPOCH",
  // Aggregate window functions
  "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD",
  "FIRST_VALUE", "LAST_VALUE", "NTH_VALUE",
  // JSON functions
  "JSON", "JSON_ARRAY", "JSON_EXTRACT", "JSON_OBJECT", "JSON_TYPE",
]);

// SQL keywords that are allowed in expressions
export const ALLOWED_SQL_KEYWORDS = new Set([
  "AS", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "BETWEEN",
  "TRUE", "FALSE", "ASC", "DESC", "OVER", "PARTITION", "BY", "ORDER",
  "DISTINCT", "ALL", "ESCAPE",
]);

// Blocked patterns that indicate SQL injection attempts
export const BLOCKED_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /;\s*$/, description: "Trailing semicolon" },
  { pattern: /;(?!\s*$)/, description: "Semicolon in expression" },
  { pattern: /--/, description: "SQL comment" },
  { pattern: /\/\*/, description: "Block comment" },
  { pattern: /\bUNION\b/i, description: "UNION keyword" },
  { pattern: /\bSELECT\b/i, description: "SELECT keyword" },
  { pattern: /\bINSERT\b/i, description: "INSERT keyword" },
  { pattern: /\bUPDATE\b/i, description: "UPDATE keyword" },
  { pattern: /\bDELETE\b/i, description: "DELETE keyword" },
  { pattern: /\bDROP\b/i, description: "DROP keyword" },
  { pattern: /\bCREATE\b/i, description: "CREATE keyword" },
  { pattern: /\bALTER\b/i, description: "ALTER keyword" },
  { pattern: /\bEXEC\b/i, description: "EXEC keyword" },
  { pattern: /\bATTACH\b/i, description: "ATTACH keyword" },
  { pattern: /\bDETACH\b/i, description: "DETACH keyword" },
  { pattern: /\bPRAGMA\b/i, description: "PRAGMA keyword" },
  { pattern: /\bVACUUM\b/i, description: "VACUUM keyword" },
  { pattern: /\bREINDEX\b/i, description: "REINDEX keyword" },
  { pattern: /\bload_extension\b/i, description: "load_extension function" },
  { pattern: /\bfts3_tokenizer\b/i, description: "fts3_tokenizer function" },
  { pattern: /\bTRUNCATE\b/i, description: "TRUNCATE keyword" },
  { pattern: /\bwritefile\b/i, description: "writefile function" },
];

/**
 * Validate table name format to prevent SQL injection in PRAGMA calls.
 * Table names must be alphanumeric with underscores/spaces, max 128 chars.
 */
export function isValidTableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_ ]*$/.test(name) && name.length <= 128;
}

/**
 * Validate an expression against security rules.
 * Checks for blocked patterns and validates identifiers against available columns.
 */
export function validateExpression(
  expression: string,
  availableColumns: string[]
): { valid: boolean; error?: string } {
  // Check expression length
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    return { valid: false, error: `Expression too long (max ${MAX_EXPRESSION_LENGTH} characters)` };
  }

  // Check for blocked patterns
  for (const { pattern, description } of BLOCKED_PATTERNS) {
    if (pattern.test(expression)) {
      return { valid: false, error: `Expression contains blocked pattern: ${description}` };
    }
  }

  // Remove string literals before extracting identifiers
  // This prevents 'Executed', 'large', 'small' etc from being validated as columns
  const exprWithoutStrings = expression.replace(/'[^']*'/g, "''");

  // Extract and validate identifiers (column references)
  // Matches: "quoted identifiers" or bare_identifiers
  const identifierPattern = /"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_.]*)/g;
  let match;
  while ((match = identifierPattern.exec(exprWithoutStrings)) !== null) {
    const identifier = match[1] || match[2];

    // Skip if it's an allowed function (case-insensitive)
    if (ALLOWED_EXPRESSION_FUNCTIONS.has(identifier.toUpperCase())) {
      continue;
    }

    // Skip SQL keywords
    if (ALLOWED_SQL_KEYWORDS.has(identifier.toUpperCase())) {
      continue;
    }

    // Skip numeric literals that look like identifiers (e.g., part of a number)
    if (/^\d+$/.test(identifier)) {
      continue;
    }

    // Must be a valid column name from the selected table
    if (!availableColumns.includes(identifier)) {
      return { valid: false, error: `Unknown column or function: ${identifier}` };
    }
  }

  return { valid: true };
}

/**
 * Sanitize an alias to be a valid SQL identifier.
 * Replaces invalid characters with underscores and ensures it starts correctly.
 */
export function sanitizeAlias(alias: string): string {
  // Auto-sanitize aliases to valid SQL identifiers
  // Replace any invalid characters (spaces, special chars) with underscores
  let sanitized = alias.replace(/[^a-zA-Z0-9_]/g, "_");
  // Ensure it starts with a letter or underscore
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = "_" + sanitized;
  }
  return sanitized;
}
