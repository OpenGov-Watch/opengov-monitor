# QueryBuilder API Reference

> **Status**: Stub - To be expanded with complete prop documentation

## Component Signature

```typescript
function QueryBuilder(props: QueryBuilderProps): JSX.Element
```

## Props

```typescript
interface QueryBuilderProps {
  initialConfig?: QueryConfig;
  onChange: (config: QueryConfig) => void;
  onPreview?: (results: unknown[], sql: string) => void;
}
```

## QueryConfig Output

See [DataTable API Reference](./data-table-api.md#queryconfig-type) for complete QueryConfig type definition.

## Aggregate Functions

```typescript
const AGGREGATE_FUNCTIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX"] as const;
```

## Filter Operators

```typescript
const FILTER_OPERATORS = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "LIKE",
  "IN",
  "NOT IN",
  "IS NULL",
  "IS NOT NULL",
] as const;
```

**Categorical Column Enhancement:** When using `IN` or `NOT IN` operators on categorical columns (`status`, `status_type`, `track`, `type`, `category`, `subcategory`), the filter builder automatically displays a multiselect dropdown with searchable values and counts instead of free text input.

## JOIN Types

```typescript
type JoinType = "LEFT" | "INNER" | "RIGHT";
```

## Unified Column Model

The QueryBuilder uses a unified column model internally to allow drag-and-drop reordering of both regular columns and expression columns together.

```typescript
type UnifiedColumn =
  | { type: "regular"; column: string; alias?: string; displayName?: string; aggregateFunction?: AggregateFunction }
  | { type: "expression"; expression: string; alias: string; displayName?: string };
```

### Column Naming

- **`alias`**: SQL identifier used in queries. Auto-sanitized to alphanumeric + underscores.
- **`displayName`**: UI header text shown in tables. Can include spaces and special characters.

When editing a column's "Display Name" in the QueryBuilder, the `displayName` field is updated while `alias` remains a valid SQL identifier.

Conversion utilities in `unified-column-utils.ts`:
- `toUnifiedColumns()` - Converts API format to unified state
- `fromUnifiedColumns()` - Converts unified state back to API format
- `getColumnId()` - Generates unique IDs with prefixes (`col:` or `expr:`)

## Usage Example

```typescript
<QueryBuilder
  initialConfig={{
    sourceTable: "Referenda",
    columns: [{ column: "id" }],
    filters: [],
    orderBy: [],
    limit: 100
  }}
  onChange={(config) => {
    console.log("Query config updated:", config);
  }}
  onPreview={(results, sql) => {
    console.log("Preview results:", results);
    console.log("Generated SQL:", sql);
  }}
/>
```

## Foreign Key Auto-Detection

The QueryBuilder automatically detects JOIN conditions based on these patterns:

### Pattern 1: `{table}_id`
- `category_id` → `Categories.id`
- `parent_bounty_id` → `Bounties.id`

### Pattern 2: `{table}Id` (camelCase)
- `parentBountyId` → `Bounties.id`
- `referendumId` → `Referenda.id`

### Pattern 3: `{table}Index`
- `referendumIndex` → `Referenda.id`

### Special Cases
- Child Bounties uses `identifier` as PK (not `id`)

## Component Files

- `src/frontend/src/components/query-builder/query-builder.tsx` - Main component
- `src/frontend/src/components/query-builder/sortable-column-item.tsx` - Unified sortable column (regular + expression)
- `src/frontend/src/components/query-builder/sortable-column.tsx` - Legacy drag-drop wrapper
- `src/frontend/src/components/query-builder/types.ts` - Type definitions
- `src/frontend/src/lib/unified-column-utils.ts` - Conversion utilities for unified column state

## See Also

- [QueryBuilder Specification](../../01_requirements/frontend/query-builder.md) - Architecture and design
- [QueryBuilder How-To](../../howtos/query-builder.md) - Practical examples
- [Dashboard How-To](../../howtos/dashboard.md) - Using QueryBuilder in dashboards
