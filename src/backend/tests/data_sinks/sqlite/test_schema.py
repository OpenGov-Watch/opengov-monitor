"""
Tests for the SQLite schema module.

Tests cover:
- TableSchema dataclass
- Schema registry
- CREATE TABLE SQL generation
- CREATE INDEX SQL generation
- Schema content validation
"""

import pytest
from data_sinks.sqlite.schema import (
    TableSchema,
    SCHEMA_REGISTRY,
    REFERENDA_SCHEMA,
    TREASURY_SCHEMA,
    CHILD_BOUNTIES_SCHEMA,
    FELLOWSHIP_SCHEMA,
    FELLOWSHIP_SALARY_CYCLES_SCHEMA,
    FELLOWSHIP_SALARY_CLAIMANTS_SCHEMA,
    FELLOWSHIP_SALARY_PAYMENTS_SCHEMA,
    CATEGORIES_SCHEMA,
    BOUNTIES_SCHEMA,
    SUBTREASURY_SCHEMA,
    FELLOWSHIP_SUBTREASURY_SCHEMA,
    TREASURY_NETFLOWS_SCHEMA,
    DASHBOARDS_SCHEMA,
    DASHBOARD_COMPONENTS_SCHEMA,
    QUERY_CACHE_SCHEMA,
    get_schema_for_table,
    generate_create_table_sql,
    generate_create_indexes_sql,
)


# =============================================================================
# TableSchema Dataclass Tests
# =============================================================================

class TestTableSchemaDataclass:
    """Tests for the TableSchema dataclass."""

    def test_table_schema_creation(self):
        """Verify TableSchema dataclass instantiation with all fields."""
        schema = TableSchema(
            name="TestTable",
            columns={"id": "INTEGER", "name": "TEXT"},
            primary_key="id",
            indexes=[("idx_name", ["name"])]
        )
        assert schema.name == "TestTable"
        assert schema.columns == {"id": "INTEGER", "name": "TEXT"}
        assert schema.primary_key == "id"
        assert schema.indexes == [("idx_name", ["name"])]

    def test_table_schema_defaults(self):
        """Verify indexes defaults to empty list."""
        schema = TableSchema(
            name="TestTable",
            columns={"id": "INTEGER"},
            primary_key="id"
        )
        assert schema.indexes == []

    def test_table_schema_field_access(self):
        """Verify field access and iteration."""
        schema = TableSchema(
            name="Test",
            columns={"a": "TEXT", "b": "INTEGER"},
            primary_key="a"
        )
        # Access via attribute
        assert "a" in schema.columns
        assert schema.columns["b"] == "INTEGER"


# =============================================================================
# Schema Registry Tests
# =============================================================================

class TestSchemaRegistry:
    """Tests for the schema registry."""

    def test_schema_registry_contains_all_predefined_schemas(self):
        """Verify all 15 schemas are in the registry."""
        expected_tables = [
            "Referenda",
            "Treasury",
            "Child Bounties",
            "Fellowship",
            "Fellowship Salary Cycles",
            "Fellowship Salary Claimants",
            "Fellowship Salary Payments",
            "Categories",
            "Bounties",
            "Subtreasury",
            "Fellowship Subtreasury",
            "Treasury Netflows",
            "Dashboards",
            "Dashboard Components",
            "Query Cache",
            "Users",
        ]
        assert len(SCHEMA_REGISTRY) == 16
        for table in expected_tables:
            assert table in SCHEMA_REGISTRY, f"Missing schema for '{table}'"

    def test_schema_registry_key_matches_schema_name(self):
        """Verify registry keys match schema.name."""
        for key, schema in SCHEMA_REGISTRY.items():
            assert key == schema.name, f"Registry key '{key}' doesn't match schema.name '{schema.name}'"

    def test_get_schema_for_table_existing(self):
        """Verify lookup returns correct schema."""
        schema = get_schema_for_table("Referenda")
        assert schema is not None
        assert schema.name == "Referenda"
        assert schema == REFERENDA_SCHEMA

    def test_get_schema_for_table_nonexistent(self):
        """Verify lookup returns None for unknown table."""
        schema = get_schema_for_table("NonexistentTable")
        assert schema is None

    def test_get_schema_for_table_case_sensitive(self):
        """Verify lookup is case-sensitive."""
        # Exact case should work
        assert get_schema_for_table("Referenda") is not None
        # Wrong case should fail
        assert get_schema_for_table("referenda") is None
        assert get_schema_for_table("REFERENDA") is None


# =============================================================================
# CREATE TABLE SQL Generation Tests
# =============================================================================

