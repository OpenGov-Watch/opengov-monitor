import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useDashboards } from "@/hooks/use-dashboards";
import { api } from "@/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import { formatDate } from "@/lib/utils";

interface FormData {
  id?: number;
  name: string;
  description: string;
}

const emptyFormData: FormData = {
  name: "",
  description: "",
};

export default function DashboardsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { dashboards, isLoading: loading, mutate } = useDashboards();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyFormData);

  function openAddDialog() {
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await api.dashboards.create(formData.name, formData.description || null);

      setDialogOpen(false);
      mutate();
    } catch (error) {
      console.error("Failed to save dashboard:", error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this dashboard and all its components?")) return;

    try {
      await api.dashboards.delete(id);
      mutate();
    } catch (error) {
      console.error("Failed to delete dashboard:", error);
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground">
            Create and manage custom dashboards with charts and tables
          </p>
        </div>
        {isAuthenticated && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                New Dashboard
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Dashboard</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Dashboard name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Last Updated</TableHead>
              {isAuthenticated && <TableHead className="w-[60px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dashboards.map((dashboard) => (
              <TableRow
                key={dashboard.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/dashboards/${dashboard.id}`)}
              >
                <TableCell>
                  <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                </TableCell>
                <TableCell className="font-medium">{dashboard.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {dashboard.description || "-"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatDate(dashboard.updated_at)}
                </TableCell>
                {isAuthenticated && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(dashboard.id);
                      }}
                      title="Delete dashboard"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {dashboards.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No dashboards yet. Click "New Dashboard" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
