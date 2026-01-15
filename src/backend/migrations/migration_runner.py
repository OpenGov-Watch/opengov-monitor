"""
Database migration runner for OpenGov Monitor.

Discovers and executes pending database migrations in version order.
"""
import argparse
import hashlib
import logging
import sqlite3
import sys
from pathlib import Path
from typing import List, Tuple, Optional
import time

# Migration file structure
Migration = Tuple[int, str, Path]  # (version, name, file_path)


def setup_logging():
    """Configure logging for migration runner."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger('migration_runner')


def ensure_migrations_table(conn: sqlite3.Connection):
    """Create schema_migrations table if it doesn't exist."""
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


def discover_migrations(migrations_dir: Path) -> List[Migration]:
    """Find all migration files in versions directory."""
    versions_dir = migrations_dir / 'versions'
    if not versions_dir.exists():
        return []

    migrations = []
    for file_path in sorted(versions_dir.glob('*')):
        if file_path.suffix not in ['.sql', '.py']:
            continue

        # Parse version from filename: 001_description.sql
        name = file_path.stem
        parts = name.split('_', 1)
        if len(parts) < 2:
            continue

        try:
            version = int(parts[0])
            description = parts[1]
            migrations.append((version, description, file_path))
        except ValueError:
            continue

    return sorted(migrations, key=lambda m: m[0])


def compute_checksum(file_path: Path) -> str:
    """Compute SHA256 checksum of migration file.

    Normalizes line endings to LF to ensure consistent checksums across platforms.
    """
    content = file_path.read_bytes()
    # Normalize CRLF -> LF to handle cross-platform line ending differences
    normalized_content = content.replace(b'\r\n', b'\n')
    return hashlib.sha256(normalized_content).hexdigest()


def get_applied_migrations(conn: sqlite3.Connection) -> dict:
    """Get dictionary of applied migrations: {version: checksum}."""
    cursor = conn.execute(
        "SELECT version, checksum FROM schema_migrations ORDER BY version"
    )
    return {row[0]: row[1] for row in cursor.fetchall()}


def backup_database(db_path: str, logger: logging.Logger) -> Optional[str]:
    """
    Create a timestamped backup of the database before running migrations.

    Uses SQLite's backup API to ensure WAL-safe backups. This properly handles
    databases in WAL mode by copying all data consistently, including any
    uncheckpointed writes in the -wal file.

    Returns:
        Path to backup file if successful, None if failed
    """
    from datetime import datetime

    db_file = Path(db_path)
    if not db_file.exists():
        logger.warning(f"Database file not found: {db_path}")
        return None

    # Create backup filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = db_file.parent
    backup_name = f"{db_file.stem}_backup_{timestamp}{db_file.suffix}"
    backup_path = backup_dir / backup_name

    try:
        logger.info(f"Creating backup: {backup_path}")

        # Use SQLite's backup API for WAL-safe backup
        # This handles WAL mode properly by copying all data consistently
        source_conn = sqlite3.connect(db_path)
        backup_conn = sqlite3.connect(str(backup_path))

        with backup_conn:
            source_conn.backup(backup_conn)

        backup_conn.close()
        source_conn.close()

        logger.info(f"Backup created successfully: {backup_path}")
        return str(backup_path)
    except Exception as e:
        logger.error(f"Failed to create backup: {e}", exc_info=True)
        return None


def validate_migrations(
    migrations: List[Migration],
    applied: dict,
    logger: logging.Logger
) -> List[Migration]:
    """
    Validate migration consistency and return pending migrations.

    Checks:
    - No gaps in version numbers
    - No duplicate versions
    - Applied migrations haven't been modified (checksum match)
    """
    if not migrations:
        logger.info("No migrations found")
        return []

    # Check for gaps
    versions = [m[0] for m in migrations]
    expected = list(range(1, len(versions) + 1))
    if versions != expected:
        logger.error(f"Gap in migration versions. Expected {expected}, got {versions}")
        sys.exit(1)

    # Check for duplicates
    if len(versions) != len(set(versions)):
        logger.error("Duplicate migration versions found")
        sys.exit(1)

    # Verify applied migrations haven't changed
    for version, name, file_path in migrations:
        if version in applied:
            current_checksum = compute_checksum(file_path)
            if current_checksum != applied[version]:
                logger.error(
                    f"Migration {version} ({name}) has been modified after being applied. "
                    f"Create a new migration instead."
                )
                sys.exit(1)

    # Return pending migrations (not yet applied)
    pending = [m for m in migrations if m[0] not in applied]
    return pending


