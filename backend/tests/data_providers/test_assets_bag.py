"""
Tests for AssetsBag class.
"""

import pytest
import math
from unittest.mock import MagicMock

from data_providers.assets_bag import AssetsBag
from data_providers.asset_kind import AssetKind


class TestAssetsBagInit:
    """Tests for AssetsBag initialization."""

    def test_empty_bag(self):
        """An empty bag should have no assets."""
        bag = AssetsBag()
        assert bag.get_amount(AssetKind.DOT) == 0
        assert bag.get_amount(AssetKind.USDC) == 0
        assert not bag.is_nan()

    def test_init_with_assets(self):
        """Bag initialized with assets should contain them."""
        initial = {AssetKind.DOT: 100.0, AssetKind.USDC: 500.0}
        bag = AssetsBag(assets=initial)
        assert bag.get_amount(AssetKind.DOT) == 100.0
        assert bag.get_amount(AssetKind.USDC) == 500.0


class TestAssetsBagAddAsset:
    """Tests for add_asset method."""

    def test_add_single_asset(self):
        """Adding an asset should set its amount."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        assert bag.get_amount(AssetKind.DOT) == 100.0

    def test_add_multiple_assets(self):
        """Adding different assets should set each independently."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.add_asset(AssetKind.USDC, 500.0)
        assert bag.get_amount(AssetKind.DOT) == 100.0
        assert bag.get_amount(AssetKind.USDC) == 500.0

    def test_add_same_asset_accumulates(self):
        """Adding the same asset multiple times should accumulate."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.add_asset(AssetKind.DOT, 50.0)
        assert bag.get_amount(AssetKind.DOT) == 150.0

    def test_add_zero_amount(self):
        """Adding zero should work without error."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 0.0)
        assert bag.get_amount(AssetKind.DOT) == 0.0

    def test_add_fractional_amount(self):
        """Adding fractional amounts should work."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 0.123456789)
        assert bag.get_amount(AssetKind.DOT) == pytest.approx(0.123456789)

    def test_add_requires_float(self):
        """Adding non-float should raise AssertionError."""
        bag = AssetsBag()
        with pytest.raises(AssertionError):
            bag.add_asset(AssetKind.DOT, 100)  # int, not float


class TestAssetsBagRemoveAsset:
    """Tests for remove_asset method."""

    def test_remove_partial_amount(self):
        """Removing partial amount should reduce the balance."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.remove_asset(AssetKind.DOT, 30.0)
        assert bag.get_amount(AssetKind.DOT) == 70.0

    def test_remove_exact_amount_deletes(self):
        """Removing exact amount should delete the asset entry."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.remove_asset(AssetKind.DOT, 100.0)
        assert bag.get_amount(AssetKind.DOT) == 0

    def test_remove_more_than_available_deletes(self):
        """Removing more than available should delete the asset entry."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.remove_asset(AssetKind.DOT, 150.0)
        assert bag.get_amount(AssetKind.DOT) == 0

    def test_remove_nonexistent_raises(self):
        """Removing an asset that doesn't exist should raise ValueError."""
        bag = AssetsBag()
        with pytest.raises(ValueError, match="Asset .* not found"):
            bag.remove_asset(AssetKind.DOT, 50.0)


class TestAssetsBagNaN:
    """Tests for NaN handling."""

    def test_set_nan(self):
        """Setting NaN should mark the bag as invalid."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.set_nan()
        assert bag.is_nan()

    def test_get_amount_returns_nan_when_set(self):
        """get_amount should return NaN when bag is marked NaN."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.set_nan()
        result = bag.get_amount(AssetKind.DOT)
        assert math.isnan(result)

    def test_get_total_value_returns_nan_when_set(self):
        """get_total_value should return NaN when bag is marked NaN."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.set_nan()

        mock_price_service = MagicMock()
        result = bag.get_total_value(mock_price_service, AssetKind.USDC)

        assert math.isnan(result)
        # Price service should not be called when bag is NaN
        mock_price_service.convert_asset_value.assert_not_called()


class TestAssetsBagGetTotalValue:
    """Tests for get_total_value method."""

    def test_single_asset_conversion(self):
        """Total value should convert single asset correctly."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)

        mock_price_service = MagicMock()
        mock_price_service.convert_asset_value.return_value = 750.0

        result = bag.get_total_value(mock_price_service, AssetKind.USDC)

        assert result == 750.0
        mock_price_service.convert_asset_value.assert_called_once_with(
            AssetKind.DOT, 100.0, AssetKind.USDC, None
        )

    def test_multiple_assets_sum(self):
        """Total value should sum all asset conversions."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        bag.add_asset(AssetKind.USDC, 500.0)

        mock_price_service = MagicMock()
        mock_price_service.convert_asset_value.side_effect = [750.0, 500.0]

        result = bag.get_total_value(mock_price_service, AssetKind.USDC)

        assert result == 1250.0

    def test_with_date_parameter(self):
        """Total value should pass date to price service."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)

        mock_price_service = MagicMock()
        mock_price_service.convert_asset_value.return_value = 700.0

        from datetime import datetime
        test_date = datetime(2024, 1, 15)

        result = bag.get_total_value(mock_price_service, AssetKind.USDC, date=test_date)

        assert result == 700.0
        mock_price_service.convert_asset_value.assert_called_once_with(
            AssetKind.DOT, 100.0, AssetKind.USDC, test_date
        )

    def test_empty_bag_returns_zero(self):
        """Empty bag should return zero total value."""
        bag = AssetsBag()

        mock_price_service = MagicMock()

        result = bag.get_total_value(mock_price_service, AssetKind.USDC)

        assert result == 0
        mock_price_service.convert_asset_value.assert_not_called()


class TestAssetsBagRepr:
    """Tests for __repr__ method."""

    def test_repr_empty(self):
        """Empty bag repr should show empty dict."""
        bag = AssetsBag()
        assert repr(bag) == "AssetBag({})"

    def test_repr_with_assets(self):
        """Bag with assets should show them in repr."""
        bag = AssetsBag()
        bag.add_asset(AssetKind.DOT, 100.0)
        assert "DOT" in repr(bag) or "AssetKind.DOT" in repr(bag)
        assert "100.0" in repr(bag)
