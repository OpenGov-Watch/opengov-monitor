import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DashboardGrid, ComponentEditor } from "@/components/dashboard";
import { Plus, ArrowLeft, Eye, Check } from "lucide-react";
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<DashboardComponent | null>(null);
  const [highlightComponentId, setHighlightComponentId] = useState<number | null>(null);

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
      setName(dashboardData.name);
      setDescription(dashboardData.description || "");
      setMetadataDirty(false);
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

  // Sync editingComponent with components array when it updates
  useEffect(() => {
    if (editingComponent && editingComponent.id) {
      const updatedComponent = components.find(c => c.id === editingComponent.id);
      if (updatedComponent && updatedComponent !== editingComponent) {
        setEditingComponent(updatedComponent);
      }
    }
  }, [components, editingComponent]);

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

  async function handleSaveMetadata() {
    if (!metadataDirty) return;

    setSavingMetadata(true);
    try {
      await fetch("/api/dashboards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dashboardId,
          name,
          description: description || null,
        }),
      });
      setMetadataDirty(false);
    } catch (err) {
      console.error("Failed to update dashboard:", err);
    } finally {
      setSavingMetadata(false);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    setMetadataDirty(true);
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    setMetadataDirty(true);
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

  async function handleDuplicateComponent(component: DashboardComponent) {
    try {
      const queryConfig = JSON.parse(component.query_config);
      const gridConfig: GridConfig = JSON.parse(component.grid_config);
      const chartConfig = component.chart_config
        ? JSON.parse(component.chart_config)
        : null;

      // Calculate position - try to place right of existing components at bottom row
      const GRID_COLS = 12;
      const componentWidth = gridConfig.w;

      // Parse all grid configs
      const grids = components.map((c) => ({
        ...JSON.parse(c.grid_config) as GridConfig,
      }));

      // Find bottom row (highest y value where components start)
      const maxY = Math.max(0, ...grids.map((g) => g.y + g.h));
      const bottomRowY = Math.max(0, ...grids.map((g) => g.y));

      // Find components in the bottom row
      const bottomRowComponents = grids.filter((g) => g.y === bottomRowY);

      // Find the rightmost edge in the bottom row
      const rightEdge = Math.max(
        0,
        ...bottomRowComponents.map((g) => g.x + g.w)
      );

      // Check if there's space to place the component to the right
      let newX: number;
      let newY: number;
      if (rightEdge + componentWidth <= GRID_COLS) {
        // Place to the right in the same row
        newX = rightEdge;
        newY = bottomRowY;
      } else {
        // No space, place at the start of a new row below
        newX = 0;
        newY = maxY;
      }

      const payload = {
        dashboard_id: component.dashboard_id,
        name: `${component.name} (copy)`,
        type: component.type,
        query_config: queryConfig,
        grid_config: { ...gridConfig, x: newX, y: newY },
        chart_config: chartConfig,
      };

      const response = await fetch("/api/dashboards/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const newComponent = await response.json();

      await fetchData();

      // Scroll to and highlight the new component
      setHighlightComponentId(newComponent.id);
      setTimeout(() => setHighlightComponentId(null), 2000);
    } catch (err) {
      console.error("Failed to duplicate component:", err);
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

        const response = await fetch("/api/dashboards/components", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const newComponent = await response.json();

        await fetchData();

        // Scroll to and highlight the new component
        setHighlightComponentId(newComponent.id);
        setTimeout(() => setHighlightComponentId(null), 2000);
        return;
      }

      await fetchData();
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
    <div className="flex-1 min-h-0 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboards">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full text-3xl font-bold tracking-tight py-0 px-1 border border-transparent rounded hover:border-input focus:border-input focus:outline-none bg-transparent"
              placeholder="Dashboard name"
            />
            <textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="w-full text-muted-foreground resize-none border border-transparent rounded hover:border-input focus:border-input focus:outline-none bg-transparent py-0 px-1"
              placeholder="Add a description..."
              rows={1}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {metadataDirty && (
            <Button onClick={handleSaveMetadata} disabled={savingMetadata}>
              <Check className="mr-2 h-4 w-4" />
              {savingMetadata ? "Saving..." : "Save"}
            </Button>
          )}
          <Button onClick={handleAddComponent}>
            <Plus className="mr-2 h-4 w-4" />
            Add Component
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/dashboards/${dashboardId}`}>
              <Eye className="mr-2 h-4 w-4" />
              View Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-lg border-2 border-dashed p-4">
        <DashboardGrid
          components={components}
          editable={true}
          highlightComponentId={highlightComponentId}
          onLayoutChange={handleLayoutChange}
          onEditComponent={handleEditComponent}
          onDuplicateComponent={handleDuplicateComponent}
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
