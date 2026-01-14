-- Migration: Drop URL Columns
-- Version: 001
-- Created: 2026-01-14
-- Description: Remove url columns from all tables. URLs are now generated client-side.

-- SQLite 3.35.0+ supports ALTER TABLE DROP COLUMN
-- Our version: 3.51.1

-- First, drop views that reference these columns
DROP VIEW IF EXISTS outstanding_claims;
DROP VIEW IF EXISTS expired_claims;
DROP VIEW IF EXISTS all_spending;

-- Drop url columns using ALTER TABLE DROP COLUMN
ALTER TABLE "Referenda" DROP COLUMN "url";
ALTER TABLE "Treasury" DROP COLUMN "url";
ALTER TABLE "Child Bounties" DROP COLUMN "url";
ALTER TABLE "Fellowship" DROP COLUMN "url";
ALTER TABLE "Fellowship Salary Cycles" DROP COLUMN "url";
ALTER TABLE "Fellowship Salary Payments" DROP COLUMN "url";
ALTER TABLE "Bounties" DROP COLUMN "url";
ALTER TABLE "Subtreasury" DROP COLUMN "url";
-- Fellowship Subtreasury: Skip if doesn't exist (table created later by data providers)

-- Recreate views without url columns
CREATE VIEW outstanding_claims AS
SELECT
    id, referendumIndex, status, description,
    DOT_proposal_time, USD_proposal_time,
    DOT_latest, USD_latest,
    DOT_component, USDC_component, USDT_component,
    proposal_time, latest_status_change, validFrom, expireAt,
    CASE WHEN validFrom <= datetime('now') THEN 'active' ELSE 'upcoming' END AS claim_type,
    CAST((julianday(expireAt) - julianday('now')) AS INTEGER) AS days_until_expiry,
    CAST((julianday(validFrom) - julianday('now')) AS INTEGER) AS days_until_valid
FROM Treasury
WHERE status = 'Approved'
  AND expireAt > datetime('now');

CREATE VIEW expired_claims AS
SELECT
    id, referendumIndex, status, description,
    DOT_proposal_time, USD_proposal_time,
    DOT_latest, USD_latest,
    DOT_component, USDC_component, USDT_component,
    proposal_time, latest_status_change, validFrom, expireAt,
    CAST((julianday('now') - julianday(expireAt)) AS INTEGER) AS days_since_expiry
FROM Treasury
WHERE status = 'Approved'
  AND expireAt < datetime('now');

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
        c.registered_paid_amount_dot AS DOT_latest,
        NULL AS USD_latest,
        'Development' AS category,
        'Polkadot Protocol & SDK' AS subcategory,
        'Fellowship Salary Cycle ' || c.cycle AS title,
        c.registered_paid_amount_dot AS DOT_component,
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
