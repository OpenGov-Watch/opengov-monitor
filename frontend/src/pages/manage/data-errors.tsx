import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Eye } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";

interface DataError {
  id: number;
  table_name: string;
  record_id: string;
  error_type: string;
  error_message: string;
  raw_data: string | null;
  metadata: string | null;
  timestamp: string;
}

function DataErrorsPageContent() {
  const [errors, setErrors] = useState<DataError[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState<string>("");
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>("");
  const [viewingData, setViewingData] = useState<{ type: "raw" | "metadata"; data: string } | null>(null);

  useEffect(() => {
    fetchErrors();
  }, [tableFilter, errorTypeFilter]);

  async function fetchErrors() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tableFilter) params.append("table_name", tableFilter);
      if (errorTypeFilter) params.append("error_type", errorTypeFilter);

      const response = await fetch(`/api/data-errors?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setErrors(data);
    } catch (error) {
      console.error("Failed to fetch data errors:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(timestamp: string) {
    return new Date(timestamp).toLocaleString();
  }

  function viewData(type: "raw" | "metadata", dataString: string | null) {
    if (!dataString) {
      setViewingData({ type, data: "No data available" });
      return;
    }

    try {
      const parsed = JSON.parse(dataString);
      setViewingData({ type, data: JSON.stringify(parsed, null, 2) });
    } catch {
      setViewingData({ type, data: dataString });
    }
  }

  // Extract unique table names and error types for filters
  const tableNames = Array.from(new Set(errors.map(e => e.table_name))).sort();
  const errorTypes = Array.from(new Set(errors.map(e => e.error_type))).sort();

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Data Validation Errors</h1>
        <p className="text-muted-foreground">
          View and diagnose data validation errors across all tables
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Label htmlFor="table-filter">Table</Label>
          <Select value={tableFilter || undefined} onValueChange={setTableFilter}>
            <SelectTrigger id="table-filter">
              <SelectValue placeholder="All tables" />
            </SelectTrigger>
            <SelectContent>
              {tableNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <Label htmlFor="error-filter">Error Type</Label>
          <Select value={errorTypeFilter || undefined} onValueChange={setErrorTypeFilter}>
            <SelectTrigger id="error-filter">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {errorTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              setTableFilter("");
              setErrorTypeFilter("");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {errors.length} error{errors.length !== 1 ? "s" : ""}
          {(tableFilter || errorTypeFilter) && " (filtered)"}
        </div>
      )}

      {/* Errors table */}
      {loading ? (
        <div className="text-center py-8">Loading errors...</div>
      ) : errors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No errors found
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead>Error Type</TableHead>
                <TableHead>Error Message</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((error) => (
                <TableRow key={error.id}>
                  <TableCell className="font-medium">{error.table_name}</TableCell>
                  <TableCell>{error.record_id}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                      {error.error_type}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-md truncate" title={error.error_message}>
                    {error.error_message}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTimestamp(error.timestamp)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {error.metadata && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewData("metadata", error.metadata)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Metadata
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Error Metadata - Record {error.record_id}</DialogTitle>
                            </DialogHeader>
                            <pre className="text-xs overflow-auto p-4 bg-muted rounded-md">
                              {viewingData?.type === "metadata" ? viewingData.data : ""}
                            </pre>
                          </DialogContent>
                        </Dialog>
                      )}
                      {error.raw_data && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewData("raw", error.raw_data)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Raw Data
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Raw API Data - Record {error.record_id}</DialogTitle>
                            </DialogHeader>
                            <pre className="text-xs overflow-auto p-4 bg-muted rounded-md">
                              {viewingData?.type === "raw" ? viewingData.data : ""}
                            </pre>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function DataErrorsPage() {
  return (
    <RequireAuth>
      <DataErrorsPageContent />
    </RequireAuth>
  );
}
