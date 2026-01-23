import yaml from "yaml";
import { formatDate } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

/**
 * Unified column type that determines both rendering AND filtering behavior.
 *
 * | Type        | Rendering               | Filter Operators                    |
 * |-------------|-------------------------|-------------------------------------|
 * | text        | Plain text              | =, !=, >, <, >=, <=, LIKE           |
 * | numeric     | Number format           | =, !=, >, <, >=, <=                 |
 * | currency    | Formatted with symbol   | =, !=, >, <, >=, <=                 |
 * | date        | Date format             | =, !=, >, <, >=, <=                 |
 * | categorical | Plain text              | IN, NOT IN                          |
 * | link        | Clickable link          | =, !=, LIKE                         |
 * | address     | Truncated address       | =, !=, LIKE                         |
 * | text_long   | Modal viewer button     | IS NULL, IS NOT NULL                |
 *
 * Note: Use `renderAs: "chip"` with `type: categorical` to get Badge rendering.
 */
export type ColumnType =
  | "text"
  | "numeric"
  | "currency"
  | "date"
  | "categorical"
  | "link"
  | "address"
  | "text_long";

export type CurrencyType = "DOT" | "USD" | "USDC" | "USDT";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export interface ColumnRenderConfig {
  displayName?: string;
  type?: ColumnType;
  /**
   * Overrides visual rendering while preserving `type` for semantic behavior (filtering).
   * - "chip": Renders as Badge (use with type: categorical for chips with IN/NOT IN filtering)
   * - Any ColumnType: Renders using that type's visual style
   */
  renderAs?: ColumnType | "chip";
  // Currency options
  currency?: CurrencyType;
  decimals?: number;
  // Date options
  format?: "date" | "datetime";
  // Badge/categorical options
  variants?: Record<string, BadgeVariant>;
  // Link options
  urlTemplate?: string;
  urlField?: string; // Field in row that contains the URL
  // Address options
  truncate?: boolean;
  // Number options
  color?: "green" | "red";
  // text_long options (for modal display)
  modalTitle?: string;
  isJson?: boolean;
}

export type PatternMatchType = "exact" | "prefix" | "suffix" | "substring";

export interface PatternRule {
  match: PatternMatchType;
  pattern: string;
  caseInsensitive?: boolean;
  config: ColumnRenderConfig;
}

export interface ColumnConfig {
  columns: Record<string, ColumnRenderConfig>;
  tables: Record<string, Record<string, ColumnRenderConfig>>;
  patterns?: PatternRule[];
}

// ============================================================================
// State
// ============================================================================

let config: ColumnConfig = { columns: {}, tables: {} };
let loaded = false;

// ============================================================================
// Config Loading
// ============================================================================

export async function loadColumnConfig(): Promise<void> {
  if (loaded) return;
  try {
    const response = await fetch("/config/column-config.yaml");
    if (response.ok) {
      const text = await response.text();
      config = yaml.parse(text) || { columns: {}, tables: {} };
    }
  } catch (e) {
    console.warn("Failed to load column config:", e);
  }

  // Add minimal fallback patterns if not present in YAML
  if (!config.patterns) {
    console.warn("No patterns section in column-config.yaml, using minimal fallbacks");
    config.patterns = [
      {
        match: "prefix",
        pattern: "DOT_",
        config: { type: "currency", currency: "DOT", decimals: 0 },
      },
      {
        match: "exact",
        pattern: "status",
        caseInsensitive: true,
        config: { type: "categorical", variants: { default: "outline" } },
      },
    ];
  }

  loaded = true;
}

// ============================================================================
// Config Lookup
// ============================================================================

const defaultConfig: ColumnRenderConfig = { type: "text" };

export function getColumnConfig(
  tableName: string,
  columnName: string
): ColumnRenderConfig {
  // 1. Check table-specific override
  const tableConfig = config.tables?.[tableName]?.[columnName];
  if (tableConfig) {
    return { ...defaultConfig, ...tableConfig };
  }

  // 2. Check global column config
  const globalConfig = config.columns?.[columnName];
  if (globalConfig) {
    return { ...defaultConfig, ...globalConfig };
  }

  // 3. Check pattern-based detection
  const patternConfig = detectFromPatterns(columnName);
  if (patternConfig) {
    return patternConfig;
  }

  // 4. Default to text
  return defaultConfig;
}

function matchesPattern(columnName: string, rule: PatternRule): boolean {
  const name = rule.caseInsensitive ? columnName.toLowerCase() : columnName;
  const pattern = rule.caseInsensitive ? rule.pattern.toLowerCase() : rule.pattern;

  switch (rule.match) {
    case "exact":
      return name === pattern;
    case "prefix":
      return name.startsWith(pattern);
    case "suffix":
      return name.endsWith(pattern);
    case "substring":
      return name.includes(pattern);
    default:
      return false;
  }
}

