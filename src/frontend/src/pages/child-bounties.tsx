import { useEffect, useState, useMemo } from "react";
import { api } from "@/api/client";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { subsquareUrls } from "@/lib/urls";
import { useAuth } from "@/contexts/auth-context";
import { SavedView } from "@/hooks/use-view-state";
import type {
  ChildBounty,
  Category,
  DataTableEditConfig,
} from "@/lib/db/types";

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" | "success" {
  switch (status?.toLowerCase()) {
    case "claimed":
    case "awarded":
      return "success";
    case "canceled":
    case "rejected":
      return "destructive";
    case "pendingpayout":
    case "active":
      return "secondary";
    default:
      return "outline";
  }
}

// Default views for Child Bounties
const defaultChildBountiesViews: SavedView[] = [
  {
    name: "All",
    deletable: false,
    state: {
      sorting: [{ id: "latest_status_change", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      pagination: { pageIndex: 0, pageSize: 100 },
    },
  },
];

export default function ChildBountiesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    api.categories.getAll().then(setCategories);
  }, []);

  const queryConfig = useMemo(
    () => ({
      sourceTable: "Child Bounties",
      columns: [
        { column: "identifier" },
        { column: "parentBountyId" },
        { column: "description" },
        { column: "status" },
        { column: "DOT" },
        { column: "USD_proposal_time" },
        { column: "proposal_time" },
        { column: "latest_status_change" },
        { column: "category_id" },
        { column: "c.category", alias: "category" },
        { column: "c.subcategory", alias: "subcategory" },
        { column: "notes" },
        { column: "hide_in_spends" },
        { column: "b.name", alias: "parentBountyName" },
        { column: "parent_cat.category", alias: "parentCategory" },
        { column: "parent_cat.subcategory", alias: "parentSubcategory" },
      ],
      joins: [
        {
          type: "LEFT" as const,
          table: "Categories",
          alias: "c",
          on: {
            left: "Child Bounties.category_id",
            right: "c.id",
          },
        },
        {
          type: "LEFT" as const,
          table: "Bounties",
          alias: "b",
          on: {
            left: "Child Bounties.parentBountyId",
            right: "b.id",
          },
        },
        {
          type: "LEFT" as const,
          table: "Categories",
          alias: "parent_cat",
          on: {
            left: "b.category_id",
            right: "parent_cat.id",
          },
        },
      ]
    }),
    []
  );

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
        notes: {
          type: "text",
          onUpdate: async (id, val) => {
            await api.childBounties.update(id, { notes: val });
          },
          placeholder: "Add notes...",
        },
        hide_in_spends: {
          type: "checkbox",
          onUpdate: async (id, val) => {
            await api.childBounties.update(id, { hide_in_spends: val });
          },
        },
      },
    };
  }, [isAuthenticated, categories]);

  const columnOverrides = useMemo(
    () => ({
      identifier: {
        header: "ID",
        cell: ({ row }: { row: any }) => (
          <a
            href={subsquareUrls.childBounty(row.original.identifier)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium w-[80px] hover:underline text-blue-600"
          >
            {row.original.identifier}
          </a>
        ),
      },
      parentBountyId: {
        header: "Parent",
        cell: ({ row }: { row: any }) => {
          const name = row.original.parentBountyName;
          const id = row.original.parentBountyId;
          return (
            <span
              className="text-muted-foreground"
              title={name ? `#${id}` : undefined}
            >
              {name || `#${id}`}
            </span>
          );
        },
      },
      description: {
        cell: ({ row }: { row: any }) => {
          const description = row.original.description;
          return (
            <div className="max-w-[350px] truncate" title={description}>
              {description || "No description"}
            </div>
          );
        },
      },
      status: {
        cell: ({ row }: { row: any }) => {
          const status = row.original.status;
          const variant = getStatusVariant(status);
          return <Badge variant={variant}>{status}</Badge>;
        },
      },
      // category_id is handled by auto-columns with parent inheritance support
      // Hide parent decoration columns (data used for rendering other columns)
      parentBountyName: {
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableColumnFilter: false,
        enableSorting: false,
        meta: { autoHidden: true },
      },
      parentCategory: {
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableColumnFilter: false,
        enableSorting: false,
        meta: { autoHidden: true },
      },
      parentSubcategory: {
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableColumnFilter: false,
        enableSorting: false,
        meta: { autoHidden: true },
      },
    }),
    []
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Child Bounties</h1>
        <p className="text-muted-foreground text-sm">
          Browse and filter child bounty claims
        </p>
      </div>
      <DataTable<ChildBounty>
        queryConfig={queryConfig}
        tableName="child-bounties"
        editConfig={editConfig}
        isAuthenticated={isAuthenticated}
        facetedFilters={["status"]}
        columnOverrides={columnOverrides}
        defaultViews={defaultChildBountiesViews}
      />
    </div>
  );
}
