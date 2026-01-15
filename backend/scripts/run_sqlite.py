"""
Run the OpenGov Monitor data pipeline with SQLite storage.

This script fetches governance data from Subsquare and stores it in a local
SQLite database instead of Google Sheets.

Usage:
    python scripts/run_sqlite.py
    python scripts/run_sqlite.py --db ./data/opengov.db
"""

import argparse
import sys
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from data_providers.subsquare import SubsquareProvider
from data_providers.price_service import PriceService
from data_providers.network_info import NetworkInfo
from data_providers.statescan_id import StatescanIdProvider
from data_sinks import SQLiteSink
from utils.custom_logging import setup_logging
import yaml


def main():
    parser = argparse.ArgumentParser(
        description='Run OpenGov Monitor with SQLite storage'
    )
    parser.add_argument(
        '--db',
        default='../data/opengov_monitor.db',
        help='Path to SQLite database file (default: ../data/opengov_monitor.db)'
    )
    parser.add_argument(
        '--network',
        default='polkadot',
        choices=['polkadot', 'kusama'],
        help='Network to fetch data for (default: polkadot)'
    )
    parser.add_argument(
        '--backfill',
        action='store_true',
        help='Force full backfill of all data (ignore existing data)'
    )
    parser.add_argument(
        '--tables',
        help='Comma-separated list of tables to fetch (default: all). Options: referenda, treasury_spends, child_bounties, fellowship_treasury_spends, fellowship_salary_cycles'
    )
    args = parser.parse_args()

    # Parse table list
    tables_to_fetch = None
    if args.tables:
        tables_to_fetch = set(args.tables.split(','))

    logger, _ = setup_logging()
    logger.info(f"Starting OpenGov Monitor with SQLite sink")
    if tables_to_fetch:
        logger.info(f"Fetching only specified tables: {', '.join(tables_to_fetch)}")
    logger.info(f"Database: {args.db}")
    logger.info(f"Network: {args.network}")

    try:
        # Load configuration
        config_path = BACKEND_DIR / 'config.yaml'
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)

        # Get fetch limits (supports both old flat structure and new incremental/backfill structure)
        fetch_limits = config['fetch_limits']
        if 'incremental' in fetch_limits:
            incremental_limits = fetch_limits['incremental']
            backfill_limits = fetch_limits.get('backfill', {})
        else:
            # Legacy flat structure - use same limits for both modes
            incremental_limits = fetch_limits
            backfill_limits = fetch_limits

        block_number = config['block_time_projection']['block_number']
        block_datetime = config['block_time_projection']['block_datetime']
        block_time = config['block_time_projection']['block_time']

        # Initialize SQLite sink
        sink = SQLiteSink(args.db)
        sink.connect()

        # Initialize providers
        network_info = NetworkInfo(args.network, 'subsquare')
        price_service = PriceService(network_info)
        provider = SubsquareProvider(network_info, price_service, sink)

        # Helper function to determine fetch mode and limit
        def get_fetch_limit(table_name: str, config_key: str) -> tuple[int, str]:
            """Determine fetch limit based on table state and --backfill flag.

            Returns:
                Tuple of (limit, mode) where mode is 'backfill' or 'incremental'.
            """
            if args.backfill:
                mode = 'backfill'
                limit = backfill_limits.get(config_key, 0)
                logger.info(f"[{table_name}] Using backfill mode (forced)")
            elif sink.is_table_empty(table_name):
                mode = 'backfill'
                limit = backfill_limits.get(config_key, 0)
                logger.info(f"[{table_name}] Table empty - using backfill mode")
            else:
                mode = 'incremental'
                limit = incremental_limits.get(config_key, 0)
                logger.info(f"[{table_name}] Table has data - using incremental mode")

            limit_str = "all" if limit == 0 else str(limit)
            logger.info(f"[{table_name}] Fetch limit: {limit_str}")
            return limit, mode

        # Fetch prices
        logger.info("Fetching prices...")
        price_service.load_prices()
        logger.info(f"Current {args.network.upper()} price: ${price_service.current_price:.2f}")

        # Fetch and store referenda
        referenda_limit, _ = get_fetch_limit("Referenda", "referenda")
        if referenda_limit != -1 and (tables_to_fetch is None or 'referenda' in tables_to_fetch):
            referenda_df = provider.fetch_referenda(referenda_limit)
            logger.info(f"Fetched {len(referenda_df)} referenda")
            sink.update_table("Referenda", referenda_df, allow_empty=True)
            logger.info(f"Total {sink.get_row_count('Referenda')} referenda in database")

        # Fetch and store treasury spends
        treasury_limit, _ = get_fetch_limit("Treasury", "treasury_spends")
        if treasury_limit != -1 and (tables_to_fetch is None or 'treasury_spends' in tables_to_fetch):
            treasury_df = provider.fetch_treasury_spends(
                treasury_limit,
                block_number,
                block_datetime,
                block_time
            )
            logger.info(f"Fetched {len(treasury_df)} treasury spends")
            sink.update_table("Treasury", treasury_df, allow_empty=True)
            logger.info(f"Total {sink.get_row_count('Treasury')} treasury spends in database")

        # Fetch and store child bounties
        child_bounties_limit, _ = get_fetch_limit("Child Bounties", "child_bounties")
        if child_bounties_limit != -1 and (tables_to_fetch is None or 'child_bounties' in tables_to_fetch):
            child_bounties_df = provider.fetch_child_bounties(child_bounties_limit)
            logger.info(f"Fetched {len(child_bounties_df)} child bounties")
            sink.update_table("Child Bounties", child_bounties_df, allow_empty=True)
            logger.info(f"Total {sink.get_row_count('Child Bounties')} child bounties in database")

        # Fetch and store fellowship treasury spends
        fellowship_limit, _ = get_fetch_limit("Fellowship", "fellowship_treasury_spends")
        if fellowship_limit != -1 and (tables_to_fetch is None or 'fellowship_treasury_spends' in tables_to_fetch):
            fellowship_df = provider.fetch_fellowship_treasury_spends(fellowship_limit)
            logger.info(f"Fetched {len(fellowship_df)} fellowship spends")
            sink.update_table("Fellowship", fellowship_df, allow_empty=True)
            logger.info(f"Total {sink.get_row_count('Fellowship')} fellowship spends in database")

        # Fetch and store fellowship salary data
        # Check fellowship_salary_cycles: 0 = fetch all, -1 = skip
        salary_limit, _ = get_fetch_limit("Fellowship Salary Cycles", "fellowship_salary_cycles")
        if salary_limit != -1 and (tables_to_fetch is None or 'fellowship_salary_cycles' in tables_to_fetch):
            # Initialize ID provider for address resolution (used by claimants and payments)
            id_provider = StatescanIdProvider(args.network)

            # Fetch salary cycles
            logger.info("Fetching fellowship salary cycles...")
            cycles_df = provider.fetch_fellowship_salary_cycles(start_cycle=1, end_cycle=None)
            if not cycles_df.empty:
                sink.update_table("Fellowship Salary Cycles", cycles_df, allow_empty=True)
                logger.info(f"Stored {sink.get_row_count('Fellowship Salary Cycles')} salary cycles in database")
            else:
                logger.warning("No salary cycle data found")

            # Fetch salary claimants with name resolution and ranks
            logger.info("Fetching fellowship salary claimants...")
            claimants_df = provider.fetch_fellowship_salary_claimants()
            if not claimants_df.empty:
                # Resolve claimant addresses to names
                claimant_addresses = claimants_df.index.tolist()
                logger.info(f"Resolving {len(claimant_addresses)} claimant addresses...")
                name_mapping = id_provider.resolve_addresses(claimant_addresses)

                # Apply names
                claimants_df['name'] = claimants_df.index.map(name_mapping).fillna('')
                claimants_df['display_name'] = claimants_df.apply(
                    lambda row: row['name'] if row['name'] else row['short_address'],
                    axis=1
                )

                # Get fellowship member ranks
                logger.info("Fetching fellowship member ranks...")
                rank_mapping = provider.fetch_fellowship_members()
                claimants_df['rank'] = claimants_df.index.map(rank_mapping)

                sink.update_table("Fellowship Salary Claimants", claimants_df, allow_empty=True)
                logger.info(f"Stored {sink.get_row_count('Fellowship Salary Claimants')} salary claimants in database")
            else:
                logger.warning("No salary claimant data found")

            # Fetch salary payments (only for cycles we know exist)
            if not cycles_df.empty:
                max_cycle = cycles_df.index.max()
                logger.info(f"Fetching fellowship salary payments for cycles 1-{max_cycle}...")
                payments_df = provider.fetch_fellowship_salary_payments(start_cycle=1, end_cycle=max_cycle)
            else:
                payments_df = provider.fetch_fellowship_salary_payments(start_cycle=1, end_cycle=22)  # fallback

            if not payments_df.empty:
                # Batch resolve all unique addresses
                all_addresses = set(payments_df['who'].tolist() + payments_df['beneficiary'].tolist())
                all_addresses.discard('')

                logger.info(f"Resolving {len(all_addresses)} payment addresses...")
                payment_name_mapping = id_provider.resolve_addresses(list(all_addresses))

                # Apply names to DataFrame
                payments_df['who_name'] = payments_df['who'].map(payment_name_mapping).fillna('')
                payments_df['beneficiary_name'] = payments_df['beneficiary'].map(payment_name_mapping).fillna('')

                sink.update_table("Fellowship Salary Payments", payments_df, allow_empty=True)
                logger.info(f"Stored {sink.get_row_count('Fellowship Salary Payments')} salary payments in database")
            else:
                logger.warning("No salary payment data found")

        sink.close()

        logger.info("=" * 50)
        logger.info("Data pipeline completed successfully!")
        logger.info(f"Database location: {Path(args.db).absolute()}")

    except Exception as e:
        logger.error(f"Error running pipeline: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
