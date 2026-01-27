"""
Backup Subsquare API responses for regression testing.

Fetches and saves raw API responses for Treasury spends and Referenda
that use XCM parsing.
"""

import requests
import json
import time
import argparse
from pathlib import Path


SUBSQUARE_API_BASE = "https://polkadot-api.subsquare.io"


def fetch_and_save(url: str, output_path: Path, delay: float = 0.5):
    """Fetch a URL and save the JSON response."""
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

        print(f"Saved: {output_path}")
        time.sleep(delay)  # Rate limiting
        return True
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return False


def backup_treasury_spends(output_dir: Path, max_id: int = 300):
    """Backup treasury spend API responses."""
    treasury_dir = output_dir / 'treasury_spends'
    treasury_dir.mkdir(parents=True, exist_ok=True)

    # Fetch paginated list
    print(f"Fetching treasury spends list...")
    page = 1
    page_size = 100
    total_saved = 0

    while True:
        list_url = f"{SUBSQUARE_API_BASE}/treasury/spends"
        params = {'page': page, 'page_size': page_size}

        try:
            response = requests.get(list_url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            items = data.get('items', [])
            if not items:
                break

            print(f"Processing page {page} ({len(items)} items)...")

            for item in items:
                spend_id = item.get('index')
                ref_index = item.get('referendumIndex')

                if spend_id is None:
                    continue

                # Only backup if linked to a referendum <= 1600
                if ref_index and ref_index <= 1600:
                    url = f"{SUBSQUARE_API_BASE}/treasury/spends/{spend_id}.json"
                    output_path = treasury_dir / f"{spend_id}.json"

                    if not output_path.exists():
                        if fetch_and_save(url, output_path):
                            total_saved += 1
                    else:
                        print(f"Skipping existing: {output_path}")

            page += 1

        except Exception as e:
            print(f"Error fetching treasury page {page}: {e}")
            break

    print(f"Saved {total_saved} treasury spend responses")


def backup_referenda(output_dir: Path, ref_ids: list = None):
    """Backup referenda API responses.

    If ref_ids is provided, only those are fetched.
    Otherwise, fetches ALL referenda up to ID 1600.
    """
    referenda_dir = output_dir / 'referenda'
    referenda_dir.mkdir(parents=True, exist_ok=True)

    if ref_ids:
        # Fetch specific IDs
        for ref_id in ref_ids:
            url = f"{SUBSQUARE_API_BASE}/gov2/referendums/{ref_id}.json"
            output_path = referenda_dir / f"{ref_id}.json"

            if not output_path.exists():
                fetch_and_save(url, output_path)
            else:
                print(f"Skipping existing: {output_path}")
    else:
        # Fetch ALL referenda up to 1600
        print("Fetching referenda list...")

        page = 1
        page_size = 100
        total_saved = 0

        while True:
            list_url = f"{SUBSQUARE_API_BASE}/gov2/referendums"
            params = {'page': page, 'page_size': page_size}

            try:
                response = requests.get(list_url, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()

                items = data.get('items', [])
                if not items:
                    break

                print(f"Processing page {page} ({len(items)} items)...")

                for item in items:
                    ref_id = item.get('referendumIndex')

                    # Fetch all referenda up to 1600
                    if ref_id is not None and ref_id <= 1600:
                        url = f"{SUBSQUARE_API_BASE}/gov2/referendums/{ref_id}.json"
                        output_path = referenda_dir / f"{ref_id}.json"

                        if not output_path.exists():
                            if fetch_and_save(url, output_path):
                                total_saved += 1
                        else:
                            print(f"Skipping existing: {output_path}")

                page += 1

            except Exception as e:
                print(f"Error fetching referenda page {page}: {e}")
                break

        print(f"Saved {total_saved} referenda responses")


def main():
    parser = argparse.ArgumentParser(description="Backup Subsquare API responses")
    parser.add_argument(
        "--output",
        default="../tests/fixtures/api_responses",
        help="Output directory for JSON files"
    )
    parser.add_argument(
        "--treasury-only",
        action="store_true",
        help="Only backup treasury spends"
    )
    parser.add_argument(
        "--referenda-only",
        action="store_true",
        help="Only backup referenda"
    )
    parser.add_argument(
        "--ref-ids",
        type=str,
        help="Comma-separated list of specific referendum IDs to fetch"
    )

    args = parser.parse_args()
    output_dir = Path(args.output)

    ref_ids = None
    if args.ref_ids:
        ref_ids = [int(x.strip()) for x in args.ref_ids.split(',')]

    if not args.referenda_only:
        print("\n=== Backing up Treasury Spends ===")
        backup_treasury_spends(output_dir)

    if not args.treasury_only:
        print("\n=== Backing up Referenda ===")
        backup_referenda(output_dir, ref_ids)

    print("\nBackup complete.")


if __name__ == "__main__":
    main()
