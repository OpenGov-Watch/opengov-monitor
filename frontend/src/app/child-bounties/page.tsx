import { getChildBounties } from "@/lib/db/queries";
import { childBountiesColumns } from "@/components/tables/child-bounties-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";

export default function ChildBountiesPage() {
  const data = getChildBounties();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Child Bounties</h1>
        <p className="text-muted-foreground">
          Browse and filter child bounties for work completion
        </p>
      </div>
      <DataTableWrapper
        columns={childBountiesColumns}
        data={data}
        tableName="child-bounties"
      />
    </div>
  );
}
