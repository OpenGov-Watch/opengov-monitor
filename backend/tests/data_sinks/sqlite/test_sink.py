"""
Tests for the SQLiteSink class.

Tests cover:
- Connection management
- View creation and logic
- Table management
- Schema inference
- DataFrame preparation
- UPSERT SQL generation
- update_table operations
- Read/query utilities
- Compatibility methods
- Edge cases
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import sqlite3

from data_sinks.sqlite.sink import SQLiteSink
from data_sinks.sqlite.schema import (
    REFERENDA_SCHEMA,
    TREASURY_SCHEMA,
    CHILD_BOUNTIES_SCHEMA,
    FELLOWSHIP_SCHEMA,
    FELLOWSHIP_SALARY_CYCLES_SCHEMA,
    generate_create_table_sql,
    generate_create_indexes_sql,
)


# =============================================================================
# Connection Management Tests
# =============================================================================

class TestConnectionManagement:
    """Tests for SQLiteSink connection management."""

    def test_sink_init_default_path(self):
        """Verify default db_path assignment."""
        sink = SQLiteSink()
        # Default is 'opengov_monitor.db' when no env var set
        assert sink.db_path is not None
        assert sink._connection is None

    def test_sink_init_custom_path(self):
        """Verify custom db_path is used."""
        sink = SQLiteSink(db_path="/custom/path/db.sqlite")
        assert sink.db_path == "/custom/path/db.sqlite"

    def test_sink_init_env_var_path(self, monkeypatch):
        """Verify OPENGOV_MONITOR_SQLITE_PATH env var is used."""
        monkeypatch.setenv("OPENGOV_MONITOR_SQLITE_PATH", "/env/path/db.sqlite")
        sink = SQLiteSink()
        assert sink.db_path == "/env/path/db.sqlite"

    def test_sink_connect_creates_connection(self, sqlite_sink):
        """Verify _connection is set after connect()."""
        assert sqlite_sink._connection is not None
        assert isinstance(sqlite_sink._connection, sqlite3.Connection)

    def test_sink_connect_enables_wal_mode(self, sqlite_sink):
        """Verify WAL mode is enabled."""
        cursor = sqlite_sink.connection.execute("PRAGMA journal_mode")
        mode = cursor.fetchone()[0]
        # In-memory databases use 'memory' journal mode, not 'wal'
        # But for file-based DBs it would be 'wal'
        assert mode in ('wal', 'memory')

    def test_sink_connection_property_before_connect(self):
        """Verify RuntimeError raised when accessing connection before connect()."""
        sink = SQLiteSink(db_path=":memory:")
        with pytest.raises(RuntimeError, match="Not connected to database"):
            _ = sink.connection

    def test_sink_connection_property_after_connect(self, sqlite_sink):
        """Verify connection property returns connection."""
        conn = sqlite_sink.connection
        assert conn is not None
        assert isinstance(conn, sqlite3.Connection)

    def test_sink_close_clears_connection(self, sqlite_sink):
        """Verify _connection is None after close()."""
        sqlite_sink.close()
        assert sqlite_sink._connection is None

    def test_sink_close_idempotent(self, sqlite_sink):
        """Verify close() can be called multiple times without error."""
        sqlite_sink.close()
        sqlite_sink.close()  # Should not raise

    def test_sink_context_manager(self):
        """Verify __enter__/__exit__ work correctly."""
        sink = SQLiteSink(db_path=":memory:")
        with sink:
            assert sink._connection is not None
        assert sink._connection is None


# =============================================================================
# View Creation Tests
# =============================================================================

class TestViewCreation:
    """Tests for view creation in _ensure_views."""

    def test_ensure_views_creates_outstanding_claims(self, sqlite_sink):
        """Verify outstanding_claims view exists after connect."""
        cursor = sqlite_sink.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='view' AND name='outstanding_claims'"
        )
        assert cursor.fetchone() is not None

    def test_ensure_views_creates_expired_claims(self, sqlite_sink):
        """Verify expired_claims view exists after connect."""
        cursor = sqlite_sink.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='view' AND name='expired_claims'"
        )
        assert cursor.fetchone() is not None

    def test_ensure_views_creates_all_spending(self, sqlite_sink):
        """Verify all_spending view exists after connect."""
        cursor = sqlite_sink.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='view' AND name='all_spending'"
        )
        assert cursor.fetchone() is not None

    def test_views_recreated_on_reconnect(self, sqlite_sink):
        """Verify views are recreated (DROP IF EXISTS then CREATE)."""
        # Close and reconnect
        sqlite_sink.close()
        sqlite_sink.connect()

        # Views should still exist
        cursor = sqlite_sink.connection.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='view'"
        )
        count = cursor.fetchone()[0]
        assert count >= 3  # At least our 3 views


# =============================================================================
# View Logic Tests
# =============================================================================

class TestViewLogic:
    """Tests for the logic of database views."""

    def test_outstanding_claims_view_filters_approved(self, populated_sink, sample_treasury_df):
        """Verify only status='Approved' is included."""
        # Modify one record to be non-Approved
        df = sample_treasury_df.copy()
        df.loc[1, 'status'] = 'Paid'  # Change first record

        populated_sink.update_table("Treasury", df, allow_empty=False)

        cursor = populated_sink.connection.execute(
            "SELECT COUNT(*) FROM outstanding_claims WHERE id = 1"
        )
        assert cursor.fetchone()[0] == 0  # Should be excluded

    def test_outstanding_claims_view_excludes_expired(self, populated_sink, sample_treasury_df):
        """Verify expireAt > now filter works."""
        # Record with id=3 has past expiration
        populated_sink.update_table("Treasury", sample_treasury_df, allow_empty=False)

        cursor = populated_sink.connection.execute(
            "SELECT COUNT(*) FROM outstanding_claims WHERE id = 3"
        )
        assert cursor.fetchone()[0] == 0  # Expired, should be excluded

    def test_outstanding_claims_view_claim_type_active(self, populated_sink, sample_treasury_df):
        """Verify 'active' when validFrom <= now."""
        populated_sink.update_table("Treasury", sample_treasury_df, allow_empty=False)

        cursor = populated_sink.connection.execute(
            "SELECT claim_type FROM outstanding_claims WHERE id = 1"
        )
        result = cursor.fetchone()
        assert result is not None
        assert result[0] == 'active'

    def test_outstanding_claims_view_claim_type_upcoming(self, populated_sink, sample_treasury_df):
        """Verify 'upcoming' when validFrom > now."""
        populated_sink.update_table("Treasury", sample_treasury_df, allow_empty=False)

        cursor = populated_sink.connection.execute(
            "SELECT claim_type FROM outstanding_claims WHERE id = 2"
        )
        result = cursor.fetchone()
        assert result is not None
        assert result[0] == 'upcoming'

    def test_expired_claims_view_includes_past_expiry(self, populated_sink, sample_treasury_df):
        """Verify expireAt < now filter works."""
        populated_sink.update_table("Treasury", sample_treasury_df, allow_empty=False)

        cursor = populated_sink.connection.execute(
            "SELECT COUNT(*) FROM expired_claims WHERE id = 3"
        )
        assert cursor.fetchone()[0] == 1  # Should be included


# =============================================================================
# Table Management Tests
# =============================================================================

class TestTableManagement:
    """Tests for _ensure_table_exists and related methods."""

    def test_ensure_table_exists_creates_from_schema(self, sqlite_sink, sample_referenda_df):
        """Verify table created from predefined schema."""
        sqlite_sink._ensure_table_exists("Referenda", sample_referenda_df)

        assert sqlite_sink.table_exists("Referenda")

    def test_ensure_table_exists_creates_indexes(self, sqlite_sink, sample_referenda_df):
        """Verify indexes created alongside table."""
        sqlite_sink._ensure_table_exists("Referenda", sample_referenda_df)

        cursor = sqlite_sink.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='Referenda'"
        )
        indexes = [row[0] for row in cursor.fetchall()]
        assert "idx_referenda_status" in indexes
        assert "idx_referenda_track" in indexes

    def test_ensure_table_exists_idempotent(self, sqlite_sink, sample_referenda_df):
        """Verify calling twice doesn't error."""
        sqlite_sink._ensure_table_exists("Referenda", sample_referenda_df)
        sqlite_sink._ensure_table_exists("Referenda", sample_referenda_df)  # Should not raise

        assert sqlite_sink.table_exists("Referenda")

    def test_ensure_table_exists_infers_schema(self, sqlite_sink):
        """Verify dynamic schema inference for unknown tables."""
        df = pd.DataFrame({
            'name': ['Test'],
            'value': [100],
        }, index=pd.Index([1], name='id'))

        schema = sqlite_sink._ensure_table_exists("UnknownTable", df)

        assert schema.name == "UnknownTable"
        assert sqlite_sink.table_exists("UnknownTable")


