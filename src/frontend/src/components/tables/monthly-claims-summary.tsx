"use client";

import { useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

interface ClaimData {
  validFrom: string | null;
  DOT_component: number | null;
  USDT_component: number | null;
  USDC_component: number | null;
}

interface MonthlyClaimsSummaryProps {
  data: ClaimData[];
}

interface MonthlySummary {
  month: string;
  DOT: number;
  USDT: number;
  USDC: number;
}

export function MonthlyClaimsSummary({ data }: MonthlyClaimsSummaryProps) {
  const { monthlySummaries, grandTotal } = useMemo(() => {
    const summaryMap = new Map<string, MonthlySummary>();

    for (const row of data) {
      if (!row.validFrom) continue;

      // Extract YYYY-MM from validFrom
      const date = new Date(row.validFrom);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const existing = summaryMap.get(month) || { month, DOT: 0, USDT: 0, USDC: 0 };
      existing.DOT += row.DOT_component || 0;
      existing.USDT += row.USDT_component || 0;
      existing.USDC += row.USDC_component || 0;
      summaryMap.set(month, existing);
    }

    // Sort by month
    const monthlySummaries = Array.from(summaryMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    // Calculate grand total
    const grandTotal = monthlySummaries.reduce(
      (acc, row) => ({
        DOT: acc.DOT + row.DOT,
        USDT: acc.USDT + row.USDT,
        USDC: acc.USDC + row.USDC,
      }),
      { DOT: 0, USDT: 0, USDC: 0 }
    );

    return { monthlySummaries, grandTotal };
  }, [data]);

  if (monthlySummaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Monthly Summary</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Month</TableHead>
              <TableHead className="text-right">DOT</TableHead>
              <TableHead className="text-right">USDT</TableHead>
              <TableHead className="text-right">USDC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlySummaries.map((row) => (
              <TableRow key={row.month}>
                <TableCell className="font-medium">{row.month}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(row.DOT)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(row.USDT)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(row.USDC)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Grand Total</TableCell>
              <TableCell className="text-right font-mono font-bold">
                {formatNumber(grandTotal.DOT)}
              </TableCell>
              <TableCell className="text-right font-mono font-bold">
                {formatNumber(grandTotal.USDT)}
              </TableCell>
              <TableCell className="text-right font-mono font-bold">
                {formatNumber(grandTotal.USDC)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