class TestGenerateCreateTableSql:
    """Tests for generate_create_table_sql function."""

    def test_generate_create_table_sql_basic(self):
        """Verify basic CREATE TABLE syntax."""
        schema = TableSchema(
            name="TestTable",
            columns={"id": "INTEGER", "name": "TEXT"},
            primary_key="id"
        )
        sql = generate_create_table_sql(schema)
        assert "CREATE TABLE IF NOT EXISTS" in sql
        assert '"TestTable"' in sql
        assert '"id" INTEGER PRIMARY KEY' in sql
        assert '"name" TEXT' in sql

    def test_generate_create_table_sql_primary_key(self):
        """Verify PRIMARY KEY is included in column definition."""
        schema = TableSchema(
            name="Test",
            columns={"pk_col": "INTEGER", "other": "TEXT"},
            primary_key="pk_col"
        )
        sql = generate_create_table_sql(schema)
        assert '"pk_col" INTEGER PRIMARY KEY' in sql
        assert '"other" TEXT' in sql
        # PRIMARY KEY should only appear once
        assert sql.count("PRIMARY KEY") == 1

    def test_generate_create_table_sql_quoted_names(self):
        """Verify table and column names are quoted."""
        schema = TableSchema(
            name="My Table",
            columns={"my.column": "TEXT", "id": "INTEGER"},
            primary_key="id"
        )
        sql = generate_create_table_sql(schema)
        assert '"My Table"' in sql
        assert '"my.column"' in sql
        assert '"id"' in sql

    def test_generate_create_table_sql_spaces_in_name(self):
        """Verify table names with spaces work correctly."""
        sql = generate_create_table_sql(CHILD_BOUNTIES_SCHEMA)
        assert '"Child Bounties"' in sql

    def test_generate_create_table_sql_all_column_types(self):
        """Verify INTEGER, REAL, TEXT, TIMESTAMP types are generated."""
        sql = generate_create_table_sql(REFERENDA_SCHEMA)
        assert "INTEGER" in sql
        assert "REAL" in sql
        assert "TEXT" in sql
        assert "TIMESTAMP" in sql

    def test_generate_create_table_sql_if_not_exists(self):
        """Verify IF NOT EXISTS clause is included."""
        schema = TableSchema(
            name="Test",
            columns={"id": "INTEGER"},
            primary_key="id"
        )
        sql = generate_create_table_sql(schema)
        assert "IF NOT EXISTS" in sql

    def test_generate_create_table_sql_column_with_dots(self):
        """Verify columns with dots (like tally.ayes) are handled."""
        sql = generate_create_table_sql(REFERENDA_SCHEMA)
        assert '"tally.ayes"' in sql
        assert '"tally.nays"' in sql

    def test_generate_create_table_sql_text_primary_key(self):
        """Verify TEXT primary key works (Child Bounties uses identifier)."""
        sql = generate_create_table_sql(CHILD_BOUNTIES_SCHEMA)
        assert '"identifier" TEXT PRIMARY KEY' in sql


# =============================================================================
# CREATE INDEX SQL Generation Tests
# =============================================================================

class TestGenerateCreateIndexesSql:
    """Tests for generate_create_indexes_sql function."""

    def test_generate_create_indexes_sql_empty(self):
        """Verify empty list when no indexes defined."""
        schema = TableSchema(
            name="Test",
            columns={"id": "INTEGER"},
            primary_key="id",
            indexes=[]
        )
        indexes = generate_create_indexes_sql(schema)
        assert indexes == []

    def test_generate_create_indexes_sql_single(self):
        """Verify single index generation."""
        schema = TableSchema(
            name="Test",
            columns={"id": "INTEGER", "status": "TEXT"},
            primary_key="id",
            indexes=[("idx_status", ["status"])]
        )
        indexes = generate_create_indexes_sql(schema)
        assert len(indexes) == 1
        assert 'CREATE INDEX IF NOT EXISTS "idx_status" ON "Test" ("status")' == indexes[0]

    def test_generate_create_indexes_sql_multiple(self):
        """Verify multiple indexes (Referenda has 4)."""
        indexes = generate_create_indexes_sql(REFERENDA_SCHEMA)
        assert len(indexes) == 4
        # Check all expected indexes exist
        index_names = [idx.split('"')[1] for idx in indexes]
        assert "idx_referenda_status" in index_names
        assert "idx_referenda_track" in index_names
        assert "idx_referenda_proposal_time" in index_names
        assert "idx_referenda_category_id" in index_names

    def test_generate_create_indexes_sql_quoted_names(self):
        """Verify index and column names are quoted."""
        indexes = generate_create_indexes_sql(TREASURY_SCHEMA)
        for idx in indexes:
            # Should have quoted identifiers
            assert '"idx_' in idx
            assert '" ON "' in idx

    def test_generate_create_indexes_sql_if_not_exists(self):
        """Verify IF NOT EXISTS clause is included."""
        schema = TableSchema(
            name="Test",
            columns={"id": "INTEGER", "name": "TEXT"},
            primary_key="id",
            indexes=[("idx_name", ["name"])]
        )
        indexes = generate_create_indexes_sql(schema)
        assert "IF NOT EXISTS" in indexes[0]

    def test_generate_create_indexes_sql_table_with_spaces(self):
        """Verify indexes on tables with spaces in name."""
        indexes = generate_create_indexes_sql(CHILD_BOUNTIES_SCHEMA)
        for idx in indexes:
            assert '"Child Bounties"' in idx


