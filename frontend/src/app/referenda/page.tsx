import { getReferenda } from "@/lib/db/queries";
import { referendaColumns } from "@/components/tables/referenda-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";

export default function ReferendaPage() {
  const data = getReferenda();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referenda</h1>
        <p className="text-muted-foreground">
          Browse and filter Polkadot governance referenda
        </p>
      </div>
      <DataTableWrapper
        columns={referendaColumns}
        data={data}
        tableName="referenda"
      />
    </div>
  );
}
