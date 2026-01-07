import { getExpiredClaims, viewExists } from "@/lib/db/queries";
import { VIEW_NAMES } from "@/lib/db/types";
import { expiredClaimsColumns } from "@/components/tables/expired-claims-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";
import { formatNumber } from "@/lib/utils";

// Prevent caching - always check view availability fresh
export const dynamic = "force-dynamic";

export default function ExpiredClaimsPage() {
  const exists = viewExists(VIEW_NAMES.expiredClaims);

  if (!exists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expired Claims</h1>
          <p className="text-muted-foreground">
            Treasury spends that were approved but have passed their expiration date
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h3 className="text-lg font-medium">View Not Available</h3>
          <p className="text-sm text-muted-foreground mt-2">
            The expired_claims view has not been created yet.
            Run the backend to create database views:
          </p>
          <pre className="mt-4 bg-muted p-4 rounded-md text-left text-sm overflow-x-auto">
            <code>python scripts/run_sqlite.py --db ../data/polkadot.db</code>
          </pre>
        </div>
      </div>
    );
  }

  const data = getExpiredClaims();

  // Calculate totals for footer
  const totals = data.reduce(
    (acc, row) => ({
      DOT: acc.DOT + (row.DOT_component || 0),
      USDT: acc.USDT + (row.USDT_component || 0),
      USDC: acc.USDC + (row.USDC_component || 0),
    }),
    { DOT: 0, USDT: 0, USDC: 0 }
  );

  const footerCells = [
    { columnId: "DOT_component", value: <span className="font-mono">{formatNumber(totals.DOT)}</span> },
    { columnId: "USDT_component", value: <span className="font-mono">{formatNumber(totals.USDT)}</span> },
    { columnId: "USDC_component", value: <span className="font-mono">{formatNumber(totals.USDC)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Expired Claims</h1>
        <p className="text-muted-foreground">
          Treasury spends that were approved but have passed their expiration date.
          Sorted by valid from date (most recent first).
        </p>
      </div>
      <DataTableWrapper
        columns={expiredClaimsColumns}
        data={data}
        tableName="expired-claims"
        footerCells={footerCells}
        footerLabel="GRAND TOTAL"
      />
    </div>
  );
}
