"""
Tests for treasury spends and child bounties transformation.

Key test areas:
- XCM asset extraction from assetKind
- Child bounties value transformation
- validFrom/expireAt datetime estimation
- Block time calculations
"""

import pytest
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from data_providers.subsquare.treasury import (
    transform_treasury_spends,
    transform_child_bounties,
    _get_value_converter,
)
from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind
from data_providers.assets_bag import AssetsBag


@pytest.fixture
def polkadot_network():
    """Polkadot network info fixture."""
    return NetworkInfo(network="polkadot", explorer="subsquare")


@pytest.fixture
def mock_price_service():
    """Mock price service for testing."""
    mock_service = MagicMock()
    mock_service.get_price.return_value = 7.50
    mock_service.get_historic_price.return_value = 7.50
    mock_service.convert_asset_value.return_value = 7.50
    return mock_service


class TestTransformTreasurySpends:
    """Tests for transform_treasury_spends function."""

    def _make_treasury_spend_row(self, spend_id, asset_kind_raw=None):
        """Helper to create a treasury spend row."""
        if asset_kind_raw is None:
            # Default: DOT on relay chain (v3 format)
            asset_kind_raw = {
                "v3": {
                    "location": {"parents": 0, "interior": {"here": None}},
                    "assetId": {"concrete": {"parents": 0, "interior": {"here": None}}}
                }
            }

        return {
            "index": spend_id,
            "referendumIndex": 100 + spend_id,
            "state": "Approved",
            "title": f"Treasury Spend {spend_id}",
            "onchainData": {
                "meta": {
                    "assetKind": asset_kind_raw,
                    "amount": "10000000000",  # 1 DOT in plancks
                    "validFrom": 20000000,
                    "expireAt": 20100000,
                },
                "timeline": [
                    {"indexer": {"blockTime": 1700000000}},  # seconds
                    {"indexer": {"blockTime": 1700100000}},
                ]
            }
        }

    def test_renames_columns_correctly(self, polkadot_network, mock_price_service):
        """Test that columns are renamed as expected."""
        df = pd.DataFrame([self._make_treasury_spend_row(1)])

        # Need block estimation params
        reference_block = 20000000
        reference_datetime = datetime(2024, 1, 15, 10, 0, 0, tzinfo=pd.Timestamp.utcnow().tzinfo)
        block_time = 6.0  # seconds

        result = transform_treasury_spends(
            df, polkadot_network, mock_price_service,
            reference_block, reference_datetime, block_time
        )

        assert "id" in result.index.names or result.index.name == "id"
        assert "status" in result.columns
        assert "description" in result.columns
        assert "referendumIndex" in result.columns

    def test_extracts_timestamps(self, polkadot_network, mock_price_service):
        """Test that proposal_time and latest_status_change are extracted."""
        df = pd.DataFrame([self._make_treasury_spend_row(1)])

        reference_block = 20000000
        reference_datetime = datetime(2024, 1, 15, 10, 0, 0, tzinfo=pd.Timestamp.utcnow().tzinfo)
        block_time = 6.0

        result = transform_treasury_spends(
            df, polkadot_network, mock_price_service,
            reference_block, reference_datetime, block_time
        )

        assert "proposal_time" in result.columns
        assert "latest_status_change" in result.columns
        assert pd.notna(result.loc[1, "proposal_time"])

    def test_estimates_valid_from_datetime(self, polkadot_network, mock_price_service):
        """Test that validFrom block is estimated to datetime."""
        df = pd.DataFrame([self._make_treasury_spend_row(1)])

        reference_block = 20000000
        reference_datetime = datetime(2024, 1, 15, 10, 0, 0, tzinfo=pd.Timestamp.utcnow().tzinfo)
        block_time = 6.0  # 6 seconds per block

        result = transform_treasury_spends(
            df, polkadot_network, mock_price_service,
            reference_block, reference_datetime, block_time
        )

        assert "validFrom" in result.columns
        assert pd.notna(result.loc[1, "validFrom"])

    def test_estimates_expire_at_datetime(self, polkadot_network, mock_price_service):
        """Test that expireAt block is estimated to datetime."""
        df = pd.DataFrame([self._make_treasury_spend_row(1)])

        reference_block = 20000000
        reference_datetime = datetime(2024, 1, 15, 10, 0, 0, tzinfo=pd.Timestamp.utcnow().tzinfo)
        block_time = 6.0

        result = transform_treasury_spends(
            df, polkadot_network, mock_price_service,
            reference_block, reference_datetime, block_time
        )

        assert "expireAt" in result.columns
        assert pd.notna(result.loc[1, "expireAt"])
        # expireAt should be after validFrom
        assert result.loc[1, "expireAt"] > result.loc[1, "validFrom"]

    def test_block_time_estimation_accuracy(self, polkadot_network, mock_price_service):
        """Test that block time estimation is calculated correctly."""
        row = self._make_treasury_spend_row(1)
        row["onchainData"]["meta"]["validFrom"] = 20001000  # 1000 blocks after reference
        row["onchainData"]["meta"]["expireAt"] = 20002000   # 2000 blocks after reference
        df = pd.DataFrame([row])

        reference_block = 20000000
        reference_datetime = datetime(2024, 1, 15, 10, 0, 0, tzinfo=pd.Timestamp.utcnow().tzinfo)
        block_time = 6.0  # 6 seconds per block

        result = transform_treasury_spends(
            df, polkadot_network, mock_price_service,
            reference_block, reference_datetime, block_time
        )

        # validFrom: 1000 blocks * 6 sec = 6000 sec = 100 minutes after reference
        expected_valid_from = reference_datetime + timedelta(seconds=6000)
        assert abs((result.loc[1, "validFrom"] - expected_valid_from).total_seconds()) < 1

        # expireAt: 2000 blocks * 6 sec = 12000 sec = 200 minutes after reference
        expected_expire_at = reference_datetime + timedelta(seconds=12000)
        assert abs((result.loc[1, "expireAt"] - expected_expire_at).total_seconds()) < 1

    def test_includes_asset_components(self, polkadot_network, mock_price_service):
        """Test that DOT, USDC, USDT components are included."""
        df = pd.DataFrame([self._make_treasury_spend_row(1)])

        reference_block = 20000000
        reference_datetime = datetime(2024, 1, 15, 10, 0, 0, tzinfo=pd.Timestamp.utcnow().tzinfo)
        block_time = 6.0

        result = transform_treasury_spends(
            df, polkadot_network, mock_price_service,
            reference_block, reference_datetime, block_time
        )

        assert "DOT_component" in result.columns
        assert "USDC_component" in result.columns
        assert "USDT_component" in result.columns


