"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import type { ChildBounty, Category } from "@/lib/db/types";
import {
  CategorySelector,
  EditableNotesCell,
  EditableHideCheckbox,
  ReadOnlyCategorySelector,
  ReadOnlyNotesCell,
  ReadOnlyHideCheckbox,
} from "@/components/data-table/editable-cells";

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

export interface ChildBountiesColumnsOptions {
  categories: Category[];
  onUpdate: (
    identifier: string,
    data: { category_id?: number | null; notes?: string | null; hide_in_spends?: number | null }
  ) => void;
  isAuthenticated?: boolean;
}

export function createChildBountiesColumns(
  options: ChildBountiesColumnsOptions
): ColumnDef<ChildBounty>[] {
  const { categories, onUpdate, isAuthenticated = false } = options;

  return [
    {
      accessorKey: "identifier",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <div className="font-medium w-[80px]">{row.getValue("identifier")}</div>
      ),
    },
    {
      accessorKey: "parentBountyId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parent" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          #{row.getValue("parentBountyId")}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => {
        const url = row.original.url;
        const description = row.getValue("description") as string;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[350px] truncate block hover:underline text-blue-600"
            title={description}
          >
            {description || "No description"}
          </a>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableFacetedFilter column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const variant = getStatusVariant(status);
        return <Badge variant={variant}>{status}</Badge>;
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      enableSorting: false,
    },
    {
      accessorKey: "DOT",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="DOT" />
      ),
      cell: ({ row }) => (
        <div className="text-right">{formatNumber(row.getValue("DOT"))}</div>
      ),
    },
    {
      accessorKey: "USD_proposal_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="USD (Proposal)" />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {formatCurrency(row.getValue("USD_proposal_time"))}
        </div>
      ),
    },
    {
      accessorKey: "beneficiary",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Beneficiary" />
      ),
      cell: ({ row }) => {
        const beneficiary = row.getValue("beneficiary") as string;
        if (!beneficiary) return "-";
        return (
          <span className="font-mono text-xs" title={beneficiary}>
            {beneficiary.slice(0, 8)}...{beneficiary.slice(-6)}
          </span>
        );
      },
    },
    {
      accessorKey: "proposal_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Proposed" />
      ),
      cell: ({ row }) => formatDate(row.getValue("proposal_time")),
    },
    {
      accessorKey: "latest_status_change",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Update" />
      ),
      cell: ({ row }) => formatDate(row.getValue("latest_status_change")),
    },
    {
      id: "category",
      accessorFn: (row) =>
        row.category ? `${row.category} > ${row.subcategory || ""}` : null,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) =>
        isAuthenticated ? (
          <CategorySelector
            categoryId={row.original.category_id}
            categories={categories}
            onChange={(category_id) => {
              onUpdate(row.original.identifier, { category_id });
            }}
          />
        ) : (
          <ReadOnlyCategorySelector
            categoryId={row.original.category_id}
            categories={categories}
          />
        ),
      filterFn: (row, _id, value) => {
        const category = row.original.category;
        return value.includes(category || "");
      },
    },
    {
      accessorKey: "notes",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Notes" />
      ),
      cell: ({ row }) =>
        isAuthenticated ? (
          <EditableNotesCell
            value={row.original.notes}
            onChange={(notes) => {
              onUpdate(row.original.identifier, { notes });
            }}
          />
        ) : (
          <ReadOnlyNotesCell value={row.original.notes} />
        ),
    },
    {
      accessorKey: "hide_in_spends",
      header: () => <span title="Hide in spending reports">Hide</span>,
      cell: ({ row }) =>
        isAuthenticated ? (
          <EditableHideCheckbox
            value={row.original.hide_in_spends}
            onChange={(hide_in_spends) => {
              onUpdate(row.original.identifier, { hide_in_spends });
            }}
          />
        ) : (
          <ReadOnlyHideCheckbox value={row.original.hide_in_spends} />
        ),
    },
  ];
}

// Keep a static version for backwards compatibility (read-only)
export const childBountiesColumns: ColumnDef<ChildBounty>[] = createChildBountiesColumns({
  categories: [],
  onUpdate: () => {},
});
