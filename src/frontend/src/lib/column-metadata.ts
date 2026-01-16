/**
 * Column type definitions for filtering behavior
 */
export type ColumnType = 'categorical' | 'numeric' | 'text' | 'date';

/**
 * Determine the type of a column based on its name
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
