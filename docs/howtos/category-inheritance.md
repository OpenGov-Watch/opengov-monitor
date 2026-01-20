# Category Inheritance

How to display inherited parent categories in child entity tables with optimistic UI updates.

## Problem

Child bounties can inherit their category from their parent bounty. When `category_id` is NULL, the UI should show the parent's category as a grayed placeholder, while still allowing the user to override it.

## Solution

Use `editConfig` with `parentCategoryColumn` and `parentSubcategoryColumn` to enable parent category inheritance while preserving optimistic UI updates.

```typescript
const editConfig: DataTableEditConfig | undefined = useMemo(() => {
  if (!isAuthenticated) return undefined;
  return {
    idField: "identifier",
    editableColumns: {
      category_id: {
        type: "category-selector",
        categories,
        onUpdate: async (id, val) => {
          await api.childBounties.update(id, { category_id: val });
        },
        // Tell auto-columns which columns have parent category data
        parentCategoryColumn: "parentCategory",
        parentSubcategoryColumn: "parentSubcategory",
      },
    },
  };
}, [isAuthenticated, categories]);
```

The query must include parent category data via JOINs:

```typescript
const queryConfig = useMemo(() => ({
  sourceTable: "Child Bounties",
  columns: [
    { column: "identifier" },
    { column: "category_id" },
    { column: "c.category", alias: "category" },
    { column: "c.subcategory", alias: "subcategory" },
    // Parent category data
    { column: "parent_cat.category", alias: "parentCategory" },
    { column: "parent_cat.subcategory", alias: "parentSubcategory" },
  ],
  joins: [
    { type: "LEFT", table: "Categories", alias: "c",
      on: { left: "Child Bounties.category_id", right: "c.id" } },
    { type: "LEFT", table: "Bounties", alias: "b",
      on: { left: "Child Bounties.parentBountyId", right: "b.id" } },
    { type: "LEFT", table: "Categories", alias: "parent_cat",
      on: { left: "b.category_id", right: "parent_cat.id" } },
  ],
}), []);
```

## Why Not Use columnOverrides?

Using `columnOverrides` with a custom cell renderer **breaks optimistic UI updates**.

DataTable wraps `editConfig.onUpdate` handlers with optimistic update logic in `editConfigWithRefresh`. When you use a custom cell with its own `onChange` handler, it bypasses this mechanism:

```typescript
// DON'T DO THIS - breaks optimistic updates
const columnOverrides = {
  category_id: {
    cell: ({ row }) => (
      <CategorySelector
        onChange={async (val) => {
          await api.update(row.id, { category_id: val }); // Direct API call
        }}  // No local state update = UI doesn't refresh until next refetch
      />
    ),
  },
};
```

## Behavior

| State | Category Column | Subcategory Column |
|-------|-----------------|-------------------|
| Own category set | Shows selected category | Shows selected subcategory (NULL = "Other") |
| No category (parent exists) | Shows parent category (grayed) | Shows parent subcategory (grayed, NULL = "Other") |
| No category (no parent) | Shows "None" | Disabled |

**NULL Subcategory Display:** A NULL subcategory is displayed as "Other" in the UI. This is the default subcategory for each category.

## Example

See `src/frontend/src/pages/child-bounties.tsx` for complete implementation.
