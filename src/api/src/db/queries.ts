import { getDatabase, getWritableDatabase } from "./index";
import type {
  Referendum,
  TreasurySpend,
  ChildBounty,
  Fellowship,
  FellowshipSalaryCycle,
  FellowshipSalaryClaimant,
  OutstandingClaim,
  ExpiredClaim,
  Category,
  Bounty,
  Subtreasury,
  CustomSpending,
  FellowshipSubtreasury,
  AllSpending,
  Dashboard,
  DashboardComponent,
  ReferendumImportItem,
  ChildBountyImportItem,
  BountyImportItem,
  CustomSpendingImportItem,
  CustomTableMetadata,
  CustomTableSchema,
} from "./types";
import { TABLE_NAMES, VIEW_NAMES } from "./types";

// Removed query functions for pages migrated to QueryConfig mode:
// - getReferenda() - Use POST /api/query/execute
// - getTreasury() - Use POST /api/query/execute
// - getChildBounties() - Use POST /api/query/execute
// - getFellowship() - Use POST /api/query/execute
// - getFellowshipSalaryCycles() - Use POST /api/query/execute
// - getFellowshipSalaryClaimants() - Use POST /api/query/execute
// - getOutstandingClaims() - Use POST /api/query/execute
// - getExpiredClaims() - Use POST /api/query/execute

// Get table names that exist in the database
export function getTableNames(): string[] {
  const db = getDatabase();
  const result = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return result.map((r) => r.name);
}

// Check if a specific table exists
export function tableExists(tableName: string): boolean {
  const tables = getTableNames();
  return tables.includes(tableName);
}

// Check if a specific view exists
export function viewExists(viewName: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare("SELECT name FROM sqlite_master WHERE type='view' AND name=?")
    .get(viewName) as { name: string } | undefined;
  return result !== undefined;
}

// Get row count for a table
export function getRowCount(tableName: string): number {
  const db = getDatabase();
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
    .get() as { count: number };
  return result.count;
}

// Check if database is accessible
export function isDatabaseAccessible(): boolean {
  try {
    const db = getDatabase();
    db.prepare("SELECT 1").get();
    return true;
  } catch (error) {
    console.error("[db] Database accessibility check failed:", error);
    return false;
  }
}

// Manual Tables - Categories

export function getCategories(): Category[] {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.categories}" ORDER BY category, subcategory`)
    .all() as Category[];
}

export function findOrCreateCategory(category: string, subcategory: string | null): Category {
  const db = getWritableDatabase();
  // Treat empty string as NULL (representing "Other")
  const normalizedSubcategory = subcategory === "" ? null : subcategory;

  const existing = normalizedSubcategory === null
    ? db.prepare(`
        SELECT * FROM "${TABLE_NAMES.categories}" WHERE category = ? AND subcategory IS NULL
      `).get(category) as Category | undefined
    : db.prepare(`
        SELECT * FROM "${TABLE_NAMES.categories}" WHERE category = ? AND subcategory = ?
      `).get(category, normalizedSubcategory) as Category | undefined;

  if (existing) {
    return existing;
  }

  const result = db.prepare(`
    INSERT INTO "${TABLE_NAMES.categories}" (category, subcategory) VALUES (?, ?)
  `).run(category, normalizedSubcategory);
  return { id: result.lastInsertRowid as number, category, subcategory: normalizedSubcategory };
}

export function createCategory(category: string, subcategory: string | null): Category {
  const db = getWritableDatabase();
  // Treat empty string as NULL (representing "Other")
  const normalizedSubcategory = subcategory === "" ? null : subcategory;

  const result = db
    .prepare(`INSERT INTO "${TABLE_NAMES.categories}" (category, subcategory) VALUES (?, ?)`)
    .run(category, normalizedSubcategory);

  // Auto-create NULL subcategory row if it doesn't exist and we're creating a non-NULL subcategory
  if (normalizedSubcategory !== null) {
    const nullSubcategoryExists = db.prepare(`
      SELECT 1 FROM "${TABLE_NAMES.categories}" WHERE category = ? AND subcategory IS NULL
    `).get(category);

    if (!nullSubcategoryExists) {
      db.prepare(`INSERT INTO "${TABLE_NAMES.categories}" (category, subcategory) VALUES (?, NULL)`).run(category);
    }
  }

  return { id: result.lastInsertRowid as number, category, subcategory: normalizedSubcategory };
}

export function updateCategory(id: number, category: string, subcategory: string | null): void {
  const db = getWritableDatabase();
  // Treat empty string as NULL (representing "Other")
  const normalizedSubcategory = subcategory === "" ? null : subcategory;
  db.prepare(`UPDATE "${TABLE_NAMES.categories}" SET category = ?, subcategory = ? WHERE id = ?`)
    .run(category, normalizedSubcategory, id);
}

export function getCategoryById(id: number): Category | undefined {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.categories}" WHERE id = ?`)
    .get(id) as Category | undefined;
}

export function deleteCategory(id: number): { success: boolean; error?: string } {
  const db = getWritableDatabase();

  // Check if this is a NULL subcategory row (cannot be deleted)
  const category = db.prepare(`SELECT * FROM "${TABLE_NAMES.categories}" WHERE id = ?`).get(id) as Category | undefined;
  if (category && category.subcategory === null) {
    return { success: false, error: "Cannot delete the 'Other' subcategory. It is required for each category." };
  }

  db.prepare(`DELETE FROM "${TABLE_NAMES.categories}" WHERE id = ?`).run(id);
  return { success: true };
}

// Manual Tables - Bounties (Parent)

