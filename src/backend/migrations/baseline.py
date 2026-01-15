"""
Baseline utility for existing databases.

Use this script to mark existing databases as "up to date" without running migrations.
This is useful when deploying the migration system to a database that already has tables.
"""
import argparse
import sqlite3
import hashlib
from pathlib import Path
import sys


def baseline_database(db_path: str, version: int, migrations_dir: Path):
    """
    Mark all migrations up to the specified version as applied without running them.

    Args:
        db_path: Path to SQLite database
        version: Baseline version (all migrations up to this version will be marked as applied)
        migrations_dir: Path to migrations directory
    """
    conn = sqlite3.connect(db_path)

    try:
        # Ensure schema_migrations table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                checksum TEXT NOT NULL,
                execution_time_ms INTEGER
            )
        """)
        conn.commit()

        # Find all migration files up to the baseline version
        versions_dir = migrations_dir / 'versions'
        if not versions_dir.exists():
            print(f"Error: versions directory not found: {versions_dir}")
            sys.exit(1)

        migrations = []
        for file_path in sorted(versions_dir.glob('*')):
            if file_path.suffix not in ['.sql', '.py']:
                continue

            name = file_path.stem
            parts = name.split('_', 1)
            if len(parts) < 2:
                continue

            try:
                migration_version = int(parts[0])
                if migration_version <= version:
                    description = parts[1]
                    checksum = hashlib.sha256(file_path.read_bytes()).hexdigest()
                    migrations.append((migration_version, description, checksum))
            except ValueError:
                continue

        if not migrations:
            print(f"No migrations found up to version {version}")
            return

        # Insert baseline records
        print(f"Baselining database to version {version}...")
        for migration_version, name, checksum in migrations:
            # Check if already applied
            cursor = conn.execute(
                "SELECT version FROM schema_migrations WHERE version = ?",
                (migration_version,)
            )
            if cursor.fetchone():
                print(f"  Migration {migration_version} ({name}) already applied, skipping")
                continue

            conn.execute(
                """
                INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
                VALUES (?, ?, ?, ?)
                """,
                (migration_version, name, checksum, 0)
            )
            print(f"  Marked migration {migration_version} ({name}) as applied")

        conn.commit()
        print(f"\nBaseline complete. Database is now at version {version}.")
        print("You can now run 'pnpm migrate' to apply any new migrations.")

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description='Baseline an existing database with migration history',
        epilog="""
Examples:
  # Baseline to latest migration
  python baseline.py --db ../data/polkadot.db --version 5

  # Baseline specific database
  python baseline.py --db /path/to/db.sqlite --version 3
        """
    )
    parser.add_argument(
        '--db',
        required=True,
        help='Path to SQLite database'
    )
    parser.add_argument(
        '--version',
        type=int,
        required=True,
        help='Baseline version (all migrations up to this version will be marked as applied)'
    )
    parser.add_argument(
        '--migrations-dir',
        default=None,
        help='Path to migrations directory (default: same dir as script)'
    )
    args = parser.parse_args()

    # Determine migrations directory
    if args.migrations_dir:
        migrations_dir = Path(args.migrations_dir)
    else:
        migrations_dir = Path(__file__).parent

    baseline_database(args.db, args.version, migrations_dir)


if __name__ == '__main__':
    main()
