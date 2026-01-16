"""
Migration: Add UNIQUE constraint on Categories table
Version: 009

This migration:
1. Sets all category_id references to NULL across all tables
2. Wipes all existing category data
3. Recreates Categories table with UNIQUE(category, subcategory) constraint

WARNING: This permanently deletes all category data and breaks all category associations.
Not reversible except via backup restore.
"""
import sqlite3


def up(conn: sqlite3.Connection) -> None:
    """Add UNIQUE constraint to Categories table."""
    cursor = conn.cursor()

    # Step 1: Log current state for audit trail
    cursor.execute("SELECT COUNT(*) FROM Categories")
    total_categories = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT category || '|' || subcategory) FROM Categories")
    unique_pairs = cursor.fetchone()[0]

    print(f"Current state: {total_categories} total categories, {unique_pairs} unique pairs")
    print(f"Duplicates to remove: {total_categories - unique_pairs}")

    # Step 2: Cascade NULL update - Set category_id to NULL in all referencing tables
    referencing_tables = [
        "Custom Spending",
        "Referenda",
        "Child Bounties",
        "Bounties",
        "Subtreasury"
    ]

    for table in referencing_tables:
        # Check if table exists
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name=?
        """, (table,))

        if cursor.fetchone():
            cursor.execute(f"""
                UPDATE "{table}"
                SET category_id = NULL
                WHERE category_id IS NOT NULL
            """)
            updated_rows = cursor.rowcount
            print(f"Set category_id to NULL in {table}: {updated_rows} rows")
        else:
            print(f"Table {table} does not exist - skipping")

    # Step 3: Wipe Categories table
    cursor.execute("DELETE FROM Categories")
    deleted_rows = cursor.rowcount
    print(f"Deleted all {deleted_rows} rows from Categories table")

    # Step 4: Recreate table with UNIQUE constraint
    # SQLite requires table recreation to add constraints
    print("Recreating Categories table with UNIQUE constraint...")

    cursor.execute("ALTER TABLE Categories RENAME TO Categories_old")

    # Drop the old index (it still exists after table rename)
    cursor.execute("DROP INDEX IF EXISTS idx_categories_category")

    cursor.execute("""
        CREATE TABLE "Categories" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "category" TEXT NOT NULL,
            "subcategory" TEXT NOT NULL,
            UNIQUE(category, subcategory)
        )
    """)

    cursor.execute("""
        CREATE INDEX "idx_categories_category" ON "Categories" ("category")
    """)

    cursor.execute("DROP TABLE Categories_old")
    print("Categories table recreated with UNIQUE constraint")

    # Step 4.5: Recreate all_spending view if it exists with Categories_old references
    # This handles cases where views may have been broken by previous migrations
    cursor.execute("""
        SELECT sql FROM sqlite_master
        WHERE type='view' AND name='all_spending'
    """)
    view_result = cursor.fetchone()

    if view_result and 'Categories_old' in view_result[0]:
        print("Recreating all_spending view to fix Categories_old references...")
        cursor.execute("DROP VIEW IF EXISTS all_spending")

        # Recreate view with correct Categories reference (from migration 002)
        cursor.execute("""
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
            ) AS spending
        """)
        print("all_spending view recreated successfully")

    # Step 5: Verification
    cursor.execute("SELECT COUNT(*) FROM Categories")
    final_count = cursor.fetchone()[0]

    if final_count != 0:
        raise Exception(f"Verification failed: Categories table should be empty but has {final_count} rows")

    # Verify all category_id are NULL
    for table in referencing_tables:
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name=?
        """, (table,))

        if cursor.fetchone():
            cursor.execute(f"""
                SELECT COUNT(*) FROM "{table}"
                WHERE category_id IS NOT NULL
            """)
            non_null_count = cursor.fetchone()[0]

            if non_null_count != 0:
                raise Exception(f"Verification failed: {table} has {non_null_count} non-NULL category_id values")

    print("Verification passed: Categories empty, all category_id values NULL")

    # Commit is handled by migration runner
    print("Migration 009 completed successfully")


def down(conn: sqlite3.Connection) -> None:
    """
    Rollback is NOT SUPPORTED for this migration.
    Data is permanently deleted. Only option is backup restore.
    """
    raise Exception(
        "Migration 009 down() is not supported. "
        "This migration permanently deletes data and cannot be reversed. "
        "Restore from backup if you need to rollback."
    )
