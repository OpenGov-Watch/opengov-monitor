# Formatting Specification

This document specifies the behavior of frontend formatting utilities for unit testing.

---

## Utils Library (`lib/utils.ts`)

### cn(...inputs)

Merges Tailwind CSS class names using `clsx` + `tailwind-merge`.

| Input | Expected Output |
|-------|-----------------|
| `"p-4", "m-2"` | `"p-4 m-2"` |
| `"p-4", "p-8"` | `"p-8"` (tailwind-merge dedupes) |
| `"text-red-500", false, "font-bold"` | `"text-red-500 font-bold"` |
| `{ "hidden": true }` | `"hidden"` |
| `{ "hidden": false }` | `""` |

### formatNumber(value)

Formats numeric values with US locale and max 2 decimal places.

| Input | Expected Output |
|-------|-----------------|
| `1234567` | `"1,234,567"` |
| `1234.5678` | `"1,234.57"` |
| `0` | `"0"` |
| `null` | `"-"` |
| `undefined` | `"-"` |
| `1000000.999` | `"1,000,001"` |
| `-5000` | `"-5,000"` |

**Implementation:**
```javascript
new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)
```

### formatCurrency(value)

Formats as USD currency with no decimal places.

| Input | Expected Output |
|-------|-----------------|
| `1234567` | `"$1,234,567"` |
| `1234.99` | `"$1,235"` |
| `0` | `"$0"` |
| `null` | `"-"` |
| `-5000` | `"-$5,000"` |

**Implementation:**
```javascript
new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(value)
```

### formatDate(value)

Formats ISO date string to "Mon DD, YYYY" format.

| Input | Expected Output |
|-------|-----------------|
| `"2024-01-15T12:00:00Z"` | `"Jan 15, 2024"` |
| `"2024-12-31"` | `"Dec 31, 2024"` |
| `null` | `"-"` |
| `""` | `"-"` |

**Implementation:**
```javascript
new Date(value).toLocaleDateString("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
})
```

### formatDateTime(value)

Formats ISO datetime string to "Mon DD, YYYY, HH:MM AM/PM" format.

| Input | Expected Output (varies by timezone) |
|-------|-------------------------------------|
| `"2024-01-15T14:30:00Z"` | `"Jan 15, 2024, 02:30 PM"` (UTC) |
| `"2024-06-01T08:00:00Z"` | `"Jun 1, 2024, 08:00 AM"` (UTC) |
| `null` | `"-"` |
| `""` | `"-"` |

**Implementation:**
```javascript
new Date(value).toLocaleString("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
```

**Note:** Output depends on browser timezone. Tests should mock timezone or test structure rather than exact output.

---

## Export Library (`lib/export.ts`)

### exportToCSV(data, filename)

Exports array of objects to CSV file.

**Behavior:**
1. Empty array → Returns immediately (no download)
2. Headers extracted from first object's keys
3. Values converted to strings
4. Special characters escaped:
   - Contains `,`, `"`, or `\n` → Wrap in quotes
   - Contains `"` → Double the quotes (`"` → `""`)
5. `null`/`undefined` → Empty string
6. Triggers file download with `.csv` extension

| Data | Expected CSV Content |
|------|---------------------|
| `[{a: 1, b: 2}]` | `a,b\n1,2` |
| `[{name: "A,B"}]` | `name\n"A,B"` |
| `[{name: 'Say "hi"'}]` | `name\n"Say ""hi"""` |
| `[{val: null}]` | `val\n` |
| `[]` | (no output) |

### exportToJSON(data, filename)

Exports data to pretty-printed JSON file.

**Behavior:**
1. Uses `JSON.stringify(data, null, 2)` for formatting
2. Triggers file download with `.json` extension

### downloadFile(content, filename, mimeType)

Internal function that creates and triggers file download.

**Behavior:**
1. Creates Blob with content and mimeType
2. Creates object URL
3. Creates hidden anchor element
4. Sets href and download attributes
5. Appends to body, clicks, removes
6. Revokes object URL

