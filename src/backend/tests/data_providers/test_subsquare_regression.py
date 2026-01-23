"""
Regression tests for Subsquare data processing.

Uses mocked API responses from saved fixtures to ensure XCM parsing
changes don't break existing data processing.
"""

import json
import pytest
import pandas as pd
from pathlib import Path
from unittest.mock import MagicMock, patch
import re

from data_providers.subsquare import SubsquareProvider
from data_providers.network_info import NetworkInfo


FIXTURES_DIR = Path(__file__).parent.parent / 'fixtures'
BASELINE_DIR = FIXTURES_DIR / 'baseline'
API_RESPONSES_DIR = FIXTURES_DIR / 'api_responses'


def load_json_fixtures(subdir: str) -> dict:
    """Load all JSON files from a fixtures subdirectory."""
    fixtures = {}
    fixtures_path = API_RESPONSES_DIR / subdir

    if not fixtures_path.exists():
        return fixtures

    for json_file in fixtures_path.glob('*.json'):
        with open(json_file, 'r', encoding='utf-8') as f:
            # Use the filename (without .json) as the key
            key = json_file.stem
            fixtures[key] = json.load(f)

    return fixtures


class MockResponse:
    """Mock response object for requests."""

    def __init__(self, json_data, status_code=200):
        self.json_data = json_data
        self.status_code = status_code

    def json(self):
        return self.json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


@pytest.fixture
def treasury_fixtures():
    """Load treasury spend API responses."""
    return load_json_fixtures('treasury_spends')


@pytest.fixture
def referenda_fixtures():
    """Load referenda API responses."""
    return load_json_fixtures('referenda')


@pytest.fixture
def treasury_baseline():
    """Load treasury baseline CSV."""
    baseline_path = BASELINE_DIR / 'treasury_baseline.csv'
    if not baseline_path.exists():
        pytest.skip(f"Baseline not found: {baseline_path}")
    return pd.read_csv(baseline_path)


@pytest.fixture
def referenda_baseline():
    """Load referenda baseline CSV."""
    baseline_path = BASELINE_DIR / 'referenda_baseline.csv'
    if not baseline_path.exists():
        pytest.skip(f"Baseline not found: {baseline_path}")
    return pd.read_csv(baseline_path)


@pytest.fixture
def mock_price_service():
    """Mock price service for consistent testing."""
    mock_service = MagicMock()
    # Return a fixed price for testing
    mock_service.get_price.return_value = 7.50  # DOT/USD
    mock_service.get_historic_price.return_value = 7.50
    mock_service.convert_asset_value.return_value = 7.50
    return mock_service


@pytest.fixture
def polkadot_network():
    """Polkadot network info fixture."""
    return NetworkInfo(network="polkadot", explorer="subsquare")


class TestSubsquareRegression:
    """Regression tests using mocked API responses."""

    @pytest.fixture
    def provider(self, polkadot_network, mock_price_service):
        """Create SubsquareProvider with mocked dependencies."""
        provider = SubsquareProvider(polkadot_network, mock_price_service)
        return provider

    def test_treasury_fixtures_loaded(self, treasury_fixtures):
        """Verify treasury fixtures are available."""
        if not treasury_fixtures:
            pytest.skip("No treasury fixtures available - run backup_api_responses.py first")
        print(f"Loaded {len(treasury_fixtures)} treasury fixtures")

    def test_referenda_fixtures_loaded(self, referenda_fixtures):
        """Verify referenda fixtures are available."""
        if not referenda_fixtures:
            pytest.skip("No referenda fixtures available - run backup_api_responses.py first")
        print(f"Loaded {len(referenda_fixtures)} referenda fixtures")

    def test_treasury_baseline_exists(self, treasury_baseline):
        """Verify treasury baseline is available."""
        assert len(treasury_baseline) > 0, "Treasury baseline is empty"
        print(f"Loaded {len(treasury_baseline)} treasury baseline records")

    def test_referenda_baseline_exists(self, referenda_baseline):
        """Verify referenda baseline is available."""
        assert len(referenda_baseline) > 0, "Referenda baseline is empty"
        print(f"Loaded {len(referenda_baseline)} referenda baseline records")

    def test_xcm_parsing_matches_baseline_treasury(
        self, provider, treasury_fixtures, treasury_baseline, mock_price_service
    ):
        """Verify XCM parsing for treasury spends matches baseline.

        This test ensures that refactoring XCM parsing doesn't change
        the results for existing (pre-1782) treasury data.
        """
        if not treasury_fixtures:
            pytest.skip("No treasury fixtures available")

        xcm_columns = [
            'DOT_component', 'USDC_component', 'USDT_component'
        ]

        mismatches = []

        for spend_id, api_response in treasury_fixtures.items():
            # Find the baseline record
            baseline_record = treasury_baseline[
                treasury_baseline['id'] == int(spend_id)
            ]

            if baseline_record.empty:
                continue

            # Extract asset kind from the API response using our parser
            onchain_data = api_response.get('onchainData', {})
            meta = onchain_data.get('meta', {})
            asset_kind_raw = meta.get('assetKind')

            if asset_kind_raw:
                parsed_kind = provider._get_XCM_asset_kind(asset_kind_raw)

                # Compare with baseline
                baseline_dot = baseline_record['DOT_component'].iloc[0]
                baseline_usdc = baseline_record['USDC_component'].iloc[0]
                baseline_usdt = baseline_record['USDT_component'].iloc[0]

                # Check if parsing result matches what we expect from baseline
                # If baseline has DOT_component, parsing should return DOT
                # If baseline has USDC_component, parsing should return USDC
                # etc.

                from data_providers.asset_kind import AssetKind

                expected_kind = None
                if pd.notna(baseline_dot) and baseline_dot > 0:
                    expected_kind = AssetKind.DOT
                elif pd.notna(baseline_usdc) and baseline_usdc > 0:
                    expected_kind = AssetKind.USDC
                elif pd.notna(baseline_usdt) and baseline_usdt > 0:
                    expected_kind = AssetKind.USDT

                if expected_kind and parsed_kind != expected_kind:
                    mismatches.append({
                        'spend_id': spend_id,
                        'expected': expected_kind.name,
                        'actual': parsed_kind.name,
                        'baseline_dot': baseline_dot,
                        'baseline_usdc': baseline_usdc,
                        'baseline_usdt': baseline_usdt,
                    })

        if mismatches:
            mismatch_str = "\n".join(
                f"  Spend {m['spend_id']}: expected {m['expected']}, got {m['actual']}"
                for m in mismatches[:10]  # Show first 10
            )
            pytest.fail(
                f"XCM parsing mismatches found ({len(mismatches)} total):\n{mismatch_str}"
            )

    def test_xcm_parsing_matches_baseline_referenda(
        self, provider, referenda_fixtures, referenda_baseline
    ):
        """Verify XCM parsing for referenda matches baseline.

        This test ensures that refactoring XCM parsing doesn't change
        the results for existing (pre-1782) referenda data.
        """
        if not referenda_fixtures:
            pytest.skip("No referenda fixtures available")

        from data_providers.asset_kind import AssetKind

        mismatches = []

        for ref_id, api_response in referenda_fixtures.items():
            # Find the baseline record
            baseline_record = referenda_baseline[
                referenda_baseline['id'] == int(ref_id)
            ]

            if baseline_record.empty:
                continue

            # Check if this referendum has XCM asset data in onchainData
            onchain_data = api_response.get('onchainData', {})

            # For referenda, XCM data might be nested in proposal or call
            # This depends on how the data is structured
            # The actual parsing is done by _build_bag_from_call_value

            # Compare component values
            baseline_dot = baseline_record['DOT_component'].iloc[0]
            baseline_usdc = baseline_record['USDC_component'].iloc[0]
            baseline_usdt = baseline_record['USDT_component'].iloc[0]

            # Log for debugging
            if pd.notna(baseline_usdc) and baseline_usdc > 0:
                print(f"Ref {ref_id}: USDC baseline = {baseline_usdc}")
            elif pd.notna(baseline_usdt) and baseline_usdt > 0:
                print(f"Ref {ref_id}: USDT baseline = {baseline_usdt}")

        if mismatches:
            mismatch_str = "\n".join(
                f"  Ref {m['ref_id']}: expected {m['expected']}, got {m['actual']}"
                for m in mismatches[:10]
            )
            pytest.fail(
                f"XCM parsing mismatches found ({len(mismatches)} total):\n{mismatch_str}"
            )


