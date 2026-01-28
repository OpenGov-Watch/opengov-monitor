"""
Tests for fellowship data fetching and transformation.

Key test areas:
- Salary cycles fetching and transformation
- Claimants data handling
- Payment records extraction
- Member fetching and rank mapping
- USDC denomination (6 decimals, not DOT's 10)
"""

import pytest
import pandas as pd
from datetime import datetime
from unittest.mock import MagicMock, patch

from data_providers.subsquare.fellowship import (
    transform_fellowship_treasury_spends,
    transform_salary_cycles,
    transform_salary_claimants,
    transform_salary_payments,
    fetch_fellowship_members,
    _extract_payment_from_event,
)
from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind


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
    mock_service.convert_asset_value.return_value = 1000.0
    return mock_service


class TestTransformFellowshipTreasurySpends:
    """Tests for transform_fellowship_treasury_spends function."""

    def test_renames_columns_correctly(self, polkadot_network, mock_price_service):
        """Test that columns are renamed as expected."""
        df = pd.DataFrame([{
            "index": 1,
            "state": "Approved",
            "title": "Fellowship Grant",
            "onchainData": {
                "meta": {"amount": "10000000000"},  # 1 DOT in plancks
                "timeline": [
                    {"indexer": {"blockTime": 1700000000000}},
                    {"indexer": {"blockTime": 1700001000000}},
                ]
            }
        }])

        result = transform_fellowship_treasury_spends(df, polkadot_network, mock_price_service)

        assert "id" in result.index.names or result.index.name == "id"
        assert "status" in result.columns
        assert "description" in result.columns

    def test_extracts_dot_amount(self, polkadot_network, mock_price_service):
        """Test that DOT amount is correctly extracted and denominated."""
        df = pd.DataFrame([{
            "index": 1,
            "state": "Approved",
            "title": "Grant",
            "onchainData": {
                "meta": {"amount": "10000000000"},  # 1 DOT
                "timeline": [
                    {"indexer": {"blockTime": 1700000000000}},
                ]
            }
        }])

        result = transform_fellowship_treasury_spends(df, polkadot_network, mock_price_service)

        assert "DOT" in result.columns
        assert result.loc[1, "DOT"] == 1.0

    def test_extracts_timestamps(self, polkadot_network, mock_price_service):
        """Test that proposal_time and latest_status_change are extracted."""
        df = pd.DataFrame([{
            "index": 1,
            "state": "Approved",
            "title": "Grant",
            "onchainData": {
                "meta": {"amount": "10000000000"},
                "timeline": [
                    {"indexer": {"blockTime": 1700000000}},  # in seconds
                    {"indexer": {"blockTime": 1700001000}},
                ]
            }
        }])

        result = transform_fellowship_treasury_spends(df, polkadot_network, mock_price_service)

        assert "proposal_time" in result.columns
        assert "latest_status_change" in result.columns
        assert pd.notna(result.loc[1, "proposal_time"])


class TestTransformSalaryCycles:
    """Tests for transform_salary_cycles function."""

    def test_extracts_budget_in_usdc(self, polkadot_network):
        """Test that budget is converted to USDC denomination (6 decimals)."""
        df = pd.DataFrame([{
            "cycle": 1,
            "status": {"budget": 1000000000, "totalRegistrations": 500000000},
            "unRegisteredPaid": "100000000",
            "registeredPaid": "200000000",
            "registrationPeriod": 7200,
            "payoutPeriod": 7200,
            "startIndexer": {"blockHeight": 100, "blockTime": 1700000000},
            "endIndexer": {"blockHeight": 200, "blockTime": 1700100000},
            "registeredCount": 10,
            "registeredPaidCount": 8,
        }])

        result = transform_salary_cycles(df, polkadot_network)

        # USDC has 6 decimals, so 1000000000 raw = 1000 USDC
        assert "budget_usdc" in result.columns
        assert result.loc[1, "budget_usdc"] == 1000.0

    def test_handles_none_end_indexer(self, polkadot_network):
        """Test that ongoing cycles with None endIndexer are handled."""
        df = pd.DataFrame([{
            "cycle": 1,
            "status": {"budget": 1000000000},
            "unRegisteredPaid": "0",
            "registeredPaid": "0",
            "registrationPeriod": 7200,
            "payoutPeriod": 7200,
            "startIndexer": {"blockHeight": 100, "blockTime": 1700000000},
            "endIndexer": None,
            "registeredCount": 0,
            "registeredPaidCount": 0,
        }])

        result = transform_salary_cycles(df, polkadot_network)

        # Should not raise an error
        assert result.loc[1, "end_block"] is None or pd.isna(result.loc[1, "end_block"])

    def test_sets_cycle_as_index(self, polkadot_network):
        """Test that cycle is set as index."""
        df = pd.DataFrame([{
            "cycle": 17,
            "status": {"budget": 1000000000},
            "unRegisteredPaid": "0",
            "registeredPaid": "0",
            "registrationPeriod": 7200,
            "payoutPeriod": 7200,
            "startIndexer": {"blockHeight": 100, "blockTime": 1700000000},
            "endIndexer": {"blockHeight": 200, "blockTime": 1700100000},
            "registeredCount": 5,
            "registeredPaidCount": 5,
        }])

        result = transform_salary_cycles(df, polkadot_network)

        assert 17 in result.index


