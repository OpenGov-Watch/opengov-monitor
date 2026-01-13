"""
Unit tests for migration_runner.py
"""
import pytest
import sqlite3
import tempfile
import hashlib
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import sys

# Add migrations directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'migrations'))

from migration_runner import (
    ensure_migrations_table,
    discover_migrations,
    compute_checksum,
    get_applied_migrations,
    validate_migrations,
    execute_sql_migration,
    execute_python_migration,
    run_migration,
    setup_logging
)


@pytest.fixture
def temp_db():
    """Create a temporary SQLite database for testing."""
    db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    db_path = db_file.name
    db_file.close()

    conn = sqlite3.connect(db_path)
    # Use DEFERRED transaction mode to match production behavior
    conn.isolation_level = 'DEFERRED'
    yield conn, db_path

    conn.close()
    Path(db_path).unlink()


@pytest.fixture
def temp_migrations_dir(tmp_path):
    """Create a temporary migrations directory structure."""
    migrations_dir = tmp_path / "migrations"
    versions_dir = migrations_dir / "versions"
    versions_dir.mkdir(parents=True)
    return migrations_dir


class TestSetupLogging:
    """Test logging setup."""

    def test_setup_logging_returns_logger(self):
        """Test that setup_logging returns a logger instance."""
        logger = setup_logging()
        assert logger.name == 'migration_runner'