export function getBounties(): Bounty[] {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT b.*, c.category, c.subcategory
      FROM "${TABLE_NAMES.bounties}" b
      LEFT JOIN "${TABLE_NAMES.categories}" c ON b.category_id = c.id
      ORDER BY b.id DESC
    `)
    .all() as Bounty[];
}

export function getBountyById(id: number): Bounty | undefined {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT b.*, c.category, c.subcategory
      FROM "${TABLE_NAMES.bounties}" b
      LEFT JOIN "${TABLE_NAMES.categories}" c ON b.category_id = c.id
      WHERE b.id = ?
    `)
    .get(id) as Bounty | undefined;
}

export function upsertBounty(bounty: Omit<Bounty, "category" | "subcategory">): void {
  const db = getWritableDatabase();
  db.prepare(`
    INSERT INTO "${TABLE_NAMES.bounties}" (id, name, category_id, remaining_dot)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category_id = excluded.category_id,
      remaining_dot = excluded.remaining_dot
  `).run(bounty.id, bounty.name, bounty.category_id, bounty.remaining_dot);
}

export function updateBountyCategory(id: number, category_id: number | null): void {
  const db = getWritableDatabase();
  db.prepare(`UPDATE "${TABLE_NAMES.bounties}" SET category_id = ? WHERE id = ?`)
    .run(category_id, id);
}

export function deleteBounty(id: number): void {
  const db = getWritableDatabase();
  db.prepare(`DELETE FROM "${TABLE_NAMES.bounties}" WHERE id = ?`).run(id);
}

// Manual Tables - Subtreasury

export function getSubtreasury(): Subtreasury[] {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT s.*, c.category, c.subcategory
      FROM "${TABLE_NAMES.subtreasury}" s
      LEFT JOIN "${TABLE_NAMES.categories}" c ON s.category_id = c.id
      ORDER BY s.latest_status_change DESC
    `)
    .all() as Subtreasury[];
}

export function getSubtreasuryById(id: number): Subtreasury | undefined {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT s.*, c.category, c.subcategory
      FROM "${TABLE_NAMES.subtreasury}" s
      LEFT JOIN "${TABLE_NAMES.categories}" c ON s.category_id = c.id
      WHERE s.id = ?
    `)
    .get(id) as Subtreasury | undefined;
}

export function createSubtreasury(entry: Omit<Subtreasury, "id" | "category" | "subcategory">): Subtreasury {
  const db = getWritableDatabase();
  const result = db.prepare(`
    INSERT INTO "${TABLE_NAMES.subtreasury}"
    (title, description, DOT_latest, USD_latest, DOT_component, USDC_component, USDT_component, category_id, latest_status_change)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.title,
    entry.description,
    entry.DOT_latest,
    entry.USD_latest,
    entry.DOT_component,
    entry.USDC_component,
    entry.USDT_component,
    entry.category_id,
    entry.latest_status_change
  );
  return { id: result.lastInsertRowid as number, ...entry };
}

export function updateSubtreasury(entry: Omit<Subtreasury, "category" | "subcategory">): void {
  const db = getWritableDatabase();
  db.prepare(`
    UPDATE "${TABLE_NAMES.subtreasury}" SET
      title = ?, description = ?, DOT_latest = ?, USD_latest = ?,
      DOT_component = ?, USDC_component = ?, USDT_component = ?,
      category_id = ?, latest_status_change = ?
    WHERE id = ?
  `).run(
    entry.title,
    entry.description,
    entry.DOT_latest,
    entry.USD_latest,
    entry.DOT_component,
    entry.USDC_component,
    entry.USDT_component,
    entry.category_id,
    entry.latest_status_change,
    entry.id
  );
}

export function deleteSubtreasury(id: number): void {
  const db = getWritableDatabase();
  db.prepare(`DELETE FROM "${TABLE_NAMES.subtreasury}" WHERE id = ?`).run(id);
}

// Custom Spending

export function getCustomSpending(): CustomSpending[] {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT cs.*, c.category, c.subcategory
      FROM "${TABLE_NAMES.customSpending}" cs
      LEFT JOIN "${TABLE_NAMES.categories}" c ON cs.category_id = c.id
      ORDER BY cs.latest_status_change DESC
    `)
    .all() as CustomSpending[];
}

export function getCustomSpendingById(id: number): CustomSpending | undefined {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT cs.*, c.category, c.subcategory
      FROM "${TABLE_NAMES.customSpending}" cs
      LEFT JOIN "${TABLE_NAMES.categories}" c ON cs.category_id = c.id
      WHERE cs.id = ?
    `)
    .get(id) as CustomSpending | undefined;
}

export function createCustomSpending(
  entry: Omit<CustomSpending, "id" | "category" | "subcategory" | "created_at" | "updated_at">
): CustomSpending {
  const db = getWritableDatabase();
  const result = db.prepare(`
    INSERT INTO "${TABLE_NAMES.customSpending}"
    (type, title, description, latest_status_change, DOT_latest, USD_latest,
     DOT_component, USDC_component, USDT_component, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.type,
    entry.title,
    entry.description,
    entry.latest_status_change,
    entry.DOT_latest,
    entry.USD_latest,
    entry.DOT_component,
    entry.USDC_component,
    entry.USDT_component,
    entry.category_id
  );
  const now = new Date().toISOString();
  return {
    id: result.lastInsertRowid as number,
    ...entry,
    created_at: now,
    updated_at: now
  };
}

