"use client";

import * as React from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SavedView } from "@/hooks/use-view-state";
import { cn } from "@/lib/utils";

interface ViewSelectorProps {
  views: SavedView[];
  currentViewName: string | null;
  onSelectView: (name: string) => void;
  onSaveView: (name: string, overwrite: boolean) => boolean;
  onDeleteView: (name: string) => void;
  className?: string;
}

export function ViewSelector({
  views,
  currentViewName,
  onSelectView,
  onSaveView,
  onDeleteView,
  className,
}: ViewSelectorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [viewName, setViewName] = React.useState("");
  const [saveMode, setSaveMode] = React.useState<"new" | "overwrite">("new");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [viewToDelete, setViewToDelete] = React.useState<string | null>(null);

  const handleSaveClick = () => {
    // Check if current view exists
    if (currentViewName && views.find((v) => v.name === currentViewName)) {
      // Prompt: overwrite or save as new
      setSaveMode("overwrite");
      setViewName(currentViewName);
    } else {
      setSaveMode("new");
      setViewName("");
    }
    setSaveDialogOpen(true);
  };

  const handleSaveConfirm = () => {
    if (!viewName.trim()) return;

    const success = onSaveView(viewName.trim(), saveMode === "overwrite");
    if (success) {
      setSaveDialogOpen(false);
      setViewName("");
    } else {
      // View exists, ask if they want to overwrite
      setSaveMode("overwrite");
    }
  };

  const handleDeleteClick = (name: string) => {
    setViewToDelete(name);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (viewToDelete) {
      onDeleteView(viewToDelete);
      setDeleteDialogOpen(false);
      setViewToDelete(null);
    }
  };

  // Desktop: Tabs view
  const desktopView = (
    <div className={cn("hidden md:flex items-center gap-2", className)}>
      <Tabs value={currentViewName || undefined} onValueChange={onSelectView}>
        <TabsList>
          {views.map((view) => (
            <TabsTrigger key={view.name} value={view.name} className="relative group">
              {view.name}
              {views.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(view.name);
                  }}
                  className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete view"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSaveClick}
        className="h-8"
      >
        <Plus className="mr-2 h-4 w-4" />
        Save
      </Button>
    </div>
  );

  // Mobile: Dropdown view
  const mobileView = (
    <div className={cn("flex md:hidden items-center gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            {currentViewName || "Select View"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {views.map((view) => (
            <DropdownMenuItem
              key={view.name}
              onClick={() => onSelectView(view.name)}
            >
              <div className="flex items-center justify-between w-full">
                <span>{view.name}</span>
                <div className="flex items-center gap-2">
                  {currentViewName === view.name && (
                    <Check className="h-4 w-4" />
                  )}
                  {views.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(view.name);
                      }}
                      title="Delete view"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSaveClick}>
            <Plus className="mr-2 h-4 w-4" />
            Save View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {desktopView}
      {mobileView}

      {/* Save View Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {saveMode === "overwrite" ? "Save View" : "Save New View"}
            </DialogTitle>
            <DialogDescription>
              {saveMode === "overwrite"
                ? "Update the current view or save as a new one?"
                : "Enter a name for this view."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g., High Value Items"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveConfirm();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            {saveMode === "overwrite" && (
              <Button
                onClick={() => {
                  setSaveMode("new");
                  setViewName("");
                }}
              >
                Save as New
              </Button>
            )}
            <Button onClick={handleSaveConfirm}>
              {saveMode === "overwrite" ? "Overwrite" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete View Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the view "{viewToDelete}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
