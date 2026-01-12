"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { formatNumber, formatDate } from "@/lib/utils";
import { subsquareUrls } from "@/lib/urls";
import type { FellowshipSalaryCycle } from "@/lib/db/types";

export const fellowshipSalaryCyclesColumns: ColumnDef<FellowshipSalaryCycle>[] = [
  {
    accessorKey: "cycle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cycle" />
    ),
    cell: ({ row }) => (
      <a
        href={subsquareUrls.salaryCycle(row.original.cycle)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium hover:underline text-blue-600"
      >
        #{row.getValue("cycle")}
      </a>
    ),
  },
  {
    accessorKey: "budget_dot",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Budget (DOT)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("budget_dot"))}
      </div>
    ),
  },
  {
    accessorKey: "registeredCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registered" />
    ),
    cell: ({ row }) => (
      <div className="text-right">{row.getValue("registeredCount")}</div>
    ),
  },
  {
    accessorKey: "registeredPaidCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paid" />
    ),
    cell: ({ row }) => (
      <div className="text-right">{row.getValue("registeredPaidCount")}</div>
    ),
  },
  {
    accessorKey: "registered_paid_amount_dot",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paid Amount (DOT)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("registered_paid_amount_dot"))}
      </div>
    ),
  },
  {
    accessorKey: "total_registrations_dot",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Reg. (DOT)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("total_registrations_dot"))}
      </div>
    ),
  },
  {
    accessorKey: "unregistered_paid_dot",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Unreg. Paid (DOT)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("unregistered_paid_dot"))}
      </div>
    ),
  },
  {
    accessorKey: "start_time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start" />
    ),
    cell: ({ row }) => formatDate(row.getValue("start_time")),
  },
  {
    accessorKey: "end_time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="End" />
    ),
    cell: ({ row }) => formatDate(row.getValue("end_time")),
  },
];
