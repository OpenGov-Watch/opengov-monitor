# Column Configuration System Reference

> **Status**: Stub - To be expanded with complete configuration reference

## Overview

The column configuration system provides automatic formatting for table columns based on naming patterns and explicit configuration.

## Configuration File

**Location**: `frontend/public/config/column-config.yaml`

## Pattern Types

### Exact Match
```yaml
- match: exact
  pattern: "status"
  config:
    render: badge
```

### Prefix Match
```yaml
- match: prefix
  pattern: "DOT_"
  config:
    render: currency
    currency: DOT
    decimals: 0
```

### Suffix Match
```yaml
- match: suffix
  pattern: "_status"
  config:
    render: badge
```

### Substring Match
```yaml
- match: substring
  pattern: "_time"
  config:
    render: date
```

## Render Types

### Currency
```yaml
render: currency
currency: DOT | USD | USDC | USDT
decimals: 0 | 2 | 4
```

### Number
```yaml
render: number
decimals: 0 | 2
color: green | red | default
```

### Date
```yaml
render: date
format: date | datetime
```

### Badge
```yaml
render: badge
variants:
  Executed: success
  Rejected: destructive
  Ongoing: default
```

### Address
```yaml
render: address
truncate: true
```

### Link
```yaml
render: link
external: true
```

## Priority Order

1. Table-specific column config
2. Global column config
3. Pattern-based detection
4. Default (text)

## Configuration Example

```yaml
# Global columns config
columns:
  DOT_latest:
    displayName: "DOT Value"
    render: currency
    currency: DOT
    decimals: 0

# Pattern-based config
patterns:
  - match: prefix
    pattern: "DOT_"
    config:
      render: currency
      currency: DOT
      decimals: 0

  - match: suffix
    pattern: ".ayes"
    config:
      render: number
      color: green
      decimals: 0

  - match: substring
    pattern: "_time"
    config:
      render: date

# Table-specific config
tables:
  referenda:
    "tally.ayes":
      render: number
      color: green
```

## Programmatic Configuration

### Column Renderer (TypeScript)

```typescript
// src/frontend/src/lib/column-renderer.ts

export interface ColumnRenderConfig {
  render: "text" | "number" | "currency" | "date" | "datetime" | "badge" | "address" | "link";
  decimals?: number;
  currency?: string;
  color?: string;
  // ... other options
}

// Get config for a column
const config = getColumnRenderConfig(columnId, tableName);
```

## Usage in Components

### Auto-Generated Columns
```typescript
// Automatically applies based on column name patterns
const columns = generateColumns(queryConfig, columnMapping);
```

### Manual Override
```typescript
const columnOverrides = {
  DOT_latest: {
    header: "Custom Header",
    cell: ({ row }) => <CustomComponent value={row.original.DOT_latest} />
  }
};
```

## Common Patterns

| Column Pattern | Render Type | Example |
|----------------|-------------|---------|
| `DOT_*` | currency | `DOT_latest` → "1,234 DOT" |
| `USD_*` | currency | `USD_value` → "$1,234" |
| `*_time` | date | `proposal_time` → "Jan 15, 2025" |
| `*_date` | date | `start_date` → "Jan 15, 2025" |
| `status` | badge | `status` → Colored badge |
| `*.ayes` | number (green) | `tally.ayes` → "1,234" |
| `*.nays` | number (red) | `tally.nays` → "567" |
| `beneficiary` | address | `beneficiary` → "0x1234...5678" |

## Adding New Patterns

1. Edit `frontend/public/config/column-config.yaml`
2. Add new pattern entry
3. Reload application

Example:
```yaml
patterns:
  - match: prefix
    pattern: "ETH_"
    config:
      render: currency
      currency: ETH
      decimals: 4
```

## Component Files

- `src/frontend/src/lib/column-renderer.ts` - Column rendering logic
- `src/frontend/src/lib/auto-columns.ts` - Auto-column generation
- `frontend/public/config/column-config.yaml` - Configuration file

## See Also

- [DataTable Specification](../../spec/frontend/data-table.md) - Column system overview
- [DataTable How-To](../../howtos/data-table.md) - Custom rendering examples
