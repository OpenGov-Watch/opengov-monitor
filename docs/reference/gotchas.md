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

### Dot-Notation Columns Need `accessorFn`

TanStack Table can't use `accessorKey` for nested fields like `tally.ayes`:

```typescript
// Wrong - won't work
{ accessorKey: "tally.ayes" }

// Correct
{ accessorFn: (row) => row["tally.ayes"], id: "tally.ayes" }
```

### Joined Columns Need Alias Resolution for Sorting

When using JOINs with aliased columns, sorting requires mapping aliases back to original references:

```typescript
// QueryConfig defines joined column with alias
columns: [
  { column: "c.category", alias: "category" }  // JOIN Categories AS c
]

// TanStack Table sorts by alias
sorting: [{ id: "category", desc: false }]

// Must resolve: "category" → "c.category" before sending to backend
const columnIdToRef = { category: "c.category" };
orderBy: sortingStateToOrderBy(sorting, queryConfig, columnIdToRef)
// Result: [{ column: "c.category", direction: "ASC" }]
```

Without resolution, backend receives `"category"` and prefixes source table → `"Referenda.category"` → error.

See `data-table.tsx` and `query-config-utils.ts` for implementation.

### Chart Data May Need Pivot

Stacked bar charts expect pivoted data. The frontend auto-transforms when it detects category columns. See `transformDataForStackedBar()` in chart components.

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
