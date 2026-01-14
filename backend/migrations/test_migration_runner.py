"""
Unit tests for migration runner backup functionality.
"""
import tempfile
import sqlite3
from pathlib import Path
import pytest
import logging
import time

# Import the backup function
import sys
sys.path.insert(0, str(Path(__file__).parent))
from migration_runner import backup_database


class TestBackupDatabase:
    """Test the backup_database function."""

    def test_backup_creates_file_with_timestamp(self):
        """Test that backup creates a timestamped file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a test database
            db_path = Path(tmpdir) / "test.db"
            conn = sqlite3.connect(str(db_path))
            conn.execute("CREATE TABLE test (id INTEGER)")
            conn.execute("INSERT INTO test VALUES (1), (2), (3)")
            conn.commit()
            conn.close()

            # Create backup
            logger = logging.getLogger('test')
            backup_path = backup_database(str(db_path), logger)

            # Verify backup exists
            assert backup_path is not None
            assert Path(backup_path).exists()

            # Verify backup filename format
            assert "test_backup_" in backup_path
            assert backup_path.endswith(".db")

    def test_backup_preserves_data(self):
        """Test that backup contains all original data."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a test database with data
            db_path = Path(tmpdir) / "test.db"
            conn = sqlite3.connect(str(db_path))
            conn.execute("CREATE TABLE users (id INTEGER, name TEXT)")
            conn.execute("INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob')")
            conn.commit()
            conn.close()

            # Create backup
            logger = logging.getLogger('test')
            backup_path = backup_database(str(db_path), logger)

            # Verify backup data matches original
            backup_conn = sqlite3.connect(backup_path)
            cursor = backup_conn.execute("SELECT COUNT(*) FROM users")
            count = cursor.fetchone()[0]
            assert count == 2

            cursor = backup_conn.execute("SELECT name FROM users ORDER BY id")
            names = [row[0] for row in cursor.fetchall()]
            assert names == ['Alice', 'Bob']

            backup_conn.close()

    def test_backup_nonexistent_database(self):
        """Test backup handling of nonexistent database."""
        logger = logging.getLogger('test')
        backup_path = backup_database("/nonexistent/path.db", logger)

        # Should return None for nonexistent database
        assert backup_path is None

    def test_backup_multiple_times_unique_names(self):
        """Test that multiple backups create unique filenames."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a test database
            db_path = Path(tmpdir) / "test.db"
            conn = sqlite3.connect(str(db_path))
            conn.execute("CREATE TABLE test (id INTEGER)")
            conn.close()

            logger = logging.getLogger('test')

            # Create first backup
            backup1 = backup_database(str(db_path), logger)

            # Wait a second to ensure different timestamp
            time.sleep(1)

            # Create second backup
            backup2 = backup_database(str(db_path), logger)

            # Verify both backups exist and have different names
            assert backup1 != backup2
            assert Path(backup1).exists()
            assert Path(backup2).exists()

    def test_backup_preserves_schema(self):
        """Test that backup preserves table schemas."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create database with complex schema
            db_path = Path(tmpdir) / "test.db"
            conn = sqlite3.connect(str(db_path))
            conn.execute("""
                CREATE TABLE items (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    price REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("CREATE INDEX idx_items_name ON items (name)")
            conn.commit()
            conn.close()

            # Create backup
            logger = logging.getLogger('test')
            backup_path = backup_database(str(db_path), logger)

            # Verify schema is preserved
            backup_conn = sqlite3.connect(backup_path)

            # Check table exists
            cursor = backup_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='items'"
            )
            assert cursor.fetchone() is not None

            # Check index exists
            cursor = backup_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_items_name'"
            )
            assert cursor.fetchone() is not None

            backup_conn.close()