class TestEnsureMigrationsTable:
    """Test schema_migrations table creation."""

    def test_creates_migrations_table(self, temp_db):
        """Test that schema_migrations table is created."""
        conn, _ = temp_db
        ensure_migrations_table(conn)

        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
        )
        assert cursor.fetchone() is not None

    def test_table_has_correct_schema(self, temp_db):
        """Test that schema_migrations has the correct columns."""
        conn, _ = temp_db
        ensure_migrations_table(conn)

        cursor = conn.execute("PRAGMA table_info(schema_migrations)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        assert 'version' in columns
        assert 'name' in columns
        assert 'applied_at' in columns
        assert 'checksum' in columns
        assert 'execution_time_ms' in columns

    def test_idempotent(self, temp_db):
        """Test that calling ensure_migrations_table multiple times is safe."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        ensure_migrations_table(conn)  # Should not raise error

        cursor = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
        assert cursor.fetchone()[0] == 1


class TestDiscoverMigrations:
    """Test migration file discovery."""

    def test_discovers_sql_migrations(self, temp_migrations_dir):
        """Test discovery of SQL migration files."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_initial.sql").write_text("CREATE TABLE test;")
        (versions_dir / "002_add_field.sql").write_text("ALTER TABLE test ADD COLUMN x;")

        migrations = discover_migrations(temp_migrations_dir)

        assert len(migrations) == 2
        assert migrations[0][0] == 1
        assert migrations[0][1] == "initial"
        assert migrations[1][0] == 2
        assert migrations[1][1] == "add_field"

    def test_discovers_python_migrations(self, temp_migrations_dir):
        """Test discovery of Python migration files."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_migrate_data.py").write_text("def up(conn): pass")

        migrations = discover_migrations(temp_migrations_dir)

        assert len(migrations) == 1
        assert migrations[0][0] == 1
        assert migrations[0][1] == "migrate_data"

    def test_sorts_by_version(self, temp_migrations_dir):
        """Test that migrations are sorted by version number."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "003_third.sql").write_text("SQL3")
        (versions_dir / "001_first.sql").write_text("SQL1")
        (versions_dir / "002_second.sql").write_text("SQL2")

        migrations = discover_migrations(temp_migrations_dir)

        assert [m[0] for m in migrations] == [1, 2, 3]

    def test_ignores_non_migration_files(self, temp_migrations_dir):
        """Test that non-migration files are ignored."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_valid.sql").write_text("SQL")
        (versions_dir / "README.md").write_text("Docs")
        (versions_dir / ".gitkeep").write_text("")
        (versions_dir / "invalid.txt").write_text("Text")

        migrations = discover_migrations(temp_migrations_dir)

        assert len(migrations) == 1

    def test_returns_empty_list_if_no_versions_dir(self, temp_migrations_dir):
        """Test that empty list is returned if versions directory doesn't exist."""
        # Don't create versions dir
        empty_dir = temp_migrations_dir / "empty"
        empty_dir.mkdir()

        migrations = discover_migrations(empty_dir)

        assert migrations == []

    def test_handles_invalid_version_format(self, temp_migrations_dir):
        """Test that files with invalid version format are skipped."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_valid.sql").write_text("SQL")
        (versions_dir / "invalid_no_version.sql").write_text("SQL")
        (versions_dir / "abc_not_number.sql").write_text("SQL")

        migrations = discover_migrations(temp_migrations_dir)

        assert len(migrations) == 1
        assert migrations[0][0] == 1


class TestComputeChecksum:
    """Test checksum computation."""

    def test_computes_sha256_checksum(self, tmp_path):
        """Test that checksum is SHA256 hash of file contents."""
        file_path = tmp_path / "test.sql"
        content = "CREATE TABLE test;"
        file_path.write_text(content)

        checksum = compute_checksum(file_path)
        expected = hashlib.sha256(content.encode()).hexdigest()

        assert checksum == expected

    def test_different_content_different_checksum(self, tmp_path):
        """Test that different content produces different checksum."""
        file1 = tmp_path / "test1.sql"
        file2 = tmp_path / "test2.sql"
        file1.write_text("CREATE TABLE test1;")
        file2.write_text("CREATE TABLE test2;")

        checksum1 = compute_checksum(file1)
        checksum2 = compute_checksum(file2)

        assert checksum1 != checksum2

    def test_same_content_same_checksum(self, tmp_path):
        """Test that same content produces same checksum."""
        content = "CREATE TABLE test;"
        file1 = tmp_path / "test1.sql"
        file2 = tmp_path / "test2.sql"
        file1.write_text(content)
        file2.write_text(content)

        checksum1 = compute_checksum(file1)
        checksum2 = compute_checksum(file2)

        assert checksum1 == checksum2


class TestGetAppliedMigrations:
    """Test retrieval of applied migrations."""

    def test_returns_empty_dict_when_no_migrations(self, temp_db):
        """Test that empty dict is returned when no migrations applied."""
        conn, _ = temp_db
        ensure_migrations_table(conn)

        applied = get_applied_migrations(conn)

        assert applied == {}

    def test_returns_applied_migrations(self, temp_db):
        """Test that applied migrations are returned with checksums."""
        conn, _ = temp_db
        ensure_migrations_table(conn)

        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (?, ?, ?, ?)",
            (1, "initial", "checksum1", 10)
        )
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (?, ?, ?, ?)",
            (2, "second", "checksum2", 20)
        )
        conn.commit()

        applied = get_applied_migrations(conn)

        assert applied == {1: "checksum1", 2: "checksum2"}


class TestValidateMigrations:
    """Test migration validation."""

    def test_returns_all_migrations_when_none_applied(self, temp_db, temp_migrations_dir):
        """Test that all migrations are returned when none applied."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_first.sql").write_text("SQL1")
        (versions_dir / "002_second.sql").write_text("SQL2")

        migrations = discover_migrations(temp_migrations_dir)
        applied = get_applied_migrations(conn)
        pending = validate_migrations(migrations, applied, logger)

        assert len(pending) == 2

    def test_returns_only_pending_migrations(self, temp_db, temp_migrations_dir):
        """Test that only unapplied migrations are returned."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file1 = versions_dir / "001_first.sql"
        file2 = versions_dir / "002_second.sql"
        file1.write_text("SQL1")
        file2.write_text("SQL2")

        # Mark first migration as applied
        checksum1 = compute_checksum(file1)
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (?, ?, ?, ?)",
            (1, "first", checksum1, 10)
        )
        conn.commit()

        migrations = discover_migrations(temp_migrations_dir)
        applied = get_applied_migrations(conn)
        pending = validate_migrations(migrations, applied, logger)

        assert len(pending) == 1
        assert pending[0][0] == 2

    def test_detects_gaps_in_versions(self, temp_db, temp_migrations_dir):
        """Test that gaps in version numbers are detected."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_first.sql").write_text("SQL1")
        (versions_dir / "003_third.sql").write_text("SQL3")  # Gap: missing 002

        migrations = discover_migrations(temp_migrations_dir)
        applied = get_applied_migrations(conn)

        with pytest.raises(SystemExit):
            validate_migrations(migrations, applied, logger)

    def test_detects_modified_applied_migration(self, temp_db, temp_migrations_dir):
        """Test that modified applied migrations are detected."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file1 = versions_dir / "001_first.sql"
        file1.write_text("SQL1")

        # Mark as applied with different checksum
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum, execution_time_ms) VALUES (?, ?, ?, ?)",
            (1, "first", "wrong_checksum", 10)
        )
        conn.commit()

        migrations = discover_migrations(temp_migrations_dir)
        applied = get_applied_migrations(conn)

        with pytest.raises(SystemExit):
            validate_migrations(migrations, applied, logger)

    def test_returns_empty_list_when_no_migrations(self, temp_db):
        """Test that empty list is returned when no migration files exist."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        migrations = []
        applied = get_applied_migrations(conn)
        pending = validate_migrations(migrations, applied, logger)

        assert pending == []


