/**
 * Hierarchical display utilities for DataTable
 *
 * Provides functions to process grouped data for hierarchical display,
 * including collapsing repeated group values and calculating group subtotals.
 */

export interface HierarchicalRowMeta {
  /** Whether this column should be rendered (first occurrence in group) */
  visibleColumns: Set<string>;
  /** Whether this row starts a new group at each level */
  isGroupStart: Record<string, boolean>;
  /** Row index within the current innermost group */
  groupRowIndex: number;
}

export interface GroupSubtotal {
  /** Index in groupByColumns (0 = outermost group) */
  level: number;
  /** The group column this subtotal represents */
  groupColumn: string;
  /** The value of the group being totaled */
  groupValue: unknown;
  /** All group values at this level (for display context) */
  groupPath: Record<string, unknown>;
  /** Calculated sums for currency columns */
  totals: Record<string, number>;
  /** Number of data rows in this group */
  rowCount: number;
}

export interface ProcessedHierarchicalData<T> {
  /** Original rows with hierarchical metadata */
  rows: Array<{ data: T; meta: HierarchicalRowMeta }>;
  /** Subtotals for each group (ordered by when they should appear) */
  subtotals: GroupSubtotal[];
  /** Map from row index to subtotals that should appear AFTER that row */
  subtotalsAfterRow: Map<number, GroupSubtotal[]>;
}

/**
 * Process data for hierarchical display
 *
 * @param data - Array of data rows
 * @param groupByColumns - Ordered array of column names for grouping (outer to inner)
 * @param currencyColumns - Column names that should be summed for totals
 * @returns Processed data with metadata and subtotals
 */
