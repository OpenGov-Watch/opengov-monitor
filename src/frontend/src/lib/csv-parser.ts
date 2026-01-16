/**
 * CSV Parser utilities for importing category mappings.
 * Supports both the simplified format (id, category, subcategory, notes, hide_in_spends)
 * and the exploration format from spreadsheets.
 */

export interface ReferendaCsvRow {
  id: number;
  category: string;
  subcategory: string;
  notes: string;
  hide_in_spends: number;
}

export interface ChildBountyCsvRow {
  identifier: string;
  category: string;
  subcategory: string;
  notes: string;
  hide_in_spends: number;
}

export interface BountyCsvRow {
  id: number;
  name: string;
  category: string | null;
  subcategory: string | null;
}

export interface NetflowCsvRow {
  month: string;
  asset_name: string;
  flow_type: string;
  amount_usd: number;
  amount_dot_equivalent: number;
}

/**
 * Parse a single CSV line, handling quoted values with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV content into array of objects with headers as keys
 */
export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse referenda CSV content.
 * Supports multiple column name formats:
 * - Simplified: id, category, subcategory, notes, hide_in_spends
 * - Exploration: #, Category, Subcategory, Notes, "hide from income statement..."
 */
export function parseReferendaCSV(content: string): ReferendaCsvRow[] {
  const rows = parseCSV(content);
  return rows
    .map((row) => {
      // Support multiple column name formats
      const id = parseInt(row.id || row["#"] || "", 10);
      const category = row.category || row.Category || "";
      const subcategory = row.subcategory || row.Subcategory || "";
      const notes = row.notes || row.Notes || row.NOTE || "";

      // Handle hide_in_spends with multiple possible column names
      let hideValue =
        row.hide_in_spends ||
        row["hide from income statement (represented via child bounties and/or via the balance sheet)"] ||
        row["hide from income statement"] ||
        "";
      const hide_in_spends =
        hideValue === "1" ||
        hideValue.toLowerCase() === "true" ||
        hideValue.toLowerCase() === "x" ||
        hideValue.toLowerCase() === "yes"
          ? 1
          : 0;

      return { id, category, subcategory, notes, hide_in_spends };
    })
    .filter((row) => !isNaN(row.id));
}

/**
 * Parse child bounties CSV content.
 * Supports multiple column name formats:
 * - Simplified: identifier, category, subcategory, notes, hide_in_spends
 * - Exploration: #, parentBountyID, Category, Subcategory, NOTE, "hide from income statement"
 */
export function parseChildBountiesCSV(content: string): ChildBountyCsvRow[] {
  const rows = parseCSV(content);
  return rows
    .map((row) => {
      // Support multiple column name formats
      let identifier = row.identifier || "";

      // If using exploration format, construct identifier from parentBountyID and index
      if (!identifier && row.parentBountyID) {
        const index = row.index || row["#"] || "";
        const parentId = row.parentBountyID;
        if (index && parentId) {
          identifier = `${parentId}-${index}`;
        }
      }

      const category = row.category || row.Category || "";
      const subcategory = row.subcategory || row.Subcategory || "";
      const notes = row.notes || row.Notes || row.NOTE || "";

      // Handle hide_in_spends with multiple possible column names
      let hideValue =
        row.hide_in_spends || row["hide from income statement"] || "";
      const hide_in_spends =
        hideValue === "1" ||
        hideValue.toLowerCase() === "true" ||
        hideValue.toLowerCase() === "x" ||
        hideValue.toLowerCase() === "yes"
          ? 1
          : 0;

      return { identifier, category, subcategory, notes, hide_in_spends };
    })
    .filter((row) => row.identifier !== "");
}

/**
 * Parse bounties CSV content.
 * Expected format: id, name, category, subcategory
 */
export function parseBountiesCSV(content: string): BountyCsvRow[] {
  const rows = parseCSV(content);
  return rows
    .map((row) => {
      // Support multiple column name formats
      const id = parseInt(row.id || row["#"] || "", 10);
      if (isNaN(id)) {
        console.warn(`Invalid or missing bounty ID, skipping row`);
        return null;
      }

      const name = row.name || "";
      const category = (row.category || row.Category || "").trim();
      const subcategory = (row.subcategory || row.Subcategory || row.sub_category || row.subcategory_name || "").trim();

      return {
        id,
        name,
        category: category || null,
        subcategory: subcategory || null,
      };
    })
    .filter((row): row is BountyCsvRow => row !== null);
}

/**
 * Parse treasury netflows CSV content.
 * Expected format: month, asset_name, flow_type, amount_usd, amount_dot_equivalent
 */
export function parseTreasuryNetflowsCSV(content: string): NetflowCsvRow[] {
  const rows = parseCSV(content);
  return rows
    .map((row) => {
      const month = row.month?.trim() || "";
      const asset_name = row.asset_name?.trim() || "";
      const flow_type = row.flow_type?.trim() || "";
      const amount_usd = parseFloat(row.amount_usd || "0");
      const amount_dot_equivalent = parseFloat(row.amount_dot_equivalent || "0");

      return {
        month,
        asset_name,
        flow_type,
        amount_usd: isNaN(amount_usd) ? 0 : amount_usd,
        amount_dot_equivalent: isNaN(amount_dot_equivalent) ? 0 : amount_dot_equivalent
      };
    })
    .filter((row) => row.month && row.asset_name && row.flow_type);
}