def execute_sql_migration(
    conn: sqlite3.Connection,
    migration: Migration,
    logger: logging.Logger
) -> int:
    """
    Execute SQL migration file within a transaction.

    IMPORTANT: We do NOT use executescript() because it auto-commits,
    which breaks transaction rollback on failure. Instead, we execute
    each statement individually within the existing transaction.
    """
    version, name, file_path = migration
    sql = file_path.read_text()

    start_time = time.time()
    cursor = conn.cursor()

    # Split SQL into individual statements
    # This is a simple splitter - assumes statements end with semicolon
    # For complex SQL with semicolons in strings, consider using sqlparse library
    statements = []
    current_statement = []

    for line in sql.split('\n'):
        # Remove SQL comments (simple heuristic: lines starting with --)
        # Note: This doesn't handle inline comments or comments in strings
        stripped = line.strip()
        if stripped.startswith('--') or not stripped:
            continue

        current_statement.append(line)

        # Check if line ends with semicolon (statement terminator)
        if stripped.endswith(';'):
            statement = '\n'.join(current_statement).strip()
            if statement:
                statements.append(statement)
            current_statement = []

    # Handle any remaining statement without trailing semicolon
    if current_statement:
        statement = '\n'.join(current_statement).strip()
        if statement:
            statements.append(statement)

    # Execute each statement within the transaction
    for statement in statements:
        cursor.execute(statement)

    execution_time = int((time.time() - start_time) * 1000)

    return execution_time


def execute_python_migration(
    conn: sqlite3.Connection,
    migration: Migration,
    logger: logging.Logger
) -> int:
    """Execute Python migration file. Returns execution time in ms."""
    version, name, file_path = migration

    # Import the migration module
    import importlib.util
    spec = importlib.util.spec_from_file_location(f"migration_{version}", file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if not hasattr(module, 'up'):
        logger.error(f"Migration {version} missing 'up' function")
        sys.exit(1)

    start_time = time.time()
    module.up(conn)
    execution_time = int((time.time() - start_time) * 1000)

    return execution_time


def run_migration(
    conn: sqlite3.Connection,
    migration: Migration,
    logger: logging.Logger
):
    """Execute a single migration and record it."""
    version, name, file_path = migration
    checksum = compute_checksum(file_path)

    logger.info(f"Running migration {version}: {name}")

    try:
        # Explicitly begin transaction
        # This ensures ALL statements (including DDL like CREATE TABLE) are in the transaction
        conn.execute("BEGIN")

        # Execute migration based on file type
        if file_path.suffix == '.sql':
            execution_time = execute_sql_migration(conn, migration, logger)
        elif file_path.suffix == '.py':
            execution_time = execute_python_migration(conn, migration, logger)
        else:
            logger.error(f"Unknown migration file type: {file_path.suffix}")
            sys.exit(1)

        # Record successful migration
        conn.execute(
            """
            INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
            VALUES (?, ?, ?, ?)
            """,
            (version, name, checksum, execution_time)
        )
        conn.commit()

        logger.info(f"Migration {version} completed in {execution_time}ms")

    except Exception as e:
        conn.rollback()
        logger.error(f"Migration {version} failed: {e}", exc_info=True)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Run database migrations')
    parser.add_argument(
        '--db',
        default='../data/local/polkadot.db',
        help='Path to SQLite database'
    )
    parser.add_argument(
        '--migrations-dir',
        default=None,
        help='Path to migrations directory (default: same dir as script)'
    )
    args = parser.parse_args()

    logger = setup_logging()

    # Determine migrations directory
    if args.migrations_dir:
        migrations_dir = Path(args.migrations_dir)
    else:
        migrations_dir = Path(__file__).parent

    logger.info(f"Migrations directory: {migrations_dir}")
    logger.info(f"Database: {args.db}")

    # Connect to database with deferred transaction mode
    # This ensures that execute() statements are wrapped in transactions
    # and can be rolled back on failure
    conn = sqlite3.connect(args.db)
    conn.isolation_level = 'DEFERRED'  # Enable transaction mode

    try:
        # Ensure migrations table exists
        ensure_migrations_table(conn)

        # Discover migration files
        migrations = discover_migrations(migrations_dir)
        logger.info(f"Found {len(migrations)} migration files")

        # Get applied migrations
        applied = get_applied_migrations(conn)
        logger.info(f"Already applied: {len(applied)} migrations")

        # Validate and get pending migrations
        pending = validate_migrations(migrations, applied, logger)

        if not pending:
            logger.info("No pending migrations. Database is up to date.")
            return

        logger.info(f"Pending migrations: {len(pending)}")

        # Create backup before running migrations
        backup_path = backup_database(args.db, logger)
        if backup_path:
            logger.info(f"Backup saved to: {backup_path}")
            logger.info("You can restore from this backup if migrations fail")
        else:
            logger.warning("Failed to create backup, but continuing with migrations")

        # Execute pending migrations
        for migration in pending:
            run_migration(conn, migration, logger)

        logger.info("All migrations completed successfully")

    finally:
        conn.close()


if __name__ == '__main__':
    main()
