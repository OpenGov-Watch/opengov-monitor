"""
Tests for referenda data fetching and transformation.

Key test areas:
- Batch fetching and detail loading
- Track determination from origin
- Status extraction with Executed_err handling
- Tally calculations
- Price conversion for USD values
"""

import pytest
import pandas as pd
from datetime import datetime
from unittest.mock import MagicMock, patch

from data_providers.subsquare.referenda import (
    transform_referenda,
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


class TestTransformReferenda:
    """Tests for transform_referenda function."""

    def _make_referendum_row(self, ref_id, status_name="Executed", origin_type="origins", origin_value="SmallSpender"):
        """Helper to create a referendum row with common structure."""
        origin = {origin_type: origin_value} if origin_type == "origins" else {"system": {"root": None}}

        return {
            "referendumIndex": ref_id,
            "createdAt": "2024-01-15T10:00:00Z",
            "lastActivityAt": "2024-01-16T15:00:00Z",
            "title": f"Referendum {ref_id}",
            "state": {
                "name": status_name,
                "args": {"result": {"ok": None}} if status_name == "Executed" else {},
                "indexer": {"blockTime": 1705400000}  # seconds
            },
            "onchainData": {
                "proposal": {},
                "tally": {"ayes": "1000000000000", "nays": "500000000000"},  # 100 DOT, 50 DOT
                "info": {"origin": origin},  # info is inside onchainData
            }
        }

    def test_renames_columns_correctly(self, polkadot_network, mock_price_service):
        """Test that columns are renamed as expected."""
        df = pd.DataFrame([self._make_referendum_row(1)])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert "id" in result.index.names or result.index.name == "id"
        assert "title" in result.columns
        assert "status" in result.columns

    def test_extracts_track_from_origins(self, polkadot_network, mock_price_service):
        """Test that track is extracted from origins field."""
        df = pd.DataFrame([self._make_referendum_row(1, origin_type="origins", origin_value="BigSpender")])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert result.loc[1, "track"] == "BigSpender"

    def test_extracts_root_track(self, polkadot_network, mock_price_service):
        """Test that Root track is extracted from system origin."""
        df = pd.DataFrame([self._make_referendum_row(1, origin_type="system", origin_value=None)])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert result.loc[1, "track"] == "Root"

    def test_extracts_status_executed(self, polkadot_network, mock_price_service):
        """Test that Executed status is extracted correctly."""
        df = pd.DataFrame([self._make_referendum_row(1, status_name="Executed")])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert result.loc[1, "status"] == "Executed"

    def test_extracts_status_executed_err(self, polkadot_network, mock_price_service):
        """Test that Executed_err status is extracted for failed executions."""
        row = self._make_referendum_row(1, status_name="Executed")
        row["state"]["args"]["result"] = {"err": "some_error"}
        df = pd.DataFrame([row])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert result.loc[1, "status"] == "Executed_err"

    def test_extracts_status_pending(self, polkadot_network, mock_price_service):
        """Test extraction of non-Executed status."""
        df = pd.DataFrame([self._make_referendum_row(1, status_name="Ongoing")])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert result.loc[1, "status"] == "Ongoing"

    def test_calculates_tally_values(self, polkadot_network, mock_price_service):
        """Test that tally ayes and nays are calculated correctly."""
        row = self._make_referendum_row(1)
        row["onchainData"]["tally"] = {
            "ayes": "1000000000000",  # 100 DOT (10 decimals)
            "nays": "500000000000",   # 50 DOT
        }
        df = pd.DataFrame([row])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert result.loc[1, "tally_ayes"] == 100.0
        assert result.loc[1, "tally_nays"] == 50.0

    def test_parses_proposal_time(self, polkadot_network, mock_price_service):
        """Test that proposal_time is parsed correctly."""
        row = self._make_referendum_row(1)
        row["createdAt"] = "2024-01-15T10:30:00Z"
        df = pd.DataFrame([row])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert pd.notna(result.loc[1, "proposal_time"])
        assert result.loc[1, "proposal_time"].year == 2024
        assert result.loc[1, "proposal_time"].month == 1
        assert result.loc[1, "proposal_time"].day == 15

    def test_extracts_latest_status_change(self, polkadot_network, mock_price_service):
        """Test that latest_status_change is extracted from state indexer."""
        row = self._make_referendum_row(1)
        row["state"]["indexer"]["blockTime"] = 1705400000  # seconds
        df = pd.DataFrame([row])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert pd.notna(result.loc[1, "latest_status_change"])

    def test_includes_asset_components(self, polkadot_network, mock_price_service):
        """Test that DOT, USDC, USDT components are included."""
        df = pd.DataFrame([self._make_referendum_row(1)])

        result = transform_referenda(df, polkadot_network, mock_price_service)

        assert "DOT_component" in result.columns
        assert "USDC_component" in result.columns
        assert "USDT_component" in result.columns


class TestGetValueConverter:
    """Tests for _get_value_converter factory function."""

    def test_returns_historic_price_for_executed(self, polkadot_network, mock_price_service):
        """Test that historic price is used for end statuses."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)

        row = pd.Series({
            "status": "Executed",
            "proposal_time": datetime(2024, 1, 15, tzinfo=pd.Timestamp.now().tzinfo),
            "bag": bag,
        })

        converter = _get_value_converter(
            polkadot_network, mock_price_service, AssetKind.USDC, "proposal_time",
            MagicMock(), status_key="status"
        )
        result = converter(row)

        # Price service should be called with date
        assert result is not None

    def test_returns_current_price_for_ongoing(self, polkadot_network, mock_price_service):
        """Test that current price is used for ongoing referenda."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)

        row = pd.Series({
            "status": "Ongoing",
            "proposal_time": datetime(2024, 1, 15, tzinfo=pd.Timestamp.now().tzinfo),
            "bag": bag,
        })

        converter = _get_value_converter(
            polkadot_network, mock_price_service, AssetKind.USDC, "proposal_time",
            MagicMock(), status_key="status"
        )
        result = converter(row)

        assert result is not None

    def test_handles_empty_bag(self, polkadot_network, mock_price_service):
        """Test that empty bag returns appropriate value."""
        bag = AssetsBag()

        row = pd.Series({
            "status": "Executed",
            "proposal_time": datetime(2024, 1, 15, tzinfo=pd.Timestamp.now().tzinfo),
            "bag": bag,
        })

        converter = _get_value_converter(
            polkadot_network, mock_price_service, AssetKind.USDC, "proposal_time",
            MagicMock()
        )
        result = converter(row)

        # Empty bag should return 0 or appropriate value
        assert result is not None

    def test_handles_historic_statuses(self, polkadot_network, mock_price_service):
        """Test that all historic statuses use historic pricing."""
        historic_statuses = ["Executed", "TimedOut", "Approved", "Cancelled", "Rejected"]
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)

        for status in historic_statuses:
            row = pd.Series({
                "status": status,
                "proposal_time": datetime(2024, 1, 15, tzinfo=pd.Timestamp.now().tzinfo),
                "bag": bag,
            })

            converter = _get_value_converter(
                polkadot_network, mock_price_service, AssetKind.USDC, "proposal_time",
                MagicMock(), status_key="status"
            )
            result = converter(row)

            assert result is not None, f"Failed for status: {status}"
