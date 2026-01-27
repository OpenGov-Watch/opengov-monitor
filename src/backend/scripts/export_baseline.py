"""
Export baseline CSV data for regression testing.

Exports Treasury and Referenda tables (up to ref 1600) with all XCM-derived columns.
"""

import sqlite3
import pandas as pd
import argparse
from pathlib import Path


def export_baseline(db_path: str, output_dir: str):
    """Export baseline data from database to CSV files."""

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)

    # List tables to verify structure
    tables = pd.read_sql('SELECT name FROM sqlite_master WHERE type="table"', conn)
    print(f"Available tables: {tables['name'].tolist()}")

    # XCM-derived columns we need to track for regression
    xcm_columns = [
        'DOT_component', 'USDC_component', 'USDT_component',
        'DOT_latest', 'USD_latest',
        'DOT_proposal_time', 'USD_proposal_time'
    ]

    # Export Referenda baseline (up to ref 1600)
    referenda_query = """
        SELECT
            id,
            DOT_component, USDC_component, USDT_component,
            DOT_latest, USD_latest,
            DOT_proposal_time, USD_proposal_time,
            track, status
        FROM Referenda
        WHERE id <= 1600
        ORDER BY id
    """

    try:
        referenda_df = pd.read_sql(referenda_query, conn)
        referenda_path = output_path / 'referenda_baseline.csv'
        referenda_df.to_csv(referenda_path, index=False)
        print(f"Exported {len(referenda_df)} referenda to {referenda_path}")
    except Exception as e:
        print(f"Error exporting Referenda: {e}")

    # Export Treasury baseline (referendumIndex <= 1600)
    treasury_query = """
        SELECT
            id,
            referendumIndex,
            DOT_component, USDC_component, USDT_component,
            DOT_latest, USD_latest,
            DOT_proposal_time, USD_proposal_time,
            status
        FROM Treasury
        WHERE referendumIndex <= 1600
        ORDER BY id
    """

    try:
        treasury_df = pd.read_sql(treasury_query, conn)
        treasury_path = output_path / 'treasury_baseline.csv'
        treasury_df.to_csv(treasury_path, index=False)
        print(f"Exported {len(treasury_df)} treasury spends to {treasury_path}")
    except Exception as e:
        print(f"Error exporting Treasury: {e}")

    conn.close()
    print("Baseline export complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export baseline CSV for regression testing")
    parser.add_argument(
        "--db",
        default="../../data/local/polkadot.db",
        help="Path to SQLite database"
    )
    parser.add_argument(
        "--output",
        default="../tests/fixtures/baseline",
        help="Output directory for CSV files"
    )

    args = parser.parse_args()
    export_baseline(args.db, args.output)