export function updateCustomSpending(
  entry: Omit<CustomSpending, "category" | "subcategory" | "created_at" | "updated_at">
): void {
  const db = getWritableDatabase();
  db.prepare(`
    UPDATE "${TABLE_NAMES.customSpending}" SET
      type = ?, title = ?, description = ?, latest_status_change = ?,
      DOT_latest = ?, USD_latest = ?, DOT_component = ?, USDC_component = ?,
      USDT_component = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    entry.type,
    entry.title,
    entry.description,
    entry.latest_status_change,
    entry.DOT_latest,
    entry.USD_latest,
    entry.DOT_component,
    entry.USDC_component,
    entry.USDT_component,
    entry.category_id,
    entry.id
  );
}

export function deleteCustomSpending(id: number): void {
  const db = getWritableDatabase();
  db.prepare(`DELETE FROM "${TABLE_NAMES.customSpending}" WHERE id = ?`).run(id);
}

// Valid spending types for custom spending
const VALID_SPENDING_TYPES = [
  "Direct Spend",
  "Claim",
  "Bounty",
  "Subtreasury",
  "Fellowship Salary",
  "Fellowship Grants",
];

// Bulk import custom spending entries from CSV
export function bulkImportCustomSpending(items: CustomSpendingImportItem[]): number {
  const db = getWritableDatabase();

  // Pre-validation: Check that all types are valid and all referenced categories exist
  const typeViolations: Array<{row: number, type: string}> = [];
  const categoryViolations: Array<{row: number, title: string, category: string, subcategory: string}> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Validate type
    if (!VALID_SPENDING_TYPES.includes(item.type)) {
      typeViolations.push({
        row: i + 2, // +2 for header row + 0-index
        type: item.type
      });
    }

    // Validate category if category/subcategory strings are provided
    if (item.category_id === undefined && (item.category || item.subcategory)) {
      const category = item.category || "";
      const subcategory = item.subcategory || "";

      // Skip validation for ("", "") - this represents "no category"
      if (category === "" && subcategory === "") {
        continue;
      }

      // Check if this category/subcategory combination exists
      if (!categoryExists(db, category, subcategory)) {
        categoryViolations.push({
          row: i + 2,
          title: item.title,
          category,
          subcategory
        });
      }
    }
  }

  // If there are type violations, reject the entire import
  if (typeViolations.length > 0) {
    const first10 = typeViolations.slice(0, 10);
    const errorMessage =
      `Import rejected: ${typeViolations.length} row(s) have invalid type.\n` +
      `Valid types: ${VALID_SPENDING_TYPES.join(", ")}\n` +
      `First 10 violations:\n` +
      first10.map(v => `  Row ${v.row}: type="${v.type}"`).join('\n');
    throw new Error(errorMessage);
  }

  // If there are category violations, reject the entire import
  if (categoryViolations.length > 0) {
    const first10 = categoryViolations.slice(0, 10);
    const errorMessage =
      `Import rejected: ${categoryViolations.length} row(s) reference non-existent categories.\n` +
      `First 10 violations:\n` +
      first10.map(v => `  Row ${v.row}: "${v.title}" → category="${v.category}", subcategory="${v.subcategory}"`).join('\n');
    throw new Error(errorMessage);
  }

  // Proceed with transaction only if validation passed
  // Use UPSERT to create entries if they don't exist, update if they do
  const upsertStmt = db.prepare(`
    INSERT INTO "${TABLE_NAMES.customSpending}"
    (id, type, title, description, latest_status_change, DOT_latest, USD_latest,
     DOT_component, USDC_component, USDT_component, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      title = excluded.title,
      description = excluded.description,
      latest_status_change = excluded.latest_status_change,
      DOT_latest = excluded.DOT_latest,
      USD_latest = excluded.USD_latest,
      DOT_component = excluded.DOT_component,
      USDC_component = excluded.USDC_component,
      USDT_component = excluded.USDT_component,
      category_id = excluded.category_id,
      updated_at = CURRENT_TIMESTAMP
  `);

  const insertStmt = db.prepare(`
    INSERT INTO "${TABLE_NAMES.customSpending}"
    (type, title, description, latest_status_change, DOT_latest, USD_latest,
     DOT_component, USDC_component, USDT_component, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items: CustomSpendingImportItem[]) => {
    let count = 0;
    for (const item of items) {
      // Resolve category_id
      let categoryId: number | null = null;

      if (item.category_id !== undefined) {
        // Option A: Direct category_id provided
        categoryId = item.category_id;
      } else if (item.category || item.subcategory) {
        // Option B: Category/subcategory strings provided - lookup only (no auto-create)
        const category = item.category || "";
        const subcategory = item.subcategory || "";
        categoryId = lookupCategoryId(db, category, subcategory);
      }

      if (item.id !== undefined) {
        // UPSERT: creates entry if not exists, updates if exists
        const result = upsertStmt.run(
          item.id,
          item.type,
          item.title,
          item.description || null,
          item.latest_status_change || null,
          item.DOT_latest ?? null,
          item.USD_latest ?? null,
          item.DOT_component ?? null,
          item.USDC_component ?? null,
          item.USDT_component ?? null,
          categoryId
        );
        if (result.changes > 0) count++;
      } else {
        // INSERT: creates new entry with auto-generated id
        const result = insertStmt.run(
          item.type,
          item.title,
          item.description || null,
          item.latest_status_change || null,
          item.DOT_latest ?? null,
          item.USD_latest ?? null,
          item.DOT_component ?? null,
          item.USDC_component ?? null,
          item.USDT_component ?? null,
          categoryId
        );
        if (result.changes > 0) count++;
      }
    }
    return count;
  });

  return transaction(items);
}

// Shared Table Replacement Infrastructure

/**
 * Creates a function that replaces all rows in a table with new items.
 * Used for CSV-backed tables that are periodically fully replaced.
 *
 * @param tableName - The name of the table to replace data in
 * @param columns - Array of column names in insert order
 * @param mapItem - Function that maps an item to an array of values matching column order
 * @returns A function that replaces all table data with the provided items
 */
function createTableReplacer<T>(
  tableName: string,
  columns: string[],
  mapItem: (item: T) => unknown[]
): (items: T[]) => number {
  return (items: T[]) => {
    const db = getWritableDatabase();

    const deleteAll = db.prepare(`DELETE FROM "${tableName}"`);
    const placeholders = columns.map(() => "?").join(", ");
    const insert = db.prepare(`
      INSERT INTO "${tableName}" (${columns.join(", ")})
      VALUES (${placeholders})
    `);

    const replaceTransaction = db.transaction((items: T[]) => {
      deleteAll.run();
      for (const item of items) {
        insert.run(...mapItem(item));
      }
    });

    replaceTransaction(items);
    return items.length;
  };
}

// Treasury Netflows

export interface NetflowImportItem {
  month: string;
  asset_name: string;
  flow_type: string;
  amount_usd: number;
  amount_dot_equivalent: number;
}

export const replaceAllNetflows = createTableReplacer<NetflowImportItem>(
  TABLE_NAMES.treasuryNetflows,
  ["month", "asset_name", "flow_type", "amount_usd", "amount_dot_equivalent"],
  (item) => [item.month, item.asset_name, item.flow_type, item.amount_usd, item.amount_dot_equivalent]
);

// Cross Chain Flows

export interface CrossChainFlowItem {
  message_hash: string;
  from_account: string;
  to_account: string;
  block: number;
  origin_event_index: string;
  dest_event_index: string;
  time: string;
  from_chain_id: string;
  destination_chain_id: string;
  value: string;
  protocol: string;
  status: string;
}

export const replaceAllCrossChainFlows = createTableReplacer<CrossChainFlowItem>(
  TABLE_NAMES.crossChainFlows,
  [
    "message_hash", "from_account", "to_account", "block",
    "origin_event_index", "dest_event_index", "time",
    "from_chain_id", "destination_chain_id", "value", "protocol", "status"
  ],
  (item) => [
    item.message_hash, item.from_account, item.to_account, item.block,
    item.origin_event_index, item.dest_event_index, item.time,
    item.from_chain_id, item.destination_chain_id, item.value, item.protocol, item.status
  ]
);

// Local Flows

export interface LocalFlowItem {
  extrinsic_id: string;
  date: string;
  block: number;
  hash: string;
  symbol: string;
  from_account: string;
  to_account: string;
  value: string;
  result: string;
  year_month: string;
  quarter: string;
}

export const replaceAllLocalFlows = createTableReplacer<LocalFlowItem>(
  TABLE_NAMES.localFlows,
  [
    "extrinsic_id", "date", "block", "hash", "symbol",
    "from_account", "to_account", "value", "result", "year_month", "quarter"
  ],
  (item) => [
    item.extrinsic_id, item.date, item.block, item.hash, item.symbol,
    item.from_account, item.to_account, item.value, item.result, item.year_month, item.quarter
  ]
);

// Fellowship Subtreasury (read-only, fetched from API)

export function getFellowshipSubtreasury(): FellowshipSubtreasury[] {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.fellowshipSubtreasury}" ORDER BY id DESC`)
    .all() as FellowshipSubtreasury[];
}

