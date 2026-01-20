import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Plus from "lucide-react/dist/esm/icons/plus";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import type { Bounty, Category } from "@/lib/db/types";
import { formatNumber, cn } from "@/lib/utils";
import { RequireAuth } from "@/components/auth/require-auth";

function BountiesPageContent() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBounty, setEditingBounty] = useState<Bounty | null>(null);
  const [formData, setFormData] = useState({
    id: 0,
    name: "",
    category_id: null as number | null,
    selectedCategory: "", // For cascading dropdown UI
    remaining_dot: 0,
  });

  useEffect(() => {
    Promise.all([fetchBounties(), fetchCategories()]).finally(() =>
      setLoading(false)
    );
  }, []);

  async function fetchBounties() {
    try {
      const response = await fetch("/api/bounties");
      const data = await response.json();
      setBounties(data);
    } catch (error) {
      console.error("Failed to fetch bounties:", error);
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetch("/api/categories");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }

  function openAddDialog() {
    setEditingBounty(null);
    setFormData({
      id: 0,
      name: "",
      category_id: null,
      selectedCategory: "",
      remaining_dot: 0,
    });
    setDialogOpen(true);
  }

  function openEditDialog(bounty: Bounty) {
    setEditingBounty(bounty);
    // Find the category string from the category_id
    const cat = categories.find((c) => c.id === bounty.category_id);
    setFormData({
      id: bounty.id,
      name: bounty.name || "",
      category_id: bounty.category_id,
      selectedCategory: cat?.category || "",
      remaining_dot: bounty.remaining_dot || 0,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await fetch("/api/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formData.id,
          name: formData.name || null,
          category_id: formData.category_id,
          remaining_dot: formData.remaining_dot || null,
        }),
      });

      setDialogOpen(false);
      fetchBounties();
    } catch (error) {
      console.error("Failed to save bounty:", error);
    }
  }

  // Get unique categories for the dropdown
  const uniqueCategories = [...new Set(categories.map((c) => c.category))].sort();

  // Get subcategories for the selected category
  // Sort: non-null values alphabetically, NULL (Other) at end
  const availableSubcategories = categories
    .filter((c) => c.category === formData.selectedCategory)
    .sort((a, b) => {
      if (a.subcategory === null) return 1;
      if (b.subcategory === null) return -1;
      return a.subcategory.localeCompare(b.subcategory);
    });

  function handleCategoryChange(category: string) {
    const subs = categories.filter((c) => c.category === category);
    // Auto-select if only one subcategory
    if (subs.length === 1) {
      setFormData({
        ...formData,
        selectedCategory: category,
        category_id: subs[0].id,
      });
    } else {
      setFormData({
        ...formData,
        selectedCategory: category,
        category_id: null,
      });
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bounties</h1>
          <p className="text-muted-foreground">
            Manage parent bounty category assignments
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Bounty
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBounty ? "Edit Bounty" : "Add Bounty"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bountyId">Bounty ID</Label>
                <Input
                  id="bountyId"
                  type="number"
                  value={formData.id}
                  onChange={(e) =>
                    setFormData({ ...formData, id: parseInt(e.target.value, 10) })
                  }
                  placeholder="e.g., 45"
                  required
                  disabled={!!editingBounty}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Bounty name"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={formData.selectedCategory || "__none__"}
                    onValueChange={(value) =>
                      handleCategoryChange(value === "__none__" ? "" : value)
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">None</span>
                      </SelectItem>
                      {uniqueCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={formData.category_id?.toString() || "__none__"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        category_id: value === "__none__" ? null : parseInt(value),
                      })
                    }
                    disabled={!formData.selectedCategory}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-[160px]",
                        !formData.selectedCategory && "opacity-50"
                      )}
                    >
                      <SelectValue placeholder="Subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">None</span>
                      </SelectItem>
                      {availableSubcategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.subcategory === null ? "Other" : cat.subcategory}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remaining_dot">Remaining DOT</Label>
                <Input
                  id="remaining_dot"
                  type="number"
                  step="0.0001"
                  value={formData.remaining_dot}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      remaining_dot: parseFloat(e.target.value),
                    })
                  }
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
                <Button type="submit">
                  {editingBounty ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Remaining DOT</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Subcategory</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bounties.map((bounty) => (
              <TableRow key={bounty.id}>
                <TableCell className="font-mono">
                  #{bounty.id}
                </TableCell>
                <TableCell>{bounty.name || "-"}</TableCell>
                <TableCell className="font-mono text-right">
                  {formatNumber(bounty.remaining_dot)}
                </TableCell>
                <TableCell>{bounty.category || "-"}</TableCell>
                <TableCell>
                  {bounty.subcategory === null && bounty.category
                    ? "Other"
                    : bounty.subcategory || "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(bounty)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {bounties.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No bounties defined. Click "Add Bounty" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function BountiesPage() {
  return (
    <RequireAuth>
      <BountiesPageContent />
    </RequireAuth>
  );
}
