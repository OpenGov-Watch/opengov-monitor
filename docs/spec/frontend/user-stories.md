# Frontend Table System User Stories

## Core User Roles

1. **Data Explorer** - Governance analyst exploring full datasets to discover patterns
2. **Dashboard Designer** - User creating custom visual dashboards combining tables and charts
3. **Mobile User** - Accessing governance data on mobile devices
4. **Admin/Curator** - Authenticated user maintaining data quality through inline edits
5. **Researcher** - Exporting filtered data for external analysis

---

## User Stories

### US-1: Data Exploration

**As a** governance analyst
**I want to** explore large datasets with sorting, filtering, and search
**So that** I can discover patterns in treasury spending and referendum outcomes

**Acceptance Criteria:**
- Global search across all visible columns
- Sorting
  - Sort by any column (ascending/descending/none cycle)
  - Sort by multiple columns (shift+click, or via a composer)
- Filtering
  - Combine one or more faceted filters (in nestable groups with AND/OR logic)
  - Clear all filters with one click
- Grouping
  - Group by one column
- Results update immediately without page reload
- URL reflects current exploration state
  
---

### US-2: View Management

**As a** regular user
**I want to** save and share custom table views
**So that** I can quickly access my common analysis scenarios and collaborate with colleagues

**Acceptance Criteria:**
- Save current state (filters, sorting, visibility, search) as named view
- Load saved views from dropdown (desktop) or tabs (mobile)
- Share view via URL (base64-encoded state in query param)
- Set default view per table (persisted in localStorage)
- Delete unwanted views
- View state includes pagination settings

---

### US-3: Data Export

**As a** researcher
**I want to** export filtered data to CSV/JSON
**So that** I can perform external analysis in Excel, R, or Python

**Acceptance Criteria:**
- Export respects current filters (only visible rows)
- Export includes visible columns only (respects column visibility)
- Both CSV (with proper quote escaping) and JSON formats supported
- Filename includes table name for organization
- Export button available in toolbar

---

### US-4: Mobile Access

**As a** mobile user
**I want to** view tables in card layout
**So that** I can access governance data on small screens without horizontal scrolling

**Acceptance Criteria:**
- Auto-detect mobile viewport (<768px)
- Card view shows first 3 columns prominently
- Expandable "Show details" section for remaining columns
- Toggle between table/card view manually
- View mode preference persisted in localStorage per table
- All features (search, filter, sort) work in card mode

---

### US-5: Inline Editing

**As an** authenticated admin
**I want to** edit data inline (categories, notes, visibility flags)
**So that** I can maintain data quality without leaving the table view

**Acceptance Criteria:**
- Editable cells for categories, notes, hidden flags
- Changes save automatically on blur
- Visual feedback during save
- Only visible when authenticated
- Read-only display for unauthenticated users (component pairs: EditableCell ↔ ReadOnlyCell)
- CategorySelector supports cascading category → subcategory with auto-select

---

### US-6: Dashboard Tables

**As a** dashboard designer
**I want to** embed tables in visual dashboards
**So that** I can combine tabular data with charts in a unified view

**Acceptance Criteria:**
- Table fits in react-grid-layout cell with fixed dimensions
- Works with constrained width/height (no overflow breaks)
- Resize/drag doesn't break layout
- All exploration features (sort, filter, export) work in constrained space
- Toolbar adapts to narrow widths (collapsed/compact mode)
- Scrollable content within fixed container

---

### US-7: Query-Driven Tables

**As a** dashboard creator
**I want to** define tables using custom SQL queries
**So that** I can create aggregated views (e.g., GROUP BY, calculated columns)

**Acceptance Criteria:**
- Auto-generate columns from query results (unknown schema)
- Support expression columns (e.g., `sum_amount`, `avg_value`)
- Apply centralized formatting rules (currency, dates, numbers) via column mapping
- Preview results before saving to dashboard
- Handle any query result shape (dynamic column count/types)
- QueryBuilder provides visual SQL construction

---

### US-8: Column Management

**As a** data explorer
**I want to** show/hide columns dynamically
**So that** I can focus on relevant data and reduce visual clutter

**Acceptance Criteria:**
- Dropdown shows all hideable columns (requires `accessorFn` defined)
- Toggle visibility with checkbox
- State persisted in view (localStorage + URL)
- Column order preserved when hiding/showing
- Display column IDs with underscores/dots converted to spaces

---

### US-9: Pagination

**As a** user viewing large datasets
**I want to** paginate results efficiently
**So that** I can navigate thousands of rows without performance issues

**Acceptance Criteria:**
- Configurable page size (10, 20, 30, 50, 100 rows)
- First/Previous/Next/Last navigation buttons
- Current page indicator (e.g., "Page 3 of 47")
- Row count display (e.g., "1,234 rows")
- State persisted in view
- Last button hidden on mobile to save space

---

## Workflows

### Workflow 1: Researcher Analyzing High-Value Ecosystem Referenda

**Actor:** Governance analyst
**Goal:** Find and export high-value ecosystem-related referenda