// All Spending View

export function getAllSpending(): AllSpending[] {
  const db = getDatabase();

  // Use fixed all_spending view
  const sql = `
    SELECT * FROM all_spending
    ORDER BY latest_status_change DESC
  `;

  return db.prepare(sql).all() as AllSpending[];
}

// Update Referendum (all editable fields)

export interface ReferendumUpdate {
  category_id?: number | null;
  notes?: string | null;
  hide_in_spends?: number | null;
}

export function updateReferendum(id: number, data: ReferendumUpdate): void {
  const db = getWritableDatabase();
  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.category_id !== undefined) {
    setClauses.push("category_id = ?");
    values.push(data.category_id);
  }
  if (data.notes !== undefined) {
    setClauses.push("notes = ?");
    values.push(data.notes);
  }
  if (data.hide_in_spends !== undefined) {
    setClauses.push("hide_in_spends = ?");
    values.push(data.hide_in_spends);
  }

  if (setClauses.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE "${TABLE_NAMES.referenda}" SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
}

// Bulk update referenda from CSV import

// Helper function to lookup category by category/subcategory strings
// Empty string or "Other" subcategory maps to NULL subcategory in database
function lookupCategoryId(db: ReturnType<typeof getWritableDatabase>, category: string, subcategory: string): number | null {
  // Normalize: empty string or "Other" becomes NULL
  const normalizedSubcategory = subcategory === "" || subcategory === "Other" ? null : subcategory;

  const existingCategory = normalizedSubcategory === null
    ? db.prepare(`
        SELECT id FROM "${TABLE_NAMES.categories}"
        WHERE category = ? AND subcategory IS NULL
      `).get(category) as { id: number } | undefined
    : db.prepare(`
        SELECT id FROM "${TABLE_NAMES.categories}"
        WHERE category = ? AND subcategory = ?
      `).get(category, normalizedSubcategory) as { id: number } | undefined;

  return existingCategory?.id ?? null;
}

// Helper function to check if category exists
function categoryExists(db: ReturnType<typeof getWritableDatabase>, category: string, subcategory: string): boolean {
  // Normalize: empty string or "Other" becomes NULL
  const normalizedSubcategory = subcategory === "" || subcategory === "Other" ? null : subcategory;

  const exists = normalizedSubcategory === null
    ? db.prepare(`
        SELECT 1 FROM "${TABLE_NAMES.categories}"
        WHERE category = ? AND subcategory IS NULL
      `).get(category)
    : db.prepare(`
        SELECT 1 FROM "${TABLE_NAMES.categories}"
        WHERE category = ? AND subcategory = ?
      `).get(category, normalizedSubcategory);

  return !!exists;
}

