import { getColumnConfig } from "@/lib/column-renderer";

/**
 * Column type definitions for filtering behavior
 */
export type ColumnType = 'categorical' | 'numeric' | 'text' | 'date';

/**
 * Determine the type of a column based on its name (legacy - uses heuristics only).
 * Prefer getColumnTypeWithConfig for proper date detection from column-config.yaml.
 */
export function getColumnType(columnName: string): ColumnType {
  // Categorical columns - finite value sets
  if (isCategoricalColumn(columnName)) {
    return 'categorical';
  }

  // Numeric columns - amounts, counts, IDs
  if (
    columnName.includes('DOT') ||
    columnName.includes('USD') ||
    columnName.includes('USDC') ||
    columnName.includes('USDT') ||
    columnName.includes('amount') ||
    columnName.includes('count') ||
    columnName.includes('Count') ||
    columnName === 'id' ||
    columnName.endsWith('_id') ||
    columnName.endsWith('Id') ||
    columnName.endsWith('Index') ||
    columnName === 'cycle' ||
    columnName === 'rank' ||
    columnName === 'payment_id'
  ) {
    return 'numeric';
  }

  // Date columns - timestamps
  if (
    columnName.endsWith('_time') ||
    columnName.endsWith('_at') ||
    columnName.includes('date') ||
    columnName.includes('Date')
  ) {
    return 'date';
  }

  // Default to text for all other columns
  return 'text';
}

/**
 * Determine the type of a column using column-config.yaml first, then fallback to heuristics.
 * This properly detects date columns like `latest_status_change` and `validFrom` that have
 * `render: date` in the config but don't match the heuristic patterns.
 */
export function getColumnTypeWithConfig(tableName: string, columnName: string): ColumnType {
  // Categorical columns - finite value sets (always check first)
  if (isCategoricalColumn(columnName)) {
    return 'categorical';
  }

  // Check column-config.yaml for explicit render type
  const config = getColumnConfig(tableName, columnName);
  if (config.render === 'date') {
    return 'date';
  }
  if (config.render === 'currency' || config.render === 'number') {
    return 'numeric';
  }

  // Fallback to heuristic-based detection for columns not in config
  return getColumnType(columnName);
}

/**
 * Categorical columns that should use multiselect dropdowns in filter builder.
 * All categorical columns use the facets API to fetch available values.
 */
export function isCategoricalColumn(columnName: string): boolean {
  const categoricalColumns = [
    'status',
    'status_type',
    'track',
    'type',
    'category',
    'subcategory',
    'parentBountyName',  // parent bounty name for child bounties
  ];

  return categoricalColumns.includes(columnName);
}

/**
 * Get available operators for a column type
 */
export function getOperatorsForColumnType(columnType: ColumnType): string[] {
  switch (columnType) {
    case 'categorical':
      return ['IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'];
    case 'numeric':
      return ['=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL'];
    case 'text':
      return ['=', '!=', 'LIKE', 'IS NULL', 'IS NOT NULL'];
    case 'date':
      return ['=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL'];
    default:
      // Fallback to all operators
      return ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'];
  }
}
