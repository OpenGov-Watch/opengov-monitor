/**
 * Shared style constants for export vs interactive rendering modes.
 *
 * html2canvas cannot reliably resolve Tailwind CSS classes on off-screen elements,
 * so we need inline styles for export mode. These constants keep both modes in sync.
 */

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
