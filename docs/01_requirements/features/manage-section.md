# Manage Section Requirements

Requirements for authenticated admin pages.

## Overview

Must provide 7 management pages for data curation, import, and system administration. All pages require authentication via `RequireAuth` wrapper.

---

## Categories Page (`/manage/categories`)

CRUD management for spending category taxonomy.

**User Capabilities:**
- Create category/subcategory pairs
- Edit existing categories
- Delete categories (with confirmation)
- View categories grouped by parent

**Validation Messages:**
- Category name is required
- Default "Other" subcategory cannot be deleted

---

## Bounties Page (`/manage/bounties`)

Edit bounty metadata and category assignments.

**User Capabilities:**
- Create bounty records with ID
- Edit bounty name, category, remaining DOT
- View all bounties

**Validation Messages:**
- ID is required for creation
- ID cannot be changed after creation

---

## Subtreasury Page (`/manage/subtreasury`)

CRUD for manual subtreasury spending entries.

**User Capabilities:**
- Create subtreasury entries
- Edit entry details and amounts
- Delete entries (with confirmation)

**Validation Messages:**
- Title is required

---

## Custom Spending Page (`/manage/custom-spending`)

CRUD for manual spending entries that integrate with all_spending view.

**User Capabilities:**
- Create custom spending entries
- Select from 6 spending types
- Edit entry details and amounts
- Delete entries (with confirmation)
- View entries in unified spending view

**Spending Types:**
1. Direct Spend
2. Claim
3. Bounty
4. Subtreasury
5. Fellowship Salary
6. Fellowship Grants

---

## Custom Tables Page (`/manage/custom-tables`)

Dynamic table creation with CSV import and schema inference.

**User Capabilities:**
- Upload CSV and create tables with inferred schema
- Configure column names, types, and nullability
- Edit individual rows
- Import additional data via CSV
- Delete tables and rows

**Column Types:** text, integer, real, date, boolean

---

## Sync Settings Page (`/manage/sync`)

Bulk import and database backup operations.

**User Capabilities:**
- Import data via CSV upload
- Apply curated default data
- Download database backup

**Import Sources:**
- Categories, Referenda, Bounties, Child Bounties
- Treasury Netflows, Cross-Chain Flows, Local Flows
- Custom Spending

**Validation Messages:**
- File is required before import
- At least 1 valid row required
- Headers must match expected format
- Error messages show first 10 violations with row numbers

---

## Data Errors Page (`/manage/data-errors`)

View data parsing and validation errors (read-only).

**User Capabilities:**
- View error records with table, type, and classification
- Filter by table name, error type, classification

**Classification Logic:**
- "Acceptable": status in (TimedOut, Rejected, Cancelled, Killed)
- "Needs Investigation": all others

---

## Common Patterns

### Form Dialogs
- Single dialog for create/edit operations
- Cancel reverts changes
- Loading state during submission

### Delete Confirmation
- Confirmation dialog required
- Shows item identifier in message

### Error Handling
- Toast notifications for success/error
- API error messages displayed to user

## See Also

- [Form Specifications](../../02_specification/frontend/form-specifications.md) - Form fields, validation rules, CSV specs
- [API Endpoints](../../02_specification/api/endpoints.md) - REST API details
- [User Stories](../user-stories.md) - US-10, US-11, US-14, US-15
- [Data Views](./data-views.md) - Public data pages
- [Authentication](./authentication.md) - Login and session