class TestTransformSalaryClaimants:
    """Tests for transform_salary_claimants function."""

    def test_extracts_status_type_registered(self, polkadot_network):
        """Test extraction of 'registered' status type."""
        df = pd.DataFrame([{
            "address": "1234567890abcdef",
            "status": {
                "lastActive": 1700000000,
                "status": {"registered": 1000000}
            }
        }])

        result = transform_salary_claimants(df, polkadot_network)

        assert result.loc["1234567890abcdef", "status_type"] == "registered"
        assert result.loc["1234567890abcdef", "registered_amount_usdc"] == 1.0  # 6 decimals

    def test_extracts_status_type_attempted(self, polkadot_network):
        """Test extraction of 'attempted' status type."""
        df = pd.DataFrame([{
            "address": "1234567890abcdef",
            "status": {
                "lastActive": 1700000000,
                "status": {
                    "attempted": {
                        "registered": 1000000,
                        "id": 5,
                        "amount": 500000
                    }
                }
            }
        }])

        result = transform_salary_claimants(df, polkadot_network)

        assert result.loc["1234567890abcdef", "status_type"] == "attempted"
        assert result.loc["1234567890abcdef", "attempt_id"] == 5

    def test_extracts_status_type_nothing(self, polkadot_network):
        """Test extraction of 'nothing' status type."""
        df = pd.DataFrame([{
            "address": "1234567890abcdef",
            "status": {
                "lastActive": 1700000000,
                "status": {"nothing": None}
            }
        }])

        result = transform_salary_claimants(df, polkadot_network)

        assert result.loc["1234567890abcdef", "status_type"] == "nothing"
        assert result.loc["1234567890abcdef", "registered_amount_usdc"] == 0

    def test_applies_name_mapping(self, polkadot_network):
        """Test that name mapping is applied correctly."""
        df = pd.DataFrame([{
            "address": "1234567890abcdef",
            "status": {"lastActive": 1700000000, "status": {"nothing": None}}
        }])

        name_mapping = {"1234567890abcdef": "Alice"}
        result = transform_salary_claimants(df, polkadot_network, name_mapping)

        assert result.loc["1234567890abcdef", "name"] == "Alice"
        assert result.loc["1234567890abcdef", "display_name"] == "Alice"

    def test_creates_short_address(self, polkadot_network):
        """Test that short_address is created correctly."""
        df = pd.DataFrame([{
            "address": "1234567890abcdefghijklmnopqrstuvwxyz",
            "status": {"lastActive": 1700000000, "status": {"nothing": None}}
        }])

        result = transform_salary_claimants(df, polkadot_network)

        # Short address: first 6 + "..." + last 6
        assert result.loc["1234567890abcdefghijklmnopqrstuvwxyz", "short_address"] == "123456...uvwxyz"