# =============================================================================
# Schema Content Validation Tests
# =============================================================================

class TestSchemaContentValidation:
    """Tests validating the content of predefined schemas."""

    def test_referenda_schema_structure(self):
        """Verify REFERENDA_SCHEMA columns and indexes."""
        schema = REFERENDA_SCHEMA
        assert schema.name == "Referenda"
        assert schema.primary_key == "id"
        assert "id" in schema.columns
        assert "status" in schema.columns
        assert "track" in schema.columns
        assert "tally.ayes" in schema.columns
        assert "tally.nays" in schema.columns
        assert len(schema.indexes) == 4

    def test_treasury_schema_includes_claim_dates(self):
        """Verify TREASURY_SCHEMA includes validFrom/expireAt."""
        schema = TREASURY_SCHEMA
        assert "validFrom" in schema.columns
        assert "expireAt" in schema.columns
        assert schema.columns["validFrom"] == "TIMESTAMP"
        assert schema.columns["expireAt"] == "TIMESTAMP"

    def test_child_bounties_schema_primary_key(self):
        """Verify Child Bounties uses TEXT primary key (identifier)."""
        schema = CHILD_BOUNTIES_SCHEMA
        assert schema.primary_key == "identifier"
        assert schema.columns["identifier"] == "TEXT"

    def test_fellowship_salary_payments_schema(self):
        """Verify payment_id as INTEGER primary key."""
        schema = FELLOWSHIP_SALARY_PAYMENTS_SCHEMA
        assert schema.primary_key == "payment_id"
        assert schema.columns["payment_id"] == "INTEGER"
        assert "cycle" in schema.columns
        assert "amount_usdc" in schema.columns  # Fellowship salaries are paid in USDC

    def test_dashboard_components_schema(self):
        """Verify Dashboard Components has JSON blob columns."""
        schema = DASHBOARD_COMPONENTS_SCHEMA
        assert schema.columns["query_config"] == "TEXT"
        assert schema.columns["grid_config"] == "TEXT"
        assert schema.columns["chart_config"] == "TEXT"
        assert "dashboard_id" in schema.columns

    def test_treasury_netflows_schema_structure(self):
        """Verify TREASURY_NETFLOWS_SCHEMA columns and indexes."""
        schema = TREASURY_NETFLOWS_SCHEMA
        assert schema.name == "Treasury Netflows"
        assert schema.primary_key == "month"
        assert "month" in schema.columns
        assert "asset_name" in schema.columns
        assert "flow_type" in schema.columns
        assert "amount_usd" in schema.columns
        assert "amount_dot_equivalent" in schema.columns
        assert schema.columns["month"] == "TEXT"
        assert schema.columns["asset_name"] == "TEXT"
        assert schema.columns["flow_type"] == "TEXT"
        assert schema.columns["amount_usd"] == "REAL"
        assert schema.columns["amount_dot_equivalent"] == "REAL"
        # Should have 3 indexes: month, asset_name, flow_type
        assert len(schema.indexes) == 3
        index_names = [idx[0] for idx in schema.indexes]
        assert "idx_netflows_month" in index_names
        assert "idx_netflows_asset" in index_names
        assert "idx_netflows_type" in index_names

    def test_all_schemas_have_primary_key_in_columns(self):
        """Verify all schemas have their primary key defined in columns."""
        for name, schema in SCHEMA_REGISTRY.items():
            assert schema.primary_key in schema.columns, \
                f"Schema '{name}' primary key '{schema.primary_key}' not in columns"

    def test_all_index_columns_exist_in_schema(self):
        """Verify all indexed columns exist in their schema."""
        for name, schema in SCHEMA_REGISTRY.items():
            for idx_name, idx_columns in schema.indexes:
                for col in idx_columns:
                    assert col in schema.columns, \
                        f"Index '{idx_name}' references non-existent column '{col}' in schema '{name}'"
