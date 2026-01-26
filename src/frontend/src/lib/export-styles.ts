/**
 * Shared style constants for export vs interactive rendering modes.
 *
 * html2canvas cannot reliably resolve Tailwind CSS classes on off-screen elements,
 * so we need inline styles for export mode. These constants keep both modes in sync.
 */

import {
  getColumnConfig,
  getColumnDisplayName,
  formatValue,
} from "@/lib/column-renderer";

// ============================================================================
// Table Styles
// ============================================================================

export const TABLE_STYLES = {
  container: {
    export: {
      width: "100%",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
  },
  table: {
    export: {
      borderCollapse: "collapse" as const,
      width: "100%",
      backgroundColor: "#ffffff",
      border: "1px solid #e5e7eb",
    },
  },
  header: {
    export: {
      fontSize: "16px",
      fontWeight: 600,
      padding: "12px 16px",
      borderBottom: "2px solid #e5e7eb",
      backgroundColor: "#f9fafb",
      whiteSpace: "nowrap" as const,
      color: "#111827",
    },
    interactive: "text-base font-semibold px-4 py-3 bg-muted whitespace-nowrap",
  },
  cell: {
    export: {
      fontSize: "14px",
      padding: "10px 16px",
      borderBottom: "1px solid #e5e7eb",
      whiteSpace: "nowrap" as const,
      color: "#374151",
      backgroundColor: "#ffffff",
    },
    interactive: "text-sm px-4 py-2.5 whitespace-nowrap",
  },
  emptyState: {
    export: {
      padding: "24px",
      textAlign: "center" as const,
      color: "#666",
      fontSize: "14px",
    },
    interactive: "p-6 text-center text-muted-foreground text-sm",
  },
  truncationNote: {
    export: {
      padding: "12px",
      textAlign: "center" as const,
      fontSize: "12px",
      color: "#666",
      backgroundColor: "#f9fafb",
      borderTop: "1px solid #e5e7eb",
    },
    interactive: "p-3 text-center text-xs text-muted-foreground bg-muted border-t",
  },
};

// ============================================================================
// Legend Styles (for charts)
// ============================================================================

export const LEGEND_STYLES = {
  list: {
    export: {
      margin: 0,
      padding: 0,
      listStyle: "none" as const,
    },
    interactive: "flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm",
  },
  listVertical: {
    export: {
      textAlign: "left" as const,
    },
    interactive: "flex-col",
  },
  listHorizontal: {
    export: {
      textAlign: "center" as const,
    },
    interactive: "",
  },
  item: {
    export: {
      marginBottom: "8px",
      fontSize: "18px",
      lineHeight: "24px",
      whiteSpace: "nowrap" as const,
    },
    exportHorizontal: {
      display: "inline-block" as const,
      marginRight: "24px",
    },
    exportVertical: {
      display: "block" as const,
      marginRight: 0,
    },
    interactive: "flex items-center gap-1.5",
  },
  swatch: {
    export: {
      display: "inline-block" as const,
      width: "20px",
      height: "20px",
      borderRadius: "2px",
      marginRight: "8px",
      verticalAlign: "top" as const,
    },
    interactive: "block flex-shrink-0 rounded-sm w-3 h-3",
  },
  label: {
    export: {
      color: "#737373",
      display: "inline-block" as const,
      verticalAlign: "top" as const,
      fontSize: "18px",
      lineHeight: 1,
      height: "20px",
      marginTop: "-8px",
    },
    interactive: "text-muted-foreground",
  },
};

// ============================================================================
// Color Constants
// ============================================================================

export const COLORS = {
  border: "#e5e7eb",
  headerBg: "#f9fafb",
  cellBg: "#ffffff",
  text: "#374151",
  headerText: "#111827",
  mutedText: "#666",
  legendText: "#737373",
};

// ============================================================================
// Table Export Dimension Calculation
// ============================================================================

export interface TableExportDimensions {
  width: number;
  height: number;
}

export interface TableExportOptions {
  tableName?: string;
  columnMapping?: Record<string, string>;
  columnOverrides?: Record<string, { header?: string }>;
}

/**
 * Estimate text width in pixels based on character count.
 * Uses average character width for proportional fonts at given font size.
 */
function estimateTextWidth(text: string, fontSize: number): number {
  // Average character width is ~0.55 of font size for proportional fonts
  const avgCharWidth = fontSize * 0.55;
  return text.length * avgCharWidth;
}

/**
 * Calculate export dimensions for a table based on actual content.
 *
 * Width: Based on actual column content (header + max cell width per column)
 * Height: Based on row count with fixed row heights
 */
export function calculateTableExportDimensions(
  data: Record<string, unknown>[],
  visibleColumns: string[],
  maxRows: number = 50,
  options?: TableExportOptions
): TableExportDimensions {
  // Width constants
  const HEADER_FONT_SIZE = 16;
  const CELL_FONT_SIZE = 14;
  const CELL_PADDING = 32; // 16px left + 16px right
  const MIN_COLUMN_WIDTH = 80;
  const MAX_COLUMN_WIDTH = 400;
  const CONTAINER_PADDING = 48;
  const MIN_WIDTH = 800;
  const MAX_WIDTH = 3200;

  // Height constants (in pixels)
  const TITLE_HEIGHT = 60; // Title area
  const HEADER_HEIGHT = 50; // Table header row
  const ROW_HEIGHT = 40; // Data row
  const TRUNCATION_NOTE_HEIGHT = 30; // "Showing X of Y rows"
  const PADDING = 48; // Container padding (top + bottom)
  const MIN_HEIGHT = 200;
  const MAX_HEIGHT = 2000;

  // Calculate width for each column based on content
  const displayData = data.slice(0, maxRows);
  let totalWidth = CONTAINER_PADDING;

  for (const col of visibleColumns) {
    // Get column config for formatting
    const sourceColumn = options?.columnMapping?.[col] ?? col;
    const config = getColumnConfig(options?.tableName ?? "", sourceColumn);

    // Get header display name
    const headerName =
      options?.columnOverrides?.[col]?.header ??
      getColumnDisplayName(options?.tableName ?? "", col);

    // Calculate header width
    const headerWidth = estimateTextWidth(headerName, HEADER_FONT_SIZE);

    // Calculate max cell width from data
    let maxCellWidth = 0;
    for (const row of displayData) {
      const formattedValue = formatValue(row[col], config);
      const cellWidth = estimateTextWidth(formattedValue, CELL_FONT_SIZE);
      maxCellWidth = Math.max(maxCellWidth, cellWidth);
    }

    // Column width is max of header and cell widths, plus padding
    const columnWidth = Math.max(headerWidth, maxCellWidth) + CELL_PADDING;
    const clampedWidth = Math.max(
      MIN_COLUMN_WIDTH,
      Math.min(MAX_COLUMN_WIDTH, columnWidth)
    );
    totalWidth += clampedWidth;
  }

  const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, totalWidth));

  // Calculate height based on row count
  const rowCount = Math.min(data.length, maxRows);
  const isTruncated = data.length > maxRows;
  const calculatedHeight =
    TITLE_HEIGHT +
    HEADER_HEIGHT +
    rowCount * ROW_HEIGHT +
    (isTruncated ? TRUNCATION_NOTE_HEIGHT : 0) +
    PADDING;
  const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, calculatedHeight));

  return { width, height };
}
