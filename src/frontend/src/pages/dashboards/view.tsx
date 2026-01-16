import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DashboardGrid } from "@/components/dashboard";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { useAuth } from "@/contexts/auth-context";
import type { Dashboard, DashboardComponent } from "@/lib/db/types";

export default function DashboardViewPage() {
  const params = useParams();
  const dashboardId = parseInt(params.id as string, 10);
  const { isAuthenticated } = useAuth();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [components, setComponents] = useState<DashboardComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [dashboardRes, componentsRes] = await Promise.all([
          fetch(`/api/dashboards?id=${dashboardId}`),
          fetch(`/api/dashboards/components?dashboard_id=${dashboardId}`),
        ]);

        if (!dashboardRes.ok) {
          setError("Dashboard not found");
          return;
        }

        const dashboardData = await dashboardRes.json();
        const componentsData = await componentsRes.json();

        setDashboard(dashboardData);
        setComponents(componentsData);
      } catch (err) {
        setError("Failed to load dashboard");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [dashboardId]);

  if (loading) {
    return <div className="p-4">Loading dashboard...</div>;
  }

  if (error || !dashboard) {
    return (
      <div className="p-4">
        <div className="text-destructive">{error || "Dashboard not found"}</div>
        <Link to="/dashboards" className="text-sm text-muted-foreground hover:underline">
          Back to Dashboards
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboards">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {dashboard.name}
            </h1>
            {dashboard.description && (
              <p className="text-muted-foreground">{dashboard.description}</p>
            )}
          </div>
        </div>
        {isAuthenticated && (
          <Button asChild>
            <Link to={`/dashboards/${dashboardId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Dashboard
            </Link>
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <DashboardGrid components={components} editable={false} />
      </div>
    </div>
  );
}
