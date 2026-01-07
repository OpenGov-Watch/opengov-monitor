import { getFellowship } from "@/lib/db/queries";
import { fellowshipColumns } from "@/components/tables/fellowship-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";

export default function FellowshipPage() {
  const data = getFellowship();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fellowship Treasury</h1>
        <p className="text-muted-foreground">
          Browse and filter fellowship treasury spends
        </p>
      </div>
      <DataTableWrapper
        columns={fellowshipColumns}
        data={data}
        tableName="fellowship"
      />
    </div>
  );
}
