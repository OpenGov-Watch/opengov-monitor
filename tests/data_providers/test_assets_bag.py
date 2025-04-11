"""Tests for the AssetsBag class."""
import pytest
from data_providers.assets_bag import AssetsBag
from utils.denomination import AssetKind

@pytest.fixture
def assets_bag():
    return AssetsBag()

def test_add_asset(assets_bag):
    """Test adding assets to the bag."""
    assets_bag.add_asset(AssetKind.DOT, 100.0)
    assets_bag.add_asset(AssetKind.USDC, 200.0)
    
    assert assets_bag.get_asset_amount(AssetKind.DOT) == 100.0
    assert assets_bag.get_asset_amount(AssetKind.USDC) == 200.0
    assert assets_bag.get_asset_amount(AssetKind.USDT) == 0.0

def test_add_asset_negative(assets_bag):
    """Test adding negative amounts."""
    assets_bag.add_asset(AssetKind.DOT, -50.0)
    assert assets_bag.get_asset_amount(AssetKind.DOT) == -50.0

def test_get_asset_amount_nonexistent(assets_bag):
    """Test getting amount for nonexistent asset."""
    assert assets_bag.get_asset_amount(AssetKind.DOT) == 0.0
    assert assets_bag.get_asset_amount(AssetKind.KSM) == 0.0

def test_get_all_assets(assets_bag):
    """Test getting all assets in the bag."""
    assets_bag.add_asset(AssetKind.DOT, 100.0)
    assets_bag.add_asset(AssetKind.USDC, 200.0)
    
    all_assets = assets_bag.get_all_assets()
    assert len(all_assets) == 2
    assert all_assets[AssetKind.DOT] == 100.0
    assert all_assets[AssetKind.USDC] == 200.0

def test_clear(assets_bag):
    """Test clearing the bag."""
    assets_bag.add_asset(AssetKind.DOT, 100.0)
    assets_bag.add_asset(AssetKind.USDC, 200.0)
    
    assets_bag.clear()
    assert assets_bag.get_asset_amount(AssetKind.DOT) == 0.0
    assert assets_bag.get_asset_amount(AssetKind.USDC) == 0.0
    assert len(assets_bag.get_all_assets()) == 0 