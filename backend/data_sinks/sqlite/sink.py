"""
SQLite Data Sink implementation.

Provides local SQLite storage with the same interface pattern as SpreadsheetSink,
enabling seamless swapping between storage backends.
"""

import sqlite3
import pandas as pd
import logging
import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from ..base import DataSink
from .schema import (
    TableSchema,
    generate_create_table_sql,
    generate_create_indexes_sql,
    get_schema_for_table,
)


class SQLiteSink(DataSink):
    """SQLite-based data sink for OpenGov Monitor.

    Stores governance data in a local SQLite database with support for
    UPSERT operations and native datetime handling.

    Attributes:
        db_path: Path to the SQLite database file.
        connection: Active SQLite connection (after connect() is called).
    """

    def __init__(self, db_path: Optional[str] = None):
        """Initialize SQLiteSink.

        Args:
            db_path: Path to SQLite database file. If None, uses
                    OPENGOV_MONITOR_SQLITE_PATH env var or 'opengov_monitor.db'.
        """
        self.db_path = db_path or os.environ.get(
            'OPENGOV_MONITOR_SQLITE_PATH',
            'opengov_monitor.db'
        )
        self._connection: Optional[sqlite3.Connection] = None
        self._logger = logging.getLogger("data_sinks.sqlite.sink")
        self._current_operation: Optional[str] = None

    @property
    def connection(self) -> sqlite3.Connection:
        """Get the active database connection."""
        if self._connection is None:
            raise RuntimeError("Not connected to database. Call connect() first.")
        return self._connection

    def connect(self) -> None:
        """Establish connection to SQLite database.

        Creates the database file if it doesn't exist.
        Enables WAL mode for better concurrency.
        """
        self._logger.info(f"Connecting to SQLite database: {self.db_path}")

        # Ensure parent directory exists
        db_file = Path(self.db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)

        # Connect with datetime detection
        self._connection = sqlite3.connect(
            self.db_path,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
        )

        # Enable WAL mode for better concurrency
        self._connection.execute("PRAGMA journal_mode = WAL")

        # Create database views
        self._ensure_views()

        self._logger.info("SQLite connection established")

    def _ensure_views(self) -> None:
        """Create database views for analytics and reporting.

        Views are created using CREATE VIEW IF NOT EXISTS to be idempotent.
        """
        # Outstanding Claims: All approved treasury spends that are not expired
        # Includes both active (validFrom <= now) and upcoming (validFrom > now) claims
        self._connection.execute('DROP VIEW IF EXISTS outstanding_claims')
        self._connection.execute('''
            CREATE VIEW outstanding_claims AS
            SELECT
                id, url, referendumIndex, status, description,
                DOT_proposal_time, USD_proposal_time,
                DOT_latest, USD_latest,
                DOT_component, USDC_component, USDT_component,
                proposal_time, latest_status_change, validFrom, expireAt,
                CASE WHEN validFrom <= datetime('now') THEN 'active' ELSE 'upcoming' END AS claim_type,
                CAST((julianday(expireAt) - julianday('now')) AS INTEGER) AS days_until_expiry,
                CAST((julianday(validFrom) - julianday('now')) AS INTEGER) AS days_until_valid
            FROM Treasury
            WHERE status = 'Approved'
              AND expireAt > datetime('now')
        ''')

        # Expired Claims: Approved treasury spends that have passed expiration
        self._connection.execute('DROP VIEW IF EXISTS expired_claims')
        self._connection.execute('''
            CREATE VIEW expired_claims AS
            SELECT
                id, url, referendumIndex, status, description,
                DOT_proposal_time, USD_proposal_time,
                DOT_latest, USD_latest,
                DOT_component, USDC_component, USDT_component,
                proposal_time, latest_status_change, validFrom, expireAt,
                CAST((julianday('now') - julianday(expireAt)) AS INTEGER) AS days_since_expiry
            FROM Treasury
            WHERE status = 'Approved'
              AND expireAt < datetime('now')
        ''')

        # All Spending: Aggregated view of all spending types
        self._connection.execute('DROP VIEW IF EXISTS all_spending')
        self._connection.execute('''
            CREATE VIEW all_spending AS
            -- Direct Spend: Referenda with DOT value but NO Treasury link
            SELECT
                'Direct Spend' AS type,
                'ref-' || r.id AS id,
                r.latest_status_change,
                r.DOT_latest,
                r.USD_latest,
                r.category,
                r.subcategory,
                r.title,
                r.DOT_component,
                r.USDC_component,
                r.USDT_component,
                r.url
            FROM Referenda r
            LEFT JOIN Treasury t ON r.id = t.referendumIndex
            WHERE t.id IS NULL
              AND r.DOT_latest > 0
              AND r.status = 'Executed'

            UNION ALL

            -- Claim: Treasury spends (paid)
            SELECT
                'Claim' AS type,
                'treasury-' || t.id AS id,
                t.latest_status_change,
                t.DOT_latest,
                t.USD_latest,
                r.category,
                r.subcategory,
                t.description AS title,
                t.DOT_component,
                t.USDC_component,
                t.USDT_component,
                t.url
            FROM Treasury t
            LEFT JOIN Referenda r ON t.referendumIndex = r.id
            WHERE t.status IN ('Paid', 'Processed')

            UNION ALL

            -- Bounty (Child): Child bounties that have been claimed
            SELECT
                'Bounty' AS type,
                'cb-' || cb.identifier AS id,
                cb.latest_status_change,
                cb.DOT AS DOT_latest,
                cb.USD_latest,
                COALESCE(cb.category, b.category) AS category,
                COALESCE(cb.subcategory, b.subcategory) AS subcategory,
                cb.description AS title,
                cb.DOT AS DOT_component,
                NULL AS USDC_component,
                NULL AS USDT_component,
                cb.url
            FROM "Child Bounties" cb
            LEFT JOIN Bounties b ON cb.parentBountyId = b.id
            WHERE cb.status = 'Claimed'

            UNION ALL

            -- Subtreasury: Manually managed spending entries
            SELECT
                'Subtreasury' AS type,
                'sub-' || s.id AS id,
                s.latest_status_change,
                s.DOT_latest,
                s.USD_latest,
                s.category,
                s.subcategory,
                s.title,
                s.DOT_component,
                s.USDC_component,
                s.USDT_component,
                s.url
            FROM Subtreasury s

            UNION ALL

            -- Fellowship Salary: From salary cycles (completed cycles only)
            SELECT
                'Fellowship Salary' AS type,
                'fs-' || c.cycle AS id,
                c.end_time AS latest_status_change,
                c.registered_paid_amount_dot AS DOT_latest,
                NULL AS USD_latest,
                'Development' AS category,
                'Polkadot Protocol & SDK' AS subcategory,
                'Fellowship Salary Cycle ' || c.cycle AS title,
                c.registered_paid_amount_dot AS DOT_component,
                NULL AS USDC_component,
                NULL AS USDT_component,
                c.url
            FROM "Fellowship Salary Cycles" c
            WHERE c.end_time IS NOT NULL

            UNION ALL

            -- Fellowship Grants: Fellowship treasury spends (from collectives API)
            SELECT
                'Fellowship Grants' AS type,
                'fg-' || f.id AS id,
                f.latest_status_change,
                f.DOT AS DOT_latest,
                f.USD_latest,
                'Development' AS category,
                'Polkadot Protocol & SDK' AS subcategory,
                f.description AS title,
                f.DOT AS DOT_component,
                NULL AS USDC_component,
                NULL AS USDT_component,
                f.url
            FROM Fellowship f
            WHERE f.status IN ('Paid', 'Approved')
        ''')

        self._connection.commit()
        self._logger.debug("Database views created/verified")

        # Ensure manual tables exist
        self._ensure_manual_tables()

    def _ensure_manual_tables(self) -> None:
        """Create manual tables that are managed by the frontend.

        These tables are not populated by the backend but need to exist
        for the frontend to function properly.
        """
        manual_tables = [
            "Categories",
            "Bounties",
            "Subtreasury",
            "Dashboards",
            "Dashboard Components",
        ]

        for table_name in manual_tables:
            schema = get_schema_for_table(table_name)
            if schema:
                create_sql = generate_create_table_sql(schema)
                self._connection.execute(create_sql)
                # Migrate schema (add any missing columns)
                self._migrate_table_schema(schema)
                # Create indexes
                for index_sql in generate_create_indexes_sql(schema):
                    self._connection.execute(index_sql)

        self._connection.commit()
        self._logger.debug("Manual tables created/verified")

    def _migrate_table_schema(self, schema: TableSchema) -> None:
        """Add missing columns to existing table.

        SQLite only supports adding columns (not removing/modifying).
        Uses ALTER TABLE ADD COLUMN for each missing column.
        """
        # Get existing columns from the table
        cursor = self.connection.execute(
            f'PRAGMA table_info("{schema.name}")'
        )
        existing_columns = {row[1] for row in cursor.fetchall()}

        # Add any columns that are in schema but not in table
        for col_name, col_type in schema.columns.items():
            if col_name not in existing_columns:
                alter_sql = f'ALTER TABLE "{schema.name}" ADD COLUMN "{col_name}" {col_type}'
                self._logger.info(f"Adding missing column: {alter_sql}")
                self.connection.execute(alter_sql)

        self.connection.commit()

    def _ensure_table_exists(self, table_name: str, df: pd.DataFrame) -> TableSchema:
        """Ensure table exists, creating it if necessary.

        Args:
            table_name: Name of the table.
            df: DataFrame to infer schema from if not predefined.

        Returns:
            The TableSchema used for the table.
        """
        schema = get_schema_for_table(table_name)

        if schema is None:
            # Generate schema dynamically from DataFrame
            schema = self._infer_schema_from_dataframe(table_name, df)
            self._logger.warning(
                f"No predefined schema for '{table_name}', inferring from DataFrame"
            )

        # Create table
        create_sql = generate_create_table_sql(schema)
        self._logger.debug(f"Ensuring table exists: {create_sql}")
        self.connection.execute(create_sql)

        # Migrate schema (add any missing columns to existing table)
        self._migrate_table_schema(schema)

        # Create indexes
        for idx_sql in generate_create_indexes_sql(schema):
            self._logger.debug(f"Creating index: {idx_sql}")
            self.connection.execute(idx_sql)

        self.connection.commit()
        return schema

    def _infer_schema_from_dataframe(
        self,
        table_name: str,
        df: pd.DataFrame
    ) -> TableSchema:
        """Infer a TableSchema from a DataFrame structure.

        Args:
            table_name: Name for the table.
            df: DataFrame to infer types from.

        Returns:
            Inferred TableSchema.
        """
        type_mapping = {
            'int64': 'INTEGER',
            'int32': 'INTEGER',
            'float64': 'REAL',
            'float32': 'REAL',
            'object': 'TEXT',
            'string': 'TEXT',
            'datetime64[ns]': 'TIMESTAMP',
            'datetime64[ns, UTC]': 'TIMESTAMP',
            'bool': 'INTEGER',
        }

        columns = {}

        # Add index as primary key column first
        pk_name = df.index.name if df.index.name else 'id'
        idx_dtype = str(df.index.dtype)
        columns[pk_name] = type_mapping.get(idx_dtype, 'TEXT')

        # Add DataFrame columns
        for col in df.columns:
            dtype_str = str(df[col].dtype)
            sql_type = type_mapping.get(dtype_str, 'TEXT')
            columns[col] = sql_type

        return TableSchema(
            name=table_name,
            columns=columns,
            primary_key=pk_name,
            indexes=[]
        )

    def _prepare_dataframe_for_insert(
        self,
        df: pd.DataFrame,
        schema: TableSchema
    ) -> pd.DataFrame:
        """Prepare DataFrame for SQLite insertion.

        Handles:
        - Moving index to column if needed
        - Converting datetime columns to ISO strings
        - Handling NaN values

        Args:
            df: Input DataFrame.
            schema: Target table schema.

        Returns:
            Prepared DataFrame ready for insertion.
        """
        df = df.copy()

        # Ensure index has the right name
        if df.index.name != schema.primary_key:
            df.index.name = schema.primary_key
        df = df.reset_index()

        # Convert datetime columns to ISO format strings
        for col in df.columns:
            if col in schema.columns and schema.columns[col] == "TIMESTAMP":
                if df[col].dtype == 'object':
                    # Already string, skip
                    continue
                df[col] = pd.to_datetime(df[col], errors='coerce')
                df[col] = df[col].apply(
                    lambda x: x.isoformat() if pd.notna(x) else None
                )

        # Handle NaN values - SQLite prefers None
        df = df.where(pd.notna(df), None)

        return df

    def _generate_upsert_sql(
        self,
        schema: TableSchema,
        columns: List[str]
    ) -> str:
        """Generate INSERT OR REPLACE SQL statement.

        Args:
            schema: Table schema.
            columns: List of column names to upsert.

        Returns:
            Parameterized SQL statement for UPSERT.
        """
        # Ensure primary key is first
        all_columns = [schema.primary_key] + [
            c for c in columns if c != schema.primary_key
        ]

        cols_quoted = ", ".join(f'"{c}"' for c in all_columns)
        placeholders = ", ".join("?" for _ in all_columns)

        return f'INSERT OR REPLACE INTO "{schema.name}" ({cols_quoted}) VALUES ({placeholders})'

    def update_table(
        self,
        name: str,
        df: pd.DataFrame,
        allow_empty: bool = False,
    ) -> None:
        """Update a SQLite table with UPSERT semantics.

        Uses INSERT OR REPLACE for atomic upsert operations.

        Args:
            name: Table name to update.
            df: DataFrame with data to upsert. Index is used as primary key.
            allow_empty: Whether to allow empty DataFrame.
        """
        operation_id = f"{name}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}"
        self._current_operation = operation_id

        self._logger.info(
            f"Starting table update",
            extra={
                "operation_id": operation_id,
                "table": name,
                "incoming_records": len(df)
            }
        )

        try:
            if df.empty:
                if not allow_empty:
                    self._logger.warning(
                        f"Empty DataFrame provided for table '{name}'",
                        extra={"operation_id": operation_id}
                    )
                return

            # Ensure table exists with correct schema
            schema = self._ensure_table_exists(name, df)

            # Prepare data for insertion
            prepared_df = self._prepare_dataframe_for_insert(df, schema)

            # Get columns that exist in both DataFrame and schema
            valid_columns = [
                c for c in prepared_df.columns
                if c in schema.columns
            ]

            # Generate UPSERT SQL
            upsert_sql = self._generate_upsert_sql(schema, valid_columns)
            self._logger.debug(f"UPSERT SQL: {upsert_sql}")

            # Build column order for data extraction
            column_order = [schema.primary_key] + [
                c for c in valid_columns if c != schema.primary_key
            ]

            # Prepare data tuples
            data_tuples = []
            for _, row in prepared_df.iterrows():
                values = tuple(row[c] for c in column_order)
                data_tuples.append(values)

            # Execute batch upsert
            cursor = self.connection.cursor()
            cursor.executemany(upsert_sql, data_tuples)
            self.connection.commit()

            self._logger.info(
                "Table update completed successfully",
                extra={
                    "operation_id": operation_id,
                    "rows_affected": len(data_tuples)
                }
            )

        except Exception as e:
            self.connection.rollback()
            self._logger.error(
                f"Error updating table",
                extra={
                    "operation_id": operation_id,
                    "error": str(e)
                },
                exc_info=True
            )
            raise
        finally:
            self._current_operation = None

    def read_table(
        self,
        table_name: str,
        limit: Optional[int] = None
    ) -> pd.DataFrame:
        """Read data from a table.

        Args:
            table_name: Name of the table to read.
            limit: Maximum number of rows to return.

        Returns:
            DataFrame with table contents.
        """
        sql = f'SELECT * FROM "{table_name}"'
        if limit:
            sql += f" LIMIT {limit}"

        return pd.read_sql_query(sql, self.connection)

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists in the database.

        Args:
            table_name: Name of the table to check.

        Returns:
            True if table exists, False otherwise.
        """
        cursor = self.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,)
        )
        return cursor.fetchone() is not None

    def get_row_count(self, table_name: str) -> int:
        """Get the number of rows in a table.

        Args:
            table_name: Name of the table.

        Returns:
            Number of rows in the table.
        """
        cursor = self.connection.execute(
            f'SELECT COUNT(*) FROM "{table_name}"'
        )
        return cursor.fetchone()[0]

    def update_worksheet(
        self,
        spreadsheet_id: str,
        name: str,
        df: pd.DataFrame,
        allow_empty_first_row: bool = False,
        sort_keys: Optional[List[str]] = None
    ) -> None:
        """Compatibility method matching SpreadsheetSink interface.

        Args:
            spreadsheet_id: Ignored for SQLite (db path set in __init__).
            name: Table name to update.
            df: DataFrame with data to upsert.
            allow_empty_first_row: Whether to allow empty DataFrame.
            sort_keys: Ignored for SQLite (sorting is query-time).
        """
        self.update_table(name, df, allow_empty=allow_empty_first_row)

    def close(self) -> None:
        """Close the database connection."""
        if self._connection:
            self._connection.close()
            self._connection = None
            self._logger.info("SQLite connection closed")