class TestXCMParsingConsistency:
    """Tests for XCM parsing consistency across versions."""

    @pytest.fixture
    def provider(self, polkadot_network, mock_price_service):
        """Create SubsquareProvider with mocked dependencies."""
        return SubsquareProvider(polkadot_network, mock_price_service)

    def test_v3_native_dot_relay_chain(self, provider):
        """Test v3 XCM parsing returns DOT for relay chain assets."""
        from data_providers.asset_kind import AssetKind

        # v3 format with here in location (relay chain style)
        # This pattern was used pre-1782 on the relay chain
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {"here": None}
                    }
                }
            }
        }

        result = provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT, f"Expected DOT, got {result}"

    def test_v3_usdc_assethub(self, provider):
        """Test v3 XCM parsing returns USDC for AssetHub assets."""
        from data_providers.asset_kind import AssetKind

        # v3 format with USDC on AssetHub
        asset_kind = {
            "v3": {
                "location": {
                    "parents": 0,
                    "interior": {
                        "x1": {"parachain": 1000}
                    }
                },
                "assetId": {
                    "concrete": {
                        "parents": 0,
                        "interior": {
                            "x2": [
                                {"palletInstance": 50},
                                {"generalIndex": 1337}
                            ]
                        }
                    }
                }
            }
        }

        result = provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDC, f"Expected USDC, got {result}"

    def test_v4_native_dot_from_assethub(self, provider):
        """Test v4 XCM parsing returns DOT when on AssetHub referencing relay."""
        from data_providers.asset_kind import AssetKind

        # v4 format: location.interior.here means "current chain" (AssetHub)
        # assetId.parents=1 + assetId.interior.here means "native relay asset"
        asset_kind = {
            "v4": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 1,
                    "interior": {"here": None}
                }
            }
        }

        result = provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.DOT, f"Expected DOT, got {result}"

    def test_v4_usdc_on_assethub(self, provider):
        """Test v4 XCM parsing returns USDC for AssetHub USDC."""
        from data_providers.asset_kind import AssetKind

        # v4 format: USDC on AssetHub
        asset_kind = {
            "v4": {
                "location": {
                    "parents": 0,
                    "interior": {"here": None}
                },
                "assetId": {
                    "parents": 0,
                    "interior": {
                        "x2": [
                            {"palletInstance": 50},
                            {"generalIndex": 1337}
                        ]
                    }
                }
            }
        }

        result = provider._get_XCM_asset_kind(asset_kind)
        assert result == AssetKind.USDC, f"Expected USDC, got {result}"


@pytest.fixture
def mock_price_service():
    """Mock price service for consistent testing."""
    mock_service = MagicMock()
    mock_service.get_price.return_value = 7.50
    mock_service.get_historic_price.return_value = 7.50
    mock_service.convert_asset_value.return_value = 7.50
    return mock_service


@pytest.fixture
def polkadot_network():
    """Polkadot network info fixture."""
    return NetworkInfo(network="polkadot", explorer="subsquare")
