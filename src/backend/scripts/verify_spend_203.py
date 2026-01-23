"""
Verify that Treasury spend #203 is correctly parsed as USDC after the XCM refactor.

This spend was incorrectly showing as 3.66 DOT instead of 36,600 USDC because
the old v3 parsing immediately returned native asset when seeing location.interior.here
without checking assetId.concrete.
"""

import requests
import json
import sys
sys.path.insert(0, str(__file__).replace('\\', '/').rsplit('/scripts/', 1)[0])

from data_providers.subsquare import SubsquareProvider
from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind
from unittest.mock import MagicMock


def main():
    # Fetch Treasury spend #203
    print("=== Fetching Treasury Spend #203 ===")
    url = 'https://polkadot-api.subsquare.io/treasury/spends/203.json'
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    data = response.json()

    # Extract the assetKind structure
    asset_kind = data.get('onchainData', {}).get('meta', {}).get('assetKind')
    amount_raw = data.get('onchainData', {}).get('meta', {}).get('amount')

    print(f"\nRaw amount: {amount_raw}")
    print(f"\nAssetKind structure:")
    print(json.dumps(asset_kind, indent=2))

    # Create a provider to test parsing
    network_info = NetworkInfo(network="polkadot", explorer="subsquare")
    price_service = MagicMock()
    provider = SubsquareProvider(network_info, price_service)

    # Parse the asset kind
    parsed_kind = provider._get_XCM_asset_kind(asset_kind)

    print(f"\n=== Parsing Result ===")
    print(f"Parsed AssetKind: {parsed_kind.name}")

    # Calculate denominated amount
    if parsed_kind == AssetKind.USDC or parsed_kind == AssetKind.USDT:
        # USDC/USDT have 6 decimals
        amount = int(amount_raw) / 1_000_000
    elif parsed_kind == AssetKind.DOT:
        # DOT has 10 decimals
        amount = int(amount_raw) / 10_000_000_000
    else:
        amount = amount_raw

    print(f"Denominated amount: {amount:,.2f} {parsed_kind.name}")

    # Verify expected result
    expected_kind = AssetKind.USDC
    expected_amount = 36600.0

    print(f"\n=== Verification ===")
    if parsed_kind == expected_kind:
        print(f"[PASS] AssetKind is correct: {parsed_kind.name}")
    else:
        print(f"[FAIL] AssetKind MISMATCH: expected {expected_kind.name}, got {parsed_kind.name}")

    if abs(amount - expected_amount) < 0.01:
        print(f"[PASS] Amount is correct: {amount:,.2f}")
    else:
        print(f"[FAIL] Amount MISMATCH: expected {expected_amount:,.2f}, got {amount:,.2f}")

    # Return success/failure
    if parsed_kind == expected_kind and abs(amount - expected_amount) < 0.01:
        print("\n=== VERIFICATION PASSED ===")
        return 0
    else:
        print("\n=== VERIFICATION FAILED ===")
        return 1


if __name__ == "__main__":
    sys.exit(main())
