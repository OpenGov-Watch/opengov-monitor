import unittest
import pytest
from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind


class TestNetworkInfoInit:
    """Tests for NetworkInfo initialization."""

    def test_polkadot_defaults(self):
        """Polkadot network should have correct defaults."""
        info = NetworkInfo(network="polkadot", explorer="subsquare")
        assert info.name == "polkadot"
        assert info.digits == 10
        assert info.native_asset == AssetKind.DOT
        assert info.denomination_factor == 10**10

    def test_kusama_defaults(self):
        """Kusama network should have correct defaults."""
        info = NetworkInfo(network="kusama", explorer="subsquare")
        assert info.name == "kusama"
        assert info.digits == 12
        assert info.native_asset == AssetKind.KSM
        assert info.denomination_factor == 10**12

    def test_subsquare_urls(self):
        """Subsquare explorer should use subsquare URLs."""
        info = NetworkInfo(network="polkadot", explorer="subsquare")
        assert "subsquare.io" in info.referenda_url
        assert "subsquare.io" in info.treasury_url
        assert "subsquare.io" in info.treasury_spends_url
        assert "subsquare.io" in info.child_bounty_url

    def test_polkassembly_urls(self):
        """Polkassembly explorer should use polkassembly URLs."""
        info = NetworkInfo(network="polkadot", explorer="polkassembly")
        assert "polkassembly.io" in info.referenda_url
        assert "polkassembly.io" in info.treasury_url

    def test_polkadot_treasury_address(self):
        """Polkadot should have correct treasury address."""
        info = NetworkInfo(network="polkadot")
        assert info.treasury_address == "13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB"

    def test_kusama_treasury_address(self):
        """Kusama should have correct treasury address."""
        info = NetworkInfo(network="kusama")
        assert info.treasury_address == "F3opxRbN5ZbjJNU511Kj2TLuzFcDq9BGduA9TgiECafpg29"


class TestApplyDenomination(unittest.TestCase):
    def setUp(self):
        self.network_info = NetworkInfo(network="polkadot", explorer="subsquare")

    def test_integer_value(self):
        result = self.network_info.apply_denomination(10000000000, AssetKind.DOT)
        self.assertEqual(result, 1.0)

    def test_float_value(self):
        result = self.network_info.apply_denomination(10000000000.0, AssetKind.DOT)
        self.assertEqual(result, 1.0)

    def test_string_scientific_notation(self):
        result = self.network_info.apply_denomination("1e10", AssetKind.DOT)
        self.assertEqual(result, 1.0)

    def test_hexadecimal_string(self):
        result = self.network_info.apply_denomination("0x2540be400", AssetKind.DOT)
        self.assertEqual(result, 1.0)

    def test_asset_kind_dot(self):
        result = self.network_info.apply_denomination(10000000000, AssetKind.DOT)
        self.assertEqual(result, 1.0)

    def test_asset_kind_ksm(self):
        self.network_info.digits = 12
        result = self.network_info.apply_denomination(1000000000000, AssetKind.KSM)
        self.assertEqual(result, 1.0)

    def test_invalid_string(self):
        with self.assertRaises(Exception) as context:
            self.network_info.apply_denomination("invalid_string", AssetKind.DOT)
        self.assertIn("Invalid string value", str(context.exception))

    def test_invalid_type(self):
        with self.assertRaises(Exception) as context:
            self.network_info.apply_denomination(["not_a_valid_type"], AssetKind.DOT)
        self.assertIn("pls implement me", str(context.exception))

if __name__ == "__main__":
    unittest.main()