export function processHierarchicalData<T extends Record<string, unknown>>(
  data: T[],
  groupByColumns: string[],
  currencyColumns: string[]
): ProcessedHierarchicalData<T> {
  if (!data.length || !groupByColumns.length) {
    return {
      rows: data.map((d) => ({
        data: d,
        meta: { visibleColumns: new Set(), isGroupStart: {}, groupRowIndex: 0 },
      })),
      subtotals: [],
      subtotalsAfterRow: new Map(),
    };
  }

  const rows: Array<{ data: T; meta: HierarchicalRowMeta }> = [];
  const subtotals: GroupSubtotal[] = [];
  const subtotalsAfterRow = new Map<number, GroupSubtotal[]>();

  // Track current group values and accumulators at each level
  const currentGroupValues: Record<string, unknown> = {};
  const groupAccumulators: Array<{
    level: number;
    groupColumn: string;
    groupValue: unknown;
    groupPath: Record<string, unknown>;
    totals: Record<string, number>;
    rowCount: number;
    startIndex: number;
  }> = [];

  // Initialize accumulators for all levels
  for (let level = 0; level < groupByColumns.length; level++) {
    groupAccumulators.push({
      level,
      groupColumn: groupByColumns[level],
      groupValue: undefined,
      groupPath: {},
      totals: Object.fromEntries(currencyColumns.map((c) => [c, 0])),
      rowCount: 0,
      startIndex: 0,
    });
  }

  let groupRowIndex = 0;

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    const visibleColumns = new Set<string>();
    const isGroupStart: Record<string, boolean> = {};
    let resetFromLevel = -1;

    // Check each group level for changes
    for (let level = 0; level < groupByColumns.length; level++) {
      const col = groupByColumns[level];
      const currentValue = row[col];
      const previousValue = currentGroupValues[col];

      // If this level changed, or a higher level changed (resetFromLevel)
      if (resetFromLevel >= 0 || currentValue !== previousValue) {
        if (resetFromLevel < 0) {
          resetFromLevel = level;
        }

        // Emit subtotals for levels that are ending (from deepest to this level)
        if (rowIndex > 0) {
          // Collect subtotals for all levels from deepest to resetFromLevel
          const rowSubtotals: GroupSubtotal[] = [];
          for (let l = groupByColumns.length - 1; l >= resetFromLevel; l--) {
            const acc = groupAccumulators[l];
            if (acc.rowCount > 0) {
              rowSubtotals.push({
                level: acc.level,
                groupColumn: acc.groupColumn,
                groupValue: acc.groupValue,
                groupPath: { ...acc.groupPath },
                totals: { ...acc.totals },
                rowCount: acc.rowCount,
              });
            }
          }
          if (rowSubtotals.length > 0) {
            subtotals.push(...rowSubtotals);
            // Store subtotals to appear after the previous row
            const existingSubtotals = subtotalsAfterRow.get(rowIndex - 1) || [];
            subtotalsAfterRow.set(rowIndex - 1, [...existingSubtotals, ...rowSubtotals]);
          }
        }

        // Mark this as a group start and make column visible
        isGroupStart[col] = true;
        visibleColumns.add(col);

        // Reset accumulators from this level down
        for (let l = level; l < groupByColumns.length; l++) {
          const acc = groupAccumulators[l];
          acc.groupValue = l === level ? currentValue : row[groupByColumns[l]];
          acc.groupPath = {};
          for (let pl = 0; pl <= l; pl++) {
            acc.groupPath[groupByColumns[pl]] = row[groupByColumns[pl]];
          }
          acc.totals = Object.fromEntries(currencyColumns.map((c) => [c, 0]));
          acc.rowCount = 0;
          acc.startIndex = rowIndex;
        }

        // Update current group value
        currentGroupValues[col] = currentValue;

        // Reset row index within group when group changes
        if (level === groupByColumns.length - 1) {
          groupRowIndex = 0;
        }
      }
    }

    // If no group change, only show the deepest (innermost) column value
    // Actually, in hierarchical display, we suppress ALL group columns for non-first rows
    // So visibleColumns stays empty for subsequent rows

    // Accumulate values for all group levels
    for (let level = 0; level < groupByColumns.length; level++) {
      const acc = groupAccumulators[level];
      acc.rowCount++;
      for (const col of currencyColumns) {
        const val = row[col];
        if (typeof val === "number") {
          acc.totals[col] += val;
        }
      }
    }

    rows.push({
      data: row,
      meta: {
        visibleColumns,
        isGroupStart,
        groupRowIndex,
      },
    });

    groupRowIndex++;
  }

  // Emit final subtotals for all levels (from deepest to outermost)
  if (data.length > 0) {
    const finalSubtotals: GroupSubtotal[] = [];
    for (let l = groupByColumns.length - 1; l >= 0; l--) {
      const acc = groupAccumulators[l];
      if (acc.rowCount > 0) {
        finalSubtotals.push({
          level: acc.level,
          groupColumn: acc.groupColumn,
          groupValue: acc.groupValue,
          groupPath: { ...acc.groupPath },
          totals: { ...acc.totals },
          rowCount: acc.rowCount,
        });
      }
    }
    if (finalSubtotals.length > 0) {
      subtotals.push(...finalSubtotals);
      const existingSubtotals = subtotalsAfterRow.get(data.length - 1) || [];
      subtotalsAfterRow.set(data.length - 1, [...existingSubtotals, ...finalSubtotals]);
    }
  }

  return { rows, subtotals, subtotalsAfterRow };
}

/**
 * Determine if a row should have a top border (group separator)
 *
 * @param meta - Row metadata
 * @param groupByColumns - The columns used for grouping
 * @returns true if the row should have a visible top border
 */
export function shouldShowRowBorder(
  meta: HierarchicalRowMeta,
  groupByColumns: string[]
): boolean {
  // Show border if the outermost (first) group column changed
  return groupByColumns.length > 0 && meta.isGroupStart[groupByColumns[0]] === true;
}

/**
 * Get display value for a cell in hierarchical mode
 *
 * @param columnId - The column being rendered
 * @param value - The actual value
 * @param meta - Row metadata
 * @param groupByColumns - The columns used for grouping
 * @returns The value to display (empty string if suppressed)
 */
export function getHierarchicalCellValue(
  columnId: string,
  value: unknown,
  meta: HierarchicalRowMeta,
  groupByColumns: string[]
): unknown {
  // If this is a group column and it's not visible, return empty
  if (groupByColumns.includes(columnId) && !meta.visibleColumns.has(columnId)) {
    return "";
  }
  return value;
}
