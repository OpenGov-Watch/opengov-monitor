import { getTreasury } from "@/lib/db/queries";
import { treasuryColumns } from "@/components/tables/treasury-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";

export default function TreasuryPage() {
  const data = getTreasury();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Treasury Spends</h1>
        <p className="text-muted-foreground">
          Browse and filter treasury allocation requests
        </p>
      </div>
      <DataTableWrapper
        columns={treasuryColumns}
        data={data}
        tableName="treasury"
      />
    </div>
  );
}
