/**
 * Generate CSV content from data array
 * @param data Array of objects to convert to CSV
 * @returns CSV string content
 */
export function generateCSVContent(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const stringValue =
            value === null || value === undefined ? "" : String(value);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    ),
  ].join("\n");

  return csvContent;
}

/**
 * Generate JSON content from data array
 * @param data Array to convert to JSON
 * @returns Pretty-printed JSON string
 */
export function generateJSONContent(data: unknown[]): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export data as CSV file
 * @param data Array of objects to export
 * @param filename Filename without extension
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  if (data.length === 0) return;

  const csvContent = generateCSVContent(data);
  downloadFile(csvContent, `${filename}.csv`, "text/csv");
}

/**
 * Export data as JSON file
 * @param data Array to export
 * @param filename Filename without extension
 */
export function exportToJSON(data: unknown[], filename: string): void {
  const jsonContent = generateJSONContent(data);
  downloadFile(jsonContent, `${filename}.json`, "application/json");
}

/**
 * Trigger file download in browser
 * @param content File content as string
 * @param filename Full filename with extension
 * @param mimeType MIME type of the file
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
