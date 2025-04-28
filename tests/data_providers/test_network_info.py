import unittest
from data_providers.network_info import NetworkInfo
from data_providers.asset_kind import AssetKind

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