1. Navigate to Referenda page (`/referenda`)
2. Apply faceted filter: Status = "Approved"
3. Click "USD Value" column header to sort descending
4. Use column visibility dropdown to hide irrelevant columns (execution block, proposer address)
5. Global search: type "ecosystem"
6. Review filtered results (e.g., 23 referenda matching criteria)
7. Click "Save View" button, name it "High-Value Ecosystem"
8. Click "Export" dropdown, select "CSV"
9. Click "Share" icon to copy URL with encoded view state
10. Share URL with colleague via email/chat

**Expected Outcome:**
- Colleague opens URL and sees identical filtered view
- CSV file contains 23 rows with visible columns only
- View "High-Value Ecosystem" persisted for future sessions

---

### Workflow 2: Dashboard Designer Creating Treasury Overview

**Actor:** Dashboard creator
**Goal:** Build dashboard with aggregated treasury spending table

1. Navigate to Dashboards page (`/dashboards`)
2. Click "New Dashboard" button
3. Enter dashboard name: "Treasury Overview Q1 2025"
4. Click "Add Component" → select "Table"
5. QueryBuilder opens:
   - Select source table: `treasury_proposals`
   - Add columns: `status`, `COUNT(*) AS count`, `SUM(value_usd) AS total_usd`
   - Add GROUP BY: `status`
   - Add ORDER BY: `total_usd DESC`
6. Click "Preview" to see results (5 rows showing status breakdown)
7. Results auto-generate columns: `status`, `count`, `total_usd`
8. Click column header "total_usd" to sort descending (client-side sort)
9. Click "Export" dropdown, select "CSV" to download summary
10. Click "Settings" to open ChartConfig, set colors for status badges
11. Drag table component to position (x:0, y:0, w:6, h:4)
12. Resize table component by dragging corner handle
13. Click "Save Dashboard"

**Expected Outcome:**
- Dashboard displays aggregated treasury data
- Table supports sorting even though query has GROUP BY
- Export includes current sort order
- Grid layout persists with table positioned at (0,0) spanning 6x4 cells

---

### Workflow 3: Mobile User Checking Recent Referenda

**Actor:** Mobile user (phone, 375px viewport)
**Goal:** Quickly review recent referendum outcomes on the go

1. Open `/referenda` on mobile browser
2. Page auto-loads in card view (first 3 columns: ID, Title, Status)
3. Scroll through cards
4. Tap "Show details" on specific card to see additional columns (track, USD value, outcome)
5. Tap global search input, type "treasury"
6. Results filter to treasury-related referenda
7. Tap status facet filter, select "Approved"
8. Tap saved view dropdown, select "Recent Approved"
9. Pagination switches to column layout (Previous/Next stacked vertically)

**Expected Outcome:**
- All features work in card mode
- No horizontal scrolling required
- View mode preference persists (card view on next visit)
- Touch targets large enough for fingers

---

## Technical Requirements

### Unified Component Interface

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

### Auto-Column Generation Logic

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

### Grid Layout Compatibility (Embedded Mode)

Requirements for dashboard grid cells:

1. **Fixed-height container** with `overflow-y: auto` for scrollable content
2. **Compact toolbar** that collapses or hides non-essential controls:
   - Hide view management (not applicable in dashboard context)
   - Combine export + column visibility into single dropdown
   - Search input takes full width
3. **Pagination uses compact layout** (minimal padding/margins)
4. **No expanding/collapsing** that changes container height (breaks grid)
5. **Responsive to resize events** from react-grid-layout

### Feature Parity Matrix

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

---

## Open Questions

1. **Performance**: Will TanStack Table's row models handle large query results (1000+ rows) in embedded mode without lag?
   - Mitigation: Virtual scrolling, lazy loading, or enforced LIMIT in queries

2. **Toolbar real estate**: In narrow dashboard cells (w=4 or less), how should we prioritize toolbar features?
   - Proposal: Show search + overflow menu with all other controls

3. **View management in dashboards**: Should dashboard tables support saved views, or is that redundant with dashboard-level persistence?
   - Current plan: Disable view management in embedded mode (dashboard config is the "view")

4. **Inline editing in dashboards**: Should dashboard tables support inline editing for manually-maintained tables?
   - Current plan: No (read-only), but flag for future consideration

5. **Column mapping complexity**: If query returns `SUM(amount)` without alias, how do we map to source column for formatting?
   - Proposal: Require aliases in QueryBuilder (`SUM(amount) AS total_amount`)

6. **Mobile dashboard experience**: Should dashboards have card view mode, or rely on grid responsiveness?
   - Current plan: Grid handles mobile via breakpoints, no card mode for dashboard tables

---

## Success Metrics

### User Experience
- Feature parity achieved (all checkmarks green in matrix above)
- No regressions in existing functionality
- Positive user feedback on unified experience

### Technical
- Single component used in all contexts (11 Main table pages + dashboards)
- Reduced code duplication (~226 + 107 = 333 lines → <300 lines unified)
- Consistent API across full-page and embedded modes
- All tests pass (unit + integration)

### Performance
- No perceived lag when sorting/filtering 1000+ rows
- Dashboard load time <2s with 5+ table components
- Build size increase <50kb (gzipped)