# =============================================================================
# Schema Inference Tests
# =============================================================================

class TestSchemaInference:
    """Tests for _infer_schema_from_dataframe."""

    def test_infer_schema_int64_to_integer(self, sqlite_sink):
        """Verify int64 -> INTEGER mapping."""
        df = pd.DataFrame({'value': pd.array([1, 2, 3], dtype='int64')}, index=pd.Index([1, 2, 3], name='id'))
        schema = sqlite_sink._infer_schema_from_dataframe("Test", df)
        assert schema.columns['value'] == 'INTEGER'

    def test_infer_schema_float64_to_real(self, sqlite_sink):
        """Verify float64 -> REAL mapping."""
        df = pd.DataFrame({'value': [1.5, 2.5, 3.5]}, index=pd.Index([1, 2, 3], name='id'))
        schema = sqlite_sink._infer_schema_from_dataframe("Test", df)
        assert schema.columns['value'] == 'REAL'

    def test_infer_schema_object_to_text(self, sqlite_sink):
        """Verify object -> TEXT mapping."""
        df = pd.DataFrame({'name': ['a', 'b', 'c']}, index=pd.Index([1, 2, 3], name='id'))
        schema = sqlite_sink._infer_schema_from_dataframe("Test", df)
        assert schema.columns['name'] == 'TEXT'

    def test_infer_schema_datetime_to_timestamp(self, sqlite_sink):
        """Verify datetime64[ns] -> TIMESTAMP mapping."""
        df = pd.DataFrame({
            'dt': pd.to_datetime(['2024-01-01', '2024-02-01', '2024-03-01'])
        }, index=pd.Index([1, 2, 3], name='id'))
        schema = sqlite_sink._infer_schema_from_dataframe("Test", df)
        assert schema.columns['dt'] == 'TIMESTAMP'

    def test_infer_schema_bool_to_integer(self, sqlite_sink):
        """Verify bool -> INTEGER mapping."""
        df = pd.DataFrame({'flag': [True, False, True]}, index=pd.Index([1, 2, 3], name='id'))
        schema = sqlite_sink._infer_schema_from_dataframe("Test", df)
        assert schema.columns['flag'] == 'INTEGER'

    def test_infer_schema_uses_index_as_pk(self, sqlite_sink):
        """Verify index name becomes primary key."""
        df = pd.DataFrame({'name': ['a']}, index=pd.Index([1], name='my_id'))
        schema = sqlite_sink._infer_schema_from_dataframe("Test", df)
        assert schema.primary_key == 'my_id'

    def test_infer_schema_default_pk_name(self, sqlite_sink):
        """Verify 'id' used when index is unnamed."""
        df = pd.DataFrame({'name': ['a']})  # Unnamed index
        schema = sqlite_sink._infer_schema_from_dataframe("Test", df)
        assert schema.primary_key == 'id'


