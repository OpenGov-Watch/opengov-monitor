# Working with Table Views

Save and share table configurations.

## Quick Reference

### ViewState Properties

| Property | Purpose | Example |
|----------|---------|---------|
| sorting | Sort order | `[{ id: "id", desc: true }]` |
| columnFilters | Quick filters | `[]` |
| columnVisibility | Hidden columns | `{ notes: false }` |
| pagination | Page settings | `{ pageIndex: 0, pageSize: 100 }` |
| filterGroup | Advanced filters | `{ operator: "AND", conditions: [...] }` |
| groupBy | Grouping | `"status"` |

### SavedView Properties

| Property | Required | Default | Purpose |
|----------|----------|---------|---------|
| name | Yes | - | Display name |
| state | Yes | - | ViewState object |
| deletable | No | true | Can user delete? |

## Defining Default Views

### Single View (Treasury)

```typescript
const defaultTreasuryViews: SavedView[] = [
  {
    name: "All",
    deletable: false,
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      pagination: { pageIndex: 0, pageSize: 100 },
    },
  },
];

<DataTable defaultViews={defaultTreasuryViews} ... />
```

### Multiple Views with Filters (Referenda)

```typescript
const defaultReferendaViews: SavedView[] = [
  {
    name: "All",
    deletable: false,
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      pagination: { pageIndex: 0, pageSize: 100 },
    },
  },
  {
    name: "Spends",
    deletable: false,
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      pagination: { pageIndex: 0, pageSize: 100 },
      filterGroup: {
        operator: "AND",
        conditions: [
          { column: "DOT_proposal_time", operator: ">", value: 0 },
          { column: "status", operator: "=", value: "Executed" },
        ],
      },
    },
  },
];
```

## User Operations

### Creating Views

1. Configure table (filters, sorting, etc.)
2. Click "+ Save" button
3. Enter view name → Save

### Switching Views

- Desktop: Click tab
- Mobile: Select from dropdown

### Deleting Views

- Hover view tab → Click trash icon
- Protected views (`deletable: false`) have no delete button

## URL Sharing

Copy URL to share current view state:

```
/referenda?view=eyJzb3J0aW5nIjpbeyJpZCI6ImlkIiwiZGVzYyI6dHJ1ZX1dLC4uLn0=
```

Recipients see exact same filters/sorting.

## Troubleshooting

### Reset to Defaults

Clear localStorage to reset views:

```javascript
localStorage.removeItem('opengov-views-referenda');
```

### Views Not Syncing

- Check browser allows localStorage
- Verify tableName matches between pages

## See Also

- [Table Views Architecture](../03_design/frontend/table-views.md)
- [DataTable Guide](./data-table.md)
- [Advanced Filters](./filters-advanced.md)
