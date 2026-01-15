"""
Database ID Continuity Sanity Check

Validates that ID sequences in key tables are continuous (no gaps).
Reports missing IDs and provides continuity metrics for each table.

Usage:
    python scripts/sanity_check.py
    python scripts/sanity_check.py --db ../data/polkadot.db --verbose
    python scripts/sanity_check.py --table Referenda
    pnpm sanity:check
"""

import sys
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import sqlite3
import argparse
from typing import Dict, List, Any, Optional
from datetime import datetime
from utils.custom_logging import setup_logging

# Configuration: Tables to check with their ID columns
TABLES_TO_CHECK = {
    'Referenda': 'id',
    'Treasury': 'id',
    'Fellowship': 'id',
    'Fellowship Salary Cycles': 'cycle',
}


def check_table_continuity(
    conn: sqlite3.Connection,
    table_name: str,
    id_column: str,
    verbose: bool = False,
    logger = None
) -> Dict[str, Any]:
    """
    Check ID continuity for a single table.

    Args:
        conn: SQLite connection
        table_name: Name of table to check
        id_column: Name of the ID/cycle column
        verbose: Show detailed gap information
        logger: Logger instance

    Returns:
        {
            'table': str,
            'id_column': str,
            'total_count': int,
            'min_id': int,
            'max_id': int,
            'gaps': List[int],
            'has_gaps': bool,
            'continuity_percentage': float,
            'error': Optional[str]
        }
    """
    try:
        cursor = conn.cursor()

        # Query all IDs in ascending order
        query = f'SELECT "{id_column}" FROM "{table_name}" ORDER BY "{id_column}" ASC'
        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            # Empty table
            return {
                'table': table_name,
                'id_column': id_column,
                'total_count': 0,
                'min_id': None,
                'max_id': None,
                'gaps': [],
                'has_gaps': False,
                'continuity_percentage': 100.0,
                'error': None
            }

        # Extract IDs from query results
        actual_ids = sorted([row[0] for row in rows])
        total_count = len(actual_ids)
        min_id = actual_ids[0]
        max_id = actual_ids[-1]

        # Build expected sequence
        expected_ids = set(range(min_id, max_id + 1))
        actual_ids_set = set(actual_ids)

        # Find gaps (missing IDs)
        gaps = sorted(expected_ids - actual_ids_set)

        # Calculate continuity percentage
        expected_count = max_id - min_id + 1
        continuity_percentage = (total_count / expected_count) * 100 if expected_count > 0 else 100.0

        return {
            'table': table_name,
            'id_column': id_column,
            'total_count': total_count,
            'min_id': min_id,
            'max_id': max_id,
            'gaps': gaps,
            'has_gaps': len(gaps) > 0,
            'continuity_percentage': continuity_percentage,
            'error': None
        }

    except sqlite3.OperationalError as e:
        # Table or column doesn't exist
        if logger:
            logger.error(f"Error checking table '{table_name}': {e}")
        return {
            'table': table_name,
            'id_column': id_column,
            'total_count': 0,
            'min_id': None,
            'max_id': None,
            'gaps': [],
            'has_gaps': False,
            'continuity_percentage': 0.0,
            'error': str(e)
        }

    except Exception as e:
        # Unexpected error
        if logger:
            logger.error(f"Unexpected error checking table '{table_name}': {e}")
        return {
            'table': table_name,
            'id_column': id_column,
            'total_count': 0,
            'min_id': None,
            'max_id': None,
            'gaps': [],
            'has_gaps': False,
            'continuity_percentage': 0.0,
            'error': str(e)
        }


def format_number(n: int) -> str:
    """Format number with thousand separators."""
    return f"{n:,}"


