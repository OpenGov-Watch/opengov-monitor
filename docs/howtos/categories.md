# Managing Categories

Categories organize spending data with a two-level hierarchy: category → subcategory. All spending entities (Referenda, Bounties, Child Bounties, Subtreasury, Custom Spending) can be tagged with categories.

## Overview

**Category Structure:**
```
Development
  ├─ Infrastructure
  ├─ Smart Contracts
  └─ Other (NULL subcategory)

Outreach
  ├─ Events
  ├─ Content Creation
  └─ Other (NULL subcategory)
```

**Database Model:**
- Categories table: `(id, category, subcategory)` with unique constraint on pair
- Entities reference via `category_id` foreign key
- NULL `category_id` = no category assigned
- NULL `subcategory` = "Other" (default subcategory, displayed as "Other" in UI)

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
   Development,
   Outreach,Events
   ```
   Note: Empty subcategory or "Other" text both stored as NULL (displayed as "Other")
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
3. **"Other" subcategories:** Each category automatically has a NULL subcategory (displayed as "Other")
4. **Cannot delete "Other":** The NULL subcategory row cannot be deleted (it's required for each category)
5. **Empty vs NULL:** Empty string subcategory converts to NULL (Other). Use `""` for category field to represent "no category"
6. **Validation:** Run audit script after editing default CSV files manually

## See Also

- [importing-data.md](importing-data.md) - Bulk imports, CSV formats, Apply Defaults
- [data-models.md](../02_specification/data-models.md#categories) - Categories table specification
- [business-rules.md](../01_requirements/business-rules.md) - Spending categorization rules
