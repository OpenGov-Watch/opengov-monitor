# Column Formatting System

Pattern-based auto-detection and configuration for DataTable column rendering.

## Overview

The column formatting system uses a **three-tier priority system** to determine how columns are rendered:

1. **Table-specific config** - Highest priority, defined per-table
2. **Global columns config** - Applies across all tables
3. **Pattern-based detection** - Auto-detects based on column name patterns
4. **Default** - Falls back to plain text rendering

## Pattern-Based Auto-Detection

Configured in `frontend/public/config/column-config.yaml`.

### Built-in Patterns

| Pattern | Type | Matches | Renders |
|---------|------|---------|---------|
| `DOT_` | prefix | DOT_latest, DOT_value | Currency (DOT, 0 decimals) |
| `USD_` | prefix | USD_latest, USD_component | Currency (USD, 0 decimals) |
| `USDC_` | prefix | USDC_component | Currency (USDC, 0 decimals) |
| `USDT_` | prefix | USDT_component | Currency (USDT, 0 decimals) |
| `_time` | substring | proposal_time, latest_status_change | Date (formatted) |
| `_at` | suffix | created_at, updated_at | Timestamp |
| `status` | exact | status | Chip/Badge (colored) |
| `_status` | suffix | proposal_status | Chip/Badge (colored) |
| `_ayes` | suffix | tally_ayes | Number (green color) |
| `_nays` | suffix | tally_nays | Number (red color) |
| `_address` | suffix | curator_address | Address (truncated) |
| `category` | exact | category | Plain text (categorical filter) |
| `subcategory` | exact | subcategory | Plain text (categorical filter) |

### Adding Custom Patterns

Edit `frontend/public/config/column-config.yaml`:

```yaml
patterns:
  - match: prefix
    pattern: "ETH_"
    config:
      render: currency
      currency: ETH
      decimals: 4

  - match: suffix
    pattern: "_count"
    config:
      render: number
      decimals: 0
      color: blue

  - match: substring
    pattern: "email"
    config:
      render: email
      truncate: true
```

### Match Types

- **prefix**: Pattern must appear at start of column name (`DOT_*`)
- **suffix**: Pattern must appear at end of column name (`*_status`)
- **substring**: Pattern can appear anywhere (`*_time*`)

### Column Types

Column types determine both rendering and filtering behavior:

| Type | Rendering | Filter Operators |
|------|-----------|------------------|
| `text` | Plain text | =, !=, LIKE |
| `numeric` | Formatted number | =, !=, >, <, >=, <= |
| `currency` | Currency with symbol | =, !=, >, <, >=, <= |
| `date` | Formatted date | =, !=, >, <, >=, <= |
| `categorical` | Plain text | IN, NOT IN |
| `link` | Clickable link | =, !=, LIKE |
| `address` | Truncated address | =, !=, LIKE |
| `text_long` | Modal viewer button | IS NULL, IS NOT NULL |

### renderAs Override

Use `renderAs` to change visual rendering while preserving filter behavior:

```yaml
# Categorical with chip/badge rendering
status:
  type: categorical      # Keeps IN/NOT IN filtering
  renderAs: chip         # Renders as Badge with colored variants
  variants:
    Approved: success
    Rejected: destructive
    default: outline

# Categorical with plain text (default behavior)
category:
  type: categorical      # IN/NOT IN filtering, renders as plain text
```

**Available renderAs values**: Any column type, plus `"chip"` for Badge rendering.

### Configuration Options

```yaml
config:
  render: currency           # Render type
  currency: DOT              # Currency symbol
  decimals: 2                # Decimal places
  color: green               # Text color (green, red, blue, etc.)
  truncate: true             # Truncate long values
  showCopy: true             # Show copy button
  relative: true             # Use relative time (date render)
```

## Table-Specific Overrides

Override column rendering per-table using `columnOverrides` prop:

```tsx
const columnOverrides = {
  type: {
    header: "Spending Type",
    cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
  },
  DOT_latest: {
    header: "DOT Value",
    cell: ({ row }) => formatCurrency(row.original.DOT_latest, "DOT", 2),
  },
};

<DataTable
  queryConfig={queryConfig}
  tableName="spending"
  columnOverrides={columnOverrides}
/>
```

## Global Column Config

Define global column configurations in `column-config.yaml`:

```yaml
columns:
  id:
    header: "ID"
    render: number
    decimals: 0

  title:
    header: "Title"
    render: text
    maxLength: 100
```

## Implementation Details

**Location**: `frontend/src/lib/auto-columns.ts`

**Column generation flow**:
1. Parse `QueryConfig.columns` to get selected columns
2. For each column:
   - Check table-specific overrides first
   - Check global columns config
   - Check pattern-based rules
   - Fall back to default text rendering
3. Apply `columnMapping` if specified (dashboard components)
4. Cache column definitions with `useMemo`

**Performance**:
- Column definitions generated once and cached
- Pattern matching happens only during column generation
- No runtime overhead for rendering

## Column Mapping

For dashboard components with computed columns, use `columnMapping` to map query result columns to format patterns:

```typescript
const columnMapping = {
  total_spending: "DOT_latest",      // Map to DOT currency format
  proposal_count: "id",               // Map to number format
  last_update: "latest_status_change" // Map to date format
};
```

This allows custom query columns to inherit formatting from known column patterns.

## See Also

- [DataTable System](./table-systems.md) - Overall table architecture
- [DataTable Howto](../../howtos/data-table.md) - Usage guide
- [Column Config YAML](../../../frontend/public/config/column-config.yaml) - Full configuration file
