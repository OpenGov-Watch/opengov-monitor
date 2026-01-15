import argparse
import sys
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from data_providers.network_info import NetworkInfo
from data_providers.price_service import PriceService
from data_providers.subsquare import SubsquareProvider
from data_providers.statescan_id import StatescanIdProvider
from utils.custom_logging import setup_logging


def main():
    parser = argparse.ArgumentParser(description='Fetch fellowship salary cycle data from Collectives API.')
    parser.add_argument('--start-cycle', type=int, default=1, 
                       help='Starting cycle number (default: 1)')
    parser.add_argument('--end-cycle', type=int, default=None,
                       help='Ending cycle number (default: fetch all available)')
    parser.add_argument('--cycle', type=int, default=None,
                       help='Fetch specific cycle number only')
    parser.add_argument('--out', default='salary_cycles', 
                       help='Output file prefix (default: salary_cycles)')
    parser.add_argument('--format', choices=['csv', 'json', 'both'], default='both',
                       help='Output format (default: both)')
    parser.add_argument('--include-claimants', action='store_true',
                       help='Also fetch individual claimant data')
    parser.add_argument('--claimants-only', action='store_true', 
                       help='Only fetch claimants data, skip cycle data')
    parser.add_argument('--no-name-resolution', action='store_true',
                       help='Skip address name resolution (faster but less readable)')

    args = parser.parse_args()

    logger, _ = setup_logging()

    # Use polkadot network info for denomination (fellowship salaries are in DOT)
    network_info = NetworkInfo('polkadot', 'subsquare')
    price_service = PriceService(network_info)
    logger.info('Loading prices')
    price_service.load_prices()

    provider = SubsquareProvider(network_info, price_service)
    id_provider = StatescanIdProvider('polkadot')

    # Determine cycle range
    if args.cycle:
        start_cycle = args.cycle
        end_cycle = args.cycle
        logger.info(f'Fetching salary cycle {args.cycle}')
    else:
        start_cycle = args.start_cycle
        end_cycle = args.end_cycle
        if end_cycle:
            logger.info(f'Fetching salary cycles {start_cycle} to {end_cycle}')
        else:
            logger.info(f'Fetching all salary cycles starting from {start_cycle}')

    # Fetch data
    try:
        output_dir = PROJECT_ROOT / 'data'
        output_dir.mkdir(exist_ok=True)

        # Fetch claimants data if requested
        if args.claimants_only or args.include_claimants:
            resolve_names = not args.no_name_resolution
            logger.info(f'Fetching salary claimants (name resolution: {resolve_names})')
            
            # First fetch raw claimants data
            claimants = provider.fetch_fellowship_salary_claimants()
            
            # Fetch fellowship members and ranks
            logger.info('Fetching fellowship members and ranks')
            members_mapping = provider.fetch_fellowship_members()
            
            if not claimants.empty:
                # Add rank information
                claimants['rank'] = claimants.index.map(members_mapping).fillna('Not a member')
                
                # Resolve names if requested
                name_mapping = {}
                if resolve_names:
                    addresses = claimants.index.tolist()  # addresses are now the index
                    name_mapping = id_provider.resolve_addresses(addresses)
                    
                    # Apply name mapping to the dataframe
                    claimants['name'] = claimants.index.map(name_mapping).fillna('')
                    claimants['display_name'] = claimants.apply(
                        lambda row: row['name'] if row['name'] else row['short_address'], 
                        axis=1
                    )
                
                # Calculate fetched amount (attempt_amount_dot * 10000)
                claimants['fetched'] = claimants['attempt_amount_dot'] * 10000
                
                # Create simplified output with only requested columns
                simplified_claimants = claimants[['display_name', 'rank', 'status_type', 'fetched']].copy()
                simplified_claimants = simplified_claimants.rename(columns={'display_name': 'name'})
            
            if not claimants.empty:
                claimants_prefix = 'salary_claimants'
                
                if args.format in ['csv', 'both']:
                    csv_path = output_dir / f'{claimants_prefix}.csv'
                    simplified_claimants.to_csv(csv_path)
                    logger.info(f'Saved claimants CSV data to {csv_path}')

                if args.format in ['json', 'both']:
                    json_path = output_dir / f'{claimants_prefix}.json'
                    simplified_claimants.to_json(json_path, orient='records', date_format='iso', indent=2)
                    logger.info(f'Saved claimants JSON data to {json_path}')
                
                # Print claimants summary
                registered_count = (claimants['status_type'] == 'registered').sum()
                attempted_count = (claimants['status_type'] == 'attempted').sum()
                nothing_count = (claimants['status_type'] == 'nothing').sum()
                total_registered_amount = claimants[claimants['status_type'] == 'registered']['registered_amount_dot'].sum()
                
                # Rank statistics
                fellowship_members = claimants[claimants['rank'] != 'Not a member']
                non_members = claimants[claimants['rank'] == 'Not a member']
                
                print(f"\nSalary Claimants Summary:")
                print(f"- Total claimants: {len(claimants)}")
                print(f"- Registered: {registered_count}")
                print(f"- Attempted: {attempted_count}")
                print(f"- Nothing: {nothing_count}")
                print(f"- Fellowship members: {len(fellowship_members)}")
                print(f"- Non-members: {len(non_members)}")
                print(f"- Total registered amount: {total_registered_amount:,.2f} DOT")
                
                if len(fellowship_members) > 0:
                    # Show rank distribution of claimants
                    rank_counts = fellowship_members['rank'].value_counts().sort_index()
                    rank_distribution = ", ".join([f"Rank {r}: {c}" for r, c in rank_counts.items()])
                    print(f"- Rank distribution: {rank_distribution}")
            else:
                logger.warning('No claimants data found')

        # Fetch cycle data unless claimants-only
        if not args.claimants_only:
            salary_cycles = provider.fetch_fellowship_salary_cycles(start_cycle, end_cycle)
            
            if salary_cycles.empty:
                logger.warning('No salary cycle data found')
                return

            if args.format in ['csv', 'both']:
                csv_path = output_dir / f'{args.out}.csv'
                salary_cycles.to_csv(csv_path)
                logger.info(f'Saved cycles CSV data to {csv_path}')

            if args.format in ['json', 'both']:
                json_path = output_dir / f'{args.out}.json'
                salary_cycles.to_json(json_path, orient='records', date_format='iso', indent=2)
                logger.info(f'Saved cycles JSON data to {json_path}')

            logger.info(f'Successfully fetched {len(salary_cycles)} salary cycles')

            # Display cycle statistics
            if len(salary_cycles) > 0:
                total_budget = salary_cycles['budget_usdc'].sum()
                total_registered = salary_cycles['registeredCount'].sum()
                total_paid = salary_cycles['registeredPaidCount'].sum()
                total_paid_amount = salary_cycles['registered_paid_amount_usdc'].sum()

                print(f"\nSalary Cycles Summary:")
                print(f"- Cycles fetched: {len(salary_cycles)}")
                print(f"- Total budget: {total_budget:,.2f} USDC")
                print(f"- Total registrations: {total_registered:,}")
                print(f"- Total paid registrations: {total_paid:,}")
                print(f"- Total paid amount: {total_paid_amount:,.2f} USDC")
                print(f"- Date range: {salary_cycles['start_time'].min()} to {salary_cycles['end_time'].max()}")

    except Exception as e:
        logger.error(f'Error fetching salary data: {e}', exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()