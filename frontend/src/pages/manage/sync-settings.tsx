import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/api/client";
import {
  parseReferendaCSV,
  parseChildBountiesCSV,
} from "@/lib/csv-parser";
import { RequireAuth } from "@/components/auth/require-auth";

type StatusType = { type: "success" | "error"; message: string } | null;

function SyncSettingsPageContent() {
  const [referendaFile, setReferendaFile] = useState<File | null>(null);
  const [childBountiesFile, setChildBountiesFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [importing, setImporting] = useState(false);

  // Helper to resolve category strings to category_id
  async function resolveCategoryId(
    category: string | null,
    subcategory: string | null
  ): Promise<number | null> {
    if (!category) return null;
    const result = await api.categories.lookup(category, subcategory || "");
    return result.id;
  }

  async function handleReferendaUpload() {
    if (!referendaFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const content = await referendaFile.text();
      const rawItems = parseReferendaCSV(content);
      if (rawItems.length === 0) {
        setStatus({ type: "error", message: "No valid rows found in CSV" });
        return;
      }

      // Resolve category strings to category_id
      const items = await Promise.all(
        rawItems.map(async (item) => ({
          id: item.id,
          category_id: await resolveCategoryId(item.category ?? null, item.subcategory ?? null),
          notes: item.notes,
          hide_in_spends: item.hide_in_spends,
        }))
      );

      const result = await api.referenda.import(items);
      setStatus({
        type: "success",
        message: `Imported ${result.count} referenda categories`,
      });
      setReferendaFile(null);
      // Reset file input
      const input = document.getElementById("referenda-csv") as HTMLInputElement;
      if (input) input.value = "";
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function handleChildBountiesUpload() {
    if (!childBountiesFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const content = await childBountiesFile.text();
      const rawItems = parseChildBountiesCSV(content);
      if (rawItems.length === 0) {
        setStatus({ type: "error", message: "No valid rows found in CSV" });
        return;
      }

      // Resolve category strings to category_id
      const items = await Promise.all(
        rawItems.map(async (item) => ({
          identifier: item.identifier,
          category_id: await resolveCategoryId(item.category ?? null, item.subcategory ?? null),
          notes: item.notes,
          hide_in_spends: item.hide_in_spends,
        }))
      );

      const result = await api.childBounties.import(items);
      setStatus({
        type: "success",
        message: `Imported ${result.count} child bounty categories`,
      });
      setChildBountiesFile(null);
      // Reset file input
      const input = document.getElementById(
        "child-bounties-csv"
      ) as HTMLInputElement;
      if (input) input.value = "";
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function applyDefaultReferenda() {
    setImporting(true);
    setStatus(null);
    try {
      const { content } = await api.sync.getDefaultReferenda();
      const rawItems = parseReferendaCSV(content);
      if (rawItems.length === 0) {
        setStatus({ type: "error", message: "No valid rows in default file" });
        return;
      }

      // Resolve category strings to category_id
      const items = await Promise.all(
        rawItems.map(async (item) => ({
          id: item.id,
          category_id: await resolveCategoryId(item.category ?? null, item.subcategory ?? null),
          notes: item.notes,
          hide_in_spends: item.hide_in_spends,
        }))
      );

      const result = await api.referenda.import(items);
      setStatus({
        type: "success",
        message: `Applied ${result.count} default referenda categories`,
      });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function applyDefaultChildBounties() {
    setImporting(true);
    setStatus(null);
    try {
      const { content } = await api.sync.getDefaultChildBounties();
      const rawItems = parseChildBountiesCSV(content);
      if (rawItems.length === 0) {
        setStatus({ type: "error", message: "No valid rows in default file" });
        return;
      }

      // Resolve category strings to category_id
      const items = await Promise.all(
        rawItems.map(async (item) => ({
          identifier: item.identifier,
          category_id: await resolveCategoryId(item.category ?? null, item.subcategory ?? null),
          notes: item.notes,
          hide_in_spends: item.hide_in_spends,
        }))
      );

      const result = await api.childBounties.import(items);
      setStatus({
        type: "success",
        message: `Applied ${result.count} default child bounty categories`,
      });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sync Settings</h1>
        <p className="text-muted-foreground">
          Import category mappings from CSV files or apply default mappings
        </p>
      </div>

      {status && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            status.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {status.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {status.message}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Referenda Categories</CardTitle>
            <CardDescription>
              Import category mappings for governance referenda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="referenda-csv">Upload CSV File</Label>
              <Input
                id="referenda-csv"
                type="file"
                accept=".csv"
                onChange={(e) => setReferendaFile(e.target.files?.[0] || null)}
                disabled={importing}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleReferendaUpload}
                disabled={!referendaFile || importing}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={applyDefaultReferenda}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Apply Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Child Bounties Categories</CardTitle>
            <CardDescription>
              Import category mappings for child bounties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="child-bounties-csv">Upload CSV File</Label>
              <Input
                id="child-bounties-csv"
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setChildBountiesFile(e.target.files?.[0] || null)
                }
                disabled={importing}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleChildBountiesUpload}
                disabled={!childBountiesFile || importing}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={applyDefaultChildBounties}
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Apply Defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSV Format</CardTitle>
          <CardDescription>
            The CSV files should have the following columns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>Referenda CSV:</strong>{" "}
            <code className="bg-muted px-1 rounded">
              id, category, subcategory, notes, hide_in_spends
            </code>
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Child Bounties CSV:</strong>{" "}
            <code className="bg-muted px-1 rounded">
              identifier, category, subcategory, notes, hide_in_spends
            </code>
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            The <code className="bg-muted px-1 rounded">hide_in_spends</code>{" "}
            column accepts: 0, 1, true, false, x, yes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SyncSettingsPage() {
  return (
    <RequireAuth>
      <SyncSettingsPageContent />
    </RequireAuth>
  );
}