# =============================================================================
# DataFrame Preparation Tests
# =============================================================================

class TestDataFramePreparation:
    """Tests for _prepare_dataframe_for_insert."""

    def test_prepare_df_resets_index(self, sqlite_sink, sample_referenda_df):
        """Verify index becomes column."""
        prepared = sqlite_sink._prepare_dataframe_for_insert(
            sample_referenda_df, REFERENDA_SCHEMA
        )
        assert 'id' in prepared.columns
        assert prepared.index.name is None  # Index reset

    def test_prepare_df_renames_index(self, sqlite_sink):
        """Verify index renamed to match pk."""
        df = pd.DataFrame({'name': ['a']}, index=pd.Index([1], name='wrong_name'))
        schema = REFERENDA_SCHEMA  # Has pk='id'
        prepared = sqlite_sink._prepare_dataframe_for_insert(df, schema)
        assert 'id' in prepared.columns

    def test_prepare_df_converts_datetime_to_iso(self, sqlite_sink, sample_df_with_datetimes):
        """Verify datetime -> ISO string."""
        # Need a schema with TIMESTAMP columns
        from data_sinks.sqlite.schema import TableSchema
        schema = TableSchema(
            name="Test",
            columns={
                "id": "INTEGER",
                "url": "TEXT",
                "proposal_time": "TIMESTAMP",
                "latest_status_change": "TIMESTAMP",
                "status": "TEXT",
                "track": "TEXT",
                "DOT_latest": "REAL",
            },
            primary_key="id"
        )
        prepared = sqlite_sink._prepare_dataframe_for_insert(
            sample_df_with_datetimes, schema
        )
        # Check SQLite-compatible datetime format (space instead of 'T')
        assert isinstance(prepared['proposal_time'].iloc[0], str)
        assert ' ' in prepared['proposal_time'].iloc[0]  # SQLite format uses space

    def test_prepare_df_handles_nat(self, sqlite_sink, sample_df_with_nan):
        """Verify NaT -> None."""
        from data_sinks.sqlite.schema import TableSchema
        schema = TableSchema(
            name="Test",
            columns={
                "id": "INTEGER",
                "url": "TEXT",
                "title": "TEXT",
                "DOT_latest": "REAL",
                "proposal_time": "TIMESTAMP",
                "status": "TEXT",
                "track": "TEXT",
                "tally.ayes": "REAL",
                "tally.nays": "REAL",
            },
            primary_key="id"
        )
        prepared = sqlite_sink._prepare_dataframe_for_insert(sample_df_with_nan, schema)
        # Row with index 2 (id=2) has NaT for proposal_time
        assert prepared.loc[prepared['id'] == 2, 'proposal_time'].iloc[0] is None

    def test_prepare_df_handles_nan_float(self, sqlite_sink, sample_df_with_nan):
        """Verify NaN -> None for floats (pandas represents as NaN for float columns)."""
        from data_sinks.sqlite.schema import TableSchema
        schema = TableSchema(
            name="Test",
            columns={
                "id": "INTEGER",
                "url": "TEXT",
                "title": "TEXT",
                "DOT_latest": "REAL",
                "proposal_time": "TIMESTAMP",
                "status": "TEXT",
                "track": "TEXT",
                "tally.ayes": "REAL",
                "tally.nays": "REAL",
            },
            primary_key="id"
        )
        prepared = sqlite_sink._prepare_dataframe_for_insert(sample_df_with_nan, schema)
        # Row with id=2 has NaN for DOT_latest
        # In pandas, None in float columns is represented as NaN
        assert pd.isna(prepared.loc[prepared['id'] == 2, 'DOT_latest'].iloc[0])

    def test_prepare_df_preserves_non_null(self, sqlite_sink, sample_referenda_df):
        """Verify valid values unchanged."""
        prepared = sqlite_sink._prepare_dataframe_for_insert(
            sample_referenda_df, REFERENDA_SCHEMA
        )
        assert prepared.loc[prepared['id'] == 1, 'title'].iloc[0] == 'Test Referendum 1'
        assert prepared.loc[prepared['id'] == 1, 'DOT_latest'].iloc[0] == 1100.0

    def test_prepare_df_copies_input(self, sqlite_sink, sample_referenda_df):
        """Verify original df unmodified."""
        original_columns = list(sample_referenda_df.columns)
        sqlite_sink._prepare_dataframe_for_insert(sample_referenda_df, REFERENDA_SCHEMA)
        assert list(sample_referenda_df.columns) == original_columns


