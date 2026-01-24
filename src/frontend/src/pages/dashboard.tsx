import { useEffect, useState } from "react";
import { Link } from "react-router";
import Vote from "lucide-react/dist/esm/icons/vote";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Gift from "lucide-react/dist/esm/icons/gift";
import Users from "lucide-react/dist/esm/icons/users";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import { api } from "@/api/client";

interface TableInfo {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  statsKey: string;
}

const tables: TableInfo[] = [
  {
    name: "Referenda",
    href: "/referenda",
    icon: Vote,
    description: "Governance proposals and voting",
    statsKey: "referenda",
  },
  {
    name: "Treasury Spends",
    href: "/treasury",
    icon: Wallet,
    description: "Treasury allocation requests",
    statsKey: "treasury",
  },
  {
    name: "Child Bounties",
    href: "/child-bounties",
    icon: Gift,
    description: "Sub-bounties for work completion",
    statsKey: "childBounties",
  },
  {
    name: "Fellowship Treasury",
    href: "/fellowship",
    icon: Users,
    description: "Fellowship treasury spends",
    statsKey: "fellowship",
  },
  {
    name: "Salary Cycles",
    href: "/fellowship-salary-cycles",
    icon: Calendar,
    description: "Fellowship salary payment cycles",
    statsKey: "salaryCycles",
  },
  {
    name: "Salary Claimants",
    href: "/fellowship-salary-claimants",
    icon: UserCheck,
    description: "Fellowship members claiming salary",
    statsKey: "salaryClaimants",
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stats
      .get()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">OpenGov Monitor</h1>
        <p className="text-muted-foreground mt-2">
          Polkadot governance data explorer. Browse referenda, treasury spends,
          bounties, and fellowship data.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <h2 className="font-semibold text-destructive">Error Loading Data</h2>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Make sure the API server is running and the database is accessible.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => {
          const count = stats[table.statsKey];
          const exists = count !== undefined && count !== null;

          return (
            <Link
              key={table.name}
              to={table.href}
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
                {loading ? (
                  <span className="text-sm text-muted-foreground">Loading...</span>
                ) : exists ? (
                  <>
                    <span className="text-2xl font-bold">{count.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground ml-2">rows</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No data</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