class TestExecuteSqlMigration:
    """Test SQL migration execution."""

    def test_executes_sql_statements(self, temp_db, temp_migrations_dir):
        """Test that SQL statements are executed."""
        conn, _ = temp_db
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_create_table.sql"
        file_path.write_text("CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT);")

        migration = (1, "create_table", file_path)
        execution_time = execute_sql_migration(conn, migration, logger)

        assert execution_time >= 0
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
        assert cursor.fetchone() is not None

    def test_executes_multiple_statements(self, temp_db, temp_migrations_dir):
        """Test that multiple SQL statements are executed in sequence."""
        conn, _ = temp_db
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_multi.sql"
        file_path.write_text("""
            -- Create table
            CREATE TABLE test1 (id INTEGER PRIMARY KEY);

            -- Create another table
            CREATE TABLE test2 (id INTEGER PRIMARY KEY);

            -- Insert data
            INSERT INTO test1 (id) VALUES (1);
            INSERT INTO test2 (id) VALUES (2);
        """)

        migration = (1, "multi", file_path)
        execution_time = execute_sql_migration(conn, migration, logger)

        assert execution_time >= 0
        # Verify both tables exist
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test1'")
        assert cursor.fetchone() is not None
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test2'")
        assert cursor.fetchone() is not None

    def test_transaction_rollback_on_multi_statement_failure(self, temp_db, temp_migrations_dir):
        """Test that ALL statements roll back when one fails in a multi-statement migration."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_partial_fail.sql"
        # First statement succeeds, second and third fail
        file_path.write_text("""
            CREATE TABLE should_rollback (id INTEGER PRIMARY KEY);
            INSERT INTO should_rollback (id) VALUES (1);
            INVALID SQL SYNTAX HERE;
        """)

        migration = (1, "partial_fail", file_path)

        # run_migration should fail and rollback
        with pytest.raises(SystemExit):
            run_migration(conn, migration, logger)

        # Verify the table was NOT created (rollback worked)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='should_rollback'")
        result = cursor.fetchone()
        assert result is None, f"Table should not exist after rollback, but found: {result}"

        # Verify migration was NOT recorded
        cursor = conn.execute("SELECT COUNT(*) FROM schema_migrations WHERE version = 1")
        assert cursor.fetchone()[0] == 0, "Migration should not be recorded after failure"

    def test_returns_execution_time(self, temp_db, temp_migrations_dir):
        """Test that execution time is returned in milliseconds."""
        conn, _ = temp_db
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.sql"
        file_path.write_text("SELECT 1;")

        migration = (1, "test", file_path)
        execution_time = execute_sql_migration(conn, migration, logger)

        assert isinstance(execution_time, int)
        assert execution_time >= 0


class TestExecutePythonMigration:
    """Test Python migration execution."""

    def test_executes_up_function(self, temp_db, temp_migrations_dir):
        """Test that up() function is executed."""
        conn, _ = temp_db
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.py"
        file_path.write_text("""