**Testing approach:** Mock DOM APIs (Blob, URL.createObjectURL, createElement)

---

## Column Renderer (`lib/column-renderer.ts`)

### getColumnConfig(tableName, columnName)

Returns render configuration for a column with priority:
1. Table-specific config (`config.tables[table][column]`)
2. Global column config (`config.columns[column]`)
3. Auto-detected config

### Auto-Detection Rules

| Pattern | Detected Config |
|---------|-----------------|
| `DOT_*` | `{ render: "currency", currency: "DOT", decimals: 0 }` |
| `USD_*` | `{ render: "currency", currency: "USD", decimals: 0 }` |
| `USDC_*` | `{ render: "currency", currency: "USDC", decimals: 2 }` |
| `USDT_*` | `{ render: "currency", currency: "USDT", decimals: 2 }` |
| `*_time`, `*_date`, `createdat` | `{ render: "date", format: "date" }` |
| `status`, `*_status` | `{ render: "badge", variants: {...} }` |
| `beneficiary`, `address`, `who`, `*_address` | `{ render: "address", truncate: true }` |
| (default) | `{ render: "text" }` |

### getColumnDisplayName(tableName, columnName)

Returns display name with priority:
1. Config-defined `displayName`
2. Auto-generated from column name

**Auto-generation rules:**
- Replace `_` with space
- Replace `.` with space
- Capitalize first letter of each word
- Uppercase: DOT, USD, USDC, USDT

| Column Name | Display Name |
|-------------|--------------|
| `proposal_time` | `"Proposal Time"` |
| `DOT_latest` | `"DOT Latest"` |
| `tally.ayes` | `"Tally Ayes"` |
| `USD_proposal_time` | `"USD Proposal Time"` |

### formatValue(value, config)

Formats value based on render type.

| Render Type | Function Called |
|-------------|-----------------|
| `currency` | `formatCurrencyValue()` |
| `number` | `formatNumberValue()` |
| `date` | `formatDateValue()` |
| `address` | `formatAddressValue()` |
| `text`/other | `String(value)` |

### formatCurrencyValue(value, config)

All currencies use the format `"X,XXX CURRENCY"` (value followed by currency code).

| Value | Currency | Decimals | Expected |
|-------|----------|----------|----------|
| `1234567` | DOT | 0 | `"1,234,567 DOT"` |
| `1234.56` | USD | 0 | `"1,235 USD"` |
| `1234.567` | USDC | 2 | `"1,234.57 USDC"` |
| `null` | any | any | `"-"` |

### formatNumberValue(value, config)

| Value | Decimals | Expected |
|-------|----------|----------|
| `1234.5678` | 2 | `"1,234.57"` |
| `1234` | 2 | `"1,234"` |
| `null` | any | `"-"` |

### formatDateValue(value, config)

| Value | Format | Expected |
|-------|--------|----------|
| `"2024-01-15T12:00:00Z"` | `date` | `"Jan 15, 2024"` |
| `"2024-01-15T12:00:00Z"` | `datetime` | `"Jan 15, 2024, 12:00 PM"` |
| `""` | any | `"-"` |

### formatAddressValue(value, config)

| Value | Truncate | Expected |
|-------|----------|----------|
| `"1234567890ABCDEF1234567890ABCDEF"` | `true` | `"12345678...ABCDEF"` |
| `"short"` | `true` | `"short"` (no truncation if < 16 chars) |
| `"1234567890ABCDEF1234567890ABCDEF"` | `false` | Full address |
| `""` | any | `"-"` |

### formatAbbreviated(value, config)

Formats large numbers with K/M/B suffixes for chart axes. All currencies use suffix format.

| Value | Currency | Expected |
|-------|----------|----------|
| `1500000000` | USD | `"1.5B USD"` |
| `1500000000` | DOT | `"1.5B DOT"` |
| `2500000` | USD | `"2.5M USD"` |
| `2500000` | null | `"2.5M"` |
| `1500` | USD | `"1.5K USD"` |
| `150` | USD | `"150 USD"` |
| `null` | any | `"-"` |

