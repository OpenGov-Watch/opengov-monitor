# Filter System Design

Implementation design for FacetedFilter and FilterGroupBuilder components.

## Architecture

### Component Hierarchy

```
DataTable
├── FacetedFilter (per column)
│   └── Multi-select dropdown with counts
└── FilterGroupBuilder (advanced dialog)
    └── Recursive FilterGroup rendering
```

### State Management

Unified filter state via `filterGroup` in DataTable:

```typescript
// Shared state for both filter types
const [filterGroup, setFilterGroup] = useState<FilterGroup>({
  operator: "AND",
  conditions: []
});
```

## FacetedFilter Implementation

**Location**: `components/data-table/faceted-filter.tsx`

### Data Flow
1. Component opens → fetch facet data from `/api/query/facets`
2. User selects values → store locally as pending
3. Apply → merge into shared `filterGroup` state
4. Cancel → discard pending selections

### Facet Integration

```typescript
// Facet request
const facetConfig: FacetQueryConfig = {
  sourceTable: queryConfig.sourceTable,
  columns: [columnId],
  filters: currentFilters  // Other active filters
};

// Response shape
interface FacetResponse {
  [column: string]: Array<{ value: string; count: number }>;
}
```

### Apply/Cancel Pattern

```typescript
// Local pending state
const [pendingValues, setPendingValues] = useState<string[]>([]);

// On open: sync from shared state
useEffect(() => {
  if (open) {
    setPendingValues(getValuesFromFilterGroup(filterGroup, columnId));
  }
}, [open]);

// Apply: merge back to shared state
const handleApply = () => {
  const newFilterGroup = mergeValuesToFilterGroup(filterGroup, columnId, pendingValues);
  onFilterGroupChange(newFilterGroup);
};
```

## FilterGroupBuilder Implementation

**Location**: `components/query-builder/filter-group-builder.tsx`

### Recursive Rendering

```typescript
function FilterGroupBuilder({ group, onChange, depth = 0 }) {
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <OperatorToggle value={group.operator} onChange={...} />
      {group.conditions.map((condition, i) => (
        isFilterGroup(condition)
          ? <FilterGroupBuilder group={condition} depth={depth + 1} />
          : <ConditionRow condition={condition} />
      ))}
      <AddConditionButton />
      <AddGroupButton />
    </div>
  );
}
```

### Categorical Column Detection

```typescript
const CATEGORICAL_COLUMNS = ["status", "track", "type", "category", "subcategory"];

function isCategorical(column: string): boolean {
  return CATEGORICAL_COLUMNS.includes(column);
}
```

### Operator Selection by Type

```typescript
function getOperatorsForColumn(column: string): string[] {
  if (isCategorical(column)) {
    return ["IN", "NOT IN", "IS NULL", "IS NOT NULL"];
  }
  if (isNumeric(column)) {
    return ["=", "!=", ">", "<", ">=", "<=", "IS NULL", "IS NOT NULL"];
  }
  // ... text, date
}
```

## Integration Points

### DataTable Integration

```typescript
// DataTable passes filterGroup to query hook
const { data } = useDataTableQuery({
  queryConfig,
  filterGroup,  // Shared state
  sorting,
  pagination
});
```

### QueryBuilder Integration

```typescript
// QueryBuilder stores filters in query config
const [queryConfig, setQueryConfig] = useState<QueryConfig>({
  sourceTable: "Referenda",
  columns: [...],
  filters: filterGroup  // FilterGroup structure
});
```

### Dashboard Integration

```typescript
// Dashboard component editor uses FilterGroupBuilder
<FilterGroupBuilder
  group={component.query_config.filters}
  onChange={(filters) => updateComponent({ ...component, query_config: { ...component.query_config, filters } })}
/>
```

## Key Files

```
frontend/src/components/
├── data-table/
│   └── faceted-filter.tsx     # Multi-select dropdown
├── query-builder/
│   ├── filter-group-builder.tsx  # AND/OR builder
│   └── condition-row.tsx         # Single condition
└── lib/
    └── query-config-utils.ts     # Filter utilities
```

## See Also

- [Filters Requirements](../../01_requirements/frontend/filters.md) - User capabilities
- [Filters Specification](../../02_specification/frontend/filters.md) - Data structures, operators
- [Filters How-To](../../howtos/filters.md) - Usage guide