# =============================================================================
# UPSERT SQL Generation Tests
# =============================================================================

class TestUpsertSqlGeneration:
    """Tests for _generate_upsert_sql."""

    def test_generate_upsert_basic(self, sqlite_sink):
        """Verify INSERT OR REPLACE syntax."""
        sql = sqlite_sink._generate_upsert_sql(
            REFERENDA_SCHEMA,
            ['id', 'url', 'title']
        )
        assert "INSERT OR REPLACE INTO" in sql

    def test_generate_upsert_quoted_table(self, sqlite_sink):
        """Verify table name is quoted."""
        sql = sqlite_sink._generate_upsert_sql(
            CHILD_BOUNTIES_SCHEMA,
            ['identifier', 'url']
        )
        assert '"Child Bounties"' in sql

    def test_generate_upsert_quoted_columns(self, sqlite_sink):
        """Verify column names are quoted."""
        sql = sqlite_sink._generate_upsert_sql(
            REFERENDA_SCHEMA,
            ['id', 'tally.ayes']
        )
        assert '"id"' in sql
        assert '"tally.ayes"' in sql

    def test_generate_upsert_placeholders(self, sqlite_sink):
        """Verify ? placeholders are used."""
        sql = sqlite_sink._generate_upsert_sql(
            REFERENDA_SCHEMA,
            ['id', 'url', 'title']
        )
        assert sql.count('?') == 3

    def test_generate_upsert_pk_first(self, sqlite_sink):
        """Verify primary key is first column."""
        sql = sqlite_sink._generate_upsert_sql(
            REFERENDA_SCHEMA,
            ['url', 'id', 'title']  # id not first in input
        )
        # The columns should start with "id"
        cols_start = sql.find('(') + 1
        cols_end = sql.find(')')
        cols = sql[cols_start:cols_end]
        assert cols.strip().startswith('"id"')