**Thresholds:**
- >= 1,000,000,000 → B suffix
- >= 1,000,000 → M suffix
- >= 1,000 → K suffix
- < 1,000 → No suffix

### getBadgeVariant(value, config)

Returns badge variant for status values.

| Value | Config Variants | Expected |
|-------|-----------------|----------|
| `"Executed"` | `{Executed: "success", ...}` | `"success"` |
| `"Unknown"` | `{default: "outline", ...}` | `"outline"` |
| `"Unknown"` | `{}` | `"outline"` |

### getLinkUrl(value, config, row)

Generates URL for link columns.

| Config | Row | Expected |
|--------|-----|----------|
| `{urlField: "url"}` | `{url: "https://..."}` | `"https://..."` |
| `{urlTemplate: "/item/{value}"}` | - | `"/item/{value}"` with value interpolated |
| `{}` | - | `null` |

---

## Test Scenarios

### Happy Path

| Function | Test |
|----------|------|
| `formatNumber(1234567)` | Returns `"1,234,567"` |
| `formatCurrency(1234)` | Returns `"$1,234"` |
| `formatDate("2024-01-15")` | Returns `"Jan 15, 2024"` |
| `exportToCSV([{a:1}], "test")` | Creates CSV, triggers download |

### Edge Cases

| Function | Input | Expected |
|----------|-------|----------|
| `formatNumber(null)` | null | `"-"` |
| `formatNumber(0)` | zero | `"0"` |
| `formatNumber(-1234)` | negative | `"-1,234"` |
| `formatCurrency(0.4)` | rounds | `"$0"` |
| `formatCurrency(0.5)` | rounds | `"$1"` |
| `formatDate("")` | empty | `"-"` |
| `exportToCSV([], "x")` | empty array | No download triggered |

### CSV Escaping

| Input | Expected CSV Cell |
|-------|-------------------|
| `"Hello"` | `Hello` |
| `"Hello,World"` | `"Hello,World"` |
| `'Say "hi"'` | `"Say ""hi"""` |
| `"Line1\nLine2"` | `"Line1\nLine2"` |
| `null` | (empty) |

### Column Auto-Detection

| Column Name | Expected Render Type |
|-------------|---------------------|
| `DOT_proposal_time` | `currency` with DOT |
| `USD_latest` | `currency` with USD |
| `proposal_time` | `date` |
| `status` | `badge` |
| `beneficiary` | `address` |
| `title` | `text` |

---

## Dashboard Column Mapping

When dashboard components execute queries with aggregations, the result column names differ from source columns:

| Source Column | Aggregation | Result Column |
|---------------|-------------|---------------|
| `USD_latest` | `SUM` | `sum_usd_latest` |
| `DOT_latest` | `AVG` | `avg_dot_latest` |
| `amount` | `COUNT` | `count_amount` |

The auto-detection patterns (e.g., `USD_*`) won't match aggregated column names like `sum_usd_latest`.

### Solution: Column Mapping

Dashboard components pass a `columnMapping` prop to charts and tables that maps result column keys back to source columns:

```typescript
// Built from QueryConfig.columns
const columnMapping = {
  "sum_usd_latest": "USD_latest",
  "avg_dot_latest": "DOT_latest"
};

// Used in config lookup
const sourceColumn = columnMapping[resultColumn] ?? resultColumn;
const config = getColumnConfig(tableName, sourceColumn);
```

### Components Using Column Mapping

| Component | Prop | Usage |
|-----------|------|-------|
| `DashboardDataTable` | `columnMapping` | Cell formatting |
| `DashboardBarChart` | `columnMapping` | Tooltip & Y-axis formatting |
| `DashboardLineChart` | `columnMapping` | Tooltip & Y-axis formatting |
| `DashboardPieChart` | `columnMapping` | Tooltip formatting |
