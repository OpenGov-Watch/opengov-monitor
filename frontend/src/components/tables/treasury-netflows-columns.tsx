import { ColumnDef } from "@tanstack/react-table";
import type { TreasuryNetflow } from "@/lib/db/types";

export const treasuryNetflowsColumns: ColumnDef<TreasuryNetflow>[] = [
  {
    id: "month",
    accessorKey: "month",
    header: "Month",
    cell: ({ getValue }) => getValue(),
  },
  {
    id: "asset_name",
    accessorKey: "asset_name",
    header: "Asset",
    cell: ({ getValue }) => getValue(),
  },
  {
    id: "flow_type",
    accessorKey: "flow_type",
    header: "Flow Type",
    cell: ({ getValue }) => getValue(),
  },
  {
    id: "amount_usd",
    accessorKey: "amount_usd",
    header: "Amount (USD)",
    cell: ({ getValue }) => {
      const value = getValue() as number;
      const formatted = Math.abs(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return value < 0 ? `-$${formatted}` : `$${formatted}`;
    },
  },
  {
    id: "amount_dot_equivalent",
    accessorKey: "amount_dot_equivalent",
    header: "Amount (DOT)",
    cell: ({ getValue }) => {
      const value = getValue() as number;
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },
  },
];
