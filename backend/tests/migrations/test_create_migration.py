"""
Unit tests for create_migration.py
"""
import pytest
from pathlib import Path
import sys

# Add migrations directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'migrations'))

from create_migration import (
    get_next_version,
    create_migration,
    SQL_TEMPLATE,
    PYTHON_TEMPLATE
)


@pytest.fixture
def temp_migrations_dir(tmp_path):
    """Create a temporary migrations directory structure."""
    migrations_dir = tmp_path / "migrations"
    versions_dir = migrations_dir / "versions"
    versions_dir.mkdir(parents=True)
    return migrations_dir


class TestGetNextVersion:
    """Test version number determination."""

    def test_returns_1_for_empty_directory(self, temp_migrations_dir):
        """Test that version 1 is returned when no migrations exist."""
        version = get_next_version(temp_migrations_dir)
        assert version == 1

    def test_creates_versions_directory_if_missing(self, tmp_path):
        """Test that versions directory is created if it doesn't exist."""
        migrations_dir = tmp_path / "migrations"
        migrations_dir.mkdir()

        version = get_next_version(migrations_dir)

        assert version == 1
        assert (migrations_dir / "versions").exists()

    def test_returns_next_version_after_sql_migration(self, temp_migrations_dir):
        """Test that next version is returned after existing SQL migration."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_initial.sql").write_text("SQL")

        version = get_next_version(temp_migrations_dir)

        assert version == 2

    def test_returns_next_version_after_python_migration(self, temp_migrations_dir):
        """Test that next version is returned after existing Python migration."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_initial.py").write_text("Python")

        version = get_next_version(temp_migrations_dir)

        assert version == 2

    def test_handles_multiple_migrations(self, temp_migrations_dir):
        """Test that correct version is returned with multiple migrations."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_first.sql").write_text("SQL1")
        (versions_dir / "002_second.sql").write_text("SQL2")
        (versions_dir / "003_third.py").write_text("Python")

        version = get_next_version(temp_migrations_dir)

        assert version == 4

    def test_finds_max_version_from_unordered_files(self, temp_migrations_dir):
        """Test that max version is found even when files are unordered."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "003_third.sql").write_text("SQL3")
        (versions_dir / "001_first.sql").write_text("SQL1")
        (versions_dir / "005_fifth.sql").write_text("SQL5")
        (versions_dir / "002_second.sql").write_text("SQL2")

        version = get_next_version(temp_migrations_dir)

        assert version == 6

    def test_ignores_non_migration_files(self, temp_migrations_dir):
        """Test that non-migration files are ignored."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_valid.sql").write_text("SQL")
        (versions_dir / "README.md").write_text("Docs")
        (versions_dir / "invalid.txt").write_text("Text")

        version = get_next_version(temp_migrations_dir)

        assert version == 2

    def test_ignores_files_with_invalid_version(self, temp_migrations_dir):
        """Test that files with invalid version format are ignored."""
        versions_dir = temp_migrations_dir / "versions"
        (versions_dir / "001_valid.sql").write_text("SQL")
        (versions_dir / "invalid_no_number.sql").write_text("SQL")
        (versions_dir / "abc_not_a_number.sql").write_text("SQL")

        version = get_next_version(temp_migrations_dir)

        assert version == 2


class TestCreateMigration:
    """Test migration file creation."""

    def test_creates_sql_migration_file(self, temp_migrations_dir, capsys):
        """Test that SQL migration file is created with correct name."""
        create_migration("add_user_table", "sql", temp_migrations_dir)

        file_path = temp_migrations_dir / "versions" / "001_add_user_table.sql"
        assert file_path.exists()

    def test_creates_python_migration_file(self, temp_migrations_dir, capsys):
        """Test that Python migration file is created with correct name."""
        create_migration("migrate_data", "py", temp_migrations_dir)

        file_path = temp_migrations_dir / "versions" / "001_migrate_data.py"
        assert file_path.exists()

    def test_sql_migration_contains_template(self, temp_migrations_dir, capsys):
        """Test that SQL migration file contains the template."""
        create_migration("test_migration", "sql", temp_migrations_dir)

        file_path = temp_migrations_dir / "versions" / "001_test_migration.sql"
        content = file_path.read_text()

        assert "Migration: Test Migration" in content
        assert "Version: 001" in content
        assert "Add your SQL statements below" in content

    def test_python_migration_contains_template(self, temp_migrations_dir, capsys):
        """Test that Python migration file contains the template."""
        create_migration("test_migration", "py", temp_migrations_dir)

        file_path = temp_migrations_dir / "versions" / "001_test_migration.py"
        content = file_path.read_text()

        assert "Migration: Test Migration" in content
        assert "Version: 001" in content
        assert "def up(conn: sqlite3.Connection)" in content
        assert "def down(conn: sqlite3.Connection)" in content

    def test_increments_version_number(self, temp_migrations_dir, capsys):
        """Test that version number increments for each migration."""
        create_migration("first", "sql", temp_migrations_dir)
        create_migration("second", "sql", temp_migrations_dir)
        create_migration("third", "sql", temp_migrations_dir)

        assert (temp_migrations_dir / "versions" / "001_first.sql").exists()
        assert (temp_migrations_dir / "versions" / "002_second.sql").exists()
        assert (temp_migrations_dir / "versions" / "003_third.sql").exists()

    def test_formats_description_with_title_case(self, temp_migrations_dir, capsys):
        """Test that migration description is formatted with title case."""
        create_migration("add_user_preferences", "sql", temp_migrations_dir)

        file_path = temp_migrations_dir / "versions" / "001_add_user_preferences.sql"
        content = file_path.read_text()

        assert "Migration: Add User Preferences" in content

    def test_includes_timestamp(self, temp_migrations_dir, capsys):
        """Test that migration file includes creation timestamp."""
        create_migration("test", "sql", temp_migrations_dir)

        file_path = temp_migrations_dir / "versions" / "001_test.sql"
        content = file_path.read_text()

        assert "Created:" in content

    def test_pads_version_with_zeros(self, temp_migrations_dir, capsys):
        """Test that version numbers are zero-padded to 3 digits."""
        # Create enough migrations to test padding
        for i in range(1, 12):
            create_migration(f"migration_{i}", "sql", temp_migrations_dir)

        assert (temp_migrations_dir / "versions" / "001_migration_1.sql").exists()
        assert (temp_migrations_dir / "versions" / "010_migration_10.sql").exists()
        assert (temp_migrations_dir / "versions" / "011_migration_11.sql").exists()

    def test_prints_confirmation_message(self, temp_migrations_dir, capsys):
        """Test that confirmation message is printed."""
        create_migration("test", "sql", temp_migrations_dir)

        captured = capsys.readouterr()
        assert "Created migration:" in captured.out
        assert "001_test.sql" in captured.out
        assert "Version: 1" in captured.out

    def test_handles_migration_name_with_special_chars(self, temp_migrations_dir, capsys):
        """Test that special characters in name are preserved in filename."""
        create_migration("add-user-table", "sql", temp_migrations_dir)

        file_path = temp_migrations_dir / "versions" / "001_add-user-table.sql"
        assert file_path.exists()


class TestTemplates:
    """Test template content."""

    def test_sql_template_structure(self):
        """Test that SQL template has correct structure."""
        assert "-- Migration:" in SQL_TEMPLATE
        assert "-- Version:" in SQL_TEMPLATE
        assert "-- Created:" in SQL_TEMPLATE
        assert "-- Add your SQL statements below" in SQL_TEMPLATE

    def test_python_template_structure(self):
        """Test that Python template has correct structure."""
        assert 'Migration:' in PYTHON_TEMPLATE
        assert 'Version:' in PYTHON_TEMPLATE
        assert 'Created:' in PYTHON_TEMPLATE
        assert 'def up(conn: sqlite3.Connection)' in PYTHON_TEMPLATE
        assert 'def down(conn: sqlite3.Connection)' in PYTHON_TEMPLATE

    def test_python_template_has_docstrings(self):
        """Test that Python template includes docstrings."""
        assert '"""Apply the migration."""' in PYTHON_TEMPLATE
        assert '"""Rollback the migration (optional)."""' in PYTHON_TEMPLATE

    def test_templates_use_format_placeholders(self):
        """Test that templates use correct format placeholders."""
        assert '{description}' in SQL_TEMPLATE
        assert '{version' in SQL_TEMPLATE
        assert '{timestamp}' in SQL_TEMPLATE

        assert '{description}' in PYTHON_TEMPLATE
        assert '{version' in PYTHON_TEMPLATE
        assert '{timestamp}' in PYTHON_TEMPLATE
