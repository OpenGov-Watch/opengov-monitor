"""Tests for the PriceService class."""
import pytest
from datetime import datetime
import pandas as pd
from data_providers.price_service import PriceService
from data_providers.network_info import NetworkInfo
from utils.denomination import AssetKind

@pytest.fixture
def network_info():
    return NetworkInfo("polkadot", "subsquare")

@pytest.fixture
def price_service(network_info):
    service = PriceService(network_info)
    # Mock the price data
    service._historic_prices_df = pd.DataFrame({
        'Close': [10.0, 20.0, 30.0]
    }, index=pd.date_range(start='2023-01-01', periods=3, freq='D'))
    service.current_price = 25.0
    return service

def test_convert_asset_value_same_asset(price_service):
    """Test conversion when input and output assets are the same."""
    assert price_service.convert_asset_value(AssetKind.DOT, 100.0, AssetKind.DOT) == 100.0
    assert price_service.convert_asset_value(AssetKind.USDC, 100.0, AssetKind.USDC) == 100.0

def test_convert_asset_value_stable_assets(price_service):
    """Test conversion between stable assets."""
    assert price_service.convert_asset_value(AssetKind.USDC, 100.0, AssetKind.USDT) == 100.0
    assert price_service.convert_asset_value(AssetKind.USDT, 100.0, AssetKind.USDC) == 100.0

def test_convert_asset_value_ded(price_service):
    """Test conversion with DED asset."""
    assert price_service.convert_asset_value(AssetKind.DED, 100.0, AssetKind.USDC) == 0.0
    assert price_service.convert_asset_value(AssetKind.USDC, 100.0, AssetKind.DED) == 0.0

def test_convert_asset_value_historic_price(price_service):
    """Test conversion using historic prices."""
    date = datetime(2023, 1, 2)
    # Using historic price of 20.0
    assert price_service.convert_asset_value(AssetKind.DOT, 100.0, AssetKind.USDC, date) == 2000.0
    assert price_service.convert_asset_value(AssetKind.USDC, 2000.0, AssetKind.DOT, date) == 100.0

def test_convert_asset_value_current_price(price_service):
    """Test conversion using current price."""
    # Using current price of 25.0
    assert price_service.convert_asset_value(AssetKind.DOT, 100.0, AssetKind.USDC) == 2500.0
    assert price_service.convert_asset_value(AssetKind.USDC, 2500.0, AssetKind.DOT) == 100.0

def test_convert_asset_value_invalid_assets(price_service):
    """Test conversion with invalid asset combinations."""
    with pytest.raises(AssertionError, match="Only USD conversions are supported for now"):
        price_service.convert_asset_value(AssetKind.DOT, 100.0, AssetKind.KSM)
    
    with pytest.raises(AssertionError, match="Only conversions to/from the network's native token are supported for now"):
        price_service.convert_asset_value(AssetKind.USDC, 100.0, AssetKind.KSM) 