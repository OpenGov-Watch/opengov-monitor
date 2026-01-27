"""
Migration: Fix tally column references in Dashboard Components
Version: 024

Migration 023 renamed tally.ayes/tally.nays to tally_ayes/tally_nays in Referenda table.
This migration updates Dashboard Components that reference the old column names in their
query_config JSON.
"""
import sqlite3
import json
from typing import Any


def fix_column_reference(value: str) -> str:
    """Fix a single column reference string."""
    replacements = [
        ("Referenda.tally.ayes", "Referenda.tally_ayes"),
        ("Referenda.tally.nays", "Referenda.tally_nays"),
        ("tally.ayes", "tally_ayes"),
        ("tally.nays", "tally_nays"),
    ]
    result = value
    for old, new in replacements:
        result = result.replace(old, new)
    return result


def fix_column_refs_in_obj(obj: Any) -> Any:
    """Recursively fix column references in a JSON object."""
    if isinstance(obj, str):
        return fix_column_reference(obj)
    elif isinstance(obj, list):
        return [fix_column_refs_in_obj(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: fix_column_refs_in_obj(value) for key, value in obj.items()}
    else:
        return obj


def up(conn: sqlite3.Connection) -> None:
    """Fix tally column references in Dashboard Components."""
    cursor = conn.cursor()

    # Check if Dashboard Components table exists
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='Dashboard Components'
    """)
    if not cursor.fetchone():
        print("Dashboard Components table does not exist - skipping")
        return

    # Find affected components
    cursor.execute("""
        SELECT id, query_config FROM "Dashboard Components"
        WHERE query_config LIKE '%tally.ayes%'
           OR query_config LIKE '%tally.nays%'
    """)
    affected_rows = cursor.fetchall()

    if not affected_rows:
        print("No Dashboard Components with old tally column references found")
    else:
        print(f"Found {len(affected_rows)} Dashboard Components with old tally column references")

        for row_id, query_config in affected_rows:
            try:
                config = json.loads(query_config)
                fixed_config = fix_column_refs_in_obj(config)
                fixed_json = json.dumps(fixed_config)

                cursor.execute("""
                    UPDATE "Dashboard Components"
                    SET query_config = ?
                    WHERE id = ?
                """, (fixed_json, row_id))

                print(f"  Fixed Dashboard Component {row_id}")
            except json.JSONDecodeError as e:
                print(f"  WARNING: Could not parse JSON for component {row_id}: {e}")

    # Clear Query Cache (stale cached queries may reference old column names)
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='Query Cache'
    """)
    if cursor.fetchone():
        cursor.execute('DELETE FROM "Query Cache"')
        deleted = cursor.rowcount
        print(f"Cleared {deleted} entries from Query Cache")

    # Verification
    cursor.execute("""
        SELECT COUNT(*) FROM "Dashboard Components"
        WHERE query_config LIKE '%tally.ayes%'
           OR query_config LIKE '%tally.nays%'
    """)
    remaining = cursor.fetchone()[0]
    if remaining > 0:
        raise Exception(f"Verification failed: {remaining} components still have old tally references")

    # Verify JSON is still valid
    cursor.execute("""
        SELECT id FROM "Dashboard Components"
        WHERE json_valid(query_config) = 0
    """)
    invalid_json = cursor.fetchall()
    if invalid_json:
        raise Exception(f"Verification failed: Invalid JSON in components: {[r[0] for r in invalid_json]}")

    conn.commit()
    print("Migration 024 completed successfully")


def down(conn: sqlite3.Connection) -> None:
    """Reverse tally column references back to old names."""
    cursor = conn.cursor()

    # Check if Dashboard Components table exists
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='Dashboard Components'
    """)
    if not cursor.fetchone():
        print("Dashboard Components table does not exist - skipping")
        return

    # Find components with new column names
    cursor.execute("""
        SELECT id, query_config FROM "Dashboard Components"
        WHERE query_config LIKE '%tally_ayes%'
           OR query_config LIKE '%tally_nays%'
    """)
    affected_rows = cursor.fetchall()

    if not affected_rows:
        print("No Dashboard Components with new tally column references found")
    else:
        print(f"Found {len(affected_rows)} Dashboard Components to revert")

        for row_id, query_config in affected_rows:
            try:
                # Reverse the replacements
                config = json.loads(query_config)
                json_str = json.dumps(config)
                # Reverse replacements (order matters - do qualified names first)
                json_str = json_str.replace("Referenda.tally_ayes", "Referenda.tally.ayes")
                json_str = json_str.replace("Referenda.tally_nays", "Referenda.tally.nays")
                json_str = json_str.replace("tally_ayes", "tally.ayes")
                json_str = json_str.replace("tally_nays", "tally.nays")

                cursor.execute("""
                    UPDATE "Dashboard Components"
                    SET query_config = ?
                    WHERE id = ?
                """, (json_str, row_id))

                print(f"  Reverted Dashboard Component {row_id}")
            except json.JSONDecodeError as e:
                print(f"  WARNING: Could not parse JSON for component {row_id}: {e}")

    # Clear Query Cache
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='Query Cache'
    """)
    if cursor.fetchone():
        cursor.execute('DELETE FROM "Query Cache"')
        deleted = cursor.rowcount
        print(f"Cleared {deleted} entries from Query Cache")

    conn.commit()
    print("Migration 024 rollback completed successfully")
