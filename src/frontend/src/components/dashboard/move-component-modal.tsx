"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dashboard, DashboardComponent } from "@/lib/db/types";

interface MoveComponentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: DashboardComponent | null;
  currentDashboardId: number;
  onMove: (targetDashboardId: number) => Promise<void>;
}

export function MoveComponentModal({
  open,
  onOpenChange,
  component,
  currentDashboardId,
  onMove,
}: MoveComponentModalProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboards when modal opens
  useEffect(() => {
    if (open) {
      setSelectedDashboardId("");
      setError(null);
      fetchDashboards();
    }
  }, [open]);

  async function fetchDashboards() {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboards");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboards");
      }
      const data = await response.json();
      setDashboards(data);
    } catch (err) {
      setError("Failed to load dashboards");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Filter out current dashboard
  const availableDashboards = dashboards.filter(
    (d) => d.id !== currentDashboardId
  );

  async function handleMove() {
    if (!selectedDashboardId) return;

    setMoving(true);
    setError(null);
    try {
      await onMove(parseInt(selectedDashboardId, 10));
      onOpenChange(false);
    } catch (err) {
      setError("Failed to move component");
      console.error(err);
    } finally {
      setMoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move Component</DialogTitle>
          <DialogDescription>
            Move "{component?.name}" to another dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="text-center text-muted-foreground">
              Loading dashboards...
            </div>
          ) : availableDashboards.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No other dashboards available. Create another dashboard first.
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="target-dashboard">Target Dashboard</Label>
              <Select
                value={selectedDashboardId}
                onValueChange={setSelectedDashboardId}
              >
                <SelectTrigger id="target-dashboard">
                  <SelectValue placeholder="Select a dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {availableDashboards.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={String(dashboard.id)}>
                      {dashboard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedDashboardId || moving || loading}
          >
            {moving ? "Moving..." : "Move"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