import sqlite3

def up(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE TABLE test_table (id INTEGER PRIMARY KEY)")
    conn.commit()
""")

        migration = (1, "test", file_path)
        execution_time = execute_python_migration(conn, migration, logger)

        assert execution_time >= 0
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
        assert cursor.fetchone() is not None

    def test_raises_error_if_no_up_function(self, temp_db, temp_migrations_dir):
        """Test that error is raised if up() function is missing."""
        conn, _ = temp_db
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.py"
        file_path.write_text("# No up function")

        migration = (1, "test", file_path)

        with pytest.raises(SystemExit):
            execute_python_migration(conn, migration, logger)

    def test_returns_execution_time(self, temp_db, temp_migrations_dir):
        """Test that execution time is returned in milliseconds."""
        conn, _ = temp_db
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.py"
        file_path.write_text("""
def up(conn):
    pass
""")

        migration = (1, "test", file_path)
        execution_time = execute_python_migration(conn, migration, logger)

        assert isinstance(execution_time, int)
        assert execution_time >= 0


class TestRunMigration:
    """Test full migration execution and recording."""

    def test_executes_and_records_sql_migration(self, temp_db, temp_migrations_dir):
        """Test that SQL migration is executed and recorded."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.sql"
        file_path.write_text("CREATE TABLE test (id INTEGER);")

        migration = (1, "test", file_path)
        run_migration(conn, migration, logger)

        # Check table was created
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
        assert cursor.fetchone() is not None

        # Check migration was recorded
        cursor = conn.execute("SELECT version, name FROM schema_migrations WHERE version = 1")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == 1
        assert row[1] == "test"

    def test_executes_and_records_python_migration(self, temp_db, temp_migrations_dir):
        """Test that Python migration is executed and recorded."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.py"
        file_path.write_text("""
def up(conn):
    conn.execute("CREATE TABLE test (id INTEGER)")
    conn.commit()
""")

        migration = (1, "test", file_path)
        run_migration(conn, migration, logger)

        # Check migration was recorded
        cursor = conn.execute("SELECT version FROM schema_migrations WHERE version = 1")
        assert cursor.fetchone() is not None

    def test_records_checksum(self, temp_db, temp_migrations_dir):
        """Test that migration checksum is recorded."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.sql"
        content = "CREATE TABLE test (id INTEGER);"
        file_path.write_text(content)

        expected_checksum = hashlib.sha256(content.encode()).hexdigest()
        migration = (1, "test", file_path)
        run_migration(conn, migration, logger)

        cursor = conn.execute("SELECT checksum FROM schema_migrations WHERE version = 1")
        assert cursor.fetchone()[0] == expected_checksum

    def test_records_execution_time(self, temp_db, temp_migrations_dir):
        """Test that execution time is recorded."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.sql"
        file_path.write_text("SELECT 1;")

        migration = (1, "test", file_path)
        run_migration(conn, migration, logger)

        cursor = conn.execute("SELECT execution_time_ms FROM schema_migrations WHERE version = 1")
        execution_time = cursor.fetchone()[0]
        assert execution_time is not None
        assert execution_time >= 0

    def test_rollback_on_failure(self, temp_db, temp_migrations_dir):
        """Test that transaction is rolled back on failure."""
        conn, _ = temp_db
        ensure_migrations_table(conn)
        logger = setup_logging()

        versions_dir = temp_migrations_dir / "versions"
        file_path = versions_dir / "001_test.sql"
        file_path.write_text("INVALID SQL SYNTAX;")

        migration = (1, "test", file_path)

        with pytest.raises(SystemExit):
            run_migration(conn, migration, logger)

        # Check migration was not recorded
        cursor = conn.execute("SELECT COUNT(*) FROM schema_migrations WHERE version = 1")
        assert cursor.fetchone()[0] == 0