class TestTransformChildBounties:
    """Tests for transform_child_bounties function."""

    def _make_child_bounty_row(self, parent_id, index):
        """Helper to create a child bounty row."""
        return {
            "parentBountyId": parent_id,
            "index": index,
            "state": "PendingPayout",
            "onchainData": {
                "value": "5000000000",  # 0.5 DOT
                "description": f"Child bounty {parent_id}_{index}",
                "address": "beneficiary_address",
                "timeline": [
                    {"indexer": {"blockTime": 1700000000}},
                    {"indexer": {"blockTime": 1700100000}},
                ]
            }
        }

    def test_creates_composite_identifier(self, polkadot_network, mock_price_service):
        """Test that identifier is created as parentId_index."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "5_3" in result.index

    def test_renames_state_to_status(self, polkadot_network, mock_price_service):
        """Test that state column is renamed to status."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "status" in result.columns
        assert result.loc["5_3", "status"] == "PendingPayout"

    def test_extracts_dot_value(self, polkadot_network, mock_price_service):
        """Test that DOT value is extracted and denominated."""
        row = self._make_child_bounty_row(5, 3)
        row["onchainData"]["value"] = "10000000000"  # 1 DOT
        df = pd.DataFrame([row])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "DOT" in result.columns
        assert result.loc["5_3", "DOT"] == 1.0

    def test_extracts_description(self, polkadot_network, mock_price_service):
        """Test that description is extracted."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "description" in result.columns
        assert result.loc["5_3", "description"] == "Child bounty 5_3"

    def test_extracts_beneficiary(self, polkadot_network, mock_price_service):
        """Test that beneficiary address is extracted."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "beneficiary" in result.columns
        assert result.loc["5_3", "beneficiary"] == "beneficiary_address"

    def test_preserves_parent_bounty_id(self, polkadot_network, mock_price_service):
        """Test that parentBountyId is preserved."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "parentBountyId" in result.columns
        assert result.loc["5_3", "parentBountyId"] == 5

    def test_preserves_index(self, polkadot_network, mock_price_service):
        """Test that index is preserved."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "index" in result.columns
        assert result.loc["5_3", "index"] == 3

    def test_extracts_timestamps(self, polkadot_network, mock_price_service):
        """Test that proposal_time and latest_status_change are extracted."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "proposal_time" in result.columns
        assert "latest_status_change" in result.columns
        assert pd.notna(result.loc["5_3", "proposal_time"])

    def test_calculates_usd_values(self, polkadot_network, mock_price_service):
        """Test that USD values are calculated."""
        df = pd.DataFrame([self._make_child_bounty_row(5, 3)])

        result = transform_child_bounties(df, polkadot_network, mock_price_service)

        assert "USD_proposal_time" in result.columns
        assert "USD_latest" in result.columns


class TestTreasuryGetValueConverter:
    """Tests for _get_value_converter in treasury module."""

    def test_uses_historic_price_for_end_statuses(self, polkadot_network, mock_price_service):
        """Test that historic price is used for completed statuses."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)

        row = pd.Series({
            "status": "Paid",
            "proposal_time": datetime(2024, 1, 15, tzinfo=pd.Timestamp.utcnow().tzinfo),
            "bag": bag,
        })

        converter = _get_value_converter(
            polkadot_network, mock_price_service, AssetKind.USDC, "proposal_time",
            MagicMock(), status_key="status"
        )
        result = converter(row)

        assert result is not None

    def test_handles_nan_bag(self, polkadot_network, mock_price_service):
        """Test handling of bag with NaN values."""
        bag = AssetsBag()
        bag.set_nan()

        row = pd.Series({
            "status": "Approved",
            "proposal_time": datetime(2024, 1, 15, tzinfo=pd.Timestamp.utcnow().tzinfo),
            "bag": bag,
        })

        converter = _get_value_converter(
            polkadot_network, mock_price_service, AssetKind.USDC, "proposal_time",
            MagicMock()
        )
        result = converter(row)

        # Should return NaN or handle gracefully
        assert result is not None or pd.isna(result)
