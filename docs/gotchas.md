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

## Database

### `all_spending` View is Broken

The view has schema issues. API uses a custom query instead:

```typescript
// api/src/db/queries.ts - don't use the view directly
const allSpending = db.prepare(`...custom UNION query...`).all();
```

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

### Chart Data May Need Pivot

Stacked bar charts expect pivoted data. The frontend auto-transforms when it detects category columns. See `transformDataForStackedBar()` in chart components.

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
