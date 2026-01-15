"""
Fixtures for SQLite data sink tests.

Uses in-memory SQLite databases for fast, isolated tests.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from data_sinks.sqlite.sink import SQLiteSink
from data_sinks.sqlite.schema import (
    REFERENDA_SCHEMA,
    TREASURY_SCHEMA,
    CHILD_BOUNTIES_SCHEMA,
    FELLOWSHIP_SCHEMA,
    CATEGORIES_SCHEMA,
    BOUNTIES_SCHEMA,
)


@pytest.fixture
def sqlite_sink():
    """Create SQLiteSink with in-memory database."""
    sink = SQLiteSink(db_path=":memory:")
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
