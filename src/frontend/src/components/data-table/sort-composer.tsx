"use client";

import * as React from "react";
import { SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SortComposerProps {
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  availableColumns: { id: string; name: string }[];
}

export function SortComposer({ sorting, setSorting, availableColumns }: SortComposerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [localSorting, setLocalSorting] = React.useState<SortingState>(sorting);

  // Sync local state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalSorting(sorting);
    }
  }, [isOpen, sorting]);

  const addSort = () => {
    const unusedColumn = availableColumns.find(
      (col) => !localSorting.some((s) => s.id === col.id)
    );
    if (unusedColumn) {
      setLocalSorting([...localSorting, { id: unusedColumn.id, desc: false }]);
    }
  };

  const removeSort = (index: number) => {
    setLocalSorting(localSorting.filter((_, i) => i !== index));
  };

  const updateSortColumn = (index: number, columnId: string) => {
    const updated = [...localSorting];
    updated[index] = { id: columnId, desc: updated[index].desc };
    setLocalSorting(updated);
  };

  const toggleSortDirection = (index: number) => {
    const updated = [...localSorting];
    updated[index] = { id: updated[index].id, desc: !updated[index].desc };
    setLocalSorting(updated);
  };

  const moveSort = (index: number, direction: "up" | "down") => {
    const updated = [...localSorting];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < updated.length) {
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      setLocalSorting(updated);
    }
  };

  const applyChanges = () => {
    setSorting(localSorting);
    setIsOpen(false);
  };

  const cancel = () => {
    setLocalSorting(sorting);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8" title="Multi-column sorting">
          <ArrowUp className="h-4 w-4" />
          {sorting.length > 1 && (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {sorting.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Multi-Column Sorting</DialogTitle>
          <DialogDescription>
            Add multiple sort columns and drag to reorder. Data will be sorted in the order shown.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {localSorting.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No sort columns. Click "Add Sort" to start.
            </div>
          ) : (
            localSorting.map((sort, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 border rounded bg-background"
              >
                {/* Order indicator */}
                <div className="flex flex-col items-center gap-1 mr-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0"
                    onClick={() => moveSort(index, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0"
                    onClick={() => moveSort(index, "down")}
                    disabled={index === localSorting.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                {/* Column selection */}
                <Select
                  value={sort.id}
                  onValueChange={(value) => updateSortColumn(index, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((col) => (
                      <SelectItem
                        key={col.id}
                        value={col.id}
                        disabled={
                          localSorting.some((s, i) => s.id === col.id && i !== index)
                        }
                      >
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Direction toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSortDirection(index)}
                  className="w-20"
                >
                  {sort.desc ? (
                    <>
                      <ArrowDown className="mr-1 h-3 w-3" />
                      Desc
                    </>
                  ) : (
                    <>
                      <ArrowUp className="mr-1 h-3 w-3" />
                      Asc
                    </>
                  )}
                </Button>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSort(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}

          {/* Add button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addSort}
            className="w-full"
            disabled={localSorting.length >= availableColumns.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Sort Column
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={applyChanges}>Apply</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
