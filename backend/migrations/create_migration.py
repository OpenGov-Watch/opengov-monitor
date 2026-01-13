"""
Create a new migration file with proper naming and template.
"""
import argparse
from pathlib import Path
from datetime import datetime

SQL_TEMPLATE = """-- Migration: {description}
-- Version: {version:03d}
-- Created: {timestamp}

-- Add your SQL statements below

"""

PYTHON_TEMPLATE = '''"""
Migration: {description}
Version: {version:03d}
Created: {timestamp}
"""
import sqlite3


def up(conn: sqlite3.Connection) -> None:
    """Apply the migration."""
    cursor = conn.cursor()

    # Add your migration logic here

    conn.commit()


def down(conn: sqlite3.Connection) -> None:
    """Rollback the migration (optional)."""
    pass
'''


def get_next_version(migrations_dir: Path) -> int:
    """Determine the next migration version number."""
    versions_dir = migrations_dir / 'versions'
    if not versions_dir.exists():
        versions_dir.mkdir(parents=True)
        return 1

    max_version = 0
    for file_path in versions_dir.glob('*'):
        if file_path.suffix not in ['.sql', '.py']:
            continue
        try:
            version = int(file_path.stem.split('_')[0])
            max_version = max(max_version, version)
        except (ValueError, IndexError):
            continue

    return max_version + 1


def create_migration(
    name: str,
    migration_type: str,
    migrations_dir: Path
):
    """Create a new migration file."""
    version = get_next_version(migrations_dir)
    timestamp = datetime.now().isoformat()

    # Format filename
    filename = f"{version:03d}_{name}.{migration_type}"
    file_path = migrations_dir / 'versions' / filename

    # Choose template
    if migration_type == 'sql':
        template = SQL_TEMPLATE
    else:
        template = PYTHON_TEMPLATE

    # Write file
    content = template.format(
        description=name.replace('_', ' ').title(),
        version=version,
        timestamp=timestamp
    )
    file_path.write_text(content)

    print(f"Created migration: {file_path}")
    print(f"Version: {version}")


def main():
    parser = argparse.ArgumentParser(description='Create a new migration file')
    parser.add_argument(
        '--name',
        required=True,
        help='Migration name (snake_case)'
    )
    parser.add_argument(
        '--type',
        choices=['sql', 'py'],
        default='sql',
        help='Migration type (default: sql)'
    )
    parser.add_argument(
        '--migrations-dir',
        default=None,
        help='Path to migrations directory'
    )
    args = parser.parse_args()

    # Determine migrations directory
    if args.migrations_dir:
        migrations_dir = Path(args.migrations_dir)
    else:
        migrations_dir = Path(__file__).parent

    create_migration(args.name, args.type, migrations_dir)


if __name__ == '__main__':
    main()