class TestTransformSalaryPayments:
    """Tests for transform_salary_payments function."""

    def test_denominates_in_usdc(self, polkadot_network, mock_price_service):
        """Test that amounts are converted to USDC denomination."""
        df = pd.DataFrame([{
            "payment_id": 1,
            "cycle": 17,
            "who": "address1",
            "beneficiary": "address2",
            "amount_raw": "1000000000",  # 1000 USDC (6 decimals)
            "salary_raw": "500000000",
            "rank": 3,
            "is_active": True,
            "block_height": 12345,
            "block_time_ms": 1700000000000,  # milliseconds
        }])

        result = transform_salary_payments(df, polkadot_network, mock_price_service)

        assert result.loc[1, "amount_usdc"] == 1000.0
        assert result.loc[1, "salary_usdc"] == 500.0

    def test_converts_time_from_milliseconds(self, polkadot_network, mock_price_service):
        """Test that block_time is converted from milliseconds."""
        df = pd.DataFrame([{
            "payment_id": 1,
            "cycle": 17,
            "who": "address1",
            "beneficiary": "address2",
            "amount_raw": "1000000000",
            "salary_raw": "500000000",
            "rank": 3,
            "is_active": True,
            "block_height": 12345,
            "block_time_ms": 1700000000000,  # 2023-11-14T22:13:20 UTC
        }])

        result = transform_salary_payments(df, polkadot_network, mock_price_service)

        assert pd.notna(result.loc[1, "block_time"])
        # Should be converted from ms to datetime
        assert result.loc[1, "block_time"].year == 2023

    def test_converts_is_active_to_int(self, polkadot_network, mock_price_service):
        """Test that is_active boolean is converted to int."""
        df = pd.DataFrame([{
            "payment_id": 1,
            "cycle": 17,
            "who": "address1",
            "beneficiary": "address2",
            "amount_raw": "1000000000",
            "salary_raw": "500000000",
            "rank": 3,
            "is_active": True,
            "block_height": 12345,
            "block_time_ms": 1700000000000,
        }])

        result = transform_salary_payments(df, polkadot_network, mock_price_service)

        assert result.loc[1, "is_active"] == 1


class TestExtractPaymentFromEvent:
    """Tests for _extract_payment_from_event helper."""

    def test_extracts_payment_data(self):
        """Test that payment data is correctly extracted from event."""
        event = {
            "event": "Paid",
            "args": {
                "paymentId": 42,
                "who": "member_address",
                "beneficiary": "payout_address",
                "amount": "1000000000",
                "memberInfo": {
                    "salary": "500000000",
                    "rank": 3,
                    "isActive": True
                }
            },
            "indexer": {
                "blockHeight": 12345,
                "blockTime": 1700000000000
            }
        }

        result = _extract_payment_from_event(event, cycle=17)

        assert result["payment_id"] == 42
        assert result["cycle"] == 17
        assert result["who"] == "member_address"
        assert result["beneficiary"] == "payout_address"
        assert result["amount_raw"] == "1000000000"
        assert result["salary_raw"] == "500000000"
        assert result["rank"] == 3
        assert result["is_active"] is True
        assert result["block_height"] == 12345
        assert result["block_time_ms"] == 1700000000000


class TestFetchFellowshipMembers:
    """Tests for fetch_fellowship_members function."""

    @patch("requests.get")
    def test_returns_address_to_rank_mapping(self, mock_get):
        """Test that members are returned as address->rank mapping."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"address": "addr1", "rank": 3},
            {"address": "addr2", "rank": 5},
            {"address": "addr3", "rank": 1},
        ]
        mock_get.return_value = mock_response

        result = fetch_fellowship_members()

        assert result == {"addr1": 3, "addr2": 5, "addr3": 1}

    @patch("requests.get")
    def test_handles_empty_response(self, mock_get):
        """Test handling of empty API response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_get.return_value = mock_response

        result = fetch_fellowship_members()

        assert result == {}

    @patch("requests.get")
    def test_handles_api_error(self, mock_get):
        """Test handling of API error response."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.reason = "Internal Server Error"
        mock_get.return_value = mock_response

        result = fetch_fellowship_members()

        assert result == {}

    @patch("requests.get")
    def test_handles_network_exception(self, mock_get):
        """Test handling of network exceptions."""
        mock_get.side_effect = Exception("Connection refused")

        result = fetch_fellowship_members()

        assert result == {}

    @patch("requests.get")
    def test_skips_members_without_address_or_rank(self, mock_get):
        """Test that members without address or rank are skipped."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"address": "addr1", "rank": 3},
            {"address": "addr2"},  # Missing rank
            {"rank": 5},  # Missing address
            {"address": "", "rank": 1},  # Empty address
        ]
        mock_get.return_value = mock_response

        result = fetch_fellowship_members()

        assert result == {"addr1": 3}
