import { getFellowshipSalaryCycles, tableExists } from "@/lib/db/queries";
import { TABLE_NAMES } from "@/lib/db/types";
import { fellowshipSalaryCyclesColumns } from "@/components/tables/fellowship-salary-cycles-columns";
import { DataTableWrapper } from "@/components/data-table/data-table-wrapper";

export default function FellowshipSalaryCyclesPage() {
  const exists = tableExists(TABLE_NAMES.fellowshipSalaryCycles);

  if (!exists) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fellowship Salary Cycles</h1>
          <p className="text-muted-foreground">
            Browse and filter fellowship salary payment cycles
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h3 className="text-lg font-medium">Table Not Available</h3>
          <p className="text-sm text-muted-foreground mt-2">
            The Fellowship Salary Cycles table has not been populated yet.
            Run the backend with salary fetching enabled:
          </p>
          <pre className="mt-4 bg-muted p-4 rounded-md text-left text-sm overflow-x-auto">
            <code>python scripts/fetch_salaries.py --start-cycle 1</code>
          </pre>
        </div>
      </div>
    );
  }

  const data = getFellowshipSalaryCycles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fellowship Salary Cycles</h1>
        <p className="text-muted-foreground">
          Browse and filter fellowship salary payment cycles
        </p>
      </div>
      <DataTableWrapper
        columns={fellowshipSalaryCyclesColumns}
        data={data}
        tableName="fellowship-salary-cycles"
      />
    </div>
  );
}
