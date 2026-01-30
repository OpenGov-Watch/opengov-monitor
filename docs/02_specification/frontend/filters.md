# Filters Specification

Column type system and operator mappings for filtering.

## Column Types

| Type | Detection Pattern | Examples |
|------|-------------------|----------|
| Categorical | status, track, type, category | status, track, type, category, subcategory |
| Numeric | DOT, USD, IDs, counts | DOT_latest, USD_proposal_time, id, tally_ayes |
| Text | title, description, notes | title, description, notes, name |
| Date | *_time, *_at, *date* | proposal_time, latest_status_change, expireAt |

## Operators by Column Type

### Categorical
- `IN`
- `NOT IN`
- `IS NULL`
- `IS NOT NULL`

### Numeric
- `=`
- `!=`
- `>`
- `<`
- `>=`
- `<=`
- `IS NULL`
- `IS NOT NULL`

### Text
- `=`
- `!=`
- `>`
- `<`
- `>=`
- `<=`
- `LIKE`
- `IS NULL`
- `IS NOT NULL`

### Date
- `=`
- `!=`
- `>`
- `<`
- `>=`
- `<=`
- `IS NULL`
- `IS NOT NULL`

## Data Structures

### FilterGroup (Canonical Format)

```typescript
interface FilterGroup {
  operator: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}
```

### FilterCondition

```typescript
interface FilterCondition {
  column: string;
  operator: string;
  value: string | string[] | null;
}
```

### Backward Compatibility

Legacy `FilterCondition[]` format auto-converted to FilterGroup on first edit. Conversion uses memoized helper with WeakMap caching. No data migration required.

## API Integration

### Faceted Filters

**Request**: POST to `/api/query/facets`
- Source table
- Columns to facet
- Active filters

**Response**: Object mapping columns to value/count pairs
- All distinct values from full dataset
- Counts filtered based on other active filters

### FilterGroupBuilder

**Request**: POST to query execute endpoint
- Query configuration including filter structure
- Filters translated to SQL WHERE clauses
- Proper operator handling and value escaping

**Execution**:
- Server-side SQL with WHERE conditions
- Proper AND/OR precedence
- Secure parameter binding
