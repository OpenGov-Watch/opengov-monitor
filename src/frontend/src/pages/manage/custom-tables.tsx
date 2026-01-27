import { useState, useEffect, useCallback, useRef } from "react";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import Upload from "lucide-react/dist/esm/icons/upload";
import Eye from "lucide-react/dist/esm/icons/eye";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import { RequireAuth } from "@/components/auth/require-auth";
import Papa from "papaparse";

// Types for custom tables
interface CustomTableColumnDef {
  name: string;
  type: "text" | "integer" | "real" | "date" | "boolean";
  nullable: boolean;
}

interface CustomTableSchema {
  columns: CustomTableColumnDef[];
}

interface CustomTableMetadata {
  id: number;
  table_name: string;
  display_name: string;
  schema_json: string;
  row_count: number;
  created_at: string | null;
  updated_at: string | null;
}

const COLUMN_TYPES = [
  { value: "text", label: "Text" },
  { value: "integer", label: "Integer" },
  { value: "real", label: "Decimal" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
];

function CustomTablesPageContent() {
  const [tables, setTables] = useState<CustomTableMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Create table state
  const [_csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [inferredSchema, setInferredSchema] = useState<CustomTableSchema | null>(null);
  const [editableSchema, setEditableSchema] = useState<CustomTableColumnDef[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [createStep, setCreateStep] = useState<"upload" | "schema" | "confirm">("upload");
  const [createError, setCreateError] = useState<string | null>(null);

  // View table state
  const [selectedTable, setSelectedTable] = useState<CustomTableMetadata | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [dataTotal, setDataTotal] = useState(0);
  const [dataOffset, setDataOffset] = useState(0);
  const [dataLimit] = useState(50);
  const [dataLoading, setDataLoading] = useState(false);

  // Row edit state
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [rowFormData, setRowFormData] = useState<Record<string, string>>({});

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importWipe, setImportWipe] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  async function fetchTables() {
    try {
      const response = await fetch("/api/custom-tables");
      const data = await response.json();
      setTables(data);
    } catch (error) {
      console.error("Failed to fetch custom tables:", error);
    } finally {
      setLoading(false);
    }
  }

  function resetCreateState() {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setInferredSchema(null);
    setEditableSchema([]);
    setDisplayName("");
    setCreateStep("upload");
    setCreateError(null);
  }

  function processFile(file: File) {
    setCsvFile(file);
    setDisplayName(file.name.replace(/\.csv$/i, ""));

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields || [];
        const data = results.data;

        setCsvHeaders(headers);
        setCsvData(data);

        // Call API to infer schema
        try {
          const response = await fetch("/api/custom-tables/infer-schema", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headers, rows: data.slice(0, 100) }),
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to infer schema");
          }

          const { schema, errors } = await response.json();
          setInferredSchema(schema);
          setEditableSchema(schema.columns);

          if (errors && errors.length > 0) {
            setCreateError(errors.join("; "));
          }

          setCreateStep("schema");
        } catch (error) {
          setCreateError((error as Error).message);
        }
      },
      error: (error) => {
        setCreateError(`CSV parsing error: ${error.message}`);
      },
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function handleFileDrop(file: File) {
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      processFile(file);
    } else {
      setCreateError("Please drop a CSV file");
    }
  }

  function handleSchemaColumnChange(index: number, field: keyof CustomTableColumnDef, value: string | boolean) {
    setEditableSchema((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function handleCreateTable() {
    if (!displayName.trim()) {
      setCreateError("Display name is required");
      return;
    }

    setCreateError(null);

    try {
      // Map CSV data to use the edited column names
      const mappedData = csvData.map((row) => {
        const mapped: Record<string, string | number | null> = {};
        editableSchema.forEach((col, i) => {
          const originalHeader = csvHeaders[i];
          mapped[col.name] = row[originalHeader] ?? null;
        });
        return mapped;
      });

      const response = await fetch("/api/custom-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          schema: { columns: editableSchema },
          data: mappedData,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create table");
      }

      setCreateDialogOpen(false);
      resetCreateState();
      fetchTables();
    } catch (error) {
      setCreateError((error as Error).message);
    }
  }

  async function handleDeleteTable(table: CustomTableMetadata) {
    if (!confirm(`Are you sure you want to delete "${table.display_name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await fetch(`/api/custom-tables/${table.id}`, { method: "DELETE" });
      fetchTables();
    } catch (error) {
      console.error("Failed to delete table:", error);
    }
  }

  async function openViewDialog(table: CustomTableMetadata) {
    setSelectedTable(table);
    setDataOffset(0);
    setViewDialogOpen(true);
    await fetchTableData(table, 0);
  }

  async function fetchTableData(table: CustomTableMetadata, offset: number = 0) {
    setDataLoading(true);
    try {
      const response = await fetch(`/api/custom-tables/${table.id}/data?limit=${dataLimit}&offset=${offset}`);
      const data = await response.json();
      setTableData(data.rows);
      setDataTotal(data.total);
      setDataOffset(offset);
    } catch (error) {
      console.error("Failed to fetch table data:", error);
    } finally {
      setDataLoading(false);
    }
  }

  function openAddRowDialog() {
    if (!selectedTable) return;
    setEditingRow(null);
    const schema: CustomTableSchema = JSON.parse(selectedTable.schema_json);
    const initialData: Record<string, string> = {};
    schema.columns.forEach((col) => {
      initialData[col.name] = "";
    });
    setRowFormData(initialData);
    setRowDialogOpen(true);
  }

  function openEditRowDialog(row: Record<string, unknown>) {
    if (!selectedTable) return;
    setEditingRow(row);
    const schema: CustomTableSchema = JSON.parse(selectedTable.schema_json);
    const formData: Record<string, string> = {};
    schema.columns.forEach((col) => {
      formData[col.name] = row[col.name]?.toString() ?? "";
    });
    setRowFormData(formData);
    setRowDialogOpen(true);
  }

  async function handleSaveRow() {
    if (!selectedTable) return;

    try {
      if (editingRow) {
        // Update
        await fetch(`/api/custom-tables/${selectedTable.id}/data/${editingRow._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: rowFormData }),
        });
      } else {
        // Create
        await fetch(`/api/custom-tables/${selectedTable.id}/data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: rowFormData }),
        });
      }

      setRowDialogOpen(false);
      await fetchTableData(selectedTable, dataOffset);
      fetchTables(); // Update row count
    } catch (error) {
      console.error("Failed to save row:", error);
    }
  }

  async function handleDeleteRow(rowId: number) {
    if (!selectedTable) return;
    if (!confirm("Are you sure you want to delete this row?")) return;

    try {
      await fetch(`/api/custom-tables/${selectedTable.id}/data/${rowId}`, {
        method: "DELETE",
      });
      await fetchTableData(selectedTable, dataOffset);
      fetchTables(); // Update row count
    } catch (error) {
      console.error("Failed to delete row:", error);
    }
  }

  // Import handlers
  function openImportDialog() {
    setImportFile(null);
    setImportWipe(false);
    setImportError(null);
    setImportDialogOpen(true);
  }

  function handleImportFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportError(null);
    }
  }

  async function handleImport() {
    if (!selectedTable || !importFile) return;

    setImportError(null);

    Papa.parse<Record<string, string>>(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        const schema: CustomTableSchema = JSON.parse(selectedTable.schema_json);

        // Map data to use schema column names
        const mappedData = data.map((row) => {
          const mapped: Record<string, string | number | null> = {};
          schema.columns.forEach((col) => {
            // Try to find the column in the CSV data
            mapped[col.name] = row[col.name] ?? null;
          });
          return mapped;
        });

        try {
          const response = await fetch(`/api/custom-tables/${selectedTable.id}/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: mappedData, wipe: importWipe }),
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Import failed");
          }

          setImportDialogOpen(false);
          await fetchTableData(selectedTable, 0);
          fetchTables();
        } catch (error) {
          setImportError((error as Error).message);
        }
      },
      error: (error) => {
        setImportError(`CSV parsing error: ${error.message}`);
      },
    });
  }

  const getSchema = useCallback((table: CustomTableMetadata): CustomTableSchema => {
    return JSON.parse(table.schema_json);
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Custom Tables</h1>
          <p className="text-muted-foreground">
            Create and manage custom data tables via CSV import
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetCreateState();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Table
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {createStep === "upload" && "Upload CSV File"}
                {createStep === "schema" && "Configure Schema"}
                {createStep === "confirm" && "Confirm & Create"}
              </DialogTitle>
            </DialogHeader>

            {createStep === "upload" && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary hover:bg-muted/50 transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      handleFileDrop(file);
                    }
                  }}
                >
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drop a CSV file here or click to browse
                  </p>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="sr-only"
                  />
                  <Button asChild>
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      Select CSV File
                    </label>
                  </Button>
                </div>
                {createError && (
                  <p className="text-destructive text-sm">{createError}</p>
                )}
              </div>
            )}

            {createStep === "schema" && inferredSchema && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Table Name *</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="My Custom Table"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Schema Configuration</Label>
                  <p className="text-sm text-muted-foreground">
                    Review and adjust column types. Detected {csvData.length} rows.
                  </p>
                  <div className="border rounded-md max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Original Header</TableHead>
                          <TableHead>Column Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="w-20">Nullable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editableSchema.map((col, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {csvHeaders[index]}
                            </TableCell>
                            <TableCell>
                              <Input
                                value={col.name}
                                onChange={(e) => handleSchemaColumnChange(index, "name", e.target.value)}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={col.type}
                                onValueChange={(value) => handleSchemaColumnChange(index, "type", value)}
                              >
                                <SelectTrigger className="h-8 w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COLUMN_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={col.nullable}
                                onChange={(e) => handleSchemaColumnChange(index, "nullable", e.target.checked)}
                                className="h-4 w-4"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {createError && (
                  <p className="text-destructive text-sm">{createError}</p>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateStep("upload")}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={handleCreateTable}>
                    Create Table
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Tables List */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Internal Name</TableHead>
              <TableHead className="text-right">Columns</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((table) => {
              const schema = getSchema(table);
              return (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">{table.display_name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {table.table_name}
                  </TableCell>
                  <TableCell className="text-right">{schema.columns.length}</TableCell>
                  <TableCell className="text-right">{table.row_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {table.created_at ? new Date(table.created_at).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openViewDialog(table)}
                        title="View Data"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTable(table)}
                        title="Delete Table"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {tables.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No custom tables. Click "Create Table" to upload a CSV.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Table Data Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedTable?.display_name}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openImportDialog}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-import
                </Button>
                <Button size="sm" onClick={openAddRowDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Row
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              {dataTotal} rows total | Showing {dataOffset + 1}-{Math.min(dataOffset + dataLimit, dataTotal)}
            </DialogDescription>
          </DialogHeader>

          {selectedTable && (
            <div className="flex-1 overflow-auto">
              {dataLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      {getSchema(selectedTable).columns.map((col) => (
                        <TableHead key={col.name}>
                          {col.name}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {col.type}
                          </Badge>
                        </TableHead>
                      ))}
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row) => (
                      <TableRow key={row._id as number}>
                        <TableCell className="font-mono text-sm">{row._id as number}</TableCell>
                        {getSchema(selectedTable).columns.map((col) => (
                          <TableCell key={col.name} className="max-w-[200px] truncate">
                            {row[col.name] != null ? String(row[col.name]) : <span className="text-muted-foreground">null</span>}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditRowDialog(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRow(row._id as number)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tableData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={getSchema(selectedTable).columns.length + 2} className="text-center text-muted-foreground">
                          No data. Click "Add Row" or "Re-import" to add data.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* Pagination */}
          {dataTotal > dataLimit && selectedTable && (
            <div className="flex justify-center gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={dataOffset === 0}
                onClick={() => fetchTableData(selectedTable, Math.max(0, dataOffset - dataLimit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={dataOffset + dataLimit >= dataTotal}
                onClick={() => fetchTableData(selectedTable, dataOffset + dataLimit)}
              >
                Next
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Row Edit Dialog */}
      <Dialog open={rowDialogOpen} onOpenChange={setRowDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRow ? "Edit Row" : "Add Row"}</DialogTitle>
          </DialogHeader>
          {selectedTable && (
            <form onSubmit={(e) => { e.preventDefault(); handleSaveRow(); }} className="space-y-4">
              {getSchema(selectedTable).columns.map((col) => (
                <div key={col.name} className="space-y-2">
                  <Label htmlFor={col.name}>
                    {col.name}
                    <Badge variant="outline" className="ml-2 text-xs">{col.type}</Badge>
                    {!col.nullable && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {col.type === "boolean" ? (
                    <Select
                      value={rowFormData[col.name] || "__none__"}
                      onValueChange={(value) => setRowFormData((prev) => ({ ...prev, [col.name]: value === "__none__" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {col.nullable && <SelectItem value="__none__">None</SelectItem>}
                        <SelectItem value="1">Yes / True</SelectItem>
                        <SelectItem value="0">No / False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : col.type === "date" ? (
                    <Input
                      id={col.name}
                      type="date"
                      value={rowFormData[col.name] || ""}
                      onChange={(e) => setRowFormData((prev) => ({ ...prev, [col.name]: e.target.value }))}
                      required={!col.nullable}
                    />
                  ) : col.type === "integer" || col.type === "real" ? (
                    <Input
                      id={col.name}
                      type="number"
                      step={col.type === "real" ? "any" : "1"}
                      value={rowFormData[col.name] || ""}
                      onChange={(e) => setRowFormData((prev) => ({ ...prev, [col.name]: e.target.value }))}
                      required={!col.nullable}
                    />
                  ) : (
                    <Input
                      id={col.name}
                      value={rowFormData[col.name] || ""}
                      onChange={(e) => setRowFormData((prev) => ({ ...prev, [col.name]: e.target.value }))}
                      required={!col.nullable}
                    />
                  )}
                </div>
              ))}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRowDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRow ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-import Data</DialogTitle>
            <DialogDescription>
              Import data from a CSV file. Column names must match the table schema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => importFileInputRef.current?.click()}
              >
                {importFile ? importFile.name : "Select CSV File"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wipe"
                checked={importWipe}
                onChange={(e) => setImportWipe(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="wipe" className="font-normal">
                Wipe existing data before import
              </Label>
            </div>
            {importError && (
              <p className="text-destructive text-sm">{importError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomTablesPage() {
  return (
    <RequireAuth>
      <CustomTablesPageContent />
    </RequireAuth>
  );
}