export function bulkUpdateReferenda(items: ReferendumImportItem[]): number {
  const db = getWritableDatabase();

  // Pre-validation: Check that all referenced categories exist
  const violations: Array<{row: number, id: number, category: string, subcategory: string}> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Only validate if category/subcategory strings are provided (not when category_id is direct)
    // Skip validation if both are null/undefined/empty (will result in category_id = null)
    if (item.category_id === undefined && (item.category || item.subcategory)) {
      const category = item.category || "";
      const subcategory = item.subcategory || "";

      // Skip validation for ("", "") - this represents "no category"
      if (category === "" && subcategory === "") {
        continue;
      }

      // Check if this category/subcategory combination exists
      if (!categoryExists(db, category, subcategory)) {
        violations.push({
          row: i + 2, // +2 for header row + 0-index
          id: item.id,
          category,
          subcategory
        });
      }
    }
  }

  // If there are violations, reject the entire import
  if (violations.length > 0) {
    const first10 = violations.slice(0, 10);
    const errorMessage =
      `Import rejected: ${violations.length} row(s) reference non-existent categories.\n` +
      `First 10 violations:\n` +
      first10.map(v => `  Row ${v.row}: referendum ${v.id} → category="${v.category}", subcategory="${v.subcategory}"`).join('\n');
    throw new Error(errorMessage);
  }

  // Proceed with transaction only if validation passed
  const stmt = db.prepare(`
    UPDATE "${TABLE_NAMES.referenda}"
    SET category_id = ?, notes = ?, hide_in_spends = ?
    WHERE id = ?
  `);

  const transaction = db.transaction((items: ReferendumImportItem[]) => {
    let count = 0;
    for (const item of items) {
      // Resolve category_id
      let categoryId: number | null = null;

      if (item.category_id !== undefined) {
        // Option A: Direct category_id provided
        categoryId = item.category_id;
      } else if (item.category !== undefined || item.subcategory !== undefined) {
        // Option B: Category/subcategory strings provided - lookup only (no auto-create)
        const category = item.category || "";
        const subcategory = item.subcategory || "";
        categoryId = lookupCategoryId(db, category, subcategory);
      }

      const result = stmt.run(
        categoryId,
        item.notes ?? null,
        item.hide_in_spends ?? null,
        item.id
      );
      if (result.changes > 0) count++;
    }
    return count;
  });

  return transaction(items);
}

// Update Child Bounty (all editable fields)

export interface ChildBountyUpdate {
  category_id?: number | null;
  notes?: string | null;
  hide_in_spends?: number | null;
}

export function updateChildBounty(identifier: string, data: ChildBountyUpdate): void {
  const db = getWritableDatabase();
  // Normalize identifier: convert hyphens to underscores to match DB format
  const normalizedIdentifier = identifier.replace(/-/g, '_');

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.category_id !== undefined) {
    setClauses.push("category_id = ?");
    values.push(data.category_id);
  }
  if (data.notes !== undefined) {
    setClauses.push("notes = ?");
    values.push(data.notes);
  }
  if (data.hide_in_spends !== undefined) {
    setClauses.push("hide_in_spends = ?");
    values.push(data.hide_in_spends);
  }

  if (setClauses.length === 0) return;

  values.push(normalizedIdentifier);
  db.prepare(`UPDATE "${TABLE_NAMES.childBounties}" SET ${setClauses.join(", ")} WHERE identifier = ?`).run(...values);
}

// Bulk update child bounties from CSV import

export function bulkUpdateChildBounties(items: ChildBountyImportItem[]): number {
  const db = getWritableDatabase();

  // Pre-validation: Check that all referenced categories exist
  const violations: Array<{row: number, identifier: string, category: string, subcategory: string}> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Only validate if category/subcategory strings are provided (not when category_id is direct)
    // Skip validation if both are null/undefined/empty (will result in category_id = null)
    if (item.category_id === undefined && (item.category || item.subcategory)) {
      const category = item.category || "";
      const subcategory = item.subcategory || "";

      // Check if this category/subcategory combination exists
      if (!categoryExists(db, category, subcategory)) {
        violations.push({
          row: i + 2, // +2 for header row + 0-index
          identifier: item.identifier,
          category,
          subcategory
        });
      }
    }
  }

  // If there are violations, reject the entire import
  if (violations.length > 0) {
    const first10 = violations.slice(0, 10);
    const errorMessage =
      `Import rejected: ${violations.length} row(s) reference non-existent categories.\n` +
      `First 10 violations:\n` +
      first10.map(v => `  Row ${v.row}: "${v.identifier}" → category="${v.category}", subcategory="${v.subcategory}"`).join('\n');
    throw new Error(errorMessage);
  }

  // Proceed with transaction only if validation passed
  const stmt = db.prepare(`
    UPDATE "${TABLE_NAMES.childBounties}"
    SET category_id = ?, notes = ?, hide_in_spends = ?
    WHERE identifier = ?
  `);

  const transaction = db.transaction((items: ChildBountyImportItem[]) => {
    let count = 0;
    for (const item of items) {
      // Normalize identifier: convert hyphens to underscores to match DB format
      const normalizedIdentifier = item.identifier.replace(/-/g, '_');

      // Resolve category_id
      let categoryId: number | null = null;

      if (item.category_id !== undefined) {
        // Option A: Direct category_id provided
        categoryId = item.category_id;
      } else if (item.category !== undefined || item.subcategory !== undefined) {
        // Option B: Category/subcategory strings provided - lookup only (no auto-create)
        const category = item.category || "";
        const subcategory = item.subcategory || "";
        categoryId = lookupCategoryId(db, category, subcategory);
      }

      const result = stmt.run(
        categoryId,
        item.notes ?? null,
        item.hide_in_spends ?? null,
        normalizedIdentifier
      );
      if (result.changes > 0) count++;
    }
    return count;
  });

  return transaction(items);
}

// Bulk update bounties from CSV import

