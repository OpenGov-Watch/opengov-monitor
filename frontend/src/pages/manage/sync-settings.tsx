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
  parseTreasuryNetflowsCSV,
} from "@/lib/csv-parser";
import { RequireAuth } from "@/components/auth/require-auth";

type StatusType = { type: "success" | "error"; message: string } | null;

function SyncSettingsPageContent() {
  const [referendaFile, setReferendaFile] = useState<File | null>(null);
  const [childBountiesFile, setChildBountiesFile] = useState<File | null>(null);
  const [netflowsFile, setNetflowsFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [importing, setImporting] = useState(false);

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

      // Send category strings directly - backend will resolve them
      const items = rawItems.map((item) => ({
        id: item.id,
        category: item.category ?? null,
        subcategory: item.subcategory ?? null,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

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

      // Send category strings directly - backend will resolve them
      const items = rawItems.map((item) => ({
        identifier: item.identifier,
        category: item.category ?? null,
        subcategory: item.subcategory ?? null,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

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

      // Send category strings directly - backend will resolve them
      const items = rawItems.map((item) => ({
        id: item.id,
        category: item.category ?? null,
        subcategory: item.subcategory ?? null,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

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

      // Send category strings directly - backend will resolve them
      const items = rawItems.map((item) => ({
        identifier: item.identifier,
        category: item.category ?? null,
        subcategory: item.subcategory ?? null,
        notes: item.notes,
        hide_in_spends: item.hide_in_spends,
      }));

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

  async function handleNetflowsUpload() {
    if (!netflowsFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const content = await netflowsFile.text();
      const items = parseTreasuryNetflowsCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows found in CSV" });
        return;
      }

      const result = await api.treasuryNetflows.import(items);
      setStatus({
        type: "success",
        message: `Imported ${result.count} treasury netflow records (table replaced)`,
      });
      setNetflowsFile(null);
      const input = document.getElementById("netflows-csv") as HTMLInputElement;
      if (input) input.value = "";
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function applyDefaultNetflows() {
    setImporting(true);
    setStatus(null);
    try {
      const { content } = await api.sync.getDefaultTreasuryNetflows();
      const items = parseTreasuryNetflowsCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows in default file" });
        return;
      }

      const result = await api.treasuryNetflows.import(items);
      setStatus({
        type: "success",
        message: `Applied ${result.count} default treasury netflow records (table replaced)`,
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

        <Card>
          <CardHeader>
            <CardTitle>Treasury Netflows</CardTitle>
            <CardDescription>
              Import quarterly treasury flow data (replaces existing data)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="netflows-csv">Upload CSV File</Label>
              <Input
                id="netflows-csv"
                type="file"
                accept=".csv"
                onChange={(e) => setNetflowsFile(e.target.files?.[0] || null)}
                disabled={importing}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleNetflowsUpload}
                disabled={!netflowsFile || importing}
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
                onClick={applyDefaultNetflows}
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
          <p className="text-sm text-muted-foreground">
            <strong>Treasury Netflows CSV:</strong>{" "}
            <code className="bg-muted px-1 rounded">
              month, asset_name, flow_type, amount_usd, amount_dot_equivalent
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
