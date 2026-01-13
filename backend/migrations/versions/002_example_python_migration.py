"""
Migration: Example Python migration (EXAMPLE - DO NOT RUN)
Version: 002
Created: 2026-01-13

This is an example Python migration showing complex data transformations.
Real migrations should be created using: pnpm migrate:create --type py
"""
import sqlite3
from typing import Optional


def up(conn: sqlite3.Connection) -> None:
    """
    Apply the migration.

    Example: Complex data transformation that requires logic
    """
    cursor = conn.cursor()

    # Example 1: Transform existing data
    # cursor.execute("SELECT id, old_category FROM Items")
    # for row in cursor.fetchall():
    #     item_id, old_cat = row
    #     new_cat = transform_category(old_cat)
    #     cursor.execute(
    #         "UPDATE Items SET category = ? WHERE id = ?",
    #         (new_cat, item_id)
    #     )

    # Example 2: Add computed fields
    # cursor.execute("SELECT id, amount, rate FROM Transactions")
    # for row in cursor.fetchall():
    #     tx_id, amount, rate = row
    #     total = amount * rate
    #     cursor.execute(
    #         "UPDATE Transactions SET total = ? WHERE id = ?",
    #         (total, tx_id)
    #     )

    # Example 3: Recreate table to remove column
    # cursor.execute("""
    #     CREATE TABLE Items_new AS
    #     SELECT id, name, category  -- Exclude old_field
    #     FROM Items
    # """)
    # cursor.execute("DROP TABLE Items")
    # cursor.execute("ALTER TABLE Items_new RENAME TO Items")

    # NOTE: This example should be deleted before real migrations
    pass

    conn.commit()


def down(conn: sqlite3.Connection) -> None:
    """
    Rollback the migration (optional).

    Implement this to enable rollback functionality.
    Leave empty/pass if the migration is not reversible.
    """
    pass


def transform_category(old: str) -> str:
    """Example helper function for data transformation."""
    mapping = {
        "dev": "Development",
        "mkt": "Marketing",
        "ops": "Operations",
    }
    return mapping.get(old, "Other")
