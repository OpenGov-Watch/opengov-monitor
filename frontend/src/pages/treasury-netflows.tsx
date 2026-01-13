import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { treasuryNetflowsColumns } from "@/components/tables/treasury-netflows-columns";
import { api } from "@/api/client";
import { Loader2 } from "lucide-react";
import type { TreasuryNetflow } from "@/lib/db/types";

export default function TreasuryNetflowsPage() {
  const [data, setData] = useState<TreasuryNetflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.treasuryNetflows
      .getAll()
      .then((result) => setData(result as TreasuryNetflow[]))
      .catch((error) => {
        console.error("Failed to load treasury netflows:", error);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Treasury Netflows</h1>
        <p className="text-muted-foreground">
          Quarterly treasury flow data tracking inflows and outflows by asset and type
        </p>
      </div>
      <DataTable
        columns={treasuryNetflowsColumns}
        data={data}
        tableName="treasury-netflows"
      />
    </div>
  );
}
