"""
Generate baseline schema from a migrated database.

Usage:
    python generate_baseline.py --db ../../data/local/polkadot.db --output baseline_schema.sql
"""
import argparse
import sqlite3
from pathlib import Path


def generate_baseline(db_path: str, output_path: str):
    """Dump schema from migrated database to baseline file."""
    conn = sqlite3.connect(db_path)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("-- Baseline schema generated from migrated database\n")
        f.write("-- Do not edit manually - regenerate after migrations\n")
        f.write("-- This file represents the current state of the database schema\n")
        f.write("-- For fresh databases, use: python migration_runner.py --db new.db --baseline\n\n")

        # Dump schema_migrations table first (with all versions marked as applied)
        f.write("-- Schema migrations tracking table\n")
        f.write("""CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    execution_time_ms INTEGER
);\n\n""")

        # Get all applied migrations to include in baseline
        cursor = conn.execute(
            "SELECT version, name, checksum FROM schema_migrations ORDER BY version"
        )
        migrations = cursor.fetchall()
        if migrations:
            f.write("-- Mark all migrations as applied (baseline includes all schema changes)\n")
            for version, name, checksum in migrations:
                f.write(f"INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) ")
                f.write(f"VALUES ({version}, '{name}', '{checksum}', 0);\n")
            f.write("\n")

        # Dump all CREATE TABLE statements (excluding sqlite internal and schema_migrations)
        f.write("-- Tables\n")
        cursor = conn.execute(
            """SELECT name, sql FROM sqlite_master
               WHERE type='table'
               AND name NOT LIKE 'sqlite_%'
               AND name != 'schema_migrations'
               ORDER BY name"""
        )
        for name, sql in cursor:
            if sql:  # Skip None (internal tables)
                f.write(f"-- Table: {name}\n")
                f.write(f"{sql};\n\n")

        # Dump all CREATE INDEX statements
        f.write("-- Indexes\n")
        cursor = conn.execute(
            """SELECT name, sql FROM sqlite_master
               WHERE type='index'
               AND sql IS NOT NULL
               ORDER BY name"""
        )
        for name, sql in cursor:
            f.write(f"{sql};\n")
        f.write("\n")

        # Dump all CREATE VIEW statements
        f.write("-- Views\n")
        cursor = conn.execute(
            """SELECT name, sql FROM sqlite_master
               WHERE type='view'
               ORDER BY name"""
        )
        for name, sql in cursor:
            if sql:
                f.write(f"-- View: {name}\n")
                f.write(f"{sql};\n\n")

    conn.close()
    print(f"Baseline schema written to {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Generate baseline schema from a migrated database'
    )
    parser.add_argument(
        '--db',
        required=True,
        help='Path to migrated SQLite database'
    )
    parser.add_argument(
        '--output',
        default='baseline_schema.sql',
        help='Output file path (default: baseline_schema.sql)'
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Error: Database file not found: {db_path}")
        return 1

    generate_baseline(str(db_path), args.output)
    return 0


if __name__ == '__main__':
    exit(main())
