"""
Fixtures for SQLite data sink tests.

Uses temporary SQLite databases with migrations applied for isolated tests.
Supports both migrated (via setup_test_database) and baseline (via baseline_schema.sql) paths.
"""

import pytest
import pandas as pd
import numpy as np
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from data_sinks.sqlite.sink import SQLiteSink
from data_sinks.sqlite.schema import (
    REFERENDA_SCHEMA,
    TREASURY_SCHEMA,
    CHILD_BOUNTIES_SCHEMA,
    FELLOWSHIP_SCHEMA,
    CATEGORIES_SCHEMA,
    BOUNTIES_SCHEMA,
)


def setup_test_database(db_path: str) -> None:
    """Set up a test database with all tables and views.

    Creates all tables with current schema and all required views.
    This simulates a fully migrated database without running the actual migrations.
    """
    from data_sinks.sqlite.schema import (
        SCHEMA_REGISTRY,
        generate_create_table_sql,
        generate_create_indexes_sql,
    )

    conn = sqlite3.connect(db_path)

    try:
        # Create all tables
        for schema in SCHEMA_REGISTRY.values():
            conn.execute(generate_create_table_sql(schema))
            for idx_sql in generate_create_indexes_sql(schema):
                conn.execute(idx_sql)

        # Create views (final definitions from latest migrations)
        conn.execute('''
            CREATE VIEW outstanding_claims AS
            SELECT
                id, referendumIndex, status, description,
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

        conn.execute('''
            CREATE VIEW expired_claims AS
            SELECT
                id, referendumIndex, status, description,
                DOT_proposal_time, USD_proposal_time,
                DOT_latest, USD_latest,
                DOT_component, USDC_component, USDT_component,
                proposal_time, latest_status_change, validFrom, expireAt,
                CAST((julianday('now') - julianday(expireAt)) AS INTEGER) AS days_since_expiry
            FROM Treasury
            WHERE status = 'Approved'
              AND expireAt < datetime('now')
        ''')

        conn.execute('''
            CREATE VIEW all_spending AS
            SELECT
                spending.*,
                strftime('%Y', spending.latest_status_change) AS year,
                strftime('%Y-%m', spending.latest_status_change) AS year_month,
                strftime('%Y', spending.latest_status_change) || '-Q' ||
                    ((CAST(strftime('%m', spending.latest_status_change) AS INTEGER) + 2) / 3) AS year_quarter
            FROM (
                SELECT
                    'Direct Spend' AS type,
                    'ref-' || r.id AS id,
                    r.latest_status_change,
                    r.DOT_latest,
                    r.USD_latest,
                    cat.category,
                    cat.subcategory,
                    r.title,
                    r.DOT_component,
                    r.USDC_component,
                    r.USDT_component
                FROM Referenda r
                LEFT JOIN Treasury t ON r.id = t.referendumIndex
                LEFT JOIN Categories cat ON r.category_id = cat.id
                WHERE t.id IS NULL
                  AND r.DOT_latest > 0
                  AND r.status = 'Executed'
                  AND (r.hide_in_spends IS NULL OR r.hide_in_spends = 0)

                UNION ALL

                SELECT
                    'Claim' AS type,
                    'treasury-' || t.id AS id,
                    t.latest_status_change,
                    t.DOT_latest,
                    t.USD_latest,
                    cat.category,
                    cat.subcategory,
                    t.description AS title,
                    t.DOT_component,
                    t.USDC_component,
                    t.USDT_component
                FROM Treasury t
                LEFT JOIN Referenda r ON t.referendumIndex = r.id
                LEFT JOIN Categories cat ON r.category_id = cat.id
                WHERE t.status IN ('Paid', 'Processed')
                  AND (r.hide_in_spends IS NULL OR r.hide_in_spends = 0)

                UNION ALL

                SELECT
                    'Bounty' AS type,
                    'cb-' || cb.identifier AS id,
                    cb.latest_status_change,
                    cb.DOT AS DOT_latest,
                    cb.USD_latest,
                    COALESCE(cb_cat.category, b_cat.category) AS category,
                    COALESCE(cb_cat.subcategory, b_cat.subcategory) AS subcategory,
                    cb.description AS title,
                    cb.DOT AS DOT_component,
                    NULL AS USDC_component,
                    NULL AS USDT_component
                FROM "Child Bounties" cb
                LEFT JOIN Bounties b ON cb.parentBountyId = b.id
                LEFT JOIN Categories cb_cat ON cb.category_id = cb_cat.id
                LEFT JOIN Categories b_cat ON b.category_id = b_cat.id
                WHERE cb.status = 'Claimed'
                  AND (cb.hide_in_spends IS NULL OR cb.hide_in_spends = 0)

                UNION ALL

                SELECT
                    'Subtreasury' AS type,
                    'sub-' || s.id AS id,
                    s.latest_status_change,
                    s.DOT_latest,
                    s.USD_latest,
                    c.category,
                    c.subcategory,
                    s.title,
                    s.DOT_component,
                    s.USDC_component,
                    s.USDT_component
                FROM Subtreasury s
                LEFT JOIN Categories c ON s.category_id = c.id

                UNION ALL

                SELECT
                    'Fellowship Salary' AS type,
                    'fs-' || p.cycle AS id,
                    MAX(p.block_time) AS latest_status_change,
                    SUM(p.amount_dot) AS DOT_latest,
                    NULL AS USD_latest,
                    'Development' AS category,
                    'Polkadot Protocol & SDK' AS subcategory,
                    'Fellowship Salary Cycle ' || p.cycle AS title,
                    SUM(p.amount_dot) AS DOT_component,
                    SUM(p.amount_usdc) AS USDC_component,
                    NULL AS USDT_component
                FROM "Fellowship Salary Payments" p
                GROUP BY p.cycle

                UNION ALL

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
                    NULL AS USDT_component
                FROM Fellowship f
                WHERE f.status IN ('Paid', 'Approved')

                UNION ALL

                SELECT
                    cs.type AS type,
                    'custom-' || cs.id AS id,
                    cs.latest_status_change,
                    cs.DOT_latest,
                    cs.USD_latest,
                    c.category,
                    c.subcategory,
                    cs.title,
                    cs.DOT_component,
                    cs.USDC_component,
                    cs.USDT_component
                FROM "Custom Spending" cs
                LEFT JOIN Categories c ON cs.category_id = c.id
            ) AS spending
            WHERE spending.latest_status_change >= '2023-07-01'
        ''')

        conn.execute('''
            CREATE VIEW treasury_netflows_view AS
            SELECT
                month,
                asset_name,
                flow_type,
                amount_usd,
                amount_dot_equivalent,
                SUBSTR(month, 1, 4) AS year,
                month AS year_month,
                SUBSTR(month, 1, 4) || '-Q' || ((CAST(SUBSTR(month, 6, 2) AS INTEGER) + 2) / 3) AS year_quarter
            FROM "Treasury Netflows"
        ''')

        conn.commit()
    finally:
        conn.close()


def setup_baseline_database(db_path: str) -> None:
    """Set up a test database from the baseline schema.

    This simulates a fresh database setup using the baseline_schema.sql file,
    which represents the current state of the schema after all migrations.
    """
    # Find the baseline schema file relative to this test file
    baseline_path = Path(__file__).parent.parent.parent.parent / 'migrations' / 'baseline_schema.sql'

    if not baseline_path.exists():
        raise FileNotFoundError(
            f"baseline_schema.sql not found at {baseline_path}. "
            "Generate it with: python migrations/generate_baseline.py"
        )

    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(baseline_path.read_text(encoding='utf-8'))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def migrated_db(tmp_path):
    """Database set up via simulated migrations (like production upgrade path).

    Uses setup_test_database which creates tables from SCHEMA_REGISTRY
    and adds all required views programmatically.
    """
    db_path = tmp_path / "migrated.db"
    setup_test_database(str(db_path))
    return str(db_path)


@pytest.fixture
def baseline_db(tmp_path):
    """Database set up from baseline schema (fresh install path).

    Uses baseline_schema.sql which is generated from a fully-migrated database.
    This represents the schema state a fresh install would get.
    """
    db_path = tmp_path / "baseline.db"
    setup_baseline_database(str(db_path))
    return str(db_path)


@pytest.fixture(params=['migrated', 'baseline'])
def any_db(request, migrated_db, baseline_db):
    """Parametrized fixture to test against both DB setup methods.

    Use this fixture for tests that should pass regardless of how the
    database was initialized (migration path vs baseline path).
    """
    if request.param == 'migrated':
        return migrated_db
    return baseline_db


# Legacy alias for compatibility
@pytest.fixture
def test_db(tmp_path):
    """Legacy alias - use migrated_db or any_db instead."""
    db_path = tmp_path / "test.db"
    setup_test_database(str(db_path))
    return str(db_path)


@pytest.fixture
def sqlite_sink(migrated_db):
    """SQLiteSink with properly migrated database."""
    sink = SQLiteSink(db_path=migrated_db)
    sink.connect()
    yield sink
    sink.close()


@pytest.fixture
def populated_sink(sqlite_sink):
    """SQLiteSink with Referenda and Treasury tables pre-created."""
    # Create the tables by upserting empty DataFrames won't work
    # Instead, manually create tables
    from data_sinks.sqlite.schema import generate_create_table_sql, generate_create_indexes_sql

    for schema in [REFERENDA_SCHEMA, TREASURY_SCHEMA, CHILD_BOUNTIES_SCHEMA]:
        sqlite_sink.connection.execute(generate_create_table_sql(schema))
        for idx_sql in generate_create_indexes_sql(schema):
            sqlite_sink.connection.execute(idx_sql)

    sqlite_sink.connection.commit()
    return sqlite_sink


@pytest.fixture
def sample_referenda_df():
    """Sample DataFrame matching REFERENDA_SCHEMA."""
    return pd.DataFrame({
        'title': ['Test Referendum 1', 'Test Referendum 2'],
        'status': ['Executed', 'Ongoing'],
        'DOT_proposal_time': [1000.0, 2000.0],
        'USD_proposal_time': [5000.0, 10000.0],
        'track': ['Treasurer', 'SmallSpender'],
        'tally.ayes': [100000.0, 50000.0],
        'tally.nays': [10000.0, 5000.0],
        'proposal_time': [datetime(2024, 1, 1), datetime(2024, 2, 1)],
        'latest_status_change': [datetime(2024, 1, 15), datetime(2024, 2, 10)],
        'DOT_latest': [1100.0, 2100.0],
        'USD_latest': [5500.0, 10500.0],
        'DOT_component': [500.0, 1000.0],
        'USDC_component': [300.0, 600.0],
        'USDT_component': [200.0, 400.0],
        'category_id': [1, None],
        'notes': ['Some notes', None],
        'hide_in_spends': [0, 0],
    }, index=pd.Index([1, 2], name='id'))


@pytest.fixture
def sample_treasury_df():
    """Sample DataFrame matching TREASURY_SCHEMA with validFrom/expireAt dates."""
    now = datetime.now()
    future = now + timedelta(days=30)
    past = now - timedelta(days=30)
    upcoming = now + timedelta(days=5)

    return pd.DataFrame({
        'referendumIndex': [1, 2, 3],
        'status': ['Approved', 'Approved', 'Approved'],
        'description': ['Active claim', 'Upcoming claim', 'Expired claim'],
        'DOT_proposal_time': [1000.0, 2000.0, 3000.0],
        'USD_proposal_time': [5000.0, 10000.0, 15000.0],
        'proposal_time': [past, past, past - timedelta(days=60)],
        'latest_status_change': [past, past, past - timedelta(days=60)],
        'DOT_latest': [1100.0, 2100.0, 3100.0],
        'USD_latest': [5500.0, 10500.0, 15500.0],
        'DOT_component': [500.0, 1000.0, 1500.0],
        'USDC_component': [300.0, 600.0, 900.0],
        'USDT_component': [200.0, 400.0, 600.0],
        'validFrom': [past, upcoming, past - timedelta(days=60)],  # Active, Upcoming, Expired
        'expireAt': [future, future, past],  # Future, Future, Past (expired)
    }, index=pd.Index([1, 2, 3], name='id'))


@pytest.fixture
def sample_child_bounties_df():
    """Sample DataFrame matching CHILD_BOUNTIES_SCHEMA."""
    return pd.DataFrame({
        'index': [1, 2],
        'parentBountyId': [10, 10],
        'status': ['Claimed', 'Pending'],
        'description': ['Child Bounty 1', 'Child Bounty 2'],
        'DOT': [100.0, 200.0],
        'USD_proposal_time': [500.0, 1000.0],
        'beneficiary': ['addr1', 'addr2'],
        'proposal_time': [datetime(2024, 1, 1), datetime(2024, 2, 1)],
        'latest_status_change': [datetime(2024, 1, 15), datetime(2024, 2, 10)],
        'USD_latest': [550.0, 1100.0],
        'category_id': [1, None],
        'notes': ['Some notes', None],
        'hide_in_spends': [0, 0],
    }, index=pd.Index(['10-1', '10-2'], name='identifier'))


@pytest.fixture
def sample_fellowship_df():
    """Sample DataFrame matching FELLOWSHIP_SCHEMA."""
    return pd.DataFrame({
        'status': ['Approved'],
        'description': ['Fellowship Treasury Spend'],
        'DOT': [5000.0],
        'USD_proposal_time': [25000.0],
        'proposal_time': [datetime(2024, 3, 1)],
        'latest_status_change': [datetime(2024, 3, 15)],
        'USD_latest': [27500.0],
    }, index=pd.Index([1], name='id'))


@pytest.fixture
def sample_df_with_nan():
    """DataFrame containing NaN/NaT values for edge case testing."""
    return pd.DataFrame({
        'title': ['Title 1', 'Title 2', None],
        'DOT_latest': [100.0, np.nan, 300.0],
        'proposal_time': [datetime(2024, 1, 1), pd.NaT, datetime(2024, 3, 1)],
        'status': ['Executed', 'Ongoing', 'Rejected'],
        'track': ['Treasurer', 'SmallSpender', 'Root'],
        'tally.ayes': [np.nan, 50000.0, np.nan],
        'tally.nays': [10000.0, np.nan, 30000.0],
    }, index=pd.Index([1, 2, 3], name='id'))


@pytest.fixture
def sample_df_with_unicode():
    """DataFrame containing unicode characters."""
    return pd.DataFrame({
        'title': ['Test with émojis 🚀 and spëcial çharacters ñ'],
        'description': ['日本語テスト Chinese: 中文 Korean: 한국어'],
        'status': ['Executed'],
        'track': ['Treasurer'],
        'DOT_latest': [100.0],
    }, index=pd.Index([1], name='id'))


@pytest.fixture
def sample_df_with_datetimes():
    """DataFrame with various datetime formats."""
    return pd.DataFrame({
        'proposal_time': [datetime(2024, 1, 1, 12, 30, 45), datetime(2024, 6, 15, 0, 0, 0)],
        'latest_status_change': [pd.Timestamp('2024-01-15T10:30:00'), pd.Timestamp('2024-06-20')],
        'status': ['Executed', 'Ongoing'],
        'track': ['Treasurer', 'SmallSpender'],
        'DOT_latest': [100.0, 200.0],
    }, index=pd.Index([1, 2], name='id'))


@pytest.fixture
def empty_df():
    """Empty DataFrame for testing edge cases."""
    return pd.DataFrame(columns=['id', 'title', 'status'])


@pytest.fixture
def large_df():
    """Large DataFrame for batch testing (1000 rows)."""
    n = 1000
    return pd.DataFrame({
        'title': [f'Test {i}' for i in range(n)],
        'status': ['Executed' if i % 2 == 0 else 'Ongoing' for i in range(n)],
        'track': ['Treasurer' if i % 3 == 0 else 'SmallSpender' for i in range(n)],
        'DOT_latest': [float(i * 100) for i in range(n)],
        'proposal_time': [datetime(2024, 1, 1) + timedelta(days=i) for i in range(n)],
    }, index=pd.Index(range(n), name='id'))