# =============================================================================
# update_table Tests
# =============================================================================

class TestUpdateTable:
    """Tests for the update_table method."""

    def test_update_table_inserts_new_rows(self, sqlite_sink, sample_referenda_df):
        """Verify new data inserted."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)

        assert sqlite_sink.get_row_count("Referenda") == 2

    def test_update_table_updates_existing_rows(self, sqlite_sink, sample_referenda_df):
        """Verify existing rows updated."""
        # Insert initial data
        sqlite_sink.update_table("Referenda", sample_referenda_df)

        # Modify and re-insert
        modified = sample_referenda_df.copy()
        modified.loc[1, 'title'] = 'Updated Title'
        sqlite_sink.update_table("Referenda", modified)

        # Should still be 2 rows, not 4
        assert sqlite_sink.get_row_count("Referenda") == 2

        # Check the update
        result = sqlite_sink.read_table("Referenda")
        updated_row = result[result['id'] == 1]
        assert updated_row['title'].iloc[0] == 'Updated Title'

    def test_update_table_upsert_semantics(self, sqlite_sink, sample_referenda_df):
        """Verify mixed insert/update in single call."""
        # Insert initial row
        initial = sample_referenda_df.head(1)
        sqlite_sink.update_table("Referenda", initial)
        assert sqlite_sink.get_row_count("Referenda") == 1

        # Now upsert: 1 existing + 1 new
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.get_row_count("Referenda") == 2

    def test_update_table_empty_df_no_allow(self, sqlite_sink, empty_df):
        """Verify warning logged for empty DataFrame, early return."""
        # Should not raise, just return early
        sqlite_sink.update_table("Referenda", empty_df, allow_empty=False)
        # Table may or may not exist, but no error

    def test_update_table_empty_df_allow(self, sqlite_sink, empty_df):
        """Verify allow_empty=True works."""
        sqlite_sink.update_table("Referenda", empty_df, allow_empty=True)
        # No error, early return

    def test_update_table_creates_table_if_missing(self, sqlite_sink, sample_referenda_df):
        """Verify table auto-created."""
        assert not sqlite_sink.table_exists("Referenda")
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.table_exists("Referenda")

    def test_update_table_commits_on_success(self, sqlite_sink, sample_referenda_df):
        """Verify commit called after successful insert."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)

        # Data should be readable (committed)
        result = sqlite_sink.read_table("Referenda")
        assert len(result) == 2

    def test_update_table_handles_unicode(self, sqlite_sink):
        """Verify unicode characters stored correctly."""
        # Use Treasury which has description column
        df = pd.DataFrame({
            'url': ['https://example.com'],
            'referendumIndex': [1],
            'status': ['Approved'],
            'description': ['Test with émojis 🚀 and 日本語テスト Chinese: 中文'],
            'DOT_proposal_time': [100.0],
            'USD_proposal_time': [500.0],
            'DOT_latest': [100.0],
            'USD_latest': [500.0],
            'DOT_component': [50.0],
            'USDC_component': [25.0],
            'USDT_component': [25.0],
        }, index=pd.Index([1], name='id'))

        sqlite_sink.update_table("Treasury", df)

        result = sqlite_sink.read_table("Treasury")
        assert 'émojis' in result['description'].iloc[0]
        assert '日本語' in result['description'].iloc[0]

    def test_update_table_preserves_types(self, sqlite_sink, sample_referenda_df):
        """Verify REAL, INTEGER, TEXT types preserved."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)

        result = sqlite_sink.read_table("Referenda")
        # Check types after round-trip
        assert result['id'].dtype in ('int64', 'object')  # SQLite may return as object
        assert result['DOT_latest'].dtype == 'float64'


# =============================================================================
# Read/Query Utility Tests
# =============================================================================

class TestReadQueryUtilities:
    """Tests for read_table, table_exists, get_row_count."""

    def test_read_table_returns_dataframe(self, sqlite_sink, sample_referenda_df):
        """Verify returns pd.DataFrame."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        result = sqlite_sink.read_table("Referenda")
        assert isinstance(result, pd.DataFrame)

    def test_read_table_with_limit(self, sqlite_sink, sample_referenda_df):
        """Verify LIMIT clause applied."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        result = sqlite_sink.read_table("Referenda", limit=1)
        assert len(result) == 1

    def test_read_table_all_columns(self, sqlite_sink, sample_referenda_df):
        """Verify SELECT * includes all columns."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        result = sqlite_sink.read_table("Referenda")
        # Should have all columns from schema
        assert 'id' in result.columns
        assert 'title' in result.columns
        assert 'tally.ayes' in result.columns

    def test_read_table_empty_table(self, populated_sink):
        """Verify empty DataFrame returned for empty table."""
        result = populated_sink.read_table("Referenda")
        assert len(result) == 0

    def test_table_exists_true(self, sqlite_sink, sample_referenda_df):
        """Verify returns True for existing table."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.table_exists("Referenda") is True

    def test_table_exists_false(self, sqlite_sink):
        """Verify returns False for nonexistent table."""
        assert sqlite_sink.table_exists("NonexistentTable") is False

    def test_table_exists_case_sensitive(self, sqlite_sink, sample_referenda_df):
        """Verify exact name match required."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.table_exists("Referenda") is True
        assert sqlite_sink.table_exists("referenda") is False
        assert sqlite_sink.table_exists("REFERENDA") is False

    def test_get_row_count_empty(self, populated_sink):
        """Verify returns 0 for empty table."""
        assert populated_sink.get_row_count("Referenda") == 0

    def test_get_row_count_with_data(self, sqlite_sink, sample_referenda_df):
        """Verify returns correct count."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.get_row_count("Referenda") == 2

    def test_get_row_count_after_insert(self, sqlite_sink, sample_referenda_df):
        """Verify count updates after insert."""
        sqlite_sink.update_table("Referenda", sample_referenda_df.head(1))
        assert sqlite_sink.get_row_count("Referenda") == 1

        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.get_row_count("Referenda") == 2

    def test_is_table_empty_nonexistent_table(self, sqlite_sink):
        """Verify returns True for nonexistent table."""
        assert sqlite_sink.is_table_empty("NonexistentTable") is True

    def test_is_table_empty_empty_table(self, populated_sink):
        """Verify returns True for empty table."""
        # populated_sink creates tables but doesn't add data
        assert populated_sink.is_table_empty("Referenda") is True

    def test_is_table_empty_with_data(self, sqlite_sink, sample_referenda_df):
        """Verify returns False for table with data."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.is_table_empty("Referenda") is False

    def test_is_table_empty_after_all_deleted(self, sqlite_sink, sample_referenda_df):
        """Verify returns True after all rows deleted."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        assert sqlite_sink.is_table_empty("Referenda") is False

        # Delete all rows
        sqlite_sink.connection.execute('DELETE FROM "Referenda"')
        sqlite_sink.connection.commit()

        assert sqlite_sink.is_table_empty("Referenda") is True


# =============================================================================
# Compatibility Method Tests
# =============================================================================

class TestCompatibilityMethods:
    """Tests for update_worksheet compatibility method."""

    def test_update_worksheet_delegates_to_update_table(self, sqlite_sink, sample_referenda_df):
        """Verify calls update_table."""
        sqlite_sink.update_worksheet(
            spreadsheet_id="ignored",
            name="Referenda",
            df=sample_referenda_df,
            allow_empty_first_row=False,
            sort_keys=None
        )
        assert sqlite_sink.get_row_count("Referenda") == 2

    def test_update_worksheet_ignores_spreadsheet_id(self, sqlite_sink, sample_referenda_df):
        """Verify spreadsheet_id is ignored."""
        # Should work regardless of spreadsheet_id value
        sqlite_sink.update_worksheet(
            spreadsheet_id="any_value_here",
            name="Referenda",
            df=sample_referenda_df
        )
        assert sqlite_sink.table_exists("Referenda")


# =============================================================================
# Edge Case and Integration Tests
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and special scenarios."""

    def test_special_characters_in_values(self, sqlite_sink):
        """Verify quotes, newlines handled correctly."""
        # Use Treasury which has 'description' column
        df = pd.DataFrame({
            'url': ['https://example.com'],
            'referendumIndex': [1],
            'status': ['Approved'],
            'description': ["Test with 'quotes' and \"double quotes\"\nLine2\tTabbed"],
            'DOT_proposal_time': [100.0],
            'USD_proposal_time': [500.0],
            'DOT_latest': [100.0],
            'USD_latest': [500.0],
            'DOT_component': [50.0],
            'USDC_component': [25.0],
            'USDT_component': [25.0],
        }, index=pd.Index([1], name='id'))

        sqlite_sink.update_table("Treasury", df)
        result = sqlite_sink.read_table("Treasury")

        assert "'" in result['description'].iloc[0]
        assert '"' in result['description'].iloc[0]
        assert '\n' in result['description'].iloc[0]

    def test_very_large_dataframe(self, sqlite_sink, large_df):
        """Verify batch insert handles 1000+ rows."""
        sqlite_sink.update_table("Referenda", large_df)
        assert sqlite_sink.get_row_count("Referenda") == 1000

    def test_column_dots_in_name(self, sqlite_sink, sample_referenda_df):
        """Verify tally.ayes column roundtrip works."""
        sqlite_sink.update_table("Referenda", sample_referenda_df)
        result = sqlite_sink.read_table("Referenda")

        assert 'tally.ayes' in result.columns
        assert result['tally.ayes'].iloc[0] == 100000.0

    def test_table_name_with_spaces(self, sqlite_sink, sample_child_bounties_df):
        """Verify 'Child Bounties' roundtrip works."""
        sqlite_sink.update_table("Child Bounties", sample_child_bounties_df)

        assert sqlite_sink.table_exists("Child Bounties")
        assert sqlite_sink.get_row_count("Child Bounties") == 2

    def test_text_primary_key(self, sqlite_sink, sample_child_bounties_df):
        """Verify TEXT primary key (identifier) works."""
        sqlite_sink.update_table("Child Bounties", sample_child_bounties_df)

        result = sqlite_sink.read_table("Child Bounties")
        assert '10-1' in result['identifier'].values
        assert '10-2' in result['identifier'].values

    def test_null_values_roundtrip(self, sqlite_sink, sample_df_with_nan):
        """Verify NULL values stored and retrieved correctly."""
        sqlite_sink.update_table("Referenda", sample_df_with_nan)
        result = sqlite_sink.read_table("Referenda")

        # Check NULL values - title is None for row with id=3
        null_title_row = result[result['id'] == 3]
        assert pd.isna(null_title_row['title'].iloc[0]) or null_title_row['title'].iloc[0] is None
