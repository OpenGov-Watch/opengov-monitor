"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import type { Referendum, Category } from "@/lib/db/types";
import {
  EditableCategoryCell,
  EditableSubcategoryCell,
  EditableNotesCell,
  EditableHideCheckbox,
} from "@/components/data-table/editable-cells";

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" | "success" {
  switch (status?.toLowerCase()) {
    case "executed":
    case "approved":
      return "success";
    case "rejected":
    case "cancelled":
    case "timedout":
      return "destructive";
    case "ongoing":
    case "deciding":
      return "secondary";
    default:
      return "outline";
  }
}

export interface ReferendaColumnsOptions {
  categories: Category[];
  onUpdate: (id: number, data: Partial<Referendum>) => void;
}

export function createReferendaColumns(
  options: ReferendaColumnsOptions
): ColumnDef<Referendum>[] {
  const { categories, onUpdate } = options;

  return [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <div className="font-medium w-[60px]">{row.getValue("id")}</div>
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => {
        const url = row.original.url;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[400px] truncate block hover:underline text-blue-600"
            title={row.getValue("title")}
          >
            {row.getValue("title")}
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
      accessorKey: "track",
      header: ({ column }) => (
        <DataTableFacetedFilter column={column} title="Track" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[150px] truncate">{row.getValue("track")}</div>
      ),
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
      enableSorting: false,
    },
    {
      accessorKey: "DOT_proposal_time",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="DOT (Proposal)" />
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {formatNumber(row.getValue("DOT_proposal_time"))}
        </div>
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
      id: "tally_ayes",
      accessorFn: (row) => row["tally.ayes"],
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ayes" />
      ),
      cell: ({ row }) => (
        <div className="text-right text-green-600">
          {formatNumber(row.original["tally.ayes"])}
        </div>
      ),
    },
    {
      id: "tally_nays",
      accessorFn: (row) => row["tally.nays"],
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nays" />
      ),
      cell: ({ row }) => (
        <div className="text-right text-red-600">
          {formatNumber(row.original["tally.nays"])}
        </div>
      ),
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
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => (
        <EditableCategoryCell
          value={row.original.category}
          categories={categories}
          onChange={(category) => {
            // When category changes, also clear subcategory
            onUpdate(row.original.id, { category, subcategory: null });
          }}
        />
      ),
      filterFn: (row, id, value) => {
        const category = row.getValue(id) as string | null;
        return value.includes(category || "");
      },
    },
    {
      accessorKey: "subcategory",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subcategory" />
      ),
      cell: ({ row }) => (
        <EditableSubcategoryCell
          value={row.original.subcategory}
          category={row.original.category}
          categories={categories}
          onChange={(subcategory) => {
            onUpdate(row.original.id, { subcategory });
          }}
        />
      ),
    },
    {
      accessorKey: "notes",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Notes" />
      ),
      cell: ({ row }) => (
        <EditableNotesCell
          value={row.original.notes}
          onChange={(notes) => {
            onUpdate(row.original.id, { notes });
          }}
        />
      ),
    },
    {
      accessorKey: "hide_in_spends",
      header: () => <span title="Hide in spending reports">Hide</span>,
      cell: ({ row }) => (
        <EditableHideCheckbox
          value={row.original.hide_in_spends}
          onChange={(hide_in_spends) => {
            onUpdate(row.original.id, { hide_in_spends });
          }}
        />
      ),
    },
  ];
}

// Keep a static version for backwards compatibility (read-only)
export const referendaColumns: ColumnDef<Referendum>[] = createReferendaColumns({
  categories: [],
  onUpdate: () => {},
});
