import argparse
import sys
from pathlib import Path
import yaml

# Add backend directory to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from data_providers.network_info import NetworkInfo
from data_providers.price_service import PriceService
from data_providers.subsquare import SubsquareProvider
from utils.custom_logging import setup_logging


def dump_to_files(provider: SubsquareProvider, output_dir: Path, config: dict):
    output_dir.mkdir(parents=True, exist_ok=True)

    # Referenda
    if config['fetch_limits']['referenda'] > 0:
        referenda = provider.fetch_referenda(config['fetch_limits']['referenda'])
        referenda.to_csv(output_dir / 'referenda.csv')
        referenda.to_json(output_dir / 'referenda.json', orient='records', date_format='iso')

    # Treasury spends
    if config['fetch_limits']['treasury_spends'] > 0:
        bp = config['block_time_projection']
        treasury = provider.fetch_treasury_spends(
            config['fetch_limits']['treasury_spends'],
            bp.get('block_number'),
            bp.get('block_datetime'),
            bp.get('block_time'),
        )
        treasury.to_csv(output_dir / 'treasury_spends.csv')
        treasury.to_json(output_dir / 'treasury_spends.json', orient='records', date_format='iso')

    # Child bounties
    if config['fetch_limits']['child_bounties'] > 0:
        child_bounties = provider.fetch_child_bounties(config['fetch_limits']['child_bounties'])
        child_bounties.to_csv(output_dir / 'child_bounties.csv')
        child_bounties.to_json(output_dir / 'child_bounties.json', orient='records', date_format='iso')

    # Fellowship treasury spends
    if config['fetch_limits']['fellowship_treasury_spends'] > 0:
        fellowship = provider.fetch_fellowship_treasury_spends(
            config['fetch_limits']['fellowship_treasury_spends']
        )
        fellowship.to_csv(output_dir / 'fellowship_treasury_spends.csv')
        fellowship.to_json(output_dir / 'fellowship_treasury_spends.json', orient='records', date_format='iso')


def main():
    parser = argparse.ArgumentParser(description='Dump governance data to CSV and JSON files.')
    parser.add_argument('--network', default='polkadot', help='Network to fetch (polkadot or kusama)')
    parser.add_argument('--explorer', default='subsquare', help='Explorer to use')
    parser.add_argument('--config', default=str(BACKEND_DIR / 'config.yaml'), help='Path to the config file')
    parser.add_argument('--out', default='data_dump', help='Output directory')

    args = parser.parse_args()

    logger, _ = setup_logging()

    with open(args.config) as f:
        config = yaml.safe_load(f)

    network_info = NetworkInfo(args.network, args.explorer)
    price_service = PriceService(network_info)
    logger.info('Loading prices')
    price_service.load_prices()

    provider = SubsquareProvider(network_info, price_service)

    dump_to_files(provider, Path(args.out), config)

    logger.info('Data written to %s', args.out)


if __name__ == '__main__':
    main()
