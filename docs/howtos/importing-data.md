# Importing Data

Bulk data import via CSV files or pre-curated defaults.

## Overview

**Importable entities:**
- Categories
- Referenda (category assignments)
- Bounties (category assignments)
- Child Bounties (category assignments)
- Treasury Netflows
- Cross-Chain Flows
- Local Flows

**Import methods:**
1. **Upload CSV** - Custom CSV file upload
2. **Apply Defaults** - Pre-curated data from `data/defaults/`

**Import order:** Always import Categories first, then entity categories.

## CSV File Formats

### Categories

```csv
category,subcategory
Development,Infrastructure
Development,Smart Contracts
Outreach,Events
```

- `category`: Required
- `subcategory`: Optional (empty = top-level category placeholder)

### Referenda

```csv
id,category,subcategory,notes,hide_in_spends
1,Development,Infrastructure,,0
2,Outreach,Events,Example note,1
3,,,,0
```

- `id`: Referendum ID (required)
- `category`/`subcategory`: Both empty = no category (NULL)
- `notes`: Optional text
- `hide_in_spends`: 0 or 1

**Alternative column names supported:**
- `#` → `id`
- `Category` → `category`
- `Subcategory` → `subcategory`
- `Notes`/`NOTE` → `notes`
- `hide from income statement` → `hide_in_spends`

### Bounties

```csv
id,name,category,subcategory
10,Polkadot Pioneers Bounty,Development,Polkadot Protocol & SDK
11,Anti-Scam Bounty,Research,Anti-Scam
13,Security Bug Bounty,,
```

- `id`: Bounty ID (required)
- `name`: Bounty name
- `category`/`subcategory`: Both empty = no category

### Child Bounties

```csv
identifier,category,subcategory,notes,hide_in_spends
33-1193,Outreach,Advertising,,0
17-111,Talent & Education,PBA,,0
```

- `identifier`: Format `{parentBountyId}-{childIndex}` (required)
- Fields same as Referenda

**Note:** Hyphens in identifiers are normalized to underscores on import.

### Boolean Fields

`hide_in_spends` accepts:
- `1`, `true`, `x`, `yes` → 1 (hide)
- `0`, `false`, empty, other → 0 (show)

### Empty Category = NULL

To clear a category assignment, use empty strings for **both** fields:
```csv
id,category,subcategory
42,,
```

## Apply Defaults

Pre-curated CSV files in `data/defaults/`:

| File | Entity | Purpose |
|------|--------|---------|
| `categories.csv` | Categories | Master category list |
| `referenda-categories.csv` | Referenda | Category assignments |
| `bounties-categories.csv` | Bounties | Category assignments |
| `child-bounties-categories.csv` | Child Bounties | Category assignments |
| `polkadot_treasury_netflows_*.csv` | Treasury Netflows | Quarterly flow data |
| `cross chain flows.csv` | Cross-Chain Flows | XCM transfer data |
| `local flows.csv` | Local Flows | On-chain transfer data |

**Usage:**
1. Navigate to `/manage/sync-settings`
2. Find the entity's card
3. Click "Apply Defaults"

**Updating default files:**
1. Edit CSV in `data/defaults/`
2. Run audit script: `python src/backend/scripts/audit_category_data.py`
3. Commit changes

## API Reference

### Import Endpoints

**Categories:**
```bash
POST /api/categories/import
Content-Type: application/json

[
  {"category": "Development", "subcategory": "Infrastructure"},
  {"category": "Outreach", "subcategory": "Events"}
]

# Response
{"success": true, "count": 2}
```

**Referenda:**
```bash
POST /api/referenda/import
Content-Type: application/json

{"items": [
  {"id": 1, "category": "Development", "subcategory": "Infrastructure", "notes": "", "hide_in_spends": 0},
  {"id": 2, "category": "Outreach", "subcategory": "Events", "notes": "Note", "hide_in_spends": 1}
]}

# Response
{"success": true, "count": 2}
```

**Bounties:**
```bash
POST /api/bounties/import
Content-Type: application/json

{"items": [
  {"id": 10, "category": "Development", "subcategory": "SDK"}
]}
```

**Child Bounties:**
```bash
POST /api/child-bounties/import
Content-Type: application/json

{"items": [
  {"identifier": "33-1193", "category": "Outreach", "subcategory": "Advertising", "notes": "", "hide_in_spends": 0}
]}
```

### Defaults Endpoints

Serve raw CSV content from `data/defaults/`:

```bash
GET /api/sync/defaults/categories
GET /api/sync/defaults/referenda
GET /api/sync/defaults/bounties
GET /api/sync/defaults/child-bounties
GET /api/sync/defaults/treasury-netflows
GET /api/sync/defaults/cross-chain-flows
GET /api/sync/defaults/local-flows

# Response
{"content": "id,category,subcategory,..."}
```

### Category Lookup

Find or create a category by strings (used for backwards-compatible imports):

```bash
POST /api/categories/lookup
Content-Type: application/json

{"category": "Development", "subcategory": "Infrastructure"}

# Response (existing)
{"id": 1}

# Response (created)
{"id": 42, "created": true}
```

## Troubleshooting

### "Import rejected: X row(s) reference non-existent categories"

**Cause:** CSV references category/subcategory pairs not in Categories table.

**Solution:**
1. Import categories first: Apply Defaults for Categories
2. Verify categories exist in `/manage/sync-settings` → Categories
3. Fix CSV data to use existing category names

### "No valid rows found in CSV"

**Cause:** Parser couldn't find required columns or all rows filtered out.

**Solution:**
- Check column names match expected format (see CSV formats above)
- Ensure required fields (`id` or `identifier`) are present
- Check for encoding issues (use UTF-8)

### Child bounty identifier mismatch

**Cause:** Using wrong separator (hyphen vs underscore).

**Solution:** Use hyphen in CSV files (`33-1193`). Backend normalizes to underscore.

### Duplicate category error

**Cause:** CSV contains duplicate `(category, subcategory)` pairs.

**Solution:** Categories import uses `INSERT OR IGNORE` - duplicates are silently skipped. For entity imports, ensure each row has unique identifier.

## See Also

- [Import System Design](../03_design/api/import-system.md) - Architecture details
- [Managing Categories](categories.md) - Category CRUD, inheritance
- [data/defaults/README.md](../../data/defaults/README.md) - Default file conventions
