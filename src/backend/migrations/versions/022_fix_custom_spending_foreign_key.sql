-- Migration: Fix Custom Spending foreign key reference
-- Version: 022
-- Created: 2026-01-22
-- Description: The Custom Spending table's foreign key incorrectly references "Categories_old"
--              instead of "Categories". This happened because migration 012 recreated the
--              Categories table but didn't update the Custom Spending table's FK.
--              SQLite doesn't support ALTER TABLE for foreign keys, so we must recreate the table.

-- Step 1: Drop dependent view
DROP VIEW IF EXISTS all_spending;

-- Step 2: Create new table with correct FK → Categories
CREATE TABLE IF NOT EXISTS "Custom Spending_new" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "latest_status_change" TIMESTAMP,
    "DOT_latest" REAL,
    "USD_latest" REAL,
    "DOT_component" REAL,
    "USDC_component" REAL,
    "USDT_component" REAL,
    "category_id" INTEGER,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("category_id") REFERENCES "Categories"("id")
);

-- Step 3: Copy all data from old table
INSERT INTO "Custom Spending_new" (
    id, type, title, description, latest_status_change,
    DOT_latest, USD_latest, DOT_component, USDC_component, USDT_component,
    category_id, created_at, updated_at
)
SELECT
    id, type, title, description, latest_status_change,
    DOT_latest, USD_latest, DOT_component, USDC_component, USDT_component,
    category_id, created_at, updated_at
FROM "Custom Spending";

-- Step 4: Drop old table
DROP TABLE "Custom Spending";

-- Step 5: Rename new table
ALTER TABLE "Custom Spending_new" RENAME TO "Custom Spending";

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS "idx_custom_spending_type" ON "Custom Spending" ("type");
CREATE INDEX IF NOT EXISTS "idx_custom_spending_category" ON "Custom Spending" ("category_id");

-- Step 7: Recreate all_spending view (latest version from migration 021)
CREATE VIEW all_spending AS
SELECT
    spending.*,
    strftime('%Y', spending.latest_status_change) AS year,
    strftime('%Y-%m', spending.latest_status_change) AS year_month,
    strftime('%Y', spending.latest_status_change) || '-Q' ||
        ((CAST(strftime('%m', spending.latest_status_change) AS INTEGER) + 2) / 3) AS year_quarter
FROM (
    -- Direct Spend: Referenda with DOT value but NO Treasury link
    SELECT
        'Direct Spend' AS type,
        'ref-' || r.id AS id,
        r.latest_status_change,
        r.DOT_latest,
        r.USD_latest,
        cat.category,
        cat.subcategory,
        r.title,
        r.DOT_component,
        r.USDC_component,
        r.USDT_component
    FROM Referenda r
    LEFT JOIN Treasury t ON r.id = t.referendumIndex
    LEFT JOIN Categories cat ON r.category_id = cat.id
    WHERE t.id IS NULL
      AND r.DOT_latest > 0
      AND r.status = 'Executed'
      AND (r.hide_in_spends IS NULL OR r.hide_in_spends = 0)

    UNION ALL

    -- Claim: Treasury spends (paid)
    -- Filter by linked referendum's hide_in_spends flag:
    -- - Treasury with no linked referendum: r.hide_in_spends is NULL -> show
    -- - Treasury with visible referendum: hide_in_spends = 0 -> show
    -- - Treasury with hidden referendum: hide_in_spends = 1 -> hide
    SELECT
        'Claim' AS type,
        'treasury-' || t.id AS id,
        t.latest_status_change,
        t.DOT_latest,
        t.USD_latest,
        cat.category,
        cat.subcategory,
        t.description AS title,
        t.DOT_component,
        t.USDC_component,
        t.USDT_component
    FROM Treasury t
    LEFT JOIN Referenda r ON t.referendumIndex = r.id
    LEFT JOIN Categories cat ON r.category_id = cat.id
    WHERE t.status IN ('Paid', 'Processed')
      AND (r.hide_in_spends IS NULL OR r.hide_in_spends = 0)

    UNION ALL

    -- Bounty (Child): Child bounties that have been claimed
    SELECT
        'Bounty' AS type,
        'cb-' || cb.identifier AS id,
        cb.latest_status_change,
        cb.DOT AS DOT_latest,
        cb.USD_latest,
        COALESCE(cb_cat.category, b_cat.category) AS category,
        COALESCE(cb_cat.subcategory, b_cat.subcategory) AS subcategory,
        cb.description AS title,
        cb.DOT AS DOT_component,
        NULL AS USDC_component,
        NULL AS USDT_component
    FROM "Child Bounties" cb
    LEFT JOIN Bounties b ON cb.parentBountyId = b.id
    LEFT JOIN Categories cb_cat ON cb.category_id = cb_cat.id
    LEFT JOIN Categories b_cat ON b.category_id = b_cat.id
    WHERE cb.status = 'Claimed'
      AND (cb.hide_in_spends IS NULL OR cb.hide_in_spends = 0)

    UNION ALL

    -- Subtreasury: Manually managed spending entries
    SELECT
        'Subtreasury' AS type,
        'sub-' || s.id AS id,
        s.latest_status_change,
        s.DOT_latest,
        s.USD_latest,
        c.category,
        c.subcategory,
        s.title,
        s.DOT_component,
        s.USDC_component,
        s.USDT_component
    FROM Subtreasury s
    LEFT JOIN Categories c ON s.category_id = c.id

    UNION ALL

    -- Fellowship Salary: Aggregated from individual payments
    -- Salaries are paid in USDC, so:
    -- - DOT_latest: DOT equivalent for display/sorting
    -- - USD_latest: USDC amount (USDC ≈ USD)
    -- - DOT_component: NULL (no actual DOT paid)
    -- - USDC_component: actual USDC payments
    SELECT
        'Fellowship Salary' AS type,
        'fs-' || p.cycle AS id,
        MAX(p.block_time) AS latest_status_change,
        SUM(p.amount_dot) AS DOT_latest,
        SUM(p.amount_usdc) AS USD_latest,
        'Development' AS category,
        'Polkadot Protocol & SDK' AS subcategory,
        'Fellowship Salary Cycle ' || p.cycle AS title,
        NULL AS DOT_component,
        SUM(p.amount_usdc) AS USDC_component,
        NULL AS USDT_component
    FROM "Fellowship Salary Payments" p
    GROUP BY p.cycle

    UNION ALL

    -- Fellowship Grants: Fellowship treasury spends (from collectives API)
    SELECT
        'Fellowship Grants' AS type,
        'fg-' || f.id AS id,
        f.latest_status_change,
        f.DOT AS DOT_latest,
        f.USD_latest,
        'Development' AS category,
        'Polkadot Protocol & SDK' AS subcategory,
        f.description AS title,
        f.DOT AS DOT_component,
        NULL AS USDC_component,
        NULL AS USDT_component
    FROM Fellowship f
    WHERE f.status IN ('Paid', 'Approved')

    UNION ALL

    -- Custom Spending: User-managed entries
    SELECT
        cs.type AS type,
        'custom-' || cs.id AS id,
        cs.latest_status_change,
        cs.DOT_latest,
        cs.USD_latest,
        c.category,
        c.subcategory,
        cs.title,
        cs.DOT_component,
        cs.USDC_component,
        cs.USDT_component
    FROM "Custom Spending" cs
    LEFT JOIN Categories c ON cs.category_id = c.id
) AS spending
WHERE spending.latest_status_change >= '2023-07-01';
