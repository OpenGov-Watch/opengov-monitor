# Form Specifications

Form fields, validation rules, and input behaviors for manage section pages.

## Categories Form (`/manage/categories`)

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| category | text | yes | Parent category name |
| subcategory | text | no | NULL represents "Other" |

### Validation
- Category field required
- Default "Other" subcategory cannot be deleted
- Delete requires confirmation dialog

---

## Bounties Form (`/manage/bounties`)

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | number | yes (create) | Disabled when editing |
| name | text | no | |
| category_id | cascading dropdown | no | Category → subcategory |
| remaining_dot | decimal | no | |

### Validation
- ID required for creation, immutable on edit
- Category change resets subcategory selection
- Subcategories sorted: alphabetical, then "Other" at end

---

## Subtreasury Form (`/manage/subtreasury`)

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | text | yes | |
| description | textarea | no | |
| DOT_latest | decimal | no | Step: 0.0001 |
| USD_latest | decimal | no | Step: 0.01 |
| DOT_component | decimal | no | Step: 0.0001 |
| USDC_component | decimal | no | Step: 0.01 |
| USDT_component | decimal | no | Step: 0.01 |
| category_id | cascading dropdown | no | |
| latest_status_change | date | no | |

### Validation
- Title required
- Numeric fields: decimal precision enforced
- Empty numeric fields parsed to NULL

---

## Custom Spending Form (`/manage/custom-spending`)

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | dropdown | yes | 6 spending types |
| title | text | yes | |
| description | textarea | no | |
| latest_status_change | date | no | |
| DOT_latest | decimal | no | |
| USD_latest | decimal | no | |
| DOT_component | decimal | no | |
| USDC_component | decimal | no | |
| USDT_component | decimal | no | |
| category_id | cascading dropdown | no | |

### Spending Types
1. Direct Spend
2. Claim
3. Bounty
4. Subtreasury
5. Fellowship Salary
6. Fellowship Grants

### Display
- ID shown as `custom-{id}` format

---

## Custom Tables Form (`/manage/custom-tables`)

### Table Creation Wizard

1. **Upload**: CSV file via drag-drop or file picker
2. **Schema**: Configure column names, types, nullability
3. **Confirm**: Set display name, create table

### Column Types
- text, integer, real, date, boolean

### Row Editing
- Dynamic form based on column types
- Nullable columns allow empty values
- Boolean displayed as Yes/No dropdown

### Pagination
- 50 rows per page

---

## Cascading Dropdown Behavior

Used in: Bounties, Subtreasury, Custom Spending, Referenda editing, Child Bounties editing

1. Category selection resets subcategory
2. Auto-select subcategory when only one option exists
3. "Other" subcategory always sorted last
4. Subcategories sorted alphabetically (then "Other")

---

## CSV Import Specifications

### Column Requirements by Source

| Source | Required Columns |
|--------|------------------|
| Categories | category, subcategory |
| Referenda | id, category, subcategory, notes, hide_in_spends |
| Child Bounties | identifier, category, subcategory, notes, hide_in_spends |
| Bounties | id, name, category, subcategory |
| Treasury Netflows | month, asset_name, flow_type, amount_usd, amount_dot_equivalent |
| Custom Spending | id, type, title, description, latest_status_change, DOT_latest, USD_latest, DOT_component, USDC_component, USDT_component, category, subcategory |

### Boolean Parsing

`hide_in_spends` accepts: `0`, `1`, `true`, `false`, `x`, `yes`

### Import Behaviors

| Source | Behavior |
|--------|----------|
| Categories | Merge |
| Referenda | Merge |
| Child Bounties | Merge |
| Bounties | Merge |
| Treasury Netflows | Replace |
| Cross Chain Flows | Replace |
| Local Flows | Replace |
| Custom Spending | Merge |

### Validation Rules
- File required before import
- Minimum 1 valid row
- Headers must match expected format
- Pre-validation rejects entire import if any category references don't exist
- Error messages show first 10 violations with row numbers
- All-or-nothing transaction semantics (no partial imports)

---

## Common Form Patterns

### Form Dialogs
- Single dialog component for create/edit operations
- Cancel button reverts changes
- Submit validates and saves
- Loading state disables form during submission

### Delete Confirmation
- Confirmation dialog required before deletion
- Shows item identifier in message
- Handles API errors gracefully

### Error Handling
- Toast notifications for success/error
- Error messages from API displayed to user
- Form validation before submission
