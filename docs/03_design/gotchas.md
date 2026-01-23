# Gotchas

Project-specific quirks that will trip you up.

## Subsquare API

### Timestamp Units Vary by Endpoint

| Endpoint | `blockTime` unit |
|----------|------------------|
| Most endpoints | **seconds** |
| `/fellowship/salary/cycles/{n}/feeds` | **milliseconds** |

```python
# Most endpoints
pd.to_datetime(blockTime * 1e6, utc=True)

# Salary feeds only
pd.to_datetime(blockTime, unit='ms', utc=True)
```

### Three Timestamp Formats

| Source | Format | Conversion |
|--------|--------|------------|
| `blockTime` | Unix seconds (or ms for feeds) | See above |
| `createdAt`, `lastActivityAt` | ISO string | `pd.to_datetime(value, utc=True)` |
| `startIndexer.blockTime` | Unix seconds | `blockTime * 1e6` |

### Runtime Upgrade Call Index Changes

Polkadot runtime upgrade at **ref 1788** changed pallet indices. Code must select correct indices based on `ref_id`:

| Call Type | Before 1788 | From 1788 |
|-----------|-------------|-----------|
| utility.batch | `0x1a00` | `0x2800` |
| utility.batchAll | `0x1a02` | `0x2802` |
| utility.dispatchAs | `0x1a03` | `0x2803` |
| utility.forceBatch | `0x1a04` | `0x2804` |
| treasury.spend | `0x1305` | `0x3c05` |

See `POLKADOT_CALL_INDICES` and `POLKADOT_ASSETHUB_CUTOFF` in `subsquare.py`.

### XCM Asset Versions

v3 uses nested objects, v4/v5 use arrays:

```json
// v3
"interior": { "x2": [{ "palletInstance": 50 }, { "generalIndex": 1337 }] }

// v4/v5
"interior": { "x1": [{ "parachain": 1000 }] }
```

Both must be handled. See `business-rules.md` for index mappings.

---

## Frontend

### Joined Columns Need Alias Resolution for Sorting and Filtering

When using JOINs with aliased columns, both sorting and filtering require mapping aliases back to original references before sending to backend.

```typescript
// QueryConfig defines joined column with alias
columns: [
  { column: "c.category", alias: "category" }  // JOIN Categories AS c
]

// TanStack Table uses aliases for sorting and filtering
sorting: [{ id: "category", desc: false }]
filterGroup: { operator: "AND", conditions: [{ column: "category", operator: "IS NULL", value: null }] }

// Must resolve: "category" → "c.category" before sending to backend
const columnIdToRef = { category: "c.category" };

// Sorting: sortingStateToOrderBy() uses columnIdToRef
orderBy: sortingStateToOrderBy(sorting, queryConfig, columnIdToRef)
// Result: [{ column: "c.category", direction: "ASC" }]

// Filtering: convertFiltersToQueryConfig() uses columnIdToRef
filters: convertFiltersToQueryConfig(columnFilters, filterGroup, columnIdToRef)
// Result: { operator: "AND", conditions: [{ column: "c.category", operator: "IS NULL", value: null }] }
```

Without resolution, backend receives alias and incorrectly prefixes source table → `"Referenda.category"` → error.

**Facet queries need the same resolution** plus reverse mapping for responses:

```typescript
// buildFacetQueryConfig() resolves aliases before sending
const facetConfig = buildFacetQueryConfig({
  sourceTable, columns: ["category"], joins, columnIdToRef
});
// Sends: columns: ["c.category"]

// Response returns resolved keys
{ facets: { "c.category": [...] } }

// Must map back to aliases for UI lookup
const refToAlias = { "c.category": "category" };
facetsData["category"] = response.facets["c.category"];
```

See `data-table.tsx`, `query-config-utils.ts`, and `filter-group-builder.tsx`.

### Chart Data May Need Pivot

Stacked bar charts expect pivoted data. The frontend auto-transforms when it detects category columns. See `pivotBarData()` in `bar-chart.tsx`.

### Chart Colors Are Sorted Alphabetically

Pie and bar charts sort categories **alphabetically** (with "Unknown" last) to ensure consistent colors when displaying the same data. Without this, different query orderings would cause the same category to have different colors in different charts.

### Dashboard Grid: react-grid-layout Gotchas

Dashboard uses `react-grid-layout` with specific patterns to avoid infinite loops:

**Breakpoints lowered for typical containers:**
```typescript
// lg: 800 (not 1200) - typical dashboard container is ~1000px
const BREAKPOINTS = { lg: 800, md: 600, sm: 480, xs: 320, xxs: 0 };
```

**Memoize with stable signatures to prevent infinite loops:**
```typescript
// Wrong - causes infinite loop
const layouts = useMemo(() => ..., [components]);

// Correct - only changes when IDs/config actually change
const componentSignature = useMemo(
  () => components.map(c => `${c.id}:${c.grid_config}`).join("|"),
  [components]
);
const layouts = useMemo(() => ..., [componentSignature, editable]);
```

**Static property required in view mode:**
```typescript
static: !editable  // Prevents unwanted movement in view mode
```

**Debounce layout changes:**
```typescript
const debouncedHandler = debounce(handleLayoutChange, 100);
```

---

## API Server

### Windows Dual-Stack Binding

On Windows, bind explicitly to `127.0.0.1` not `localhost`:

```typescript
app.listen(port, '127.0.0.1', () => { ... });
```

`localhost` can resolve to IPv6 `::1` and cause connection issues.

### Port File Coordination

API writes port to `data/.api-port`. Frontend reads it for proxy config. Start API before frontend.