def print_table_result(result: Dict[str, Any], table_num: int, total_tables: int, verbose: bool):
    """Print results for a single table."""
    print(f"\n[{table_num}/{total_tables}] Checking {result['table']}...")

    # Handle errors
    if result['error']:
        print(f"  Status: X ERROR")
        print(f"  Error: {result['error']}")
        return

    # Handle empty tables
    if result['total_count'] == 0:
        print(f"  Column: {result['id_column']}")
        print(f"  Total records: 0")
        print(f"  Status: OK EMPTY (no data to check)")
        return

    # Print details
    print(f"  Column: {result['id_column']}")
    print(f"  Total records: {format_number(result['total_count'])}")
    print(f"  ID range: {result['min_id']} -> {result['max_id']}")
    print(f"  Missing IDs: {format_number(len(result['gaps']))}")
    print(f"  Continuity: {result['continuity_percentage']:.2f}%")

    # Show gap details in verbose mode
    if verbose and result['has_gaps']:
        print(f"  Gap details:")
        # Group consecutive gaps for readability
        if len(result['gaps']) <= 20:
            for gap_id in result['gaps']:
                print(f"    - ID {gap_id}")
        else:
            # Too many gaps, show first 10 and last 10
            print(f"    - ID {result['gaps'][0]} (first)")
            for gap_id in result['gaps'][1:10]:
                print(f"    - ID {gap_id}")
            print(f"    ... ({len(result['gaps']) - 20} more gaps)")
            for gap_id in result['gaps'][-10:]:
                print(f"    - ID {gap_id}")

    # Status indicator
    if result['has_gaps']:
        print(f"  Status: ! GAPS FOUND")
    else:
        print(f"  Status: OK CONTINUOUS")


def print_summary(results: List[Dict[str, Any]], quiet: bool = False):
    """Print overall summary."""
    if not quiet:
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)

    tables_checked = len(results)
    tables_with_gaps = sum(1 for r in results if r['has_gaps'])
    total_gaps = sum(len(r['gaps']) for r in results)
    tables_with_errors = sum(1 for r in results if r['error'])

    if quiet:
        print(f"Database ID Continuity Check: {tables_with_gaps}/{tables_checked} tables with gaps ({format_number(total_gaps)} total gaps)")
    else:
        print(f"Tables checked: {tables_checked}")
        print(f"Tables with gaps: {tables_with_gaps}")
        print(f"Total gaps found: {format_number(total_gaps)}")
        if tables_with_errors > 0:
            print(f"Tables with errors: {tables_with_errors}")

    return tables_with_gaps > 0


def main():
    parser = argparse.ArgumentParser(
        description='Check ID continuity in OpenGov Monitor database tables',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/sanity_check.py
  python scripts/sanity_check.py --db ../data/polkadot.db --verbose
  python scripts/sanity_check.py --table Referenda
  pnpm sanity:check
  pnpm sanity:check:verbose
        """
    )
    parser.add_argument(
        '--db',
        default='../data/local/polkadot.db',
        help='Path to SQLite database (default: ../data/local/polkadot.db)'
    )
    parser.add_argument(
        '--table',
        choices=list(TABLES_TO_CHECK.keys()) + ['all'],
        default='all',
        help='Check specific table or all tables (default: all)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed gap information (exact missing IDs)'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Only show summary (no per-table details)'
    )

    args = parser.parse_args()

    logger, _ = setup_logging()
    logger.info("Starting database ID continuity check")

    # Resolve database path relative to current working directory
    db_path = Path(args.db)
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path
    db_path = db_path.resolve()

    # Check if database exists
    if not db_path.exists():
        print(f"Error: Database file not found: {db_path}")
        logger.error(f"Database file not found: {db_path}")
        sys.exit(2)

    # Print header
    if not args.quiet:
        print("=" * 80)
        print("DATABASE ID CONTINUITY CHECK")
        print("=" * 80)
        print(f"Database: {db_path}")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Connect to database
    try:
        conn = sqlite3.connect(db_path)
        logger.info(f"Connected to database: {db_path}")
    except Exception as e:
        print(f"Error: Failed to connect to database: {e}")
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(2)

    # Determine which tables to check
    if args.table == 'all':
        tables_to_check = TABLES_TO_CHECK
    else:
        tables_to_check = {args.table: TABLES_TO_CHECK[args.table]}

    # Check each table
    results = []
    for i, (table_name, id_column) in enumerate(tables_to_check.items(), 1):
        result = check_table_continuity(
            conn=conn,
            table_name=table_name,
            id_column=id_column,
            verbose=args.verbose,
            logger=logger
        )
        results.append(result)

        # Print result (unless in quiet mode)
        if not args.quiet:
            print_table_result(result, i, len(tables_to_check), args.verbose)

    # Close database connection
    conn.close()

    # Print summary
    has_gaps = print_summary(results, quiet=args.quiet)

    # Exit with appropriate code
    if has_gaps:
        if not args.quiet:
            print("\nExit code: 1 (gaps detected)")
        logger.warning("ID continuity check completed with gaps")
        sys.exit(1)
    else:
        if not args.quiet:
            print("\nExit code: 0 (all tables continuous)")
        logger.info("ID continuity check completed successfully")
        sys.exit(0)


if __name__ == '__main__':
    main()
