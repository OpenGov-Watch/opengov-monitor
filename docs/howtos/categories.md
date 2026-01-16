# Managing Categories

Categories organize spending data with a two-level hierarchy: category → subcategory. All spending entities (Referenda, Bounties, Child Bounties, Subtreasury, Custom Spending) can be tagged with categories.

## Overview

**Category Structure:**
```
Development
  ├─ Infrastructure
  ├─ Smart Contracts
  └─ Other

Outreach
  ├─ Events
  ├─ Content Creation
  └─ Other
```

**Database Model:**
- Categories table: `(id, category, subcategory)` with unique constraint on pair
- Entities reference via `category_id` foreign key
- NULL `category_id` = no category assigned

## Managing Categories

### Via UI (Sync Settings)

**Location:** `/manage/sync-settings` → Categories section

**Add/Edit/Delete:**
1. Navigate to Sync Settings
2. Scroll to Categories card
3. Use table actions (pencil/trash icons) to modify
4. Changes saved immediately

**Bulk Import:**
1. Prepare CSV file:
   ```csv
   category,subcategory
   Development,Infrastructure
   Development,Other
   Outreach,Events
   ```
2. Upload via Categories sync card
3. System validates unique constraint before import
4. Duplicate pairs rejected with error message

### Via API

**Endpoints:** See [src/api/src/routes/categories.ts](../../src/api/src/routes/categories.ts)

```bash
# List all
GET /api/categories

# Create
POST /api/categories
{"category": "Development", "subcategory": "Infrastructure"}

# Update
PATCH /api/categories/:id
{"category": "Development", "subcategory": "Smart Contracts"}

# Delete
DELETE /api/categories/:id

# Lookup category_id
POST /api/categories/lookup
{"category": "Development", "subcategory": "Infrastructure"}
# Returns: {"id": 1}
```

## Apply Defaults Workflow

The "Apply Defaults" feature imports pre-curated category assignments from CSV files in `data/defaults/`.

**Process Flow:**
1. User clicks "Apply Defaults" for an entity type (e.g., Referenda)
2. Frontend fetches CSV via `GET /api/sync/defaults/referenda-categories.csv`
3. Frontend parses CSV and resolves category strings to IDs via `POST /api/categories/lookup`
4. Frontend sends resolved data to `POST /api/referenda/import`
5. Backend validates all category references exist
6. If validation passes, transaction updates all rows
7. If validation fails, entire import rejected with 400 error

**CSV Format (Entity Categories):**
```csv
id,category,subcategory,notes,hide_in_spends
1,Development,Infrastructure,,0
2,Outreach,Events,Example note,1
3,,,,0
```

**Special Case:** Empty category + subcategory (`,,`) = NULL category_id (no category)

## Import Validation Rules

**Pre-Import Validation:**

All bulk imports (`POST /api/{entity}/import`) validate category references **before** database transaction:

1. **Skip validation for empty pairs:**
   - `category=""` AND `subcategory=""` → Allowed (NULL category_id)

2. **Validate non-empty pairs:**
   - `category="X"` AND `subcategory="Y"` → Must exist in Categories table
   - Missing pair → Add to violations list

3. **Reject on violations:**
   - Any violations → HTTP 400 with detailed error message
   - Shows first 10 violations with row numbers and values
   - No database changes made

**Example Error:**
```
Import rejected: 3 row(s) reference non-existent categories.
First 10 violations:
  Row 165: referendum 352 → category="", subcategory="PBA"
  Row 200: referendum 400 → category="InvalidCat", subcategory="Infrastructure"
```

## Category Assignment by Entity Type

| Entity | Assignment Method | Inheritance |
|--------|------------------|-------------|
| Referenda | Manual or bulk import | None |
| Bounties | Manual or bulk import | None |
| Child Bounties | Manual, bulk import, or parent | Inherits from parent if NULL |
| Subtreasury | Manual | None |
| Custom Spending | Manual (required on creation) | None |
| Treasury Spends | Via parent referendum | From referendum's category |
| Fellowship | N/A (hardcoded in all_spending view) | None |

**Child Bounty Inheritance:** See [src/api/src/db/queries.ts:findCategoryForChildBounty](../../src/api/src/db/queries.ts)

## Validation Script

Audit category data consistency across CSV files:

```bash
# Run audit
python src/backend/scripts/audit_category_data.py

# Auto-fix unambiguous issues
python src/backend/scripts/audit_category_data.py --fix
```

**Output:**
- Auto-fixable: Subcategory exists under exactly one category
- Ambiguous: Subcategory exists under multiple categories (manual review)
- Error: Subcategory doesn't exist in categories.csv

## Common Issues

**Issue: Import rejected with category validation errors**

Cause: CSV references category/subcategory pairs not in Categories table

Solution:
1. Import Categories first: Apply Defaults for Categories
2. Verify categories exist: Check `/manage/sync-settings` Categories card
3. Fix CSV data: Ensure all pairs exist before entity import

**Issue: Child bounty shows wrong category**

Cause: Category inheritance from parent bounty

Solution: Explicitly set child bounty category (overrides inheritance)

**Issue: Duplicate category error on bulk import**

Cause: CSV contains duplicate `(category, subcategory)` pairs

Solution: Remove duplicates from CSV or use audit script to identify conflicts

## Best Practices

1. **Import order:** Always import Categories before entity categories
2. **Naming consistency:** Use consistent capitalization (Categories are case-sensitive)
3. **"Other" subcategories:** Ensure every category has an "Other" subcategory for UI fallbacks
4. **Empty vs NULL:** Use `""` for both fields to represent "no category", not just one field
5. **Validation:** Run audit script after editing default CSV files manually

## See Also

- [data-models.md](../02_specification/data-models.md#categories) - Categories table specification
- [business-rules.md](../01_requirements/business-rules.md) - Spending categorization rules
- [src/api/src/db/queries.ts](../../src/api/src/db/queries.ts) - Import/validation implementation
