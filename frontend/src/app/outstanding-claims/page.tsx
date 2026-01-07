import { getOutstandingClaims, viewExists } from "@/lib/db/queries";
import { VIEW_NAMES, type OutstandingClaim } from "@/lib/db/types";
import { outstandingClaimsColumns } from "@/components/tables/outstanding-claims-columns";
import { upcomingClaimsColumns } from "@/components/tables/upcoming-claims-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";
import { MonthlyClaimsSummary } from "@/components/tables/monthly-claims-summary";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

// Prevent caching - always check view availability fresh
export const dynamic = "force-dynamic";

function calculateTotals(claims: OutstandingClaim[]) {
  return claims.reduce(
    (acc, row) => ({
      DOT: acc.DOT + (row.DOT_component || 0),
      USDT: acc.USDT + (row.USDT_component || 0),
      USDC: acc.USDC + (row.USDC_component || 0),
    }),
    { DOT: 0, USDT: 0, USDC: 0 }
  );
}

function formatFooterCells(totals: { DOT: number; USDT: number; USDC: number }) {
  return [
    { columnId: "DOT_component", value: <span className="font-mono">{formatNumber(totals.DOT)}</span> },
    { columnId: "USDT_component", value: <span className="font-mono">{formatNumber(totals.USDT)}</span> },
    { columnId: "USDC_component", value: <span className="font-mono">{formatNumber(totals.USDC)}</span> },
  ];
}

export default function OutstandingClaimsPage() {
  const exists = viewExists(VIEW_NAMES.outstandingClaims);

  if (!exists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outstanding Claims</h1>
          <p className="text-muted-foreground">
            Treasury spends that are approved, valid, and awaiting claim
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h3 className="text-lg font-medium">View Not Available</h3>
          <p className="text-sm text-muted-foreground mt-2">
            The outstanding_claims view has not been created yet.
            Run the backend to create database views:
          </p>
          <pre className="mt-4 bg-muted p-4 rounded-md text-left text-sm overflow-x-auto">
            <code>python scripts/run_sqlite.py --db ../data/polkadot.db</code>
          </pre>
        </div>
      </div>
    );
  }

  const allClaims = getOutstandingClaims();
  const activeClaims = allClaims.filter((c) => c.claim_type === "active");
  const upcomingClaims = allClaims.filter((c) => c.claim_type === "upcoming");

  const activeTotals = calculateTotals(activeClaims);
  const activeFooterCells = formatFooterCells(activeTotals);

  const upcomingTotals = calculateTotals(upcomingClaims);
  const upcomingFooterCells = formatFooterCells(upcomingTotals);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outstanding Claims</h1>
        <p className="text-muted-foreground">
          Treasury spends that are approved and awaiting claim
        </p>
      </div>

      {/* Active Claims Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Active Claims</h2>
          <Badge variant="default">{activeClaims.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Currently valid and can be claimed now. Sorted by valid from date (oldest first).
        </p>
        {activeClaims.length > 0 ? (
          <DataTableWrapper
            columns={outstandingClaimsColumns}
            data={activeClaims}
            tableName="active-claims"
            footerCells={activeFooterCells}
            footerLabel="ACTIVE TOTAL"
          />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            No active claims at the moment.
          </div>
        )}
      </section>

      {/* Upcoming Claims Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Upcoming Claims</h2>
          <Badge variant="secondary">{upcomingClaims.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Approved but not yet valid. Will become claimable when the valid from date arrives.
        </p>
        {upcomingClaims.length > 0 ? (
          <DataTableWrapper
            columns={upcomingClaimsColumns}
            data={upcomingClaims}
            tableName="upcoming-claims"
            footerCells={upcomingFooterCells}
            footerLabel="UPCOMING TOTAL"
          />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            No upcoming claims.
          </div>
        )}
      </section>

      {/* Monthly Summary - aggregates BOTH active and upcoming */}
      <MonthlyClaimsSummary data={allClaims} />
    </div>
  );
}