export function bulkUpdateBounties(items: BountyImportItem[]): number {
  const db = getWritableDatabase();

  // Pre-validation: Check that all referenced categories exist
  const violations: Array<{row: number, id: number, category: string, subcategory: string}> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Only validate if category/subcategory strings are provided (not when category_id is direct)
    // Skip validation if both are null/undefined/empty (will result in category_id = null)
    if (item.category_id === undefined && (item.category || item.subcategory)) {
      const category = item.category || "";
      const subcategory = item.subcategory || "";

      // Skip validation for ("", "") - this represents "no category"
      if (category === "" && subcategory === "") {
        continue;
      }

      // Check if this category/subcategory combination exists
      if (!categoryExists(db, category, subcategory)) {
        violations.push({
          row: i + 2, // +2 for header row + 0-index
          id: item.id,
          category,
          subcategory
        });
      }
    }
  }

  // If there are violations, reject the entire import
  if (violations.length > 0) {
    const first10 = violations.slice(0, 10);
    const errorMessage =
      `Import rejected: ${violations.length} row(s) reference non-existent categories.\n` +
      `First 10 violations:\n` +
      first10.map(v => `  Row ${v.row}: bounty ${v.id} → category="${v.category}", subcategory="${v.subcategory}"`).join('\n');
    throw new Error(errorMessage);
  }

  // Proceed with transaction only if validation passed
  // Use UPSERT to create bounties if they don't exist
  const stmt = db.prepare(`
    INSERT INTO "${TABLE_NAMES.bounties}" (id, name, category_id)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, name),
      category_id = excluded.category_id
  `);

  const transaction = db.transaction((items: BountyImportItem[]) => {
    let count = 0;
    for (const item of items) {
      // Resolve category_id
      let categoryId: number | null = null;

      if (item.category_id !== undefined) {
        // Option A: Direct category_id provided
        categoryId = item.category_id;
      } else if (item.category || item.subcategory) {
        // Option B: Category/subcategory strings provided - lookup only (no auto-create)
        const category = item.category || "";
        const subcategory = item.subcategory || "";
        categoryId = lookupCategoryId(db, category, subcategory);
      }

      // UPSERT: creates bounty if not exists, updates if exists
      const result = stmt.run(item.id, item.name || null, categoryId);
      if (result.changes > 0) count++;
    }
    return count;
  });

  return transaction(items);
}

// Dashboards

export function getDashboards(): Dashboard[] {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.dashboards}" ORDER BY updated_at DESC`)
    .all() as Dashboard[];
}

export function getDashboardById(id: number): Dashboard | undefined {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.dashboards}" WHERE id = ?`)
    .get(id) as Dashboard | undefined;
}

export function createDashboard(name: string, description: string | null): Dashboard {
  const db = getWritableDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO "${TABLE_NAMES.dashboards}" (name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(name, description, now, now);
  return {
    id: result.lastInsertRowid as number,
    name,
    description,
    created_at: now,
    updated_at: now,
  };
}

export function updateDashboard(id: number, name: string, description: string | null): void {
  const db = getWritableDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE "${TABLE_NAMES.dashboards}" SET name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description, now, id);
}

export function deleteDashboard(id: number): void {
  const db = getWritableDatabase();
  // Delete components first (cascade)
  db.prepare(`DELETE FROM "${TABLE_NAMES.dashboardComponents}" WHERE dashboard_id = ?`).run(id);
  db.prepare(`DELETE FROM "${TABLE_NAMES.dashboards}" WHERE id = ?`).run(id);
}

// Dashboard Components

export function getDashboardComponents(dashboardId: number): DashboardComponent[] {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.dashboardComponents}" WHERE dashboard_id = ? ORDER BY id`)
    .all(dashboardId) as DashboardComponent[];
}

export function getDashboardComponentById(id: number): DashboardComponent | undefined {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.dashboardComponents}" WHERE id = ?`)
    .get(id) as DashboardComponent | undefined;
}

