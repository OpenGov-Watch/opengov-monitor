"""
Tests for StatescanIdProvider class.
"""

import pytest
from unittest.mock import MagicMock, patch

from data_providers.statescan_id import StatescanIdProvider


class TestStatescanIdProviderInit:
    """Tests for StatescanIdProvider initialization."""

    def test_default_network(self):
        """Default network should be polkadot."""
        provider = StatescanIdProvider()
        assert provider.network == "polkadot"
        assert "polkadot" in provider.base_url

    def test_kusama_network(self):
        """Kusama network should use kusama URL."""
        provider = StatescanIdProvider(network="kusama")
        assert provider.network == "kusama"
        assert "kusama" in provider.base_url


class TestResolveAddresses:
    """Tests for resolve_addresses method."""

    def test_empty_list_returns_empty_dict(self):
        """Empty address list should return empty dict without API call."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            result = provider.resolve_addresses([])
            mock_post.assert_not_called()
            assert result == {}

    def test_successful_resolution(self, mock_statescan_response):
        """Successful response should map addresses to names."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = mock_statescan_response
            mock_post.return_value = mock_response

            addresses = [
                "16a357f5Sxab3V2ne4emGQvqJaCLeYpTMx3TCjnQhmJQ71DX",
                "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3"
            ]
            result = provider.resolve_addresses(addresses)

            assert result["16a357f5Sxab3V2ne4emGQvqJaCLeYpTMx3TCjnQhmJQ71DX"] == "Alice"
            assert result["14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3"] == "Bob"

    def test_missing_addresses_get_empty_string(self):
        """Addresses not in response should get empty string."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = [
                {
                    "address": "addr1",
                    "info": {"display": "Alice"}
                }
            ]
            mock_post.return_value = mock_response

            result = provider.resolve_addresses(["addr1", "addr2"])

            assert result["addr1"] == "Alice"
            assert result["addr2"] == ""  # Not in response

    def test_name_priority_display_first(self):
        """Display name should take priority over legal and web."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = [
                {
                    "address": "addr1",
                    "info": {
                        "display": "Display Name",
                        "legal": "Legal Name",
                        "web": "https://example.com"
                    }
                }
            ]
            mock_post.return_value = mock_response

            result = provider.resolve_addresses(["addr1"])
            assert result["addr1"] == "Display Name"

    def test_name_priority_legal_second(self):
        """Legal name should be used when display is empty."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = [
                {
                    "address": "addr1",
                    "info": {
                        "display": "",
                        "legal": "Legal Name",
                        "web": "https://example.com"
                    }
                }
            ]
            mock_post.return_value = mock_response

            result = provider.resolve_addresses(["addr1"])
            assert result["addr1"] == "Legal Name"

    def test_name_priority_web_third(self):
        """Web should be used when display and legal are empty."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = [
                {
                    "address": "addr1",
                    "info": {
                        "display": "",
                        "legal": "",
                        "web": "https://example.com"
                    }
                }
            ]
            mock_post.return_value = mock_response

            result = provider.resolve_addresses(["addr1"])
            assert result["addr1"] == "https://example.com"

    def test_non_200_returns_empty_strings(self):
        """Non-200 response should return empty strings for all addresses."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_response.reason = "Internal Server Error"
            mock_post.return_value = mock_response

            result = provider.resolve_addresses(["addr1", "addr2"])

            assert result["addr1"] == ""
            assert result["addr2"] == ""

    def test_network_error_returns_empty_strings(self):
        """Network error should return empty strings for all addresses."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_post.side_effect = Exception("Connection refused")

            result = provider.resolve_addresses(["addr1", "addr2"])

            assert result["addr1"] == ""
            assert result["addr2"] == ""

    def test_unicode_characters_cleaned(self):
        """Problematic unicode characters should be replaced."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            # Response with emoji in name
            mock_response.json.return_value = [
                {
                    "address": "addr1",
                    "info": {"display": "OLIVER \u26a1"}  # Lightning bolt emoji
                }
            ]
            mock_post.return_value = mock_response

            result = provider.resolve_addresses(["addr1"])

            # Should not contain the emoji (replaced with ?)
            assert "\u26a1" not in result["addr1"]

    def test_info_not_dict_handled(self):
        """Non-dict info field should be handled gracefully."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = [
                {
                    "address": "addr1",
                    "info": "not a dict"
                }
            ]
            mock_post.return_value = mock_response

            result = provider.resolve_addresses(["addr1"])
            assert result["addr1"] == ""

    def test_post_payload_format(self):
        """API call should send addresses in correct format."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = []
            mock_post.return_value = mock_response

            provider.resolve_addresses(["addr1", "addr2"])

            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert call_args.kwargs["json"] == {"addresses": ["addr1", "addr2"]}
            assert call_args.kwargs["timeout"] == 30


class TestResolveSingleAddress:
    """Tests for resolve_single_address method."""

    def test_resolves_single_address(self):
        """Should resolve a single address."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = [
                {"address": "addr1", "info": {"display": "Alice"}}
            ]
            mock_post.return_value = mock_response

            result = provider.resolve_single_address("addr1")
            assert result == "Alice"

    def test_not_found_returns_empty(self):
        """Address not found should return empty string."""
        provider = StatescanIdProvider()

        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = []
            mock_post.return_value = mock_response

            result = provider.resolve_single_address("unknown")
            assert result == ""
