-- Migration: Use NULL subcategory instead of "Other" text
-- Version: 012
-- Created: 2026-01-20
-- Description: Change subcategory column to allow NULL, convert "Other" text to NULL.
--              NULL subcategory represents "Other" (default subcategory for a category).

-- SQLite doesn't support ALTER TABLE DROP NOT NULL directly, so we need to recreate the table.
-- Views referencing Categories must be dropped first, then recreated after.

-- Step 1: Drop dependent view (will be recreated after table migration)
DROP VIEW IF EXISTS all_spending;

-- Step 2: Create new table with nullable subcategory
CREATE TABLE IF NOT EXISTS "Categories_new" (
    "id" INTEGER PRIMARY KEY,
    "category" TEXT NOT NULL,
    "subcategory" TEXT
);

-- Step 3: Copy data, converting "Other" and empty string subcategory to NULL
-- Use MIN(id) to keep the oldest row when there are duplicates (both '' and 'Other' for same category)
INSERT INTO "Categories_new" (id, category, subcategory)
SELECT
    MIN(id) as id,
    category,
    CASE WHEN subcategory = 'Other' OR subcategory = '' THEN NULL ELSE subcategory END as subcategory
FROM "Categories"
GROUP BY category, CASE WHEN subcategory = 'Other' OR subcategory = '' THEN NULL ELSE subcategory END;

-- Step 4: Drop old table
DROP TABLE "Categories";

-- Step 5: Rename new table
ALTER TABLE "Categories_new" RENAME TO "Categories";

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS "idx_categories_category" ON "Categories" ("category");

-- Step 7: Add unique constraint on (category, subcategory) - treating NULL as distinct
-- This prevents duplicate subcategories within a category
CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_unique" ON "Categories" ("category", COALESCE("subcategory", ''));

-- Step 8: Recreate the all_spending view
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

    -- Fellowship Salary: From salary cycles (completed cycles only)
    SELECT
        'Fellowship Salary' AS type,
        'fs-' || c.cycle AS id,
        c.end_time AS latest_status_change,
        c.registered_paid_amount_usdc AS DOT_latest,
        NULL AS USD_latest,
        'Development' AS category,
        'Polkadot Protocol & SDK' AS subcategory,
        'Fellowship Salary Cycle ' || c.cycle AS title,
        c.registered_paid_amount_usdc AS DOT_component,
        NULL AS USDC_component,
        NULL AS USDT_component
    FROM "Fellowship Salary Cycles" c
    WHERE c.end_time IS NOT NULL

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
) AS spending;
