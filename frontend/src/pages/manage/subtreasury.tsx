import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Pencil, Trash2, Plus, ExternalLink, ChevronRight } from "lucide-react";
import type { Subtreasury, Category } from "@/lib/db/types";
import { formatNumber, formatDate, cn } from "@/lib/utils";

interface FormData {
  id?: number;
  title: string;
  description: string;
  DOT_latest: string;
  USD_latest: string;
  DOT_component: string;
  USDC_component: string;
  USDT_component: string;
  category_id: number | null;
  selectedCategory: string; // For cascading dropdown UI
  latest_status_change: string;
  url: string;
}

const emptyFormData: FormData = {
  title: "",
  description: "",
  DOT_latest: "",
  USD_latest: "",
  DOT_component: "",
  USDC_component: "",
  USDT_component: "",
  category_id: null,
  selectedCategory: "",
  latest_status_change: "",
  url: "",
};

export default function SubtreasuryPage() {
  const [entries, setEntries] = useState<Subtreasury[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Subtreasury | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyFormData);

  useEffect(() => {
    Promise.all([fetchEntries(), fetchCategories()]).finally(() =>
      setLoading(false)
    );
  }, []);

  async function fetchEntries() {
    try {
      const response = await fetch("/api/subtreasury");
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error("Failed to fetch subtreasury entries:", error);
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
    setEditingEntry(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(entry: Subtreasury) {
    setEditingEntry(entry);
    // Find the category string from the category_id
    const cat = categories.find((c) => c.id === entry.category_id);
    setFormData({
      id: entry.id,
      title: entry.title || "",
      description: entry.description || "",
      DOT_latest: entry.DOT_latest?.toString() || "",
      USD_latest: entry.USD_latest?.toString() || "",
      DOT_component: entry.DOT_component?.toString() || "",
      USDC_component: entry.USDC_component?.toString() || "",
      USDT_component: entry.USDT_component?.toString() || "",
      category_id: entry.category_id,
      selectedCategory: cat?.category || "",
      latest_status_change: entry.latest_status_change?.slice(0, 10) || "",
      url: entry.url || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      id: editingEntry?.id,
      title: formData.title || null,
      description: formData.description || null,
      DOT_latest: formData.DOT_latest ? parseFloat(formData.DOT_latest) : null,
      USD_latest: formData.USD_latest ? parseFloat(formData.USD_latest) : null,
      DOT_component: formData.DOT_component ? parseFloat(formData.DOT_component) : null,
      USDC_component: formData.USDC_component ? parseFloat(formData.USDC_component) : null,
      USDT_component: formData.USDT_component ? parseFloat(formData.USDT_component) : null,
      category_id: formData.category_id,
      latest_status_change: formData.latest_status_change || null,
      url: formData.url || null,
    };

    try {
      if (editingEntry) {
        await fetch(`/api/subtreasury/${editingEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/subtreasury", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      fetchEntries();
    } catch (error) {
      console.error("Failed to save subtreasury entry:", error);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      await fetch(`/api/subtreasury/${id}`, { method: "DELETE" });
      fetchEntries();
    } catch (error) {
      console.error("Failed to delete entry:", error);
    }
  }

  // Get unique categories for the dropdown
  const uniqueCategories = [...new Set(categories.map((c) => c.category))].sort();

  // Get subcategories for the selected category
  const availableSubcategories = categories
    .filter((c) => c.category === formData.selectedCategory)
    .sort((a, b) => a.subcategory.localeCompare(b.subcategory));

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
          <h1 className="text-3xl font-bold tracking-tight">Subtreasury</h1>
          <p className="text-muted-foreground">
            Manage manually tracked spending entries
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? "Edit Entry" : "Add Entry"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Entry title"
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
                  placeholder="Detailed description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="DOT_latest">DOT Value</Label>
                  <Input
                    id="DOT_latest"
                    type="number"
                    step="0.0001"
                    value={formData.DOT_latest}
                    onChange={(e) =>
                      setFormData({ ...formData, DOT_latest: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="USD_latest">USD Value</Label>
                  <Input
                    id="USD_latest"
                    type="number"
                    step="0.01"
                    value={formData.USD_latest}
                    onChange={(e) =>
                      setFormData({ ...formData, USD_latest: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="DOT_component">DOT Component</Label>
                  <Input
                    id="DOT_component"
                    type="number"
                    step="0.0001"
                    value={formData.DOT_component}
                    onChange={(e) =>
                      setFormData({ ...formData, DOT_component: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="USDC_component">USDC Component</Label>
                  <Input
                    id="USDC_component"
                    type="number"
                    step="0.01"
                    value={formData.USDC_component}
                    onChange={(e) =>
                      setFormData({ ...formData, USDC_component: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="USDT_component">USDT Component</Label>
                  <Input
                    id="USDT_component"
                    type="number"
                    step="0.01"
                    value={formData.USDT_component}
                    onChange={(e) =>
                      setFormData({ ...formData, USDT_component: e.target.value })
                    }
                  />
                </div>
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
                          {cat.subcategory || "(default)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="latest_status_change">Date</Label>
                <Input
                  id="latest_status_change"
                  type="date"
                  value={formData.latest_status_change}
                  onChange={(e) =>
                    setFormData({ ...formData, latest_status_change: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://..."
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
                  {editingEntry ? "Update" : "Create"}
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
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-right">DOT</TableHead>
              <TableHead className="text-right">USD</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-sm">
                  {formatDate(entry.latest_status_change)}
                </TableCell>
                <TableCell>
                  {entry.url ? (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {entry.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    entry.title
                  )}
                </TableCell>
                <TableCell className="font-mono text-right">
                  {formatNumber(entry.DOT_latest)}
                </TableCell>
                <TableCell className="font-mono text-right">
                  {formatNumber(entry.USD_latest)}
                </TableCell>
                <TableCell>
                  {entry.category && entry.subcategory
                    ? `${entry.category} / ${entry.subcategory}`
                    : entry.category || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(entry)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No subtreasury entries. Click "Add Entry" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