function detectFromPatterns(columnName: string): ColumnRenderConfig | null {
  if (!config.patterns) return null;

  // Iterate through patterns in order, return first match
  for (const rule of config.patterns) {
    if (matchesPattern(columnName, rule)) {
      return { ...defaultConfig, ...rule.config };
    }
  }

  return null;
}

// ============================================================================
// Display Name
// ============================================================================

export function getColumnDisplayName(
  tableName: string,
  columnName: string
): string {
  const cfg = getColumnConfig(tableName, columnName);
  if (cfg.displayName) return cfg.displayName;

  // Auto-generate from column name
  return autoGenerateDisplayName(columnName);
}

function autoGenerateDisplayName(columnName: string): string {
  return columnName
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDot\b/gi, "DOT")
    .replace(/\bUsd\b/gi, "USD")
    .replace(/\bUsdc\b/gi, "USDC")
    .replace(/\bUsdt\b/gi, "USDT");
}

// ============================================================================
// Value Formatting (for text output)
// ============================================================================

export function formatValue(
  value: unknown,
  config: ColumnRenderConfig
): string {
  if (value === null || value === undefined) return "-";

  switch (config.type) {
    case "currency":
      return formatCurrencyValue(value as number, config);
    case "numeric":
      return formatNumberValue(value as number, config);
    case "date":
      return formatDate(value as string);
    case "address":
      return formatAddressValue(value as string, config);
    default:
      return String(value);
  }
}

function formatCurrencyValue(
  value: number,
  config: ColumnRenderConfig
): string {
  if (value === null || value === undefined) return "-";

  const decimals = config.decimals ?? 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  const currency = config.currency || "DOT";
  return `${formatted} ${currency}`;
}

function formatNumberValue(value: number, config: ColumnRenderConfig): string {
  if (value === null || value === undefined) return "-";

  const decimals = config.decimals ?? 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatAddressValue(value: string, config: ColumnRenderConfig): string {
  if (!value) return "-";
  if (config.truncate && value.length > 16) {
    return `${value.slice(0, 8)}...${value.slice(-6)}`;
  }
  return value;
}

// ============================================================================
// Abbreviated Formatting (for chart axes)
// ============================================================================

export function formatAbbreviated(
  value: number,
  config: ColumnRenderConfig
): string {
  if (value === null || value === undefined) return "-";

  const absValue = Math.abs(value);
  let formatted: string;
  let suffix = "";

  if (absValue >= 1_000_000_000) {
    formatted = (value / 1_000_000_000).toPrecision(3);
    suffix = "B";
  } else if (absValue >= 1_000_000) {
    formatted = (value / 1_000_000).toPrecision(3);
    suffix = "M";
  } else if (absValue >= 1_000) {
    formatted = (value / 1_000).toPrecision(3);
    suffix = "K";
  } else {
    formatted = value.toPrecision(3);
  }

  // Remove trailing zeros after decimal
  formatted = parseFloat(formatted).toString();

  const currency = config.currency;
  if (currency) {
    return `${formatted}${suffix} ${currency}`;
  }
  return `${formatted}${suffix}`;
}

// ============================================================================
// Badge Variant Lookup
// ============================================================================

export function getBadgeVariant(
  value: string,
  config: ColumnRenderConfig
): BadgeVariant {
  if (!config.variants) return "outline";

  const variant = config.variants[value];
  if (variant) return variant;

  return config.variants["default"] || "outline";
}

// ============================================================================
// Link URL Generation
// ============================================================================

export function getLinkUrl(
  value: unknown,
  config: ColumnRenderConfig,
  row?: Record<string, unknown>
): string | null {
  // If urlField is specified, get URL from the row data
  if (config.urlField && row) {
    const url = row[config.urlField];
    return url ? String(url) : null;
  }

  // If urlTemplate is specified, interpolate the value
  if (config.urlTemplate) {
    return config.urlTemplate.replace("{value}", String(value));
  }

  return null;
}

// ============================================================================
// Re-export for backwards compatibility
// ============================================================================

// These functions maintain backwards compatibility with code that imported from column-display-names.ts
export { loadColumnConfig as loadColumnNameOverrides };

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Sets the column configuration directly (for testing purposes only).
 * This bypasses the YAML file loading and allows tests to inject config.
 */
export function __setConfigForTesting(testConfig: ColumnConfig): void {
  config = testConfig;
  loaded = true;
}
