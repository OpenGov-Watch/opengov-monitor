"""
Migration: Log historical Treasury NULLs to DataErrors
Version: 004
"""
import sqlite3
import json
from datetime import datetime, timezone


def up(conn: sqlite3.Connection) -> None:
    """Log existing Treasury NULL values to DataErrors."""
    cursor = conn.cursor()

    # Check if Treasury table exists
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='Treasury'
    """)

    if not cursor.fetchone():
        print("Treasury table does not exist - skipping historical NULL logging")
        return

    # Check if DataErrors table exists, create if not
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='DataErrors'
    """)

    if not cursor.fetchone():
        print("Creating DataErrors table...")
        cursor.execute("""
            CREATE TABLE DataErrors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                error_type TEXT NOT NULL,
                error_message TEXT NOT NULL,
                raw_data TEXT,
                metadata TEXT,
                timestamp TIMESTAMP NOT NULL
            )
        """)
        cursor.execute("""
            CREATE INDEX idx_data_errors_table ON DataErrors(table_name)
        """)
        cursor.execute("""
            CREATE INDEX idx_data_errors_record ON DataErrors(table_name, record_id)
        """)
        cursor.execute("""
            CREATE INDEX idx_data_errors_type ON DataErrors(error_type)
        """)
        cursor.execute("""
            CREATE INDEX idx_data_errors_timestamp ON DataErrors(timestamp)
        """)
        print("DataErrors table created")

    # Find rows with NULLs
    cursor.execute("""
        SELECT id, status, description
        FROM Treasury
        WHERE DOT_proposal_time IS NULL
           OR USD_proposal_time IS NULL
           OR DOT_component IS NULL
           OR USDC_component IS NULL
           OR USDT_component IS NULL
    """)

    null_rows = cursor.fetchall()

    if not null_rows:
        print("No NULL values found in Treasury table")
        return

    print(f"Found {len(null_rows)} treasury spends with NULL values")

    for row in null_rows:
        treasury_id, status, description = row

        # Determine which columns are NULL
        cursor.execute("""
            SELECT DOT_proposal_time, USD_proposal_time, DOT_component, USDC_component, USDT_component
            FROM Treasury WHERE id = ?
        """, (treasury_id,))

        values = cursor.fetchone()
        null_columns = []
        col_names = ['DOT_proposal_time', 'USD_proposal_time', 'DOT_component', 'USDC_component', 'USDT_component']
        for i, val in enumerate(values):
            if val is None:
                null_columns.append(col_names[i])

        metadata = {
            'status': status,
            'description': description[:200] if description else None,
            'null_columns': null_columns,
            'source': 'historical_migration'
        }

        # Insert into DataErrors
        cursor.execute("""
            INSERT INTO DataErrors (table_name, record_id, error_type, error_message, raw_data, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "Treasury",
            str(treasury_id),
            "historical_null",
            f"NULL values in columns: {', '.join(null_columns)}",
            None,  # No raw data available
            json.dumps(metadata),
            datetime.now(timezone.utc).isoformat()
        ))

    conn.commit()
    print(f"Logged {len(null_rows)} historical NULL errors to DataErrors table")


def down(conn: sqlite3.Connection) -> None:
    """Remove historical_null entries from DataErrors."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM DataErrors WHERE error_type = 'historical_null'")
    conn.commit()
    print("Removed historical_null entries from DataErrors")
