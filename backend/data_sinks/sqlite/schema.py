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
        "url": "TEXT",
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
        "category": "TEXT",
        "subcategory": "TEXT",
        "notes": "TEXT",
        "hide_in_spends": "INTEGER",
    },
    primary_key="id",
    indexes=[
        ("idx_referenda_status", ["status"]),
        ("idx_referenda_track", ["track"]),
        ("idx_referenda_proposal_time", ["proposal_time"]),
        ("idx_referenda_category", ["category"]),
    ]
)

# Schema for Treasury Spends
TREASURY_SCHEMA = TableSchema(
    name="Treasury",
    columns={
        "id": "INTEGER",
        "url": "TEXT",
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
        "url": "TEXT",
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
        "category": "TEXT",
        "subcategory": "TEXT",
        "notes": "TEXT",
        "hide_in_spends": "INTEGER",
    },
    primary_key="identifier",
    indexes=[
        ("idx_child_bounty_parent", ["parentBountyId"]),
        ("idx_child_bounty_status", ["status"]),
        ("idx_child_bounty_category", ["category"]),
    ]
)

# Schema for Fellowship Treasury Spends
FELLOWSHIP_SCHEMA = TableSchema(
    name="Fellowship",
    columns={
        "id": "INTEGER",
        "url": "TEXT",
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
        "url": "TEXT",
        "budget_dot": "REAL",
        "registeredCount": "INTEGER",
        "registeredPaidCount": "INTEGER",
        "registered_paid_amount_dot": "REAL",
        "total_registrations_dot": "REAL",
        "unregistered_paid_dot": "REAL",
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
        "registered_amount_dot": "REAL",
        "attempt_amount_dot": "REAL",
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
        "url": "TEXT",
    },
    primary_key="payment_id",
    indexes=[
        ("idx_salary_payment_cycle", ["cycle"]),
        ("idx_salary_payment_who", ["who"]),
        ("idx_salary_payment_rank", ["rank"]),
    ]
)

# Schema for Categories (predefined category/subcategory pairs)
CATEGORIES_SCHEMA = TableSchema(
    name="Categories",
    columns={
        "id": "INTEGER",
        "category": "TEXT",
        "subcategory": "TEXT",
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
        "category": "TEXT",
        "subcategory": "TEXT",
        "remaining_dot": "REAL",
        "url": "TEXT",
    },
    primary_key="id",
    indexes=[
        ("idx_bounties_category", ["category"]),
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
        "category": "TEXT",
        "subcategory": "TEXT",
        "latest_status_change": "TIMESTAMP",
        "url": "TEXT",
    },
    primary_key="id",
    indexes=[
        ("idx_subtreasury_category", ["category"]),
    ]
)

# Schema for Fellowship Subtreasury (fetched from collectives-api.subsquare.io)
FELLOWSHIP_SUBTREASURY_SCHEMA = TableSchema(
    name="Fellowship Subtreasury",
    columns={
        "id": "INTEGER",
        "url": "TEXT",
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
    "Fellowship Subtreasury": FELLOWSHIP_SUBTREASURY_SCHEMA,
    "Dashboards": DASHBOARDS_SCHEMA,
    "Dashboard Components": DASHBOARD_COMPONENTS_SCHEMA,
    "Query Cache": QUERY_CACHE_SCHEMA,
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
