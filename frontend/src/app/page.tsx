import Link from "next/link";
import {
  Vote,
  Wallet,
  Gift,
  Users,
  Calendar,
  UserCheck,
} from "lucide-react";
import { isDatabaseAccessible, getRowCount, getTableNames } from "@/lib/db/queries";
import { TABLE_NAMES } from "@/lib/db/types";

const tables = [
  {
    name: "Referenda",
    href: "/referenda",
    icon: Vote,
    description: "Governance proposals and voting",
    tableName: TABLE_NAMES.referenda,
  },
  {
    name: "Treasury Spends",
    href: "/treasury",
    icon: Wallet,
    description: "Treasury allocation requests",
    tableName: TABLE_NAMES.treasury,
  },
  {
    name: "Child Bounties",
    href: "/child-bounties",
    icon: Gift,
    description: "Sub-bounties for work completion",
    tableName: TABLE_NAMES.childBounties,
  },
  {
    name: "Fellowship Treasury",
    href: "/fellowship",
    icon: Users,
    description: "Fellowship treasury spends",
    tableName: TABLE_NAMES.fellowship,
  },
  {
    name: "Salary Cycles",
    href: "/fellowship-salary-cycles",
    icon: Calendar,
    description: "Fellowship salary payment cycles",
    tableName: TABLE_NAMES.fellowshipSalaryCycles,
  },
  {
    name: "Salary Claimants",
    href: "/fellowship-salary-claimants",
    icon: UserCheck,
    description: "Fellowship members claiming salary",
    tableName: TABLE_NAMES.fellowshipSalaryClaimants,
  },
];

export default function HomePage() {
  const dbAccessible = isDatabaseAccessible();
  const existingTables = dbAccessible ? getTableNames() : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">OpenGov Monitor</h1>
        <p className="text-muted-foreground mt-2">
          Polkadot governance data explorer. Browse referenda, treasury spends,
          bounties, and fellowship data.
        </p>
      </div>

      {!dbAccessible && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <h2 className="font-semibold text-destructive">Database Not Found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The SQLite database could not be accessed. Make sure to run the backend
            data pipeline first to populate the database.
          </p>
          <pre className="mt-2 text-xs bg-muted p-2 rounded">
            cd backend && python scripts/run_sqlite.py --db ../data/polkadot.db
          </pre>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => {
          const exists = existingTables.includes(table.tableName);
          const count = exists ? getRowCount(table.tableName) : 0;

          return (
            <Link
              key={table.name}
              href={table.href}
              className="group rounded-lg border p-6 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-secondary p-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <table.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{table.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {table.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 text-right">
                {exists ? (
                  <span className="text-2xl font-bold">{count.toLocaleString()}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">No data</span>
                )}
                {exists && (
                  <span className="text-sm text-muted-foreground ml-2">rows</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
