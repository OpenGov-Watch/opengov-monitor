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
  } catch {
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

export function findOrCreateCategory(category: string, subcategory: string): Category {
  const db = getWritableDatabase();
  const existing = db.prepare(`
    SELECT * FROM "${TABLE_NAMES.categories}" WHERE category = ? AND subcategory = ?
  `).get(category, subcategory) as Category | undefined;

  if (existing) {
    return existing;
  }

  const result = db.prepare(`
    INSERT INTO "${TABLE_NAMES.categories}" (category, subcategory) VALUES (?, ?)
  `).run(category, subcategory);
  return { id: result.lastInsertRowid as number, category, subcategory };
}

export function createCategory(category: string, subcategory: string): Category {
  const db = getWritableDatabase();
  const result = db
    .prepare(`INSERT INTO "${TABLE_NAMES.categories}" (category, subcategory) VALUES (?, ?)`)
    .run(category, subcategory);
  return { id: result.lastInsertRowid as number, category, subcategory };
}

export function updateCategory(id: number, category: string, subcategory: string): void {
  const db = getWritableDatabase();
  db.prepare(`UPDATE "${TABLE_NAMES.categories}" SET category = ?, subcategory = ? WHERE id = ?`)
    .run(category, subcategory, id);
}

export function deleteCategory(id: number): void {
  const db = getWritableDatabase();
  db.prepare(`DELETE FROM "${TABLE_NAMES.categories}" WHERE id = ?`).run(id);
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

// Treasury Netflows

export interface NetflowImportItem {
  month: string;
  asset_name: string;
  flow_type: string;
  amount_usd: number;
  amount_dot_equivalent: number;
}

export function replaceAllNetflows(items: NetflowImportItem[]): number {
  const db = getWritableDatabase();

  // Full table replacement strategy for quarterly updates
  const deleteAll = db.prepare(`DELETE FROM "${TABLE_NAMES.treasuryNetflows}"`);
  const insert = db.prepare(`
    INSERT INTO "${TABLE_NAMES.treasuryNetflows}"
    (month, asset_name, flow_type, amount_usd, amount_dot_equivalent)
    VALUES (?, ?, ?, ?, ?)
  `);

  const replaceTransaction = db.transaction((items: NetflowImportItem[]) => {
    deleteAll.run();
    for (const item of items) {
      insert.run(
        item.month,
        item.asset_name,
        item.flow_type,
        item.amount_usd,
        item.amount_dot_equivalent
      );
    }
  });

  replaceTransaction(items);
  return items.length;
}

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
      const exists = db.prepare(`
        SELECT 1 FROM "${TABLE_NAMES.categories}"
        WHERE category = ? AND subcategory = ?
      `).get(category, subcategory);

      if (!exists) {
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

        const existingCategory = db.prepare(`
          SELECT id FROM "${TABLE_NAMES.categories}"
          WHERE category = ? AND subcategory = ?
        `).get(category, subcategory) as { id: number } | undefined;

        categoryId = existingCategory?.id ?? null;
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
      const exists = db.prepare(`
        SELECT 1 FROM "${TABLE_NAMES.categories}"
        WHERE category = ? AND subcategory = ?
      `).get(category, subcategory);

      if (!exists) {
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

        const existingCategory = db.prepare(`
          SELECT id FROM "${TABLE_NAMES.categories}"
          WHERE category = ? AND subcategory = ?
        `).get(category, subcategory) as { id: number } | undefined;

        categoryId = existingCategory?.id ?? null;
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
      const exists = db.prepare(`
        SELECT 1 FROM "${TABLE_NAMES.categories}"
        WHERE category = ? AND subcategory = ?
      `).get(category, subcategory);

      if (!exists) {
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
  const stmt = db.prepare(`
    UPDATE "${TABLE_NAMES.bounties}"
    SET category_id = ?
    WHERE id = ?
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

        const existingCategory = db.prepare(`
          SELECT id FROM "${TABLE_NAMES.categories}"
          WHERE category = ? AND subcategory = ?
        `).get(category, subcategory) as { id: number } | undefined;

        categoryId = existingCategory?.id ?? null;
      }

      const result = stmt.run(categoryId, item.id);
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
