import { getFellowshipSalaryClaimants, tableExists } from "@/lib/db/queries";
import { TABLE_NAMES } from "@/lib/db/types";
import { fellowshipSalaryClaimantsColumns } from "@/components/tables/fellowship-salary-claimants-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";

export default function FellowshipSalaryClaimantsPage() {
  const exists = tableExists(TABLE_NAMES.fellowshipSalaryClaimants);

  if (!exists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fellowship Salary Claimants</h1>
          <p className="text-muted-foreground">
            Browse and filter fellowship members claiming salary
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h3 className="text-lg font-medium">Table Not Available</h3>
          <p className="text-sm text-muted-foreground mt-2">
            The Fellowship Salary Claimants table has not been populated yet.
            Run the backend with claimants fetching enabled:
          </p>
          <pre className="mt-4 bg-muted p-4 rounded-md text-left text-sm overflow-x-auto">
            <code>python scripts/fetch_salaries.py --claimants-only</code>
          </pre>
        </div>
      </div>
    );
  }

  const data = getFellowshipSalaryClaimants();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fellowship Salary Claimants</h1>
        <p className="text-muted-foreground">
          Browse and filter fellowship members claiming salary
        </p>
      </div>
      <DataTableWrapper
        columns={fellowshipSalaryClaimantsColumns}
        data={data}
        tableName="fellowship-salary-claimants"
      />
    </div>
  );
}
