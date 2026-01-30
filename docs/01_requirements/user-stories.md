# Frontend Table System User Stories

## Core User Roles

1. **Data Explorer** - Governance analyst exploring full datasets to discover patterns
2. **Dashboard Designer** - User creating custom visual dashboards combining tables and charts
3. **Mobile User** - Accessing governance data on mobile devices
4. **Admin/Curator** - Authenticated user maintaining data quality through inline edits
5. **Researcher** - Exporting filtered data for external analysis

---

## Data Management

### US-1: Data Exploration

**As a** governance analyst
**I want to** explore large datasets with sorting and filtering
**So that** I can discover patterns in treasury spending and referendum outcomes

**Acceptance Criteria:**
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

## Data Editing

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

### US-10: Custom Spending Entries

**As an** authenticated user
**I want to** add custom spending entries that integrate with existing spending data
**So that** I can manually track spending not captured by automated sources

**Acceptance Criteria:**
- Create/edit/delete custom spending entries via manage section UI
- Entries union into `all_spending` view alongside automated sources
- Required fields: Type (from existing spending types), Title
- Optional fields: Description, Date, DOT/USD values, DOT/USDC/USDT components, Category/Subcategory
- ID auto-generated with 'custom-' prefix (e.g., custom-1, custom-2)
- Type selectable from 6 existing spending types via dropdown
- Category/Subcategory use cascading dropdown (same pattern as Subtreasury)
- All authenticated users can view and edit all custom entries (shared, not user-owned)
- Custom entries appear in all spending queries, dashboards, and exports

---

### US-11: Database Backup Download

**As an** authenticated admin
**I want to** download a complete copy of the database from the Sync Settings menu
**So that** I can create local backups for disaster recovery or offline analysis

**Acceptance Criteria:**
- Download button available in Sync Settings menu (authenticated users only)
- Database is automatically checkpointed before download to ensure consistency
- Downloaded file includes timestamp in filename (e.g., `opengov-backup-2026-01-15.db`)
- Visual feedback during download (loading spinner, success/error messages)
- File size displayed before download
- Download works for both UI and CLI (via authenticated API endpoint)
- WAL checkpoint always runs before download for data consistency

---

### US-14: Bulk Data Import

**As an** authenticated admin
**I want to** bulk import category assignments and flow data via CSV upload or curated defaults
**So that** I can efficiently maintain data quality without editing rows individually

**Acceptance Criteria:**
- Import categories first, then entity category assignments (order enforced)
- Two import methods: CSV upload or "Apply Defaults" from curated files
- CSV formats support multiple column name variants (case-insensitive, aliases)
- Pre-validation rejects entire import if any category references don't exist
- Error messages show first 10 violations with row numbers
- All-or-nothing transaction semantics (no partial imports)
- Importable entities: Categories, Referenda, Bounties, Child Bounties, Treasury Netflows, Cross-Chain Flows, Local Flows
- Empty category fields (`""`, `""`) clear category assignment (sets NULL)
- Child bounty identifiers normalized (hyphen → underscore)
- Visual feedback during import (loading state, success/error messages)
- Import UI available in Sync Settings page (authenticated users only)

---

### US-15: Category Inheritance for Child Bounties

**As an** admin categorizing child bounties
**I want to** see the parent bounty's category when no override is set
**So that** I know what category a child bounty inherits before deciding to override it

**Acceptance Criteria:**
- When child bounty has no category set, show parent's category/subcategory as grayed placeholder
- User can select a different subcategory based on the inherited category
- User can select a different category; if current subcategory is invalid for new category, default to "Other"
- User can select "None" for category to revert to inherited category
- After selecting a category, selecting "None" reverts to inherited; subcategory stays if valid, else defaults to inherited
- Changes update UI immediately (optimistic update) without page reload
- NULL subcategory displays as "Other" in all UI (it's the default subcategory for each category)
- NULL subcategory rows cannot be deleted (they're required for each category)
- Entities without parents show "None" option (no category)

**Implementation:** See [Category Inheritance Guide](../howtos/category-inheritance.md)

---

## Presentation

### US-2: View Management

**As a** regular user
**I want to** save and share custom table views
**So that** I can quickly access my common analysis scenarios and collaborate with colleagues

**Acceptance Criteria:**
- Save current state (filters, sorting, visibility) as named view
- Load saved views from dropdown (desktop) or tabs (mobile)
- Share view via URL (base64-encoded state in query param)
- Set default view per table (persisted in localStorage)
- Delete unwanted views
- View state includes pagination settings

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
- All features (filter, sort) work in card mode

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

### US-12: Visual Query Builder

**As a** dashboard creator
**I want to** build custom queries visually without writing SQL
**So that** I can create filtered, aggregated, and sorted views without technical expertise

**Acceptance Criteria:**
- Select source table from allowlist
- Choose columns to display (with optional aliases)
- Add expression columns (computed: `column1 + column2`)
- Add filters with operators (=, !=, <, >, <=, >=, LIKE, IN, IS NULL, IS NOT NULL)
- Multiple filters combined with AND logic
- Group by columns for aggregations
- Add aggregate functions: COUNT, SUM, AVG, MIN, MAX
- Order by columns (ASC/DESC)
- Set row limit
- Live preview of query results
- Save query configuration to dashboard components

---

### US-13: JOIN Support in Visual Query Builder

**As a** dashboard creator
**I want to** join multiple tables in the visual query builder
**So that** I can access related data (e.g., referendum details for claims) without hardcoding queries

**Acceptance Criteria:**
- Add JOIN section in query builder UI
- Select join type: LEFT, INNER, RIGHT
- Choose table to join from allowlist
- **Join conditions auto-populate based on FK relationships**
- Add multiple JOINs (e.g., claims → referenda → categories)
- Access columns from joined tables in column picker
- Filter on joined table columns
- Order by joined table columns
- Live preview shows joined results
- JOIN configuration saved with dashboard component

**Example Use Case:**
Query outstanding claims with referendum creation dates:
- Source: `outstanding_claims`
- JOIN: `Referenda` (auto-detects ON `outstanding_claims.referendumIndex = Referenda.id`)
- Filter: `Referenda.proposal_time <= '2025-12-31'`
- Filter: `outstanding_claims.expireAt > '2025-12-31'`
- Columns: claim details + `Referenda.proposal_time`