export function createDashboardComponent(
  dashboardId: number,
  name: string,
  type: string,
  queryConfig: string,
  gridConfig: string,
  chartConfig: string | null
): DashboardComponent {
  const db = getWritableDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO "${TABLE_NAMES.dashboardComponents}"
    (dashboard_id, name, type, query_config, grid_config, chart_config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(dashboardId, name, type, queryConfig, gridConfig, chartConfig, now, now);

  // Update dashboard's updated_at
  db.prepare(`UPDATE "${TABLE_NAMES.dashboards}" SET updated_at = ? WHERE id = ?`).run(now, dashboardId);

  return {
    id: result.lastInsertRowid as number,
    dashboard_id: dashboardId,
    name,
    type: type as DashboardComponent["type"],
    query_config: queryConfig,
    grid_config: gridConfig,
    chart_config: chartConfig,
    created_at: now,
    updated_at: now,
  };
}

export function updateDashboardComponent(
  id: number,
  name: string,
  type: string,
  queryConfig: string,
  gridConfig: string,
  chartConfig: string | null
): void {
  const db = getWritableDatabase();
  const now = new Date().toISOString();

  // Get dashboard_id to update dashboard's updated_at
  const component = db
    .prepare(`SELECT dashboard_id FROM "${TABLE_NAMES.dashboardComponents}" WHERE id = ?`)
    .get(id) as { dashboard_id: number } | undefined;

  db.prepare(`
    UPDATE "${TABLE_NAMES.dashboardComponents}" SET
      name = ?, type = ?, query_config = ?, grid_config = ?, chart_config = ?, updated_at = ?
    WHERE id = ?
  `).run(name, type, queryConfig, gridConfig, chartConfig, now, id);

  if (component) {
    db.prepare(`UPDATE "${TABLE_NAMES.dashboards}" SET updated_at = ? WHERE id = ?`)
      .run(now, component.dashboard_id);
  }
}

export function updateDashboardComponentGrid(id: number, gridConfig: string): void {
  const db = getWritableDatabase();
  const now = new Date().toISOString();

  const component = db
    .prepare(`SELECT dashboard_id FROM "${TABLE_NAMES.dashboardComponents}" WHERE id = ?`)
    .get(id) as { dashboard_id: number } | undefined;

  db.prepare(`UPDATE "${TABLE_NAMES.dashboardComponents}" SET grid_config = ?, updated_at = ? WHERE id = ?`)
    .run(gridConfig, now, id);

  if (component) {
    db.prepare(`UPDATE "${TABLE_NAMES.dashboards}" SET updated_at = ? WHERE id = ?`)
      .run(now, component.dashboard_id);
  }
}

export function deleteDashboardComponent(id: number): void {
  const db = getWritableDatabase();
  const now = new Date().toISOString();

  const component = db
    .prepare(`SELECT dashboard_id FROM "${TABLE_NAMES.dashboardComponents}" WHERE id = ?`)
    .get(id) as { dashboard_id: number } | undefined;

  db.prepare(`DELETE FROM "${TABLE_NAMES.dashboardComponents}" WHERE id = ?`).run(id);

  if (component) {
    db.prepare(`UPDATE "${TABLE_NAMES.dashboards}" SET updated_at = ? WHERE id = ?`)
      .run(now, component.dashboard_id);
  }
}

export function moveDashboardComponent(
  componentId: number,
  targetDashboardId: number,
  newGridConfig: string
): { sourceDashboardId: number } | null {
  const db = getWritableDatabase();
  const now = new Date().toISOString();

  // Get source dashboard_id
  const component = db
    .prepare(`SELECT dashboard_id FROM "${TABLE_NAMES.dashboardComponents}" WHERE id = ?`)
    .get(componentId) as { dashboard_id: number } | undefined;

  if (!component) {
    return null;
  }

  const sourceDashboardId = component.dashboard_id;

  // Update component's dashboard_id and grid_config
  db.prepare(`
    UPDATE "${TABLE_NAMES.dashboardComponents}"
    SET dashboard_id = ?, grid_config = ?, updated_at = ?
    WHERE id = ?
  `).run(targetDashboardId, newGridConfig, now, componentId);

  // Update timestamps on both source and target dashboards
  db.prepare(`UPDATE "${TABLE_NAMES.dashboards}" SET updated_at = ? WHERE id = ?`)
    .run(now, sourceDashboardId);
  db.prepare(`UPDATE "${TABLE_NAMES.dashboards}" SET updated_at = ? WHERE id = ?`)
    .run(now, targetDashboardId);

  return { sourceDashboardId };
}

// ============================================================================
// Custom Tables - Metadata and Dynamic Table Operations
// ============================================================================

import {
  generateTableName,
  generateCreateTableSQL,
  coerceValue,
  schemasMatch,
} from "../lib/schema-inference.js";

/**
 * Get all custom tables metadata
 */
export function getCustomTables(): CustomTableMetadata[] {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.customTableMetadata}" ORDER BY display_name`)
    .all() as CustomTableMetadata[];
}

/**
 * Get custom table metadata by ID
 */
export function getCustomTableById(id: number): CustomTableMetadata | undefined {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.customTableMetadata}" WHERE id = ?`)
    .get(id) as CustomTableMetadata | undefined;
}

/**
 * Get custom table metadata by table name
 */
export function getCustomTableByName(tableName: string): CustomTableMetadata | undefined {
  const db = getDatabase();
  return db
    .prepare(`SELECT * FROM "${TABLE_NAMES.customTableMetadata}" WHERE table_name = ?`)
    .get(tableName) as CustomTableMetadata | undefined;
}

/**
 * Get all custom table names (for query builder integration)
 */
export function getCustomTableNames(): string[] {
  const db = getDatabase();
  const result = db
    .prepare(`SELECT table_name FROM "${TABLE_NAMES.customTableMetadata}"`)
    .all() as { table_name: string }[];
  return result.map((r) => r.table_name);
}

/**
 * Create a new custom table with schema and optional initial data
 */
