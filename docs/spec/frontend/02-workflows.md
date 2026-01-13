# Frontend Table System Workflows

## Workflow 1: Researcher Analyzing High-Value Ecosystem Referenda

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

## Workflow 2: Dashboard Designer Creating Treasury Overview

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

## Workflow 3: Mobile User Checking Recent Referenda

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
