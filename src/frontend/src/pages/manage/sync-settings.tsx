import { useState, useEffect } from "react";
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
import Upload from "lucide-react/dist/esm/icons/upload";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Check from "lucide-react/dist/esm/icons/check";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Database from "lucide-react/dist/esm/icons/database";
import { api } from "@/api/client";
import {
  parseReferendaCSV,
  parseChildBountiesCSV,
  parseBountiesCSV,
  parseTreasuryNetflowsCSV,
  parseCategoriesCSV,
  parseCrossChainFlowsCSV,
  parseLocalFlowsCSV,
} from "@/lib/csv-parser";
import { RequireAuth } from "@/components/auth/require-auth";

type StatusType = { type: "success" | "error"; message: string } | null;

function SyncSettingsPageContent() {
  const [categoriesFile, setCategoriesFile] = useState<File | null>(null);
  const [referendaFile, setReferendaFile] = useState<File | null>(null);
  const [childBountiesFile, setChildBountiesFile] = useState<File | null>(null);
  const [bountiesFile, setBountiesFile] = useState<File | null>(null);
  const [netflowsFile, setNetflowsFile] = useState<File | null>(null);
  const [crossChainFlowsFile, setCrossChainFlowsFile] = useState<File | null>(null);
  const [localFlowsFile, setLocalFlowsFile] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusType>(null);
  const [importing, setImporting] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{
    size: number;
    sizeFormatted: string;
  } | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  // Fetch backup info on mount
  useEffect(() => {
    fetch("/api/backup/info", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setBackupInfo(data))
      .catch(() => {}); // Silently fail if backup info unavailable
  }, []);

  async function handleDownloadBackup() {
    setBackupLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/backup/download", {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `opengov-backup-${timestamp}.db`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus({ type: "success", message: "Backup downloaded successfully" });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setBackupLoading(false);
    }
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

  async function handleBountiesUpload() {
    if (!bountiesFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const content = await bountiesFile.text();
      const rawItems = parseBountiesCSV(content);
      if (rawItems.length === 0) {
        setStatus({ type: "error", message: "No valid rows in CSV file" });
        return;
      }

      const items = rawItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
      }));

      const result = await api.bounties.import(items);
      setStatus({
        type: "success",
        message: `Imported ${result.count} bounty categories`,
      });
      setBountiesFile(null);
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function applyDefaultBounties() {
    setImporting(true);
    setStatus(null);
    try {
      const { content } = await api.sync.getDefaultBounties();
      const rawItems = parseBountiesCSV(content);
      if (rawItems.length === 0) {
        setStatus({ type: "error", message: "No valid rows in default file" });
        return;
      }

      const items = rawItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
      }));

      const result = await api.bounties.import(items);
      setStatus({
        type: "success",
        message: `Applied ${result.count} default bounty categories`,
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

  async function handleCrossChainFlowsUpload() {
    if (!crossChainFlowsFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const content = await crossChainFlowsFile.text();
      const items = parseCrossChainFlowsCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows found in CSV" });
        return;
      }

      const result = await api.crossChainFlows.import(items);
      setStatus({
        type: "success",
        message: `Imported ${result.count} cross chain flow records (table replaced)`,
      });
      setCrossChainFlowsFile(null);
      const input = document.getElementById("cross-chain-flows-csv") as HTMLInputElement;
      if (input) input.value = "";
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function applyDefaultCrossChainFlows() {
    setImporting(true);
    setStatus(null);
    try {
      const { content } = await api.sync.getDefaultCrossChainFlows();
      const items = parseCrossChainFlowsCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows in default file" });
        return;
      }

      const result = await api.crossChainFlows.import(items);
      setStatus({
        type: "success",
        message: `Applied ${result.count} default cross chain flow records (table replaced)`,
      });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function handleLocalFlowsUpload() {
    if (!localFlowsFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const content = await localFlowsFile.text();
      const items = parseLocalFlowsCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows found in CSV" });
        return;
      }

      const result = await api.localFlows.import(items);
      setStatus({
        type: "success",
        message: `Imported ${result.count} local flow records (table replaced)`,
      });
      setLocalFlowsFile(null);
      const input = document.getElementById("local-flows-csv") as HTMLInputElement;
      if (input) input.value = "";
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function applyDefaultLocalFlows() {
    setImporting(true);
    setStatus(null);
    try {
      const { content } = await api.sync.getDefaultLocalFlows();
      const items = parseLocalFlowsCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows in default file" });
        return;
      }

      const result = await api.localFlows.import(items);
      setStatus({
        type: "success",
        message: `Applied ${result.count} default local flow records (table replaced)`,
      });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function handleCategoriesUpload() {
    if (!categoriesFile) return;
    setImporting(true);
    setStatus(null);
    try {
      const content = await categoriesFile.text();
      const items = parseCategoriesCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows found in CSV" });
        return;
      }

      const result = await api.categories.import(items);
      setStatus({
        type: "success",
        message: `Imported ${result.count} categories`,
      });
      setCategoriesFile(null);
      // Reset file input
      const input = document.getElementById("categories-csv") as HTMLInputElement;
      if (input) input.value = "";
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    } finally {
      setImporting(false);
    }
  }

  async function applyDefaultCategories() {
    setImporting(true);
    setStatus(null);
    try {
      const { content } = await api.sync.getDefaultCategories();
      const items = parseCategoriesCSV(content);
      if (items.length === 0) {
        setStatus({ type: "error", message: "No valid rows in default file" });
        return;
      }

      const result = await api.categories.import(items);
      setStatus({
        type: "success",
        message: `Applied ${result.count} default categories`,
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
          className={`flex items-start gap-2 p-4 rounded-lg ${
            status.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {status.type === "success" ? (
            <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          )}
          <pre className="whitespace-pre-wrap font-sans text-sm flex-1">
            {status.message}
          </pre>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Import all unique category/subcategory pairs (aggregated from all sources)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categories-csv">Upload CSV File</Label>
              <Input
                id="categories-csv"
                type="file"
                accept=".csv"
                onChange={(e) => setCategoriesFile(e.target.files?.[0] || null)}
                disabled={importing}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCategoriesUpload}
                disabled={!categoriesFile || importing}
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
                onClick={applyDefaultCategories}
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
            <CardTitle>Bounties Categories</CardTitle>
            <CardDescription>
              Import category mappings for parent bounties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bounties-csv">Upload CSV File</Label>
              <Input
                id="bounties-csv"
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setBountiesFile(e.target.files?.[0] || null)
                }
                disabled={importing}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleBountiesUpload}
                disabled={!bountiesFile || importing}
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
                onClick={applyDefaultBounties}
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

        <Card>
          <CardHeader>
            <CardTitle>Cross Chain Flows</CardTitle>
            <CardDescription>
              Import cross chain flow data (replaces existing data)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cross-chain-flows-csv">Upload CSV File</Label>
              <Input
                id="cross-chain-flows-csv"
                type="file"
                accept=".csv"
                onChange={(e) => setCrossChainFlowsFile(e.target.files?.[0] || null)}
                disabled={importing}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCrossChainFlowsUpload}
                disabled={!crossChainFlowsFile || importing}
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
                onClick={applyDefaultCrossChainFlows}
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
            <CardTitle>Local Flows</CardTitle>
            <CardDescription>
              Import local flow data (replaces existing data)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="local-flows-csv">Upload CSV File</Label>
              <Input
                id="local-flows-csv"
                type="file"
                accept=".csv"
                onChange={(e) => setLocalFlowsFile(e.target.files?.[0] || null)}
                disabled={importing}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLocalFlowsUpload}
                disabled={!localFlowsFile || importing}
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
                onClick={applyDefaultLocalFlows}
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
            <CardTitle>Database Backup</CardTitle>
            <CardDescription>
              Download a complete copy of the database
              {backupInfo && ` (${backupInfo.sizeFormatted})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleDownloadBackup}
              disabled={backupLoading || importing}
              variant="outline"
              className="w-full"
            >
              {backupLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Download Backup
            </Button>
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
            <strong>Categories CSV:</strong>{" "}
            <code className="bg-muted px-1 rounded">
              category, subcategory
            </code>
          </p>
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
          <p className="text-sm text-muted-foreground">
            <strong>Cross Chain Flows CSV:</strong>{" "}
            <code className="bg-muted px-1 rounded">
              Message Hash, From Account, To Account, Block, Time, Value, Protocol, Status, ...
            </code>
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Local Flows CSV:</strong>{" "}
            <code className="bg-muted px-1 rounded">
              Extrinsic ID, Date, Block, Hash, Symbol, From, To, Value, Result, year-month, quarter
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
