"""
SQLite schema definitions for OpenGov Monitor entities.

Each schema defines:
- Table name
- Column definitions with SQLite types
- Primary key column(s)
- Index definitions for query optimization
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class TableSchema:
    """Definition of a SQLite table schema."""
    name: str
    columns: Dict[str, str]  # column_name -> SQLite type
    primary_key: str
    indexes: List[Tuple[str, List[str]]] = field(default_factory=list)


# Schema for Polkadot Referenda
REFERENDA_SCHEMA = TableSchema(
    name="Referenda",
    columns={
        "id": "INTEGER",
        "title": "TEXT",
        "status": "TEXT",
        "DOT_proposal_time": "REAL",
        "USD_proposal_time": "REAL",
        "track": "TEXT",
        "tally.ayes": "REAL",
        "tally.nays": "REAL",
        "proposal_time": "TIMESTAMP",
        "latest_status_change": "TIMESTAMP",
        "DOT_latest": "REAL",
        "USD_latest": "REAL",
        "DOT_component": "REAL",
        "USDC_component": "REAL",
        "USDT_component": "REAL",
        "category_id": "INTEGER",
        "notes": "TEXT",
        "hide_in_spends": "INTEGER",
    },
    primary_key="id",
    indexes=[
        ("idx_referenda_status", ["status"]),
        ("idx_referenda_track", ["track"]),
        ("idx_referenda_proposal_time", ["proposal_time"]),
        ("idx_referenda_category_id", ["category_id"]),
    ]
)

# Schema for Treasury Spends
TREASURY_SCHEMA = TableSchema(
    name="Treasury",
    columns={
        "id": "INTEGER",
        "referendumIndex": "INTEGER",
        "status": "TEXT",
        "description": "TEXT",
        "DOT_proposal_time": "REAL",
        "USD_proposal_time": "REAL",
        "proposal_time": "TIMESTAMP",
        "latest_status_change": "TIMESTAMP",
        "DOT_latest": "REAL",
        "USD_latest": "REAL",
        "DOT_component": "REAL",
        "USDC_component": "REAL",
        "USDT_component": "REAL",
        "validFrom": "TIMESTAMP",
        "expireAt": "TIMESTAMP",
    },
    primary_key="id",
    indexes=[
        ("idx_treasury_status", ["status"]),
        ("idx_treasury_referendum", ["referendumIndex"]),
    ]
)

# Schema for Child Bounties
CHILD_BOUNTIES_SCHEMA = TableSchema(
    name="Child Bounties",
    columns={
        "identifier": "TEXT",
        "index": "INTEGER",
        "parentBountyId": "INTEGER",
        "status": "TEXT",
        "description": "TEXT",
        "DOT": "REAL",
        "USD_proposal_time": "REAL",
        "beneficiary": "TEXT",
        "proposal_time": "TIMESTAMP",
        "latest_status_change": "TIMESTAMP",
        "USD_latest": "REAL",
        "category_id": "INTEGER",
        "notes": "TEXT",
        "hide_in_spends": "INTEGER",
    },
    primary_key="identifier",
    indexes=[
        ("idx_child_bounty_parent", ["parentBountyId"]),
        ("idx_child_bounty_status", ["status"]),
        ("idx_child_bounty_category_id", ["category_id"]),
    ]
)

# Schema for Fellowship Treasury Spends
FELLOWSHIP_SCHEMA = TableSchema(
    name="Fellowship",
    columns={
        "id": "INTEGER",
        "status": "TEXT",
        "description": "TEXT",
        "DOT": "REAL",
        "USD_proposal_time": "REAL",
        "proposal_time": "TIMESTAMP",
        "latest_status_change": "TIMESTAMP",
        "USD_latest": "REAL",
    },
    primary_key="id",
    indexes=[
        ("idx_fellowship_status", ["status"]),
    ]
)

# Schema for Fellowship Salary Cycles
FELLOWSHIP_SALARY_CYCLES_SCHEMA = TableSchema(
    name="Fellowship Salary Cycles",
    columns={
        "cycle": "INTEGER",
        "budget_usdc": "REAL",
        "registeredCount": "INTEGER",
        "registeredPaidCount": "INTEGER",
        "registered_paid_amount_usdc": "REAL",
        "total_registrations_usdc": "REAL",
        "unregistered_paid_usdc": "REAL",
        "registration_period": "INTEGER",
        "payout_period": "INTEGER",
        "start_block": "INTEGER",
        "end_block": "INTEGER",
        "start_time": "TIMESTAMP",
        "end_time": "TIMESTAMP",
    },
    primary_key="cycle",
    indexes=[]
)

# Schema for Fellowship Salary Claimants
FELLOWSHIP_SALARY_CLAIMANTS_SCHEMA = TableSchema(
    name="Fellowship Salary Claimants",
    columns={
        "address": "TEXT",
        "display_name": "TEXT",
        "name": "TEXT",
        "short_address": "TEXT",
        "status_type": "TEXT",
        "registered_amount_usdc": "REAL",
        "attempt_amount_usdc": "REAL",
        "attempt_id": "INTEGER",
        "last_active_time": "TIMESTAMP",
        "rank": "INTEGER",
    },
    primary_key="address",
    indexes=[
        ("idx_claimant_rank", ["rank"]),
        ("idx_claimant_status", ["status_type"]),
    ]
)

# Schema for Fellowship Salary Payments (individual Paid events per cycle)
FELLOWSHIP_SALARY_PAYMENTS_SCHEMA = TableSchema(
    name="Fellowship Salary Payments",
    columns={
        "payment_id": "INTEGER",
        "cycle": "INTEGER",
        "who": "TEXT",
        "who_name": "TEXT",
        "beneficiary": "TEXT",
        "beneficiary_name": "TEXT",
        "amount_dot": "REAL",
        "salary_dot": "REAL",
        "rank": "INTEGER",
        "is_active": "INTEGER",
        "block_height": "INTEGER",
        "block_time": "TIMESTAMP",
    },
    primary_key="payment_id",
    indexes=[
        ("idx_salary_payment_cycle", ["cycle"]),
        ("idx_salary_payment_who", ["who"]),
        ("idx_salary_payment_rank", ["rank"]),
    ]
)

# Schema for Categories (predefined category/subcategory pairs)
# NOTE: Table has UNIQUE(category, COALESCE(subcategory, '')) constraint enforced at DB level (migration 012)
# NULL subcategory represents "Other" (default subcategory for a category)
CATEGORIES_SCHEMA = TableSchema(
    name="Categories",
    columns={
        "id": "INTEGER",
        "category": "TEXT NOT NULL",
        "subcategory": "TEXT",  # NULL = "Other" (default subcategory)
    },
    primary_key="id",
    indexes=[
        ("idx_categories_category", ["category"]),
    ]
)

# Schema for Parent Bounties (fetched from Subsquare + manual category assignment)
BOUNTIES_SCHEMA = TableSchema(
    name="Bounties",
    columns={
        "id": "INTEGER",
        "name": "TEXT",
        "category_id": "INTEGER",
        "remaining_dot": "REAL",
    },
    primary_key="id",
    indexes=[
        ("idx_bounties_category_id", ["category_id"]),
    ]
)

# Schema for Subtreasury (manually managed spending entries)
SUBTREASURY_SCHEMA = TableSchema(
    name="Subtreasury",
    columns={
        "id": "INTEGER",
        "title": "TEXT",
        "description": "TEXT",
        "DOT_latest": "REAL",
        "USD_latest": "REAL",
        "DOT_component": "REAL",
        "USDC_component": "REAL",
        "USDT_component": "REAL",
        "category_id": "INTEGER",
        "latest_status_change": "TIMESTAMP",
    },
    primary_key="id",
    indexes=[
        ("idx_subtreasury_category_id", ["category_id"]),
    ]
)

# Schema for Custom Spending (user-managed spending entries)
CUSTOM_SPENDING_SCHEMA = TableSchema(
    name="Custom Spending",
    columns={
        "id": "INTEGER",
        "type": "TEXT NOT NULL",
        "title": "TEXT NOT NULL",
        "description": "TEXT",
        "latest_status_change": "TIMESTAMP",
        "DOT_latest": "REAL",
        "USD_latest": "REAL",
        "DOT_component": "REAL",
        "USDC_component": "REAL",
        "USDT_component": "REAL",
        "category_id": "INTEGER",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    primary_key="id",
    indexes=[
        ("idx_custom_spending_type", ["type"]),
        ("idx_custom_spending_category", ["category_id"]),
    ]
)

# Schema for Fellowship Subtreasury (fetched from collectives-api.subsquare.io)
FELLOWSHIP_SUBTREASURY_SCHEMA = TableSchema(
    name="Fellowship Subtreasury",
    columns={
        "id": "INTEGER",
        "title": "TEXT",
        "status": "TEXT",
        "DOT_proposal_time": "REAL",
        "USD_proposal_time": "REAL",
        "DOT_latest": "REAL",
        "USD_latest": "REAL",
        "proposal_time": "TIMESTAMP",
        "latest_status_change": "TIMESTAMP",
        "validFrom": "TIMESTAMP",
        "expireAt": "TIMESTAMP",
    },
    primary_key="id",
    indexes=[
        ("idx_fellowship_subtreasury_status", ["status"]),
    ]
)

# Schema for Treasury Netflows (manual quarterly imports)
TREASURY_NETFLOWS_SCHEMA = TableSchema(
    name="Treasury Netflows",
    columns={
        "month": "TEXT",                    # YYYY-MM format
        "asset_name": "TEXT",               # DOT, USDC, USDT
        "flow_type": "TEXT",                # fees, inflation, proposals, bounties, etc.
        "amount_usd": "REAL",               # USD value
        "amount_dot_equivalent": "REAL",    # DOT equivalent value
    },
    primary_key=None,  # No primary key - allows multiple transactions per month
    indexes=[
        ("idx_netflows_month", ["month"]),
        ("idx_netflows_asset", ["asset_name"]),
        ("idx_netflows_type", ["flow_type"]),
        # No unique constraint - multiple transactions per (month, asset, flow_type) allowed
    ]
)

# Schema for Dashboards (user-created dashboard definitions)
DASHBOARDS_SCHEMA = TableSchema(
    name="Dashboards",
    columns={
        "id": "INTEGER",
        "name": "TEXT",
        "description": "TEXT",
        "created_at": "TIMESTAMP",
        "updated_at": "TIMESTAMP",
    },
    primary_key="id",
    indexes=[]
)

# Schema for Dashboard Components (widgets on a dashboard)
DASHBOARD_COMPONENTS_SCHEMA = TableSchema(
    name="Dashboard Components",
    columns={
        "id": "INTEGER",
        "dashboard_id": "INTEGER",
        "name": "TEXT",
        "type": "TEXT",  # 'table' | 'pie' | 'bar_stacked' | 'bar_grouped' | 'line'
        "query_config": "TEXT",  # JSON blob storing query builder config
        "grid_config": "TEXT",  # JSON blob: { x, y, w, h }
        "chart_config": "TEXT",  # JSON blob for chart-specific options
        "created_at": "TIMESTAMP",
        "updated_at": "TIMESTAMP",
    },
    primary_key="id",
    indexes=[
        ("idx_dashboard_components_dashboard", ["dashboard_id"]),
    ]
)

# Schema for Query Cache (caching query results with TTL)
QUERY_CACHE_SCHEMA = TableSchema(
    name="Query Cache",
    columns={
        "id": "INTEGER",
        "cache_key": "TEXT",  # hash of query config
        "result_json": "TEXT",  # JSON blob of query results
        "cached_at": "TIMESTAMP",
        "expires_at": "TIMESTAMP",
    },
    primary_key="id",
    indexes=[
        ("idx_query_cache_key", ["cache_key"]),
        ("idx_query_cache_expires", ["expires_at"]),
    ]
)

# Schema for Users (authentication)
USERS_SCHEMA = TableSchema(
    name="Users",
    columns={
        "id": "INTEGER",
        "username": "TEXT UNIQUE NOT NULL",
        "password_hash": "TEXT NOT NULL",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    },
    primary_key="id",
    indexes=[
        ("idx_users_username", ["username"]),
    ]
)

# Schema for Data Errors (generic error logging for all tables)
DATA_ERRORS_SCHEMA = TableSchema(
    name="DataErrors",
    columns={
        "id": "INTEGER",
        "table_name": "TEXT NOT NULL",
        "record_id": "TEXT NOT NULL",
        "error_type": "TEXT NOT NULL",
        "error_message": "TEXT NOT NULL",
        "raw_data": "TEXT",
        "metadata": "TEXT",
        "timestamp": "TIMESTAMP NOT NULL",
    },
    primary_key="id",
    indexes=[
        ("idx_data_errors_table", ["table_name"]),
        ("idx_data_errors_record", ["table_name", "record_id"]),
        ("idx_data_errors_type", ["error_type"]),
        ("idx_data_errors_timestamp", ["timestamp"]),
    ]
)

# Registry mapping table names to schemas
SCHEMA_REGISTRY: Dict[str, TableSchema] = {
    "Referenda": REFERENDA_SCHEMA,
    "Treasury": TREASURY_SCHEMA,
    "Child Bounties": CHILD_BOUNTIES_SCHEMA,
    "Fellowship": FELLOWSHIP_SCHEMA,
    "Fellowship Salary Cycles": FELLOWSHIP_SALARY_CYCLES_SCHEMA,
    "Fellowship Salary Claimants": FELLOWSHIP_SALARY_CLAIMANTS_SCHEMA,
    "Fellowship Salary Payments": FELLOWSHIP_SALARY_PAYMENTS_SCHEMA,
    "Categories": CATEGORIES_SCHEMA,
    "Bounties": BOUNTIES_SCHEMA,
    "Subtreasury": SUBTREASURY_SCHEMA,
    "Custom Spending": CUSTOM_SPENDING_SCHEMA,
    "Fellowship Subtreasury": FELLOWSHIP_SUBTREASURY_SCHEMA,
    "Treasury Netflows": TREASURY_NETFLOWS_SCHEMA,
    "Dashboards": DASHBOARDS_SCHEMA,
    "Dashboard Components": DASHBOARD_COMPONENTS_SCHEMA,
    "Query Cache": QUERY_CACHE_SCHEMA,
    "Users": USERS_SCHEMA,
    "DataErrors": DATA_ERRORS_SCHEMA,
}


def get_schema_for_table(table_name: str) -> Optional[TableSchema]:
    """Get the schema for a given table name."""
    return SCHEMA_REGISTRY.get(table_name)


def generate_create_table_sql(schema: TableSchema) -> str:
    """Generate CREATE TABLE SQL statement from schema."""
    columns_sql = []
    for col_name, col_type in schema.columns.items():
        col_def = f'"{col_name}" {col_type}'
        if col_name == schema.primary_key:
            col_def += " PRIMARY KEY"
        columns_sql.append(col_def)

    return f'CREATE TABLE IF NOT EXISTS "{schema.name}" ({", ".join(columns_sql)})'


def generate_create_indexes_sql(schema: TableSchema) -> List[str]:
    """Generate CREATE INDEX SQL statements from schema."""
    if not schema.indexes:
        return []

    statements = []
    for idx_name, idx_columns in schema.indexes:
        cols = ", ".join(f'"{c}"' for c in idx_columns)
        statements.append(
            f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{schema.name}" ({cols})'
        )
    return statements
