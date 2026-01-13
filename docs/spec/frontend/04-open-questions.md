# Frontend Table System Open Questions

## 1. Performance

**Question:** Will TanStack Table's row models handle large query results (1000+ rows) in embedded mode without lag?

**Mitigation Options:**
- Virtual scrolling (react-virtual or TanStack Virtual)
- Lazy loading with pagination
- Enforced LIMIT in queries for dashboard tables
- Performance profiling with realistic data volumes

---

## 2. Toolbar Real Estate

**Question:** In narrow dashboard cells (w=4 or less), how should we prioritize toolbar features?

**Proposal:** Show search + overflow menu with all other controls

**Alternatives:**
- Collapsible toolbar with expand/collapse toggle
- Tab-based toolbar (Search | Filter | Export)
- Hide toolbar entirely in narrow cells, show on hover

---

## 3. View Management in Dashboards

**Question:** Should dashboard tables support saved views, or is that redundant with dashboard-level persistence?

**Current Plan:** Disable view management in embedded mode (dashboard config is the "view")

**Considerations:**
- Dashboard-level persistence already saves table state
- Saved views might be useful for exploring dashboard table data full-screen
- Could support "Open in full page" link with view state pre-applied

---

## 4. Inline Editing in Dashboards

**Question:** Should dashboard tables support inline editing for manually-maintained tables?

**Current Plan:** No (read-only), but flag for future consideration

**Use Case:** Dashboard showing `categories` table with inline edits
- Pro: Convenient for data curation
- Con: Editing workflow might be disrupted by grid constraints
- Alternative: "Open in full page" link to edit mode

---

## 5. Column Mapping Complexity

**Question:** If query returns `SUM(amount)` without alias, how do we map to source column for formatting?

**Proposal:** Require aliases in QueryBuilder (`SUM(amount) AS total_amount`)

**Alternatives:**
- Attempt to parse expression and guess source column
- Fallback to generic numeric formatting
- Show warning in QueryBuilder preview if no alias provided

---

## 6. Mobile Dashboard Experience

**Question:** Should dashboards have card view mode, or rely on grid responsiveness?

**Current Plan:** Grid handles mobile via breakpoints, no card mode for dashboard tables

**Considerations:**
- react-grid-layout has mobile breakpoints (sm, xs, xxs)
- Card view might not make sense in grid context (layout already adaptive)
- Full-page dashboard tables could support card view via "Open full" link
