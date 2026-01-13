# Frontend Table System Technical Requirements

## Unified Component Interface

```tsx
interface UnifiedTableProps<TData> {
  // Data source (either pre-fetched or query-driven)
  data?: TData[];
  queryConfig?: QueryConfig;

  // Column definition (static or auto-generated)
  columns?: ColumnDef<TData>[];
  autoGenerateColumns?: boolean;

  // Feature toggles (all default true unless noted)
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
  enableExport?: boolean;
  enableViewManagement?: boolean;
  enableColumnVisibility?: boolean;
  enableCardView?: boolean;       // Default: true on mobile only
  enableInlineEdit?: boolean;     // Default: false (auth-gated)

  // Layout mode
  mode?: 'fullPage' | 'embedded';
  height?: number; // Required for embedded mode

  // State management
  tableName: string;
  defaultViews?: SavedView[];
  defaultSorting?: SortingState;

  // Callbacks
  onUpdate?: (id: any, data: Partial<TData>) => void;

  // Context
  isAuthenticated?: boolean;
  categories?: Category[]; // For category selector
}
```

## Auto-Column Generation Logic

For query-driven tables with unknown schemas:

1. **Extract column names** from first result object: `Object.keys(data[0])`
2. **Infer type** from values:
   - `typeof value === 'number'` → numeric (right-aligned)
   - `/^\d{4}-\d{2}-\d{2}/.test(value)` → date
   - `/^\d{4}-\d{2}-\d{2}T/.test(value)` → datetime
   - Default: string (left-aligned)
3. **Apply centralized decoration** via `column-renderer.ts`:
   - Use `columnMapping` to resolve aliases (e.g., `sum_DOT_latest` → `DOT_latest`)
   - Look up source table column config for formatting rules
   - Apply `formatCurrency()`, `formatNumber()`, `formatDate()` as needed
4. **Generate sortable headers** with `DataTableColumnHeader` component
5. **Support filtering** based on inferred type (string: includes, number: range, date: range)

## Grid Layout Compatibility (Embedded Mode)

Requirements for dashboard grid cells:

1. **Fixed-height container** with `overflow-y: auto` for scrollable content
2. **Compact toolbar** that collapses or hides non-essential controls:
   - Hide view management (not applicable in dashboard context)
   - Combine export + column visibility into single dropdown
   - Search input takes full width
3. **Pagination uses compact layout** (minimal padding/margins)
4. **No expanding/collapsing** that changes container height (breaks grid)
5. **Responsive to resize events** from react-grid-layout

## Feature Parity Matrix

| Feature | Main DataTable | Dashboard Table | Unified (Target) |
|---------|----------------|-----------------|------------------|
| Sorting | ✅ | ❌ | ✅ Both modes |
| Filtering | ✅ | ❌ | ✅ Both modes |
| Column visibility | ✅ | ❌ | ✅ Both modes |
| Pagination | ✅ | ❌ | ✅ Both modes |
| Export (CSV/JSON) | ✅ | ❌ | ✅ Both modes |
| View management | ✅ | ❌ | ✅ Full-page only |
| Inline editing | ✅ | ❌ | ✅ Full-page only (auth) |
| Mobile card view | ✅ | ❌ | ✅ Full-page only |
| Auto-column generation | ❌ | ✅ | ✅ Both modes |
| Fixed-height layout | ❌ | ✅ | ✅ Embedded mode |
| Query-driven data | ❌ | ✅ | ✅ Both modes |
