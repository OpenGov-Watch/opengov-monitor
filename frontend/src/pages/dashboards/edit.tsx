import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DashboardGrid, ComponentEditor } from "@/components/dashboard";
import { Plus, ArrowLeft, Eye } from "lucide-react";
import type {
  Dashboard,
  DashboardComponent,
  DashboardComponentType,
  QueryConfig,
  GridConfig,
  ChartConfig,
} from "@/lib/db/types";

export default function DashboardEditPage() {
  const params = useParams();
  const dashboardId = parseInt(params.id as string, 10);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [components, setComponents] = useState<DashboardComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<DashboardComponent | null>(null);

  const fetchData = useCallback(async () => {
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
  }, [dashboardId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleLayoutChange(componentId: number, gridConfig: GridConfig) {
    try {
      await fetch("/api/dashboards/components", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: componentId,
          grid_only: true,
          grid_config: gridConfig,
        }),
      });
    } catch (err) {
      console.error("Failed to update layout:", err);
    }
  }

  function handleAddComponent() {
    setEditingComponent(null);
    setEditorOpen(true);
  }

  function handleEditComponent(component: DashboardComponent) {
    setEditingComponent(component);
    setEditorOpen(true);
  }

  async function handleDeleteComponent(componentId: number) {
    if (!confirm("Are you sure you want to delete this component?")) return;

    try {
      await fetch(`/api/dashboards/components?id=${componentId}`, {
        method: "DELETE",
      });
      fetchData();
    } catch (err) {
      console.error("Failed to delete component:", err);
    }
  }

  async function handleSaveComponent(component: {
    id?: number;
    dashboard_id: number;
    name: string;
    type: DashboardComponentType;
    query_config: QueryConfig;
    grid_config: GridConfig;
    chart_config: ChartConfig;
  }) {
    try {
      const payload = {
        ...component,
        query_config: component.query_config,
        grid_config: component.grid_config,
        chart_config: component.chart_config,
      };

      if (component.id) {
        // Update existing
        await fetch("/api/dashboards/components", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new - find a good position
        const maxY = Math.max(0, ...components.map((c) => {
          const grid: GridConfig = JSON.parse(c.grid_config);
          return grid.y + grid.h;
        }));

        payload.grid_config = {
          ...payload.grid_config,
          x: 0,
          y: maxY,
        };

        await fetch("/api/dashboards/components", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      fetchData();
    } catch (err) {
      console.error("Failed to save component:", err);
    }
  }

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboards">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Edit: {dashboard.name}
            </h1>
            {dashboard.description && (
              <p className="text-muted-foreground">{dashboard.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/dashboards/${dashboardId}`}>
              <Eye className="mr-2 h-4 w-4" />
              View Dashboard
            </Link>
          </Button>
          <Button onClick={handleAddComponent}>
            <Plus className="mr-2 h-4 w-4" />
            Add Component
          </Button>
        </div>
      </div>

      <div className="rounded-lg border-2 border-dashed p-4 min-h-[500px]">
        <DashboardGrid
          components={components}
          editable={true}
          onLayoutChange={handleLayoutChange}
          onEditComponent={handleEditComponent}
          onDeleteComponent={handleDeleteComponent}
        />
      </div>

      <ComponentEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        component={editingComponent}
        dashboardId={dashboardId}
        onSave={handleSaveComponent}
      />
    </div>
  );
}