export function createCustomTable(
  displayName: string,
  schema: CustomTableSchema,
  initialData?: Record<string, string | number | null>[]
): CustomTableMetadata {
  const db = getWritableDatabase();

  // Generate internal table name
  let tableName = generateTableName(displayName);

  // Ensure uniqueness by appending number if needed
  let counter = 1;
  while (getCustomTableByName(tableName)) {
    tableName = `${generateTableName(displayName)}_${counter}`;
    counter++;
  }

  const schemaJson = JSON.stringify(schema);
  const now = new Date().toISOString();

  // Use transaction for atomicity
  const transaction = db.transaction(() => {
    // 1. Create the actual table
    const createTableSQL = generateCreateTableSQL(tableName, schema);
    db.exec(createTableSQL);

    // 2. Insert initial data if provided
    let rowCount = 0;
    if (initialData && initialData.length > 0) {
      const columnNames = schema.columns.map((c) => c.name);
      const placeholders = columnNames.map(() => "?").join(", ");
      const insertSQL = `INSERT INTO "${tableName}" (${columnNames.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
      const insertStmt = db.prepare(insertSQL);

      for (const row of initialData) {
        const values = schema.columns.map((col) => {
          const rawValue = row[col.name];
          return coerceValue(
            rawValue === null || rawValue === undefined ? null : String(rawValue),
            col.type
          );
        });
        insertStmt.run(...values);
        rowCount++;
      }
    }

    // 3. Create metadata entry
    const result = db.prepare(`
      INSERT INTO "${TABLE_NAMES.customTableMetadata}"
      (table_name, display_name, schema_json, row_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tableName, displayName, schemaJson, rowCount, now, now);

    return {
      id: result.lastInsertRowid as number,
      table_name: tableName,
      display_name: displayName,
      schema_json: schemaJson,
      row_count: rowCount,
      created_at: now,
      updated_at: now,
    };
  });

  return transaction();
}

/**
 * Validate custom table name format to prevent SQL injection.
 * Custom table names must start with 'custom_' and contain only safe characters.
 */
function isValidCustomTableName(name: string): boolean {
  return /^custom_[a-zA-Z0-9_]+$/.test(name) && name.length <= 128;
}

/**
 * Delete a custom table (drops the table and removes metadata)
 */
export function deleteCustomTable(id: number): boolean {
  const db = getWritableDatabase();

  const metadata = getCustomTableById(id);
  if (!metadata) {
    return false;
  }

  // Validate table name matches custom table pattern before DROP
  if (!isValidCustomTableName(metadata.table_name)) {
    throw new Error(`Invalid custom table name: ${metadata.table_name}`);
  }

  const transaction = db.transaction(() => {
    // 1. Drop the actual table
    db.exec(`DROP TABLE IF EXISTS "${metadata.table_name}"`);

    // 2. Delete metadata entry
    db.prepare(`DELETE FROM "${TABLE_NAMES.customTableMetadata}" WHERE id = ?`).run(id);
  });

  transaction();
  return true;
}

/**
 * Get paginated data from a custom table
 */
export function getCustomTableData(
  tableName: string,
  limit: number = 100,
  offset: number = 0
): { rows: Record<string, unknown>[]; total: number } {
  const db = getDatabase();

  // Verify table exists in metadata (security check)
  const metadata = getCustomTableByName(tableName);
  if (!metadata) {
    throw new Error(`Custom table "${tableName}" not found`);
  }

  const rows = db
    .prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`)
    .all(limit, offset) as Record<string, unknown>[];

  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
    .get() as { count: number };

  return { rows, total: countResult.count };
}

/**
 * Insert a row into a custom table
 */
export function insertCustomTableRow(
  tableName: string,
  data: Record<string, string | number | null>
): { _id: number } {
  const db = getWritableDatabase();

  // Verify table exists and get schema
  const metadata = getCustomTableByName(tableName);
  if (!metadata) {
    throw new Error(`Custom table "${tableName}" not found`);
  }

  const schema: CustomTableSchema = JSON.parse(metadata.schema_json);
  const columnNames = schema.columns.map((c) => c.name);
  const placeholders = columnNames.map(() => "?").join(", ");

  const values = schema.columns.map((col) => {
    const rawValue = data[col.name];
    return coerceValue(
      rawValue === null || rawValue === undefined ? null : String(rawValue),
      col.type
    );
  });

  const result = db.prepare(`
    INSERT INTO "${tableName}" (${columnNames.map((c) => `"${c}"`).join(", ")})
    VALUES (${placeholders})
  `).run(...values);

  // Update row count in metadata
  updateCustomTableRowCount(tableName);

  return { _id: result.lastInsertRowid as number };
}

/**
 * Update a row in a custom table
 */
export function updateCustomTableRow(
  tableName: string,
  rowId: number,
  data: Record<string, string | number | null>
): boolean {
  const db = getWritableDatabase();

  // Verify table exists and get schema
  const metadata = getCustomTableByName(tableName);
  if (!metadata) {
    throw new Error(`Custom table "${tableName}" not found`);
  }

  const schema: CustomTableSchema = JSON.parse(metadata.schema_json);

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  for (const col of schema.columns) {
    if (col.name in data) {
      setClauses.push(`"${col.name}" = ?`);
      const rawValue = data[col.name];
      values.push(
        coerceValue(
          rawValue === null || rawValue === undefined ? null : String(rawValue),
          col.type
        )
      );
    }
  }

  if (setClauses.length === 0) {
    return false;
  }

  values.push(rowId);
  const result = db.prepare(`
    UPDATE "${tableName}" SET ${setClauses.join(", ")} WHERE _id = ?
  `).run(...values);

  return result.changes > 0;
}

/**
 * Delete a row from a custom table
 */
export function deleteCustomTableRow(tableName: string, rowId: number): boolean {
  const db = getWritableDatabase();

  // Verify table exists
  const metadata = getCustomTableByName(tableName);
  if (!metadata) {
    throw new Error(`Custom table "${tableName}" not found`);
  }

  const result = db.prepare(`DELETE FROM "${tableName}" WHERE _id = ?`).run(rowId);

  // Update row count in metadata
  updateCustomTableRowCount(tableName);

  return result.changes > 0;
}

/**
 * Wipe all data and re-import from new data (schema must match)
 */
export function wipeAndImportCustomTable(
  tableName: string,
  rows: Record<string, string | number | null>[]
): number {
  const db = getWritableDatabase();

  // Verify table exists and get schema
  const metadata = getCustomTableByName(tableName);
  if (!metadata) {
    throw new Error(`Custom table "${tableName}" not found`);
  }

  const schema: CustomTableSchema = JSON.parse(metadata.schema_json);

  const transaction = db.transaction(() => {
    // 1. Delete all existing data
    db.exec(`DELETE FROM "${tableName}"`);

    // 2. Reset autoincrement (parameterized to prevent SQL injection)
    db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(tableName);

    // 3. Insert new data
    let count = 0;
    if (rows.length > 0) {
      const columnNames = schema.columns.map((c) => c.name);
      const placeholders = columnNames.map(() => "?").join(", ");
      const insertSQL = `INSERT INTO "${tableName}" (${columnNames.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
      const insertStmt = db.prepare(insertSQL);

      for (const row of rows) {
        const values = schema.columns.map((col) => {
          const rawValue = row[col.name];
          return coerceValue(
            rawValue === null || rawValue === undefined ? null : String(rawValue),
            col.type
          );
        });
        insertStmt.run(...values);
        count++;
      }
    }

    // 4. Update metadata
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE "${TABLE_NAMES.customTableMetadata}"
      SET row_count = ?, updated_at = ?
      WHERE table_name = ?
    `).run(count, now, tableName);

    return count;
  });

  return transaction();
}

/**
 * Update the row count in metadata for a custom table
 */
function updateCustomTableRowCount(tableName: string): void {
  const db = getWritableDatabase();

  const countResult = db
    .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
    .get() as { count: number };

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE "${TABLE_NAMES.customTableMetadata}"
    SET row_count = ?, updated_at = ?
    WHERE table_name = ?
  `).run(countResult.count, now, tableName);
